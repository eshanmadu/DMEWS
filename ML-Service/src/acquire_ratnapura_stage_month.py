"""Bounded 723-file stage archive: inspect, acquire, verify, selftest, qa.

Standard library, Python 3.9+, macOS/Windows. Raw files never overwritten.
Reporting/edit proxies are not verified physical measurement timestamps.
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
DEST = ROOT / 'data/raw/ratnapura_stage_month_2026-09-11_to_2026-10-10'
REPORT = ROOT / 'outputs/ratnapura_stage_month_qa.md'
COMMIT = 'baffd0a5fea232d05de7bcb80f3405740f1a1851'
BASE = 'data/rwlds/kalu-ganga-basin/kalu-ganga-river/rathnapura-station/2026/'
API = 'https://api.github.com/repos/nuuuwan/lk_irrigation'
LOCAL = timezone(timedelta(hours=5, minutes=30), 'Asia/Colombo')
DAYS = [(date(2026, 9, 11)+timedelta(days=i)).isoformat() for i in range(30)]
COUNTS = [23,25,23,22,25,25,25,24,25,24,24,24,25,25,24,24,23,25,25,24,24,24,24,24,24,24,26,22,24,23]
SIZES = [1931,2097,1928,1843,2094,2099,2094,2013,2098,2012,2013,2010,2099,2098,2013,2016,1926,2096,2099,2012,2012,2011,2012,2014,2014,2015,2176,1846,2012,1930]
TREES = {'2026-09':'0e75bc48f23ed949d0640a1eeef8ac72bca4b6a3', '2026-10':'c148bde67c931e4eb3bbc4561a1720f24d00917f'}
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
            req=urllib.request.Request(url,headers={'User-Agent':'Cascade-bounded-stage-month/1.0','Accept-Encoding':'identity'})
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
                             'git_blob_sha1':x['sha'],'bytes':x['size'],'source_revision':COMMIT})
    selected.sort(key=lambda x:x['path'])
    if len(selected)!=723 or len({x['path'] for x in selected})!=723:raise RuntimeError('Expected exactly 723 unique paths')
    for day,n,size in zip(DAYS,COUNTS,SIZES):
        xs=[x for x in selected if x['day']==day]
        if len(xs)!=n or sum(x['bytes'] for x in xs)!=size:raise RuntimeError('Daily index differs from preflight: '+day)
    json_new(DEST/'source_index/approved_records.json',{'commit':COMMIT,'timezone':'Asia/Colombo','days':DAYS,'expected_records':723,'expected_body_bytes':60633,'records':selected})
    print('INDEX PASS: 723 files / 60,633 bytes / exact 30-day preflight agreement',flush=True)
    return selected


def index():
    d=json.loads((DEST/'source_index/approved_records.json').read_text())
    if d['commit']!=COMMIT or d['days']!=DAYS or len(d['records'])!=723:raise RuntimeError('Index scope mismatch')
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
                checkpoint({'status':'partial' if len(chosen)<723 else 'in_progress','commit':COMMIT,'checked_this_run':completed,'expected':723,'outcomes':dict(outcomes),'updated_utc':now()})
                print('PROGRESS',completed,'/',len(chosen),dict(outcomes),flush=True)
    if limit is not None and limit<723:
        event('controlled_pause',verified_this_run=completed);return
    records=[]
    for item in items:
        r,_=ensure_record(item,network=False);records.append(dict(item,sha256=r['sha256'],retrieved_utc=r.get('retrieved_utc'),request_started_utc=r.get('request_started_utc'),recovery=r.get('recovery')))
    manifest={'status':'complete_verified','commit':COMMIT,'repository':'https://github.com/nuuuwan/lk_irrigation','days':DAYS,'timezone':'Asia/Colombo','offset':'+05:30','expected_records':723,'verified_records':723,'raw_body_bytes':sum(x['bytes'] for x in records),'records':records,
              'timestamp_semantics':'time_ut is upstream EditDate floored to epoch seconds; not verified measurement time',
              'station':'Rathnapura / Kalu Ganga; official 003HD007 crosswalk unverified','units':'source-labelled metres; datum unverified; not discharge',
              'upstream_ids':'Retain if present; absent IDs are unknown, not inferred from timestamps. No enrichment requested.',
              'licensing':'MIT repository code; underlying observation reuse rights remain unresolved',
              'generated_utc':now(),'limitations':'Exploratory only, not training-ready; no rainfall, interpolation, merging or filtering'}
    if (DEST/'manifest.json').exists():
        old=json.loads((DEST/'manifest.json').read_text())
        if old['records']!=records or old['commit']!=COMMIT:raise RuntimeError('Refusing conflicting completed manifest')
    else:json_new(DEST/'manifest.json',manifest)
    checkpoint({'status':'complete_verified','commit':COMMIT,'verified_records':723,'updated_utc':now(),'outcomes_this_run':dict(outcomes)})
    event('acquisition_complete',verified=723,outcomes=dict(outcomes));print('COMPLETE: 723 verified records',flush=True)


def verify():
    items=index();m=json.loads((DEST/'manifest.json').read_text())
    if m['commit']!=COMMIT or m.get('verified_records')!=723 or len(m['records'])!=723:raise RuntimeError('Incomplete manifest')
    bypath={x['path']:x for x in m['records']}
    if set(bypath)!={x['path'] for x in items}:raise RuntimeError('Manifest path mismatch')
    for x in items:
        b=(DEST/x['path']).read_bytes();valid_body(b,x)
        for k in ['url','source_revision','git_blob_sha1','bytes']:
            if bypath[x['path']][k]!=x[k]:raise RuntimeError('Manifest identity mismatch')
        if sha(b)!=bypath[x['path']]['sha256']:raise RuntimeError('SHA-256 mismatch')
    actual={str(p.relative_to(DEST)) for p in (DEST/'observations').rglob('*') if p.is_file()}
    if actual!=set(bypath):raise RuntimeError('Unexpected/missing observation file')
    print('VERIFY PASS: 723 byte counts, SHA-256, Git blobs, URLs and source identities',flush=True)
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
    return {'indexed':len(rows),'downloaded_verified':len(rows),'finite_stage':len(vals),'missing_stage_field':sum(not x['stage_present'] for x in rows),'null_stage':sum(x['stage_present'] and x['stage_raw'] is None for x in rows),'invalid_stage':len(rows)-len(vals),'invalid_reporting_timestamp':len(rows)-len(ts),
            'span_local':[ts[0]['report_local'],ts[-1]['report_local']] if ts else None,'stage_range_m':[min(vals),max(vals)] if vals else None,
            'interval_minutes':{'min':min(x['minutes'] for x in pairs),'median':statistics.median(x['minutes'] for x in pairs),'max':max(x['minutes'] for x in pairs)} if pairs else None,
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
        rows.append({'raw_path':x['path'],'source_url':x['url'],'station_raw':d.get('station_name'),'raw_time_ut':t,'report_epoch':t if good else None,'report_local':dt.isoformat() if dt else None,'measurement_time':None,'stage_present':'water_level_m' in d,'stage_raw':d.get('water_level_m'),'units':'m, source convention; datum unverified','upstream_ids':fields,'raw_fields':list(d),
                     'filename_or_day_conflict':not good or dt.date().isoformat()!=x['day'] or datetime.strptime(x['name'],'%Y-%m-%d-%H-%M-%S.json').replace(tzinfo=LOCAL).timestamp()!=t})
    daily={d:summary([x for x in rows if x['raw_path'].split('/')[1]==d]) for d in DAYS}
    result={'status':'Exploratory, not training-ready','daily':daily,'overall':summary(rows),'rows':rows}
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


def report(result,manifest):
    overall=result['overall'];daily=result['daily']
    events=[json.loads(s) for s in (DEST/'events.jsonl').read_text().splitlines()]
    failures=[x for x in events if x['event']=='http_failure']
    successes=[x for x in events if x['event']=='http_success']
    recovery=[x for x in events if x['event'] in ['orphan_reconciled','raw_staging_recovered','receipt_recovered','controlled_pause','retry_backoff']]
    tests=json.loads((DEST/'resumability_tests.json').read_text())
    raw_success=[x for x in successes if x['label'].startswith('observations/')]
    def change(x):
        if not x:return 'None'
        return f"{x['change_m']:+.4f} m; {x['from']} → {x['to']}; {x['minutes']:.3f} min"
    lines=[
        '# Ratnapura month-long stage archive QA', '',
        '**Status:** Exploratory reporting-time archive; **not training-ready**. No verified physical measurement timestamps.',
        '**Window:** 11 September–10 October 2026 inclusive, Asia/Colombo (UTC+05:30).',
        '**QA date (UTC):** '+now(), '',
        '## 1. Scope and result', '',
        f"Source: [nuuuwan/lk_irrigation](https://github.com/nuuuwan/lk_irrigation), pinned revision **`{COMMIT}`**. Exactly **723 indexed / 723 downloaded / 723 verified** stage records, totalling **60,633 raw-body bytes**. Index counts and daily byte totals reproduce the [approved preflight](ratnapura_month_archive_preflight.md). No adjacent days, unrelated stations, rainfall, secondary API history or full repository were acquired.", '',
        'The three original metadata responses, their retrieval receipts, and the approved 723-path allow-list are preserved under `source_index/`. The metadata month trees contain out-of-window filenames, hashes and sizes; only approved observation bodies were requested. Both recursive trees are untruncated.', '',
        'The original stage bodies are under `observations/YYYY-MM-DD/`. Per-response receipts under `receipts/`, `events.jsonl`, `checkpoint.json` and `manifest.json` separate retrieval provenance, verified completion and reporting/edit proxies. `exploratory_qa.json` preserves original values and raw-file links; it has no interpolation, lag features, targets or cleaning.', '',
        '## 2. Daily indexed/downloaded/verified and stage QA', '',
        '| Local date | Indexed | Downloaded | Verified | Finite stage | Null / missing field / invalid total | Stage range (source m) | Median / max interval (min) | >90 min gaps | ≤5 min pairs |',
        '|---|---:|---:|---:|---:|---|---|---|---:|---:|']
    for d,x in daily.items():
        v=x['interval_minutes'];level=x['stage_range_m']
        lines.append(f"| {d} | {x['indexed']} | {x['downloaded_verified']} | {x['downloaded_verified']} | {x['finite_stage']} | {x['null_stage']} / {x['missing_stage_field']} / {x['invalid_stage']} | {level[0]}–{level[1]} | {v['median']:.3f} / {v['max']:.3f} | {len(x['gaps_over_90_minutes'])} | {len(x['close_events_at_most_5_minutes'])} |")
    lines += ['', 'Daily intervals exclude transitions across dates; full-window statistics include them. Empty boundary hours are not assumed complete merely because a day has 24 records.', '',
        '## 3. Full-window QA', '',
        '| Measure | Result |', '|---|---|',
        f"| Finite numeric stages | {overall['finite_stage']} / 723 |",
        f"| Missing stage field / null / invalid total | {overall['missing_stage_field']} / {overall['null_stage']} / {overall['invalid_stage']} |",
        f"| Reporting span, local | {overall['span_local']} |",
        f"| Reporting interval min / median / max (minutes) | {overall['interval_minutes']} |",
        f"| Gaps >90 minutes | {len(overall['gaps_over_90_minutes'])} |",
        f"| Stage range, source-labelled metres | {overall['stage_range_m']} |",
        f"| Largest positive consecutive report change | {change(overall['largest_positive_change'])} |",
        f"| Largest negative consecutive report change | {change(overall['largest_negative_change'])} |",
        f"| Consecutive identical-stage pairs | {overall['consecutive_identical_values']} |",
        f"| Close reporting pairs, ≤5 minutes | {len(overall['close_events_at_most_5_minutes'])} |",
        f"| Duplicate reporting timestamps | {overall['duplicate_reporting_timestamps']} |",
        f"| Conflicting same-timestamp groups | {len(overall['conflicting_timestamp_groups'])} |",
        f"| Invalid reporting timestamps | {overall['invalid_reporting_timestamp']} |",
        f"| Filename/date conflicts / station-name conflicts | {overall['filename_day_conflicts']} / {overall['station_conflicts']} |",
        f"| Nonmonotonic/equal timestamps in filename order | {overall['nonmonotonic_filename_order']} |",
        f"| Rows exposing upstream IDs | {overall['rows_with_upstream_ids']} |",
        '| Physical measurement times independently verified | 0 |', '',
        '### Reporting gaps over 90 minutes', '',
        '| From, local | To, local | Minutes | Stage change (m) |', '|---|---|---:|---:|']
    for x in overall['gaps_over_90_minutes']:
        delta=f"{x['change_m']:+.4f}" if number(x['change_m']) else 'Unavailable'
        lines.append(f"| {x['from']} | {x['to']} | {x['minutes']:.3f} | {delta} |")
    lines += ['', 'These are **reporting/edit-time gaps**, not demonstrated missing physical measurements. All indexed bodies were acquired, so there are zero missing downloads relative to the pinned allow-list; upstream reports or measurements absent from that index cannot be counted. Unusual changes are retained without being designated flood events, instrument errors or outliers.', '',
        '### Near-event flags: 0–300 seconds inclusive', '',
        '| First report, local | Next report, local | Seconds | First / next stage (m) | Difference (m) |', '|---|---|---:|---|---:|']
    for x in overall['close_events_at_most_5_minutes']:
        delta=f"{x['change_m']:+.4f}" if number(x['change_m']) else 'Unavailable'
        lines.append(f"| {x['from']} | {x['to']} | {x['minutes']*60:.3f} | {x['from_stage']} / {x['to_stage']} | {delta} |")
    lines += ['',
        'Each flagged pair remains two distinct archived records. This is a screening heuristic, not deduplication or proof of revisions. Equal values may reflect stable level, rounding, repeated submission or another mechanism; different values seconds apart do not establish a physical rate of change. Source-level identity reconciliation is separate from future time-series resampling. No records were merged, discarded, averaged or selected as corrections.', '',
        '### Identity and conflict limitations', '',
        'Actual raw field sets: '+json.dumps(sorted({tuple(sorted(x['raw_fields'])) for x in result['rows']})),
        'Available upstream object/global/measurement/event IDs are preserved in the exploratory rows if present. Missing IDs remain unavailable, never inferred from timestamps. **Where IDs are absent, repeated upstream IDs and ID-based value conflicts are not assessable**, rather than proven zero. Archive path/blob/revision identities remain distinct and verified.',
        'Observed repeated-ID groups among supplied IDs: '+json.dumps(overall['repeated_upstream_ids']),
        'Observed same-timestamp conflict groups: '+json.dumps(overall['conflicting_timestamp_groups']), '',
        '### Daily time endpoints, changes and repeats', '',
        '| Date | First / last local report | Largest rise | Largest fall | Identical consecutive pairs | Duplicate times / time conflicts |', '|---|---|---|---|---:|---|']
    for d,x in daily.items():
        span=x['span_local']
        lines.append(f"| {d} | {span[0][11:19]} / {span[1][11:19]} | {change(x['largest_positive_change'])} | {change(x['largest_negative_change'])} | {x['consecutive_identical_values']} | {x['duplicate_reporting_timestamps']} / {len(x['conflicting_timestamp_groups'])} |")
    lines += ['',
        '## 4. Data integrity and provenance', '',
        'All 723 bodies passed indexed byte-size and Git blob SHA-1 checks on acquisition, were revalidated before declaring completion, and passed manifest SHA-256, URL, revision, blob and file-set verification. The complete manifest is emitted only after every expected file passes. A mutable checkpoint marker alone is never trusted. Indexed source identities and expected daily totals are re-derived from the preserved, receipt-verified month trees on restarts.', '',
        f"Successful HTTP responses: **{len(successes)}**, comprising **{len(raw_success)} raw record responses** and three metadata responses. Successful response-body bytes: **{sum(x['bytes'] for x in successes):,}**. Exact source URLs, request/retrieval timestamps and checksums are retained, not replaced by normalized values.", '',
        'Raw request span, UTC: '+raw_success[0]['request_started_utc']+' to '+raw_success[-1]['retrieved_utc']+'. Elapsed wall-clock span including the deliberate pause/tests: '+str(round((datetime.fromisoformat(raw_success[-1]['retrieved_utc'])-datetime.fromisoformat(raw_success[0]['request_started_utc'])).total_seconds(),2))+' seconds. Two workers share a 0.75-second minimum request-start interval; retries are bounded.', '',
        'Stage records preserve source-labelled metres and the original numeric values. The source loader maps upstream EditDate to whole-second `time_ut`; the per-file reporting/edit proxy is not a physical measurement clock. Our UTC retrieval timestamps describe collection by this research workflow only, not historical availability.', '',
        '## 5. Interruptions, recovery and resumability tests', '',
        f"Logged request failures: **{len(failures)}**. Details are preserved below and in `events.jsonl`:", '',
        '```json',json.dumps(failures,indent=2),'```', '',
        'Recovery/backoff/pause actions:', '',
        '```json',json.dumps(recovery,indent=2),'```', '',
        'The first sandboxed metadata attempt encountered DNS restrictions; bounded retries were logged, followed by an approved network-enabled restart. This is not an upstream data gap. Acquisition then deliberately paused after 12 verified records. Restart reused those records without downloading their bodies again before continuing with the remaining allowed files.', '',
        'Resumability tests used temporary copies of one already acquired real record, not altered original data or synthetic training observations. No network request was made by the tests. Results:', '']
    lines += ['- '+x for x in tests['tests']]
    lines += ['',
        'Verified receipts are persisted before raw publication. Staging files are fully written and fsynced; hard-link publication refuses an existing destination atomically. Only verified published staging links are removed. A valid orphan is reconciled only after matching pinned size/blob identity; absent historical retrieval time remains null with an explicit recovery note. Suspicious bytes/receipts are preserved and stop processing. The small checkpoint is the only replaceable progress file; raw responses, receipts and completed manifest are not overwritten.', '',
        'This run exercised publication on macOS. Paths and APIs support Python 3.9+ on macOS and Windows/NTFS, but **Windows execution was not tested here**. If hard links are unsupported, publication stops rather than falling back to an overwrite. Power-loss/filesystem durability and every possible failure sequence are not certified by these bounded tests. Metadata orphans stop for review instead of inventing provenance.', '',
        '## 6. Continuity, scientific usability and limitations', '',
        'The complete index-matched archive provides a reproducible basis for **exploratory reporting-time series analysis and historical hydrographs**. Plot irregular timestamps directly, retain near-event markers and visibly flag gaps; do not connect gaps in a way that implies continuous measured coverage. Its finite-value count and complete retrieval establish archive consistency, not physical measurement completeness or accuracy.', '',
        'Do not label this dataset training-ready. Official station 003HD007 equivalence, gauge datum/history, actual measurement periods, correction semantics, historic first availability and event representation remain unverified. The provisional V2 outlet and 603 versus 644.1525 km² discrepancy are not resolved by acquiring stage reports. Reporting-time jumps are not independently corroborated hydrological events. The previous 14 October close-pair investigation remains contextual evidence from a different window.', '',
        'No secondary history was requested, so this month has no secondary-source comparison. Public-feed agreement would not independently validate a shared upstream measurement. Repository MIT licensing does not by itself settle underlying official observation redistribution rights; attribution and permissions require continued attention.', '',
        'A longer **separately bounded stage-only** acquisition is justified for exploratory coverage/continuity assessment, using the same pinned allow-list and integrity rules. This month does not justify immediate full-archive download, rainfall integration, a forecast horizon, model training or operational use.', '',
        '**One smallest recommended next step:** Create a read-only historical stage hydrograph from this preserved month, displaying every report, gaps and close-event flags without interpolation. Do not alter the Leaflet map or begin that visualization without approval.', '',
        '## 7. Reproduction and files', '',
        'Script: `ML-Service/src/acquire_ratnapura_stage_month.py`. Uses the existing virtual environment and Python standard library only; no packages installed. From the repository root:', '',
        '```text',
        '# macOS — read-only completed-data verification',
        'ML-Service/.venv/bin/python ML-Service/src/acquire_ratnapura_stage_month.py --phase verify',
        '# Windows PowerShell — read-only completed-data verification',
        r'& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\acquire_ratnapura_stage_month.py --phase verify',
        '```', '',
        'Phase order for this fixed approved window was `inspect`, `acquire --limit 12`, `selftest`, `acquire`, `verify`, `qa`. Existing verified records are reused on an acquisition restart; the script cannot expand dates via command-line arguments. Complete QA/report outputs refuse replacement. No concurrent invocation of this script should be used; two bounded worker threads are internal to a single run.', '',
        'Created: the dedicated script, the new month raw-data folder (source metadata, allow-list, 723 original observations, receipts, event ledger, checkpoint, completed manifest, resumability-test results and exploratory QA), and this report. Existing samples/manifests, research reports/scripts, DEMs, flow rasters, watershed exports, Leaflet map and teammates’ files were preserved. No local Git operation, package installation, rainfall acquisition, stage-to-discharge conversion or model training occurred.']
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase',choices=['inspect','acquire','verify','selftest','qa'],required=True)
    parser.add_argument('--limit',type=int,help='Controlled pause after first N indexed records')
    args=parser.parse_args()
    if args.limit is not None and not 1<=args.limit<=723:parser.error('limit must be 1..723')
    if args.phase=='acquire':acquire(args.limit)
    else:{'inspect':inspect,'verify':verify,'selftest':selftest,'qa':qa}[args.phase]()
