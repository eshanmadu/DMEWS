"""Bounded 739-file stage archive, 1–31 August 2026: inspect, acquire, verify, selftest, qa.

Standard library, Python 3.9+, macOS/Windows. Raw files never overwritten.
Reporting/edit proxies are not verified physical measurement timestamps.
Adapted from acquire_ratnapura_stage_sep01_10.py and the month workflow; originals are unchanged.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import hashlib
import json
import math
import os
import statistics
import tempfile
import threading
import time
import urllib.request
import urllib.error
import uuid

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'data/raw/ratnapura_stage_batch_2026-08-01_to_2026-08-31'
REPORT = ROOT / 'outputs/ratnapura_stage_batch_2026-08_qa.md'
COMMIT = '4f47a297db0da993ca8e05ba4bdc422c082add38'
BASE = 'data/rwlds/kalu-ganga-basin/kalu-ganga-river/rathnapura-station/2026/'
API = 'https://api.github.com/repos/nuuuwan/lk_irrigation'
LOCAL = timezone(timedelta(hours=5, minutes=30), 'Asia/Colombo')
DAYS = [(date(2026, 8, 1)+timedelta(days=i)).isoformat() for i in range(31)]
COUNTS = [25, 24, 24, 24, 24, 20, 22, 24, 24, 24, 24, 26, 24, 24, 25, 26, 24, 25, 25, 24, 26, 24, 24, 24, 24, 24, 20, 18, 24, 25, 24]
SIZES = [2096, 2013, 2013, 2013, 2013, 1679, 1846, 2015, 2015, 2013, 2014, 2181, 2011, 2015, 2096, 2184, 2012, 2100, 2098, 2013, 2184, 2010, 2011, 2014, 2014, 2013, 1676, 1512, 2015, 2097, 2013]
TREES = {'2026-08': 'e1bf0b5cac15368a38250a05aaa00e40e8ad1ba9'}
LOG_LOCK = threading.Lock()
PACE_LOCK = threading.Lock()
NEXT_START = 0.0


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(body):
    return hashlib.sha256(body).hexdigest()


def blob(body):
    return hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()


def event(kind, **data):
    with LOG_LOCK:
        with (DEST/'events.jsonl').open('a', encoding='utf-8') as f:
            f.write(json.dumps(dict(event=kind, logged_utc=now(), **data))+'\n')
            f.flush()
            os.fsync(f.fileno())


def publish(part, final):
    """Atomic no-clobber publication (hard links: macOS/Windows NTFS).

    If unsupported, stop with both paths intact; never fall back to overwrite.
    Only a verified, successfully published staging link is removed.
    """
    os.link(str(part), str(final))
    part.unlink()


def json_new(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    part=path.with_name(path.name+'.part')
    encoded=(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False)+'\n').encode()
    if path.exists():
        if path.read_bytes()!=encoded: raise RuntimeError('Refusing different existing metadata: '+str(path))
        return
    if part.exists():
        if part.read_bytes()!=encoded: raise RuntimeError('Unreconciled metadata staging file: '+str(part))
    else:
        with part.open('xb') as f:
            f.write(encoded);f.flush();os.fsync(f.fileno())
    publish(part,path)


def checkpoint(value):
    """Only this run-owned progress summary is replaced, never raw data."""
    p=DEST/'checkpoint.json';tmp=DEST/('checkpoint.'+uuid.uuid4().hex+'.tmp')
    with tmp.open('x',encoding='utf-8') as f:
        json.dump(value,f,indent=2);f.flush();os.fsync(f.fileno())
    os.replace(str(tmp),str(p))


def request(url, limit, label):
    global NEXT_START
    for attempt in range(1,4):
        with PACE_LOCK:
            time.sleep(max(0,NEXT_START-time.monotonic()))
            NEXT_START=time.monotonic()+0.75
        started=now()
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Cascade-bounded-stage-batch/1.0','Accept-Encoding':'identity'})
            with urllib.request.urlopen(req,timeout=30) as r:
                body=r.read(limit+1)
                if len(body)>limit:raise RuntimeError('Response exceeds bounded size: '+label)
                entry={'url':url,'final_url':r.url,'request_started_utc':started,'retrieved_utc':now(),
                       'status':r.status,'bytes':len(body),'sha256':sha(body),
                       'headers':{k:r.headers[k] for k in ['ETag','Last-Modified','Retry-After','X-RateLimit-Remaining','X-RateLimit-Reset'] if r.headers.get(k)}}
            event('http_success',label=label,attempt=attempt,**entry)
            return body,entry
        except (urllib.error.URLError,TimeoutError,OSError) as exc:
            code=getattr(exc,'code',None)
            event('http_failure',label=label,url=url,attempt=attempt,request_started_utc=started,error=str(exc),status=code)
            # Authorization/access errors and rate limits stop for review; no bypass.
            transient=code in [408,500,502,503,504] or code is None
            if not transient or attempt==3:raise
            delay=2**attempt
            header=getattr(exc,'headers',None)
            if header and header.get('Retry-After'):
                try:delay=max(delay,float(header['Retry-After']))
                except ValueError:raise RuntimeError('Non-numeric Retry-After; stop for review') from exc
            if delay>30:raise RuntimeError('Server requests a longer pause; resume later') from exc
            event('retry_backoff',label=label,seconds=delay)
            time.sleep(delay)


def metadata(name,url,limit):
    p=DEST/'source_index'/name;receipt=p.with_suffix(p.suffix+'.receipt.json')
    if p.exists():
        b=p.read_bytes()
        if not receipt.exists():raise RuntimeError('Metadata orphan: stop for provenance review '+str(p))
        r=json.loads(receipt.read_text())
        if r['url']!=url or len(b)!=r['bytes'] or sha(b)!=r['sha256']:raise RuntimeError('Metadata integrity mismatch')
        return json.loads(b)
    b,r=request(url,limit,name)
    # Metadata final is published before its receipt: orphan stops rather than guesses.
    p.parent.mkdir(parents=True,exist_ok=True)
    part=p.with_name(p.name+'.part')
    if part.exists():raise RuntimeError('Metadata staging file requires review')
    with part.open('xb') as f:f.write(b);f.flush();os.fsync(f.fileno())
    publish(part,p);json_new(receipt,r)
    return json.loads(b)


def inspect():
    DEST.mkdir(parents=True,exist_ok=True)
    months=metadata('year_2026.json',API+'/contents/'+BASE.rstrip('/')+'?ref='+COMMIT,100000)
    selected=[]
    for month,expected_tree in TREES.items():
        m=next(x for x in months if x['name']==month)
        if m['sha']!=expected_tree or m['type']!='dir':raise RuntimeError('Pinned month tree differs from preflight')
        tree=metadata(month+'_tree.json',API+'/git/trees/'+expected_tree+'?recursive=1',700000)
        if tree['sha']!=expected_tree or tree.get('truncated') is not False:raise RuntimeError('Incomplete or incorrect tree')
        for x in tree['tree']:
            day=x['path'].split('/')[0]
            if day not in DAYS or x['type']=='tree':continue
            name=x['path'].split('/')[-1]
            stamp=datetime.strptime(name,'%Y-%m-%d-%H-%M-%S.json')
            if x['type']!='blob' or x.get('mode')!='100644' or len(x['path'].split('/'))!=2 or stamp.date().isoformat()!=day or not 0<x['size']<=10000:
                raise RuntimeError('Unexpected source identity: '+x['path'])
            source=BASE+month+'/'+x['path']
            selected.append({'day':day,'name':name,'path':'observations/'+day+'/'+name,'source_path':source,
                             'url':'https://raw.githubusercontent.com/nuuuwan/lk_irrigation/'+COMMIT+'/'+source,
                             'git_blob_sha1':x['sha'],'bytes':x['size'],'source_revision':COMMIT,
                             'filename_timestamp_string':name[:-5],
                             'filename_reporting_local':stamp.replace(tzinfo=LOCAL).isoformat()})
    selected.sort(key=lambda x:x['path'])
    if len(selected)!=739 or len({x['path'] for x in selected})!=739:raise RuntimeError('Expected exactly 739 unique paths')
    for day,n,size in zip(DAYS,COUNTS,SIZES):
        xs=[x for x in selected if x['day']==day]
        if len(xs)!=n or sum(x['bytes'] for x in xs)!=size:raise RuntimeError('Daily index differs from preflight: '+day)
    json_new(DEST/'source_index/approved_records.json',{'commit':COMMIT,'timezone':'Asia/Colombo','days':DAYS,'expected_records':739,'expected_body_bytes':61999,'records':selected})
    print('INDEX PASS: 739 files / 61,999 bytes / exact 31-day approved August index agreement',flush=True)
    return selected


def index():
    d=json.loads((DEST/'source_index/approved_records.json').read_text())
    if d['commit']!=COMMIT or d['days']!=DAYS or len(d['records'])!=739:raise RuntimeError('Index scope mismatch')
    # Re-derive from preserved, checked trees on every acquisition restart.
    return inspect()


def valid_body(body,item):
    if len(body)!=item['bytes'] or blob(body)!=item['git_blob_sha1']:
        raise RuntimeError('Raw bytes/blob mismatch; preserving file: '+item['path'])


def receipt_for(item,body):
    directory=DEST/'receipts'/item['day'];directory.mkdir(parents=True,exist_ok=True)
    # Reconcile complete receipt staging files; partial/suspicious ones stop.
    for part in directory.glob(item['name']+'.*.json.part'):
        try:r=json.loads(part.read_text())
        except Exception as exc:raise RuntimeError('Incomplete receipt staging; review '+str(part)) from exc
        if r.get('url')!=item['url'] or r.get('source_revision')!=COMMIT or r.get('git_blob_sha1')!=item['git_blob_sha1'] or r.get('sha256')!=sha(body):
            raise RuntimeError('Suspicious staged receipt; preserving '+str(part))
        final=part.with_name(part.name[:-5])
        if final.exists():
            if final.read_bytes()!=part.read_bytes():raise RuntimeError('Conflicting staged receipt')
            part.unlink();event('verified_staging_cleanup',path=str(part.relative_to(DEST)))
        else:publish(part,final);event('receipt_recovered',path=str(final.relative_to(DEST)))
    entries=[]
    for p in directory.glob(item['name']+'.*.json'):
        r=json.loads(p.read_text())
        if r.get('url')!=item['url'] or r.get('source_revision')!=COMMIT or r.get('git_blob_sha1')!=item['git_blob_sha1'] or r.get('sha256')!=sha(body) or r.get('bytes')!=len(body):
            raise RuntimeError('Receipt mismatch: '+str(p))
        entries.append(r)
    if entries:return sorted(entries,key=lambda r:r.get('retrieved_utc') or '9999')[0]
    # Identity is verified from the pinned index; never fabricate retrieval history.
    r=dict(item,sha256=sha(body),retrieved_utc=None,request_started_utc=None,
           recovery='Orphan verified against pinned blob; original retrieval time unavailable',reconciled_utc=now())
    json_new(directory/(item['name']+'.recovered.'+uuid.uuid4().hex+'.json'),r)
    event('orphan_reconciled',path=item['path'],retrieval_time_unknown=True)
    return r


def ensure_record(item,network=True):
    p=DEST/item['path'];part=p.with_name(p.name+'.part')
    if p.exists():
        body=p.read_bytes();valid_body(body,item);r=receipt_for(item,body)
        if part.exists():
            valid_body(part.read_bytes(),item)
            part.unlink();event('verified_staging_cleanup',path=item['path']+'.part')
        return r,'reused'
    if part.exists():
        body=part.read_bytes();valid_body(body,item);r=receipt_for(item,body)
        publish(part,p);event('raw_staging_recovered',path=item['path'])
        return r,'recovered'
    if not network:raise RuntimeError('Missing expected raw file: '+item['path'])
    body,r=request(item['url'],10000,item['path']);valid_body(body,item)
    r.update(source_revision=COMMIT,git_blob_sha1=item['git_blob_sha1'],path=item['path'])
    json_new(DEST/'receipts'/item['day']/(item['name']+'.'+uuid.uuid4().hex+'.json'),r)
    p.parent.mkdir(parents=True,exist_ok=True)
    with part.open('xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
    publish(part,p)
    return r,'downloaded'


def acquire(limit=None):
    items=index();chosen=items if limit is None else items[:limit]
    event('acquisition_started',selected=len(chosen),workers=2,min_request_start_seconds=0.75)
    outcomes=Counter();completed=0
    # Two tasks at a time avoids an unbounded queue after a failure.
    with ThreadPoolExecutor(max_workers=2) as pool:
        for offset in range(0,len(chosen),2):
            jobs=[pool.submit(ensure_record,x) for x in chosen[offset:offset+2]]
            for job in as_completed(jobs):
                _,state=job.result();outcomes[state]+=1;completed+=1
            if completed%20==0 or completed==len(chosen):
                checkpoint({'status':'partial' if len(chosen)<739 else 'in_progress','commit':COMMIT,'checked_this_run':completed,'expected':739,'outcomes':dict(outcomes),'updated_utc':now()})
                print('PROGRESS',completed,'/',len(chosen),dict(outcomes),flush=True)
    if limit is not None and limit<739:
        event('controlled_pause',verified_this_run=completed);return
    records=[]
    for item in items:
        r,_=ensure_record(item,network=False);records.append(dict(item,sha256=r['sha256'],retrieved_utc=r.get('retrieved_utc'),request_started_utc=r.get('request_started_utc'),recovery=r.get('recovery')))
    manifest={'status':'complete_verified','commit':COMMIT,'repository':'https://github.com/nuuuwan/lk_irrigation','days':DAYS,'timezone':'Asia/Colombo','offset':'+05:30','expected_records':739,'verified_records':739,'raw_body_bytes':sum(x['bytes'] for x in records),'records':records,
              'timestamp_semantics':'time_ut is upstream EditDate floored to epoch seconds; not verified measurement time',
              'station':'Rathnapura / Kalu Ganga; official 003HD007 crosswalk unverified','units':'source-labelled metres; datum unverified; not discharge',
              'upstream_ids':'Retain if present; absent IDs are unknown, not inferred from timestamps. No enrichment requested.',
              'licensing':'MIT repository code; underlying observation reuse rights remain unresolved',
              'generated_utc':now(),'limitations':'Exploratory only, not training-ready; no rainfall, interpolation, merging or filtering'}
    if (DEST/'manifest.json').exists():
        old=json.loads((DEST/'manifest.json').read_text())
        if old['records']!=records or old['commit']!=COMMIT:raise RuntimeError('Refusing conflicting completed manifest')
    else:json_new(DEST/'manifest.json',manifest)
    checkpoint({'status':'complete_verified','commit':COMMIT,'verified_records':739,'updated_utc':now(),'outcomes_this_run':dict(outcomes)})
    event('acquisition_complete',verified=739,outcomes=dict(outcomes));print('COMPLETE: 739 verified records',flush=True)


def verify():
    items=index();m=json.loads((DEST/'manifest.json').read_text())
    if m['commit']!=COMMIT or m.get('verified_records')!=739 or len(m['records'])!=739:raise RuntimeError('Incomplete manifest')
    bypath={x['path']:x for x in m['records']}
    if set(bypath)!={x['path'] for x in items}:raise RuntimeError('Manifest path mismatch')
    for x in items:
        b=(DEST/x['path']).read_bytes();valid_body(b,x)
        for k in ['url','source_revision','git_blob_sha1','bytes']:
            if bypath[x['path']][k]!=x[k]:raise RuntimeError('Manifest identity mismatch')
        if sha(b)!=bypath[x['path']]['sha256']:raise RuntimeError('SHA-256 mismatch')
    actual={str(p.relative_to(DEST)) for p in (DEST/'observations').rglob('*') if p.is_file()}
    if actual!=set(bypath):raise RuntimeError('Unexpected/missing observation file')
    print('VERIFY PASS: 739 byte counts, SHA-256, Git blobs, URLs and source identities',flush=True)
    return items,m


def number(v):
    return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)


def summary(rows):
    ts=sorted([x for x in rows if number(x['report_epoch'])],key=lambda x:x['report_epoch'])
    vals=[x['stage_raw'] for x in rows if number(x['stage_raw'])]
    pairs=[]
    for a,b in zip(ts,ts[1:]):
        pairs.append({'from_path':a['raw_path'],'to_path':b['raw_path'],'from':a['report_local'],'to':b['report_local'],'minutes':(b['report_epoch']-a['report_epoch'])/60,'from_stage':a['stage_raw'],'to_stage':b['stage_raw'],'change_m':b['stage_raw']-a['stage_raw'] if number(a['stage_raw']) and number(b['stage_raw']) else None})
    groups=defaultdict(list);ids=defaultdict(list)
    for x in rows:
        if number(x['report_epoch']):groups[x['report_epoch']].append(x)
        for field,value in x['upstream_ids'].items():
            if value is not None:ids[(field,str(value))].append(x)
    changes=[x for x in pairs if number(x['change_m'])]
    intervals=[x['minutes'] for x in pairs]
    return {'indexed':len(rows),'downloaded_verified':len(rows),'finite_stage':len(vals),'missing_stage_field':sum(not x['stage_present'] for x in rows),'null_stage':sum(x['stage_present'] and x['stage_raw'] is None for x in rows),'invalid_stage':len(rows)-len(vals),'invalid_reporting_timestamp':len(rows)-len(ts),
            'span_local':[ts[0]['report_local'],ts[-1]['report_local']] if ts else None,'stage_range_m':[min(vals),max(vals)] if vals else None,
            'interval_minutes':{'min':min(x['minutes'] for x in pairs),'median':statistics.median(x['minutes'] for x in pairs),'max':max(x['minutes'] for x in pairs)} if pairs else None,
            'interval_distribution':{'pairs':len(intervals),'quartiles_minutes':statistics.quantiles(intervals,n=4,method='inclusive') if len(intervals)>=2 else None,
                'bins':{'0_to_5_min':sum(0<=v<=5 for v in intervals),'over_5_to_30_min':sum(5<v<=30 for v in intervals),'over_30_to_90_min':sum(30<v<=90 for v in intervals),'over_90_min':sum(v>90 for v in intervals)}},
            'gaps_over_90_minutes':[x for x in pairs if x['minutes']>90],'close_events_at_most_5_minutes':[x for x in pairs if x['minutes']<=5],
            'largest_positive_change':max([x for x in changes if x['change_m']>0],key=lambda x:x['change_m'],default=None),'largest_negative_change':min([x for x in changes if x['change_m']<0],key=lambda x:x['change_m'],default=None),
            'consecutive_identical_values':sum(x['change_m']==0 for x in changes),'duplicate_reporting_timestamps':sum(len(v)-1 for v in groups.values()),
            'conflicting_timestamp_groups':[{'epoch':k,'paths':[x['raw_path'] for x in v],'values':[x['stage_raw'] for x in v]} for k,v in groups.items() if len({str(x['stage_raw']) for x in v})>1],
            'rows_with_upstream_ids':sum(bool(x['upstream_ids']) for x in rows),'repeated_upstream_ids':[{'field':k[0],'id':k[1],'paths':[x['raw_path'] for x in v],'conflicting_values':len({str(x['stage_raw']) for x in v})>1} for k,v in ids.items() if len(v)>1],
            'filename_day_conflicts':sum(x['filename_or_day_conflict'] for x in rows),'station_conflicts':sum(x['station_raw']!='Rathnapura' for x in rows),
            'nonmonotonic_filename_order':sum(b['report_epoch']<=a['report_epoch'] for a,b in zip(rows,rows[1:]) if number(a['report_epoch']) and number(b['report_epoch'])),
            'verified_physical_measurement_times':0}


def qa():
    items,m=verify();rows=[]
    for x in items:
        d=json.loads((DEST/x['path']).read_bytes());t=d.get('time_ut');good=number(t)
        dt=datetime.fromtimestamp(t,timezone.utc).astimezone(LOCAL) if good else None
        fields={k:v for k,v in d.items() if k.lower() in ['objectid','globalid','measurement_id','event_id','edit_id'] and v is not None}
        rows.append({'raw_path':x['path'],'source_url':x['url'],'station_raw':d.get('station_name'),'raw_time_ut':t,'original_timestamp_string':t if isinstance(t,str) else None,
                     'filename_timestamp_string':x['filename_timestamp_string'],
                     'git_blob_sha1':x['git_blob_sha1'],'source_revision':COMMIT,'source_path':x['source_path'],
                     'raw_sha256':sha((DEST/x['path']).read_bytes()),'report_epoch':t if good else None,'report_local':dt.isoformat() if dt else None,'measurement_time':None,'stage_present':'water_level_m' in d,'stage_raw':d.get('water_level_m'),'units':'m, source convention; datum unverified','upstream_ids':fields,'raw_fields':list(d),
                     'filename_or_day_conflict':not good or dt.date().isoformat()!=x['day'] or datetime.strptime(x['name'],'%Y-%m-%d-%H-%M-%S.json').replace(tzinfo=LOCAL).timestamp()!=t})
    daily={d:summary([x for x in rows if x['raw_path'].split('/')[1]==d]) for d in DAYS}
    result={'status':'Exploratory, not training-ready','daily':daily,'overall':summary(rows),'rows':rows,
            'boundary_continuity':boundary_check(rows)}
    json_new(DEST/'exploratory_qa.json',result)
    report(result,m)
    print('QA COMPLETE',json.dumps({k:v for k,v in result['overall'].items() if k not in ['gaps_over_90_minutes','close_events_at_most_5_minutes']}),flush=True)


def selftest():
    """Exercise crash recovery using a copy of one real approved record only."""
    global DEST
    original=DEST;items=index();item=items[0];body=(DEST/item['path']).read_bytes();tests=[]
    with tempfile.TemporaryDirectory(prefix='ratnapura-resume-') as temp:
        DEST=Path(temp)
        try:
            p=DEST/item['path'];p.parent.mkdir(parents=True);p.write_bytes(body)
            r,state=ensure_record(item,network=False)
            assert state=='reused' and r['retrieved_utc'] is None and r.get('recovery')
            tests.append('PASS: valid orphan reconciled using pinned blob; retrieval time kept unknown')
            before=sha(p.read_bytes());ensure_record(item,network=False);assert sha(p.read_bytes())==before
            tests.append('PASS: verified existing file reused without network or mutation')
            part=p.with_name(p.name+'.part');p.rename(part)
            _,state=ensure_record(item,network=False);assert state=='recovered' and p.read_bytes()==body
            tests.append('PASS: complete raw staging file recovered atomically')
            p.write_bytes(b'invalid')
            try:ensure_record(item,network=False)
            except RuntimeError:pass
            else:raise AssertionError('Corrupt file accepted')
            assert p.read_bytes()==b'invalid'
            tests.append('PASS: corrupt raw file rejected and preserved')
            p.write_bytes(body)
            receipts=list((DEST/'receipts').rglob('*.json'));r=json.loads(receipts[0].read_text());r['sha256']='incorrect';receipts[0].write_text(json.dumps(r))
            try:ensure_record(item,network=False)
            except RuntimeError:pass
            else:raise AssertionError('Invalid receipt accepted')
            assert p.read_bytes()==body
            tests.append('PASS: conflicting receipt rejected; raw file preserved')
        finally:DEST=original
    json_new(DEST/'resumability_tests.json',{'tests':tests,'fixture':'Temporary copies of first approved raw record; not synthetic training data','network_requests':0})
    print('\n'.join(tests),flush=True)



def boundary_check(rows):
    """Read-only comparison, not a merge; reverify all 246 neighbouring bodies."""
    other=ROOT/'data/raw/ratnapura_stage_batch_2026-09-01_to_2026-09-10'
    m=json.loads((other/'manifest.json').read_text())
    if m['verified_records']!=246 or len(m['records'])!=246:raise RuntimeError('Neighbour manifest incomplete')
    known=[]
    for entry in m['records']:
        body=(other/entry['path']).read_bytes()
        if len(body)!=entry['bytes'] or sha(body)!=entry['sha256'] or blob(body)!=entry['git_blob_sha1']:
            raise RuntimeError('Existing neighbour integrity failure: '+entry['path'])
        raw=json.loads(body)
        if not number(raw.get('time_ut')) or not number(raw.get('water_level_m')):raise RuntimeError('Neighbour time/stage invalid')
        known.append({'source_path':entry['source_path'],'raw_path':entry['path'],'source_url':entry['url'],
                      'epoch':raw['time_ut'],'stage':raw['water_level_m'],'sha256':entry['sha256'],
                      'report_local':datetime.fromtimestamp(raw['time_ut'],timezone.utc).astimezone(LOCAL).isoformat()})
    last=max((x for x in rows if number(x['report_epoch'])),key=lambda x:x['report_epoch'])
    first=min(known,key=lambda x:x['epoch'])
    overlap=sorted({x['report_epoch'] for x in rows if number(x['report_epoch'])}&{x['epoch'] for x in known})
    conflicts=[{'report_epoch':t,'new_values':[x['stage_raw'] for x in rows if x['report_epoch']==t],
                'existing_values':[x['stage'] for x in known if x['epoch']==t]} for t in overlap
               if len({str(x['stage_raw']) for x in rows if x['report_epoch']==t}|{str(x['stage']) for x in known if x['epoch']==t})>1]
    delta=first['epoch']-last['report_epoch']
    return {'status':'Read-only endpoint comparison; no merge','existing_revision':m['commit'],'existing_records_reverified':246,
            'existing_manifest_sha256':sha((other/'manifest.json').read_bytes()),
            'final_batch_report':{'source_path':last['source_path'],'raw_path':last['raw_path'],'source_url':last['source_url'],
                                  'report_local':last['report_local'],'epoch':last['report_epoch'],'stage':last['stage_raw'],'sha256':last['raw_sha256']},
            'first_existing_report':first,'reporting_interval_seconds':delta,'reporting_interval_minutes':delta/60,
            'stage_difference_m':first['stage']-last['stage_raw'],'crosses_gap_over_90_minutes':delta>5400,
            'overlapping_reporting_timestamps':overlap,'same_timestamp_value_conflicts':conflicts,
            'overlapping_source_paths':sorted({x['source_path'] for x in rows}&{x['source_path'] for x in known})}


def report(result,manifest):
    overall=result['overall'];daily=result['daily'];boundary=result['boundary_continuity']
    events=[json.loads(x) for x in (DEST/'events.jsonl').read_text().splitlines()]
    success=[x for x in events if x['event']=='http_success'];failures=[x for x in events if x['event']=='http_failure']
    raw_success=[x for x in success if x['label'].startswith('observations/')]
    actions=[x for x in events if x['event'] in ['retry_backoff','controlled_pause','orphan_reconciled','raw_staging_recovered','receipt_recovered']]
    tests=json.loads((DEST/'resumability_tests.json').read_text())
    def change(x):
        return f"{x['change_m']:+.4f} m; {x['from']} → {x['to']}; {x['minutes']:.3f} min" if x else 'None'
    lines=['# Rathnapura stage batch QA — 1–31 August 2026', '',
        '**Status:** Exploratory stage-only archive QA; not training-ready. No verified physical measurement timestamps.',
        '**QA date (UTC):** '+now(), '',
        '## 1. Source, scope and authoritative files', '',
        f"Source: [nuuuwan/lk_irrigation](https://github.com/nuuuwan/lk_irrigation), pinned revision **`{COMMIT}`**. Exactly **739 indexed / 739 downloaded / 739 verified** original observation bodies for the 31 approved Sri Lanka local dates. Total original body size **61,999 bytes**. Two pinned metadata responses (2026 station-year directory and August recursive tree) were saved with provenance; the month tree is untruncated. No observation outside 1–31 August was requested.", '',
        'New folder: `ML-Service/data/raw/ratnapura_stage_batch_2026-08-01_to_2026-08-31/`. Its `source_index/approved_records.json` preserves all exact source paths, Git blob IDs, indexed sizes, source revision and filename-derived reporting strings. Raw bodies are under `observations/`; immutable response receipts are under `receipts/`. The completed `manifest.json`, `checkpoint.json` and `events.jsonl` distinguish verified completion, request attempts and retrieval provenance.', '',
        'Original values/timestamps come from raw JSON, not filename inference. The exploratory QA retains `raw_time_ut`, source path/revision/blob/SHA-256, parsed local reporting time, source-labelled metre values and any actual upstream object/global/event IDs. Raw `time_ut` is an epoch number: **where no original textual timestamp field exists, `original_timestamp_string` is null**, not a fabricated date string. The filename timestamp string is separately identified as such.', '',
        '## 2. Daily counts and intervals', '',
        '| Local date | Indexed / downloaded / verified | Finite stages | Missing field / null / invalid total | Reporting span, local | Median / maximum interval (min) | >90 min gaps | ≤5 min pairs | Stage range (source m) |',
        '|---|---|---:|---|---|---|---:|---:|---|']
    for d,x in daily.items():
        span=x['span_local'];it=x['interval_minutes'];v=x['stage_range_m']
        lines.append(f"| {d} | {x['indexed']} / {x['downloaded_verified']} / {x['downloaded_verified']} | {x['finite_stage']} | {x['missing_stage_field']} / {x['null_stage']} / {x['invalid_stage']} | {span[0][11:19]}–{span[1][11:19]} | {it['median']:.3f} / {it['max']:.3f} | {len(x['gaps_over_90_minutes'])} | {len(x['close_events_at_most_5_minutes'])} | {v[0]}–{v[1]} |")
    lines += ['', 'Daily intervals exclude overnight transitions; the overall analysis includes them. Daily counts are archived reports, not an assumed 24 physical measurements.', '',
        '## 3. Overall stage and reporting QA', '', '| Measure | Result |', '|---|---|',
        f"| Indexed/downloaded/verified | {overall['indexed']} / {overall['downloaded_verified']} / {overall['downloaded_verified']} |",
        f"| Finite stage readings | {overall['finite_stage']} |",
        f"| Missing field / null / invalid total | {overall['missing_stage_field']} / {overall['null_stage']} / {overall['invalid_stage']} |",
        f"| Reporting-time span, Asia/Colombo | {overall['span_local']} |",
        f"| Stage minimum/maximum, source metres | {overall['stage_range_m']} |",
        f"| Interval min / median / max, minutes | {overall['interval_minutes']} |",
        f"| Interval Q1 / median / Q3, minutes (inclusive quartiles) | {overall['interval_distribution']['quartiles_minutes']} |",
        f"| Interval bin counts | {overall['interval_distribution']['bins']} |",
        f"| Reporting gaps >90 minutes | {len(overall['gaps_over_90_minutes'])} |",
        f"| Close consecutive reporting pairs, 0–300 seconds inclusive | {len(overall['close_events_at_most_5_minutes'])} |",
        f"| Largest positive consecutive report change | {change(overall['largest_positive_change'])} |",
        f"| Largest negative consecutive report change | {change(overall['largest_negative_change'])} |",
        f"| Consecutive identical-stage pairs | {overall['consecutive_identical_values']} |",
        f"| Duplicate reporting timestamps | {overall['duplicate_reporting_timestamps']} |",
        f"| Same-timestamp value conflict groups | {len(overall['conflicting_timestamp_groups'])} |",
        f"| Invalid timestamps / filename-date conflicts / station conflicts | {overall['invalid_reporting_timestamp']} / {overall['filename_day_conflicts']} / {overall['station_conflicts']} |",
        f"| Non-monotonic/equal timestamps in filename order | {overall['nonmonotonic_filename_order']} |",
        f"| Rows exposing upstream IDs | {overall['rows_with_upstream_ids']} |", '',
        'Stage values, unusually close reports and large changes were all retained. A reporting gap does not establish missing physical measurements. A large stage difference is not independently verified as a hydrological event. No interpolation, smoothing, deduplication, resampling or discharge conversion occurred.', '',
        '### All reporting gaps greater than 90 minutes', '',
        '| From, local | To, local | Minutes | Stage A / B (m) |', '|---|---|---:|---|']
    for x in overall['gaps_over_90_minutes']:
        lines.append(f"| {x['from']} | {x['to']} | {x['minutes']:.3f} | {x['from_stage']} / {x['to_stage']} |")
    lines += ['', '### All close reporting pairs within five minutes', '',
        '| First report, local | Next report, local | Seconds | Stage A / B (m) | Difference (m) |', '|---|---|---:|---|---:|']
    for x in overall['close_events_at_most_5_minutes']:
        delta=f"{x['change_m']:+.4f}" if number(x['change_m']) else 'Unavailable'
        lines.append(f"| {x['from']} | {x['to']} | {x['minutes']*60:.3f} | {x['from_stage']} / {x['to_stage']} | {delta} |")
    lines += ['',
        'These are review flags, not a rule declaring two submissions independent measurements or revisions. The [record revision review](ratnapura_record_revision_review.md) shows why distinct reporting records can remain unresolved at measurement level. Upstream IDs are preserved only if actually present; **absent IDs make repeated upstream-ID and ID-based conflict assessment unavailable**, not proven zero.',
        'Observed repeated-ID groups among supplied IDs: '+json.dumps(overall['repeated_upstream_ids']),
        'Observed same-reporting-timestamp conflicts: '+json.dumps(overall['conflicting_timestamp_groups']),
        'Actual raw field sets: '+json.dumps(sorted({tuple(sorted(x['raw_fields'])) for x in result['rows']})), '',
        '### Daily changes, repeats and identity checks', '',
        '| Date | Largest rise | Largest fall | Consecutive identical pairs | Duplicate times / value conflicts | Rows with upstream IDs |', '|---|---|---|---:|---|---:|']
    for d,x in daily.items():
        lines.append(f"| {d} | {change(x['largest_positive_change'])} | {change(x['largest_negative_change'])} | {x['consecutive_identical_values']} | {x['duplicate_reporting_timestamps']} / {len(x['conflicting_timestamp_groups'])} | {x['rows_with_upstream_ids']} |")
    a=boundary['final_batch_report'];b=boundary['first_existing_report']
    lines += ['', '## 4. August–September boundary continuity', '',
        'The existing 1–10 September dataset was read locally only. All **246 existing bodies** were reverified against its original manifest byte sizes, SHA-256 and Git blob identities before selecting the earliest reporting event. No adjacent-day observation was reacquired, and neither raw folder was merged or modified.', '',
        '| Endpoint | Local reporting/edit proxy | Stage (source m) | Source file identity |', '|---|---|---:|---|',
        f"| Final new-batch event | {a['report_local']} | {a['stage']} | `{a['source_path']}` |",
        f"| First existing event | {b['report_local']} | {b['stage']} | `{b['source_path']}` |", '',
        f"- Reporting interval: **{boundary['reporting_interval_seconds']} seconds / {boundary['reporting_interval_minutes']:.6f} minutes**.",
        f"- Stage difference (1 September minus 31 August): **{boundary['stage_difference_m']:+.4f} m**.",
        f"- Cross-boundary reporting gap >90 minutes: **{boundary['crosses_gap_over_90_minutes']}**.",
        '- Overlapping reporting timestamps: '+json.dumps(boundary['overlapping_reporting_timestamps']),
        '- Conflicting values at overlapping reporting timestamps: '+json.dumps(boundary['same_timestamp_value_conflicts']),
        '- Overlapping exact source paths: '+json.dumps(boundary['overlapping_source_paths']),
        f"- Existing manifest revision retained: `{boundary['existing_revision']}`; new batch revision: `{COMMIT}`.",
        '- Existing-manifest SHA-256: `'+boundary['existing_manifest_sha256']+'`.', '',
        'This establishes reporting-time/level continuity only under source conventions, not a verified physical measurement interval or stable vertical datum. Boundary identities and checksums are retained in `exploratory_qa.json`; no consolidated training table was created.', '',
        '## 5. Integrity, acquisition and recovery', '',
        'All **739 original bodies** passed indexed size and Git blob SHA-1 verification during acquisition, then SHA-256, size, source URL/revision/blob and complete file-set verification before completion. The pinned index matched 739 expected paths, 31 daily counts and 61,999 indexed bytes. Any mismatch would stop acquisition rather than substitute another revision. No unexpected record filename/source identity was accepted.', '',
        f"Successful HTTP responses: **{len(success)}**, including **{len(raw_success)} observation responses** and two metadata responses. Total successful response-body bytes: **{sum(x['bytes'] for x in success):,}**. Logged failed attempts: **{len(failures)}**.", '',
        'Failed request details:', '', '```json',json.dumps(failures,indent=2),'```', '',
        'Backoff/pause/recovery actions:', '', '```json',json.dumps(actions,indent=2),'```', '',
        'All failed attempts and backoff actions, if any, are shown above; network failures are not archive reporting gaps. Acquisition deliberately paused after eight records; restart revalidated and reused those records without duplicate body downloads. No full archive, other station or rainfall endpoint was requested.', '',
        'Atomic no-clobber raw publication, durable receipts, checksum/blob revalidation and stop-on-mismatch behavior are reused from `acquire_ratnapura_stage_month.py`; that original script was not edited. Valid orphan recovery preserves unknown original retrieval time rather than inventing it. Ambiguous/corrupt raw or receipt states are preserved and stop. Metadata orphan cases fail closed for review. The workflow does not claim protection against every possible power-loss/filesystem failure.', '',
        'Five offline tests on temporary copies of one already acquired real observation passed, without changing any source record or making network requests:', '']
    lines += ['- '+x for x in tests['tests']]
    elapsed=(datetime.fromisoformat(raw_success[-1]['retrieved_utc'])-datetime.fromisoformat(raw_success[0]['request_started_utc'])).total_seconds()
    lines += ['',f'Raw acquisition span including the deliberate pause/tests: **{elapsed:.2f} seconds**. Two workers share a minimum 0.75-second request-start interval. Windows paths/APIs are supported in the code, but this run and recovery tests executed on macOS; Windows execution was not tested.', '',
        '## 6. Limitations and next batch', '',
        'The public label Rathnapura / Kalu Ganga is not a verified crosswalk to official station 003HD007. Gauge datum, relocation/offset history, physical measurement clocks, historical first availability and revision semantics remain unverified. `time_ut` follows the archive reporting/edit-time convention; neither filenames, retrieval times nor Git dates establish measurement time. Repeated/close records are not automatically independent physical observations.', '',
        'This is reproducible exploratory archive evidence, not training-ready data, a validated flood-event catalogue, a forecast or a causal cascade model. Public access does not by itself settle official-data redistribution rights; preserve source attribution and the existing licence caveats. All remaining anomalies need transparent flags rather than arbitrary filtering.', '',
        '**Next-batch assessment:** a separately approved bounded July 2026 stage-only acquisition is justified if this batch’s checks pass. The prior plan lists 747 July files at the same frozen revision. Any future acquisition must verify that count before downloading; this task does not reverify July or authorize its downloads.', '',
        '**One smallest next step:** review this QA report and approve, if satisfactory, a separate **1–31 July 2026 acquisition of 747 records** at the same frozen revision, with mandatory index verification and the existing integrity/recovery safeguards. Do not start it or update the dashboard during this task.', '',
        '## 7. Reproduction and changed files', '',
        'New script: `ML-Service/src/acquire_ratnapura_stage_aug2026.py`, adapted from the existing month workflow, standard library only. No package installation. Phases: `inspect`, `acquire --limit 8`, `selftest`, `acquire`, `verify`, `qa`. The date range/revision/count are fixed; existing raw files are never overwritten. Completed QA/report outputs refuse replacement.', '',
        'Read-only completed-data verification:', '', '```text',
        'ML-Service/.venv/bin/python ML-Service/src/acquire_ratnapura_stage_aug2026.py --phase verify',
        '& .\\ML-Service\\.venv\\Scripts\\python.exe .\\ML-Service\\src\\acquire_ratnapura_stage_aug2026.py --phase verify',
        '```', '',
        'Created only the dedicated new script, new batch raw folder (original bodies, pinned indexes/allow-list, receipts, manifest, checksums, checkpoint, event ledger, tests and exploratory QA), and this report. Existing raw datasets/manifests, acquisition and plotting scripts, DEMs, watershed/GeoJSON files, Leaflet visualization and teammates’ application files remain unchanged. No Git operation, model training, API implementation, observation interpolation, smoothing, deduplication or next-batch acquisition occurred.']
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase',choices=['inspect','acquire','verify','selftest','qa'],required=True)
    parser.add_argument('--limit',type=int,help='Controlled pause after first N indexed records')
    args=parser.parse_args()
    if args.limit is not None and not 1<=args.limit<=739:parser.error('limit must be 1..739')
    if args.phase=='acquire':acquire(args.limit)
    else:{'inspect':inspect,'verify':verify,'selftest':selftest,'qa':qa}[args.phase]()
