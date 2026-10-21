"""Bounded stage-only pilot, 11–17 October 2026; standard library only.

Run with --phase inspect, acquire, then qa. Existing raw bodies are verified,
never overwritten. Reporting/edit proxies are not physical measurement times.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict
import argparse
import hashlib
import json
import math
import statistics
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'data/raw/ratnapura_stage_pilot_2026-10-11_to_2026-10-17'
REPORT = ROOT / 'outputs/ratnapura_stage_seven_day_pilot_qa.md'
COMMIT = 'baffd0a5fea232d05de7bcb80f3405740f1a1851'
DAYS = [f'2026-10-{d:02d}' for d in range(11, 18)]
LOCAL = timezone(timedelta(hours=5, minutes=30), 'Asia/Colombo')
BASE = 'data/rwlds/kalu-ganga-basin/kalu-ganga-river/rathnapura-station/2026/2026-10/'
REPO = 'https://api.github.com/repos/nuuuwan/lk_irrigation'


def write(path, obj):
    with path.open('x', encoding='utf-8') as f:
        json.dump(obj, f, indent=2, ensure_ascii=False, allow_nan=False)
        f.write('\n')


def sha(body):
    return hashlib.sha256(body).hexdigest()


def ledger():
    p = DEST / 'retrieval_log.jsonl'
    return [json.loads(s) for s in p.read_text().splitlines()] if p.exists() else []


def fetch(relative, url, limit):
    """Serial bounded GET; record failures, no automatic retries or overwrite."""
    p = DEST / relative
    if p.exists():
        entries = [e for e in ledger() if e.get('path') == relative and e.get('status') == 200]
        body = p.read_bytes()
        if len(entries) != 1 or entries[0]['url'] != url or sha(body) != entries[0]['sha256']:
            raise RuntimeError('Existing response provenance mismatch: ' + relative)
        return body
    time.sleep(1.2)
    entry = {'path': relative, 'url': url, 'request_started_utc': datetime.now(timezone.utc).isoformat()}
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Cascade-stage-pilot-QA/1.0', 'Accept-Encoding': 'identity'})
        with urllib.request.urlopen(req, timeout=35) as response:
            body = response.read(limit + 1)
            if len(body) > limit:
                raise RuntimeError('Response exceeds bounded size')
            entry.update(status=response.status, final_url=response.url,
                         retrieved_utc=datetime.now(timezone.utc).isoformat(), bytes=len(body), sha256=sha(body),
                         headers={k: response.headers[k] for k in ['ETag', 'Last-Modified', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'] if response.headers.get(k)})
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open('xb') as f:
            f.write(body)
    except Exception as exc:
        entry.update(status=getattr(exc, 'code', None), error=str(exc), failed_utc=datetime.now(timezone.utc).isoformat())
        raise
    finally:
        with (DEST / 'retrieval_log.jsonl').open('a', encoding='utf-8') as f:
            f.write(json.dumps(entry) + '\n')
    print(relative, entry['bytes'], flush=True)
    return body


def inspect():
    DEST.mkdir(parents=True, exist_ok=True)
    counts = {}
    for day in DAYS:
        url = REPO + '/contents/' + BASE + day + '?ref=' + COMMIT
        items = json.loads(fetch('indexes/' + day + '.json', url, 200000))
        if not isinstance(items, list) or not 1 <= len(items) <= 100:
            raise RuntimeError('Unexpected index count: ' + day)
        for item in items:
            stamp = datetime.strptime(item['name'], '%Y-%m-%d-%H-%M-%S.json')
            if item['type'] != 'file' or stamp.date().isoformat() != day or item['size'] > 10000 or item['path'] != BASE + day + '/' + item['name']:
                raise RuntimeError('Unexpected indexed record')
        counts[day] = len(items)
    if not (DEST / 'inspection.json').exists():
        write(DEST / 'inspection.json', {'commit': COMMIT, 'timezone': 'Asia/Colombo', 'expected_records': counts,
              'status': 'Indexes only; review counts before acquisition', 'measurement_time_verified': False})
    print(json.dumps(counts), flush=True)


def acquire():
    info = json.loads((DEST / 'inspection.json').read_text())
    for day in DAYS:
        items = json.loads((DEST / 'indexes' / (day + '.json')).read_text())
        if len(items) != info['expected_records'][day]:
            raise RuntimeError('Index changed')
        for item in items:
            body = fetch('github_records/' + day + '/' + item['name'],
                         'https://raw.githubusercontent.com/nuuuwan/lk_irrigation/' + COMMIT + '/' + item['path'], 10000)
            blob = hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()
            if len(body) != item['size'] or blob != item['sha']:
                raise RuntimeError('Git blob identity failure: ' + item['path'])
    # Both documented history modes include rainfall; preserve stage-only scope.
    if not (DEST / 'manifest.json').exists():
        write(DEST / 'manifest.json', {
            'title': 'Exploratory stage-only seven-day pilot; NOT training-ready',
            'local_dates': DAYS, 'timezone': 'Asia/Colombo', 'offset': '+05:30',
            'utc_window_exclusive_end': ['2026-10-10T18:30:00Z', '2026-10-17T18:30:00Z'],
            'repository': 'https://github.com/nuuuwan/lk_irrigation', 'commit': COMMIT,
            'indexed_counts': info['expected_records'], 'retrievals': ledger(),
            'timestamp_policy': 'time_ut = upstream ArcGIS EditDate floored to epoch seconds per pinned loader; reporting/edit proxy, not verified measurement time. Filename derived from proxy. Retrieval times separate.',
            'station': {'label': 'Rathnapura / Kalu Ganga', 'possible_official_code': '003HD007', 'identity_crosswalk': 'Unverified', 'vertical_datum': 'Unverified'},
            'units': 'water_level_m; Rathnapura source-unit convention metres; not discharge',
            'provenance': 'Shared upstream feed likely; API agreement is consistency, not independent observation validation',
            'licensing': 'Repository MIT licence in prior sample; underlying official-data reuse rights and API data licence unresolved',
            'prior_source_metadata': '../ratnapura_stage_sample_2026-10-18/source_metadata/',
            'secondary_scope': 'Not acquired: documented compact and detailed history modes both include rainfall; no documented stage-only field selection. Existing 18 October comparison is context only.',
            'restrictions': 'No interpolation, filtering, training, discharge conversion, or archive expansion',
        })


def number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def local(t):
    return datetime.fromtimestamp(t, timezone.utc).astimezone(LOCAL).isoformat()


def stats(rows, indexed):
    valid_t = sorted([r for r in rows if number(r['report_epoch'])], key=lambda r: r['report_epoch'])
    vals = [r['stage_raw'] for r in rows if number(r['stage_raw'])]
    intervals = [(b['report_epoch']-a['report_epoch'])/60 for a,b in zip(valid_t, valid_t[1:])]
    changes = [{'from': a['report_local'], 'to': b['report_local'], 'minutes': (b['report_epoch']-a['report_epoch'])/60,
                'change_m': b['stage_raw']-a['stage_raw']} for a,b in zip(valid_t,valid_t[1:]) if number(a['stage_raw']) and number(b['stage_raw'])]
    groups=defaultdict(list)
    for r in valid_t: groups[r['report_epoch']].append(r['stage_raw'])
    return {'indexed': indexed, 'downloaded': len(rows), 'finite_stage': len(vals),
        'missing_stage_field': sum(not r['stage_field_present'] for r in rows), 'null_stage':sum(r['stage_field_present'] and r['stage_raw'] is None for r in rows),
        'invalid_stage':len(rows)-len(vals), 'invalid_timestamp':len(rows)-len(valid_t),
        'duplicate_reporting_timestamps':len(valid_t)-len(groups),
        'conflicting_same_timestamp':[{'epoch':t,'values':v} for t,v in groups.items() if len(set(map(str,v)))>1],
        'span_local':[valid_t[0]['report_local'],valid_t[-1]['report_local']] if valid_t else None,
        'interval_minutes':{'min':min(intervals),'median':statistics.median(intervals),'max':max(intervals)} if intervals else None,
        'gaps_over_90_minutes':[x for x in changes if x['minutes']>90],
        'close_reporting_pairs_at_most_5_minutes':[x for x in changes if 0<=x['minutes']<=5],
        'stage_range_m':[min(vals),max(vals)] if vals else None,
        'largest_positive_change':max((x for x in changes if x['change_m']>0),key=lambda x:x['change_m'],default=None),
        'largest_negative_change':min((x for x in changes if x['change_m']<0),key=lambda x:x['change_m'],default=None),
        'unchanged_consecutive_pairs':sum(x['change_m']==0 for x in changes),
        'repeated_values':{str(v):n for v,n in Counter(vals).items() if n>1},
        'nonmonotonic_in_filename_order':sum(b['report_epoch']<=a['report_epoch'] for a,b in zip(rows,rows[1:]) if number(a['report_epoch']) and number(b['report_epoch'])),
        'filename_or_day_conflicts':sum(r['filename_conflict'] or r['day_conflict'] for r in rows),
        'station_conflicts':sum(r['station_raw']!='Rathnapura' for r in rows),
        'verified_measurement_times':0}



def verify():
    """Offline, repeatable integrity check; writes nothing."""
    manifest=json.loads((DEST/'manifest.json').read_text())
    count=0
    for entry in manifest['retrievals']:
        if entry.get('status')!=200:continue
        body=(DEST/entry['path']).read_bytes()
        if len(body)!=entry['bytes'] or sha(body)!=entry['sha256']:
            raise RuntimeError('Response integrity failure: '+entry['path'])
        count+=1
    records=0
    for day in DAYS:
        for item in json.loads((DEST/'indexes'/(day+'.json')).read_text()):
            body=(DEST/'github_records'/day/item['name']).read_bytes()
            blob=hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()
            if len(body)!=item['size'] or blob!=item['sha']:raise RuntimeError('Git blob failure')
            records+=1
    print('PASS: SHA-256 and sizes:',count,'responses; Git blob identities:',records,'records')


def qa():
    manifest=json.loads((DEST/'manifest.json').read_text())
    for e in manifest['retrievals']:
        if e.get('status')==200:
            b=(DEST/e['path']).read_bytes()
            if len(b)!=e['bytes'] or sha(b)!=e['sha256']: raise RuntimeError('Checksum failure')
    lookup={e['path']:e for e in manifest['retrievals'] if e.get('status')==200}
    rows=[]; daily={}
    for day in DAYS:
        dayrows=[]
        items=json.loads((DEST/'indexes'/(day+'.json')).read_text())
        for item in sorted(items,key=lambda x:x['name']):
            rel='github_records/'+day+'/'+item['name'];p=DEST/rel;b=p.read_bytes()
            if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()!=item['sha']:raise RuntimeError('Blob mismatch')
            d=json.loads(b);t=d.get('time_ut');good=number(t)
            row={'raw_path':rel,'source_url':lookup[rel]['url'],'sha256':lookup[rel]['sha256'],'retrieved_utc':lookup[rel]['retrieved_utc'],
                 'station_raw':d.get('station_name'),'raw_time_ut':t,'report_epoch':t if good else None,
                 'report_local':local(t) if good else None,'stage_raw':d.get('water_level_m'),'stage_field_present':'water_level_m' in d,
                 'units':'m, source convention; datum unverified','measurement_time':None,'timestamp_meaning':'Upstream reporting/edit proxy',
                 'filename_conflict':good and datetime.strptime(item['name'],'%Y-%m-%d-%H-%M-%S.json').replace(tzinfo=LOCAL).timestamp()!=t,
                 'day_conflict':not good or datetime.fromtimestamp(t,LOCAL).date().isoformat()!=day}
            rows.append(row);dayrows.append(row)
        daily[day]=stats(dayrows,len(items))
    overall=stats(rows,sum(manifest['indexed_counts'].values()))
    write(DEST/'exploratory_qa.json',{'status':'Exploratory only; not a training dataset','daily':daily,'overall':overall,'rows':rows})
    successful=[e for e in manifest['retrievals'] if e.get('status')==200]
    failed=[e for e in manifest['retrievals'] if e.get('status')!=200]
    primary_entries=[e for e in successful if e['path'].startswith('github_records/')]
    def change(x):
        return f"{x['change_m']:+.4f} m ({x['from']} → {x['to']}; {x['minutes']:.2f} min)" if x else 'None'
    lines=[
        '# Ratnapura seven-day stage-only pilot QA', '',
        '**Status:** Exploratory archive QA; not a training-ready dataset. No physical measurement timestamps verified.',
        '**Window:** 11–17 October 2026 inclusive, Asia/Colombo (UTC+05:30).',
        '**QA generated:** '+datetime.now(timezone.utc).isoformat(), '',
        '## 1. Acquisition and scope', '',
        'Primary source: [nuuuwan/lk_irrigation](https://github.com/nuuuwan/lk_irrigation), pinned revision `'+COMMIT+'` (same source version as the 18 October sample). Each of seven daily indexes was inspected before observation acquisition. Only the listed Rathnapura files for these dates were fetched; no clone, full-history request, rainfall acquisition or adjacent-day acquisition occurred.', '',
        f"Indexed **{overall['indexed']}**, downloaded **{overall['downloaded']}**, finite numeric stage readings **{overall['finite_stage']}**. All counts refer to archived reporting records, not independently verified physical measurements.", '',
        '## 2. Daily QA', '',
        '| Local date | Indexed / downloaded | Finite stage | Null / missing field / invalid total | First / last local reporting time | Median / largest interval (min) | Gaps >90 min | Stage range (source m) |',
        '|---|---:|---:|---|---|---|---:|---|']
    for day,x in daily.items():
        interval=x['interval_minutes']; span=x['span_local']; level=x['stage_range_m']
        lines.append(f"| {day} | {x['indexed']} / {x['downloaded']} | {x['finite_stage']} | {x['null_stage']} / {x['missing_stage_field']} / {x['invalid_stage']} | {span[0][11:19]} / {span[1][11:19]} | {interval['median']:.3f} / {interval['max']:.3f} | {len(x['gaps_over_90_minutes'])} | {level[0]}–{level[1]} |")
    lines += ['', 'Daily intervals exclude overnight transitions; full-window intervals below include them. Boundary hours before the first or after the last observed record are not assumed complete.', '',
              '## 3. Full-window timing and values', '',
              '- Reporting span: '+str(overall['span_local']),
              '- Interval minutes (minimum / median / maximum): '+str(overall['interval_minutes']),
              '- Source-labelled stage range (m): '+str(overall['stage_range_m']),
              '- Largest positive consecutive change: '+change(overall['largest_positive_change']),
              '- Largest negative consecutive change: '+change(overall['largest_negative_change']),
              '- Duplicate reporting timestamps: '+str(overall['duplicate_reporting_timestamps']),
              '- Conflicting values at identical reporting timestamps: '+str(overall['conflicting_same_timestamp']),
              '- Invalid timestamps / filename-or-day conflicts / station-name conflicts: '+str((overall['invalid_timestamp'],overall['filename_or_day_conflicts'],overall['station_conflicts'])),
              '- Non-monotonic/equal timestamps in filename order: '+str(overall['nonmonotonic_in_filename_order']),
              '- Consecutive unchanged-stage pairs: '+str(overall['unchanged_consecutive_pairs']),
              '- Repeated stage values (value: total occurrences, including non-consecutive): '+json.dumps(overall['repeated_values']), '',
              '### All full-window reporting gaps over 90 minutes', '',
              '| From (local) | To (local) | Minutes | Stage change (m) |', '|---|---|---:|---:|']
    for x in overall['gaps_over_90_minutes']:
        lines.append(f"| {x['from']} | {x['to']} | {x['minutes']:.3f} | {x['change_m']:+.4f} |")
    if not overall['gaps_over_90_minutes']:lines.append('| None | — | — | — |')
    lines += ['', '### Closely spaced reports (at most five minutes)', '',
              '| From (local) | To (local) | Minutes | Stage change (m) |', '|---|---|---:|---:|']
    for x in overall['close_reporting_pairs_at_most_5_minutes']:
        lines.append(f"| {x['from']} | {x['to']} | {x['minutes']:.3f} | {x['change_m']:+.4f} |")
    lines += ['', 'Close pairs are flagged for possible repeated reporting/correction, not automatically merged. Distinct edit times do not establish distinct physical measurements. In particular, a seconds-apart value change cannot be interpreted as a physical rise/fall rate without measurement-time and revision evidence. Stable record IDs are unavailable here.', '']
    lines += ['', '### Daily changes and repeated readings', '',
              '| Date | Largest rise | Largest fall | Consecutive unchanged pairs | Duplicate times / conflicting events |', '|---|---|---|---:|---|']
    for day,x in daily.items():
        lines.append(f"| {day} | {change(x['largest_positive_change'])} | {change(x['largest_negative_change'])} | {x['unchanged_consecutive_pairs']} | {x['duplicate_reporting_timestamps']} / {len(x['conflicting_same_timestamp'])} |")
    lines += ['', 'Unusual changes are retained. A repeated stage can mean stable water level, rounding, copied values or repeated reporting; these bodies do not distinguish them. Gaps indicate reporting/index irregularity, not demonstrated missing physical measurements. More than 24 daily records is not proof of duplicate measurements, and fewer than 24 is not proof of missing hourly measurements.', '',
        '## 4. Source consistency and revision limits', '',
        'No new secondary observations were acquired. The previously saved API documentation describes rainfall fields in both compact and detailed history modes, with no documented stage-only field selector. The optional comparison was therefore omitted to preserve this task’s stage-only scope. Seven-day secondary matches, disagreements and millisecond differences are **not evaluated**, not zero.', '',
        'The existing [18 October QA](ratnapura_stage_sample_qa.md) established 24 stage matches after flooring API milliseconds to primary whole seconds; 23 retained additional milliseconds. That is contextual pipeline-consistency evidence for a different day, not validation of this seven-day window or an independent upstream observation source.', '',
        'The pinned archive gives a reproducible snapshot, not revision completeness. Per-record bodies omit upstream stable IDs and CreationDate. The writer skips an existing pathname, while edits that change EditDate can create another pathname. Duplicate edit timestamps and conflicting values were checked here; undetected corrections or repeated physical observations remain possible. No cross-revision audit or measurement-ID deduplication was performed.', '',
        '## 5. Provenance, integrity and access', '',
        f"Every one of {len(successful)} successful responses was rechecked against its recorded byte count and SHA-256. Each of {len(primary_entries)} primary record bodies also matches the indexed Git blob SHA-1 and indexed byte size. Git blob SHA-1 is an additional source-identity check, not a substitute for SHA-256.", '',
        f"Primary bodies total {sum(e['bytes'] for e in primary_entries):,} bytes; all successful raw responses including indexes total {sum(e['bytes'] for e in successful):,} bytes. Index/provenance overhead dominates these small record bodies. Exact URLs, final URLs, request/retrieval UTC timestamps, response metadata, byte sizes and SHA-256 hashes are in `manifest.json` and `retrieval_log.jsonl`.", '',
        f"Logged failed requests: {len(failed)}. Details: "+json.dumps(failed,ensure_ascii=False), '',
        'The initial sandbox DNS failure was retried after network approval. No raw response was overwritten. Requests were serial, with at least 1.2 seconds between attempts; no credentials, access bypass, repository clone or automated retry loop was used. The pinned revision avoids snapshot drift; it does not establish latest-data or physical measurement completeness.', '',
        'Repository MIT licensing is recorded in the prior sample; underlying official observation rights and secondary data licensing remain unresolved. Public accessibility does not establish unrestricted redistribution rights.', '',
        '## 6. Interpretation and longer-history readiness', '',
        'A longer **bounded stage-only** acquisition is justified if the indexed/downloaded counts and integrity checks above agree. The pilot demonstrates public accessibility and reproducibility at one pinned version, and provides a concrete interval/value-continuity audit. It does not establish official-station identity, instrument accuracy, stable gauge datum, exact measurement time, historical first availability, complete event representation or sufficient training history.', '',
        'The archive loader maps upstream ArcGIS EditDate to `time_ut` in whole seconds. These are reporting/edit proxies; local filenames encode that proxy. Values are source-labelled metres under the Rathnapura station convention, not discharge. The possible mapping to official station 003HD007 remains unverified. Never use retrieval time as measurement time, assume rows are evenly spaced, interpolate gaps or silently discard jumps.', '',
        'Raw acquisition cost scales roughly with one request per record: at this pilot’s density, approximately 24 requests/day, plus indexes. The imposed 1.2-second pacing alone requires about 29 seconds/day, before network latency. Longer windows need a separately approved request/volume bound and QA gates. A larger history can support exploratory reporting-time series analysis, not automatically leakage-safe forecasting or operational warnings.', '',
        '**One smallest next step:** Investigate the upstream record-identity/revision evidence for the 14 October 05:03:24 and 05:03:27 reporting pair, using a narrowly bounded metadata check if separately approved. Establish whether these are distinct submissions or a correction before designing deduplication rules for a longer history. Do not merge them automatically, create model features or expand acquisition during this task.', '',
        '## 7. Reproduction and files', '',
        'Script: `ML-Service/src/acquire_ratnapura_stage_pilot.py`, standard library only, compatible with the existing Python 3.9 environment. Paths use pathlib. Run phases in order; inspect counts before acquisition. Existing responses are verified and reused, never overwritten; derived QA outputs use exclusive creation.', '',
        'macOS: `ML-Service/.venv/bin/python ML-Service/src/acquire_ratnapura_stage_pilot.py --phase verify`', '',
        'Windows PowerShell: `& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\acquire_ratnapura_stage_pilot.py --phase verify`', '',
        'The completed QA files intentionally refuse replacement. For an integrity-only recheck after completion, run the read-only `--phase verify` shown above; do not rerun network acquisition unnecessarily.', '',
        'New raw folder: `ML-Service/data/raw/ratnapura_stage_pilot_2026-10-11_to_2026-10-17/`; contains seven original indexes, original date-partitioned primary bodies, inspection record, retrieval ledger, manifest and exploratory QA JSON. The QA JSON retains original timestamps/stage values, raw paths, source URLs and uncertainty; it has no interpolated values, lag features or training targets.', '',
        'Existing 18 October records, reports and acquisition script were preserved. Hydrological inputs/scripts, GeoJSON, Leaflet map and teammates’ files were not modified. No package installation, model training or local Git operation occurred.']
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')
    print(json.dumps({'daily':daily,'overall':overall},indent=2),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase',choices=['inspect','acquire','qa','verify'],required=True)
    args=parser.parse_args()
    {'inspect':inspect,'acquire':acquire,'qa':qa,'verify':verify}[args.phase]()
