"""Controlled 2026-10-18 Rathnapura sample: inspect, acquire, then local QA.

Uses Python standard library only. No interpolation, cleaning or model training.
Run each phase once with the existing virtual environment's Python.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import Counter
import argparse
import hashlib
import json
import math
import statistics
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / 'data/raw/ratnapura_stage_sample_2026-10-18'
REPORT = ROOT / 'outputs/ratnapura_stage_sample_qa.md'
DAY = '2026-10-18'
LOCAL = timezone(timedelta(hours=5, minutes=30), name='Asia/Colombo')
DAY_PATH = ('data/rwlds/kalu-ganga-basin/kalu-ganga-river/rathnapura-station/'
            '2026/2026-10/2026-10-18')
REPO = 'https://api.github.com/repos/nuuuwan/lk_irrigation'
SECONDARY = 'https://slwaterlevel.mevinu.com/api/history/Rathnapura?date=2026-10-18&detailed=true'


def save_json(path, obj):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(obj, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def fetched(relative, url, limit=200000):
    """Preserve response bytes, and append request provenance immediately.

    Serial requests, paced to <=~55/min; no authentication, retries or bypasses.
    Exceptions stop the phase. Already acquired files are never overwritten.
    """
    path = SAMPLE / relative
    if path.exists():
        raise FileExistsError('Preserving acquired response: ' + str(path))
    time.sleep(1.1)
    requested = datetime.now(timezone.utc).isoformat()
    req = urllib.request.Request(url, headers={'User-Agent': 'Cascade-research-sample-QA/1.0',
                                               'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=25) as response:
        body = response.read(limit + 1)
        if len(body) > limit:
            raise RuntimeError('Response exceeds approved small-response bound: ' + url)
        received = datetime.now(timezone.utc).isoformat()
        entry = {'path': relative, 'url': url, 'final_url': response.url, 'status': response.status,
                 'request_started_utc': requested, 'retrieved_utc': received,
                 'bytes': len(body), 'sha256': sha256(body),
                 'headers': {k: response.headers.get(k) for k in
                             ('Content-Type', 'ETag', 'Last-Modified', 'X-RateLimit-Remaining', 'X-RateLimit-Reset')
                             if response.headers.get(k) is not None}}
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        stream.write(body)
    with (SAMPLE / 'retrieval_log.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(entry, ensure_ascii=False) + '\n')
    print('Fetched', relative, len(body), 'bytes', flush=True)
    return body


def inspect_sources():
    if SAMPLE.exists() and any(SAMPLE.iterdir()):
        raise FileExistsError('Preserving existing sample folder')
    SAMPLE.mkdir(parents=True, exist_ok=True)
    ref = json.loads(fetched('source_metadata/github_ref.json', REPO + '/git/ref/heads/main'))
    commit = ref['object']['sha']
    raw = 'https://raw.githubusercontent.com/nuuuwan/lk_irrigation/' + commit + '/'
    listing = json.loads(fetched('source_metadata/github_day_listing.json',
                                REPO + '/contents/' + DAY_PATH + '?ref=' + commit))
    if not isinstance(listing, list) or not 1 <= len(listing) <= 100:
        raise RuntimeError('Unexpected day listing; stop before observations')
    for item in listing:
        name = item['name']
        stamp = datetime.strptime(name, '%Y-%m-%d-%H-%M-%S.json')
        if item['type'] != 'file' or stamp.date().isoformat() != DAY or item['size'] > 10000:
            raise RuntimeError('Unexpected item/date/size; stop before observations')
    sources = {
        'github_load_mixin.py.txt': 'src/lk_irrigation/rwld/RiverWaterLevelDataLoadMixin.py',
        'github_time_mixin.py.txt': 'src/lk_irrigation/base/HasTimeMixin.py',
        'github_station_model.py.txt': 'src/lk_irrigation/core/Station.py',
        'github_stations.json': 'data/static/stations.json',
        'github_LICENSE.txt': 'LICENSE',
    }
    for filename, path in sources.items():
        fetched('source_metadata/' + filename, raw + path, 30000)
    fetched('source_metadata/secondary_api_docs.html', 'https://slwaterlevel.mevinu.com/api', 250000)
    save_json(SAMPLE / 'inspection.json', {
        'date': DAY, 'timezone': 'Asia/Colombo', 'utc_offset': '+05:30', 'commit': commit,
        'primary_day_path': DAY_PATH, 'listed_files': len(listing),
        'listing_filenames': [x['name'] for x in listing],
        'review_required': 'Inspect preserved source code and docs before --phase acquire',
        'measurement_time_verified': False,
    })
    print('SOURCE INSPECTION COMPLETE; no observation files acquired. Commit:', commit)


def acquire():
    info = json.loads((SAMPLE / 'inspection.json').read_text())
    listing = json.loads((SAMPLE / 'source_metadata/github_day_listing.json').read_text())
    if (SAMPLE / 'manifest.json').exists():
        raise FileExistsError('Sample acquisition already complete; use local QA only')
    for item in listing:
        url = 'https://raw.githubusercontent.com/nuuuwan/lk_irrigation/' + info['commit'] + '/' + item['path']
        body = fetched('github_records/' + item['name'], url, 10000)
        # Verify exact Git blob identity as well as SHA-256 preserved in ledger.
        blob = hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()
        if blob != item['sha']:
            raise RuntimeError('Git blob mismatch: ' + item['name'])
    fetched('secondary/history_2026-10-18.json', SECONDARY, 100000)
    entries = [json.loads(s) for s in (SAMPLE / 'retrieval_log.jsonl').read_text().splitlines()]
    manifest = {
        'title': 'Exploratory Rathnapura stage QA sample; NOT a training dataset',
        'local_calendar_date': DAY, 'timezone': 'Asia/Colombo', 'offset': '+05:30',
        'utc_window': ['2026-10-17T18:30:00Z', '2026-10-18T18:30:00Z'],
        'github_repository': 'https://github.com/nuuuwan/lk_irrigation',
        'github_commit': info['commit'], 'github_day_path': DAY_PATH,
        'github_raw_records': len(listing), 'secondary_endpoint': SECONDARY,
        'retrievals': entries,
        'provenance': 'Primary code maps ArcGIS EditDate to Unix seconds; secondary republishes stage/rain history. Shared upstream feed likely; not independent validation.',
        'timestamp_semantics': {'actual_measurement_time': 'Unverified for every record',
                                'primary_time_ut': 'ArcGIS EditDate truncated to whole epoch seconds per inspected source code',
                                'source_publication_time': 'Not supplied', 'source_edit_time': 'Inferred from scraper lineage; raw per-record EditDate not retained in primary',
                                'retrieval_time': 'Separately recorded UTC times; never used as measurement time'},
        'units': {'primary': 'water_level_m; station unit property must be checked',
                  'secondary': 'API docs specify stage m and rain mm', 'vertical_datum': 'Unverified'},
        'station_identity': {'public_label': 'Rathnapura / Kalu Ganga', 'official_code_context': '003HD007',
                             'code_crosswalk': 'Unverified; do not assume equivalence from names'},
        'license': {'primary': 'MIT repository licence preserved; government-data reuse scope not established',
                    'secondary': 'No explicit data licence found in inspected API documentation; public access is not a reuse licence'},
        'access': 'Public GETs without credentials; serial paced requests; no complete archive/clone or adjacent-day request',
        'incidental_metadata': 'Secondary response may contain retrieval-era current_level/status metadata; excluded from the dated sample and QA',
        'restrictions': 'No interpolation, outlier removal, stage-to-discharge conversion, training or bulk expansion',
    }
    save_json(SAMPLE / 'manifest.json', manifest)
    print('ACQUISITION COMPLETE; raw bodies preserved. Run --phase qa without network.')


def numeric(v):
    # Do not coerce missing/boolean/numeric strings into valid observations.
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def iso_epoch(value):
    return datetime.fromtimestamp(value, timezone.utc).astimezone(LOCAL)


def summary(rows):
    ts = [r['epoch_seconds'] for r in rows if r['epoch_seconds'] is not None]
    ordered = sorted(ts)
    gaps = [(b - a) / 60 for a, b in zip(ordered, ordered[1:])]
    levels = [r['stage'] for r in rows if numeric(r['stage'])]
    hours = Counter(iso_epoch(t).hour for t in ts)
    pairs = [(b['epoch_seconds'] - a['epoch_seconds'], b['stage'] - a['stage'],
              a['local_time'], b['local_time']) for a, b in zip(rows, rows[1:])
             if a['epoch_seconds'] is not None and b['epoch_seconds'] is not None
             and numeric(a['stage']) and numeric(b['stage'])]
    return {'raw_rows': len(rows), 'numeric_stage': len(levels),
            'null_stage': sum(r['stage'] is None for r in rows),
            'invalid_or_nonnumeric_stage': len(rows) - len(levels),
            'verified_measurement_timestamps': 0,
            'parseable_reporting_timestamps': len(ts),
            'duplicate_reporting_timestamps': len(ts) - len(set(ts)),
            'duplicate_time_stage_pairs': len(rows) - len(set((r['epoch_seconds'], str(r['stage'])) for r in rows)),
            'nonmonotonic_or_equal_in_source_order': sum(b <= a for a, b in zip(ts, ts[1:])),
            'reporting_span_local': [iso_epoch(min(ts)).isoformat(), iso_epoch(max(ts)).isoformat()] if ts else None,
            'stage_range_m_source_units': [min(levels), max(levels)] if levels else None,
            'reporting_interval_minutes': {'min': min(gaps), 'median': statistics.median(gaps), 'max': max(gaps)} if gaps else None,
            'empty_local_hour_bins': [h for h in range(24) if hours[h] == 0],
            'multiple_record_local_hour_bins': {str(h): n for h, n in hours.items() if n > 1},
            'reporting_gaps_over_90_minutes': [p for p in pairs if p[0] > 90 * 60],
            'largest_absolute_stage_change': max(pairs, key=lambda p: abs(p[1])) if pairs else None,
            'unchanged_consecutive_stage_pairs': sum(p[1] == 0 for p in pairs),
            'repeated_stage_values': {str(v): n for v, n in Counter(levels).items() if n > 1}}


def qa():
    manifest = json.loads((SAMPLE / 'manifest.json').read_text())
    for item in manifest['retrievals']:
        body = (SAMPLE / item['path']).read_bytes()
        if len(body) != item['bytes'] or sha256(body) != item['sha256']:
            raise RuntimeError('Raw-file integrity failure: ' + item['path'])
    primary = []
    for path in sorted((SAMPLE / 'github_records').glob('*.json')):
        obj = json.loads(path.read_text())
        raw_t = obj.get('time_ut'); epoch = raw_t if numeric(raw_t) else None
        filename_dt = datetime.strptime(path.name, '%Y-%m-%d-%H-%M-%S.json').replace(tzinfo=LOCAL)
        local = iso_epoch(epoch) if epoch is not None else None
        primary.append({'source': 'github', 'raw_path': str(path.relative_to(SAMPLE)),
                        'raw_timestamp': raw_t, 'epoch_seconds': epoch,
                        'utc_time': local.astimezone(timezone.utc).isoformat() if local else None,
                        'local_time': local.isoformat() if local else None,
                        'filename_time_local': filename_dt.isoformat(),
                        'filename_epoch_conflict': local != filename_dt,
                        'local_day_conflict': local is None or local.date().isoformat() != DAY,
                        'station_name_conflict': obj.get('station_name') != 'Rathnapura',
                        'stage': obj.get('water_level_m'),
                        'actual_measurement_time': None, 'publication_time': None,
                        'time_meaning': 'Reporting/edit proxy; actual observation time unverified'})
    response = json.loads((SAMPLE / 'secondary/history_2026-10-18.json').read_text())
    secondary = []
    for i, obj in enumerate(response.get('readings', [])):
        raw_ts, raw_iso = obj.get('ts'), obj.get('time')
        epoch = raw_ts / 1000 if numeric(raw_ts) else None
        try:
            parsed = datetime.fromisoformat(raw_iso) if isinstance(raw_iso, str) else None
            if parsed is not None and parsed.utcoffset() is None:
                parsed = None  # No silent timezone assignment.
        except ValueError:
            parsed = None
        local = iso_epoch(epoch) if epoch is not None else None
        secondary.append({'source': 'secondary', 'raw_path': 'secondary/history_2026-10-18.json', 'raw_row_index': i,
                          'raw_timestamp': raw_ts, 'raw_iso_time': raw_iso, 'epoch_seconds': epoch,
                          'utc_time': local.astimezone(timezone.utc).isoformat() if local else None,
                          'local_time': local.isoformat() if local else None,
                          'iso_epoch_conflict': parsed is None or epoch is None or abs(parsed.timestamp() - epoch) > 0.00001,
                          'local_day_conflict': local is None or local.date().isoformat() != DAY,
                          'stage': obj.get('water_level'), 'rainfall_source_units': obj.get('rain_fall'),
                          'actual_measurement_time': None, 'publication_time': None,
                          'time_meaning': 'API reporting timestamp; actual observation time and rainfall interval unverified'})
    ledger = {item['path']: item for item in manifest['retrievals']}
    for row in primary + secondary:
        item = ledger[row['raw_path']]
        row.update(source_url=item['url'], retrieved_utc=item['retrieved_utc'], raw_sha256=item['sha256'],
                   timestamp_uncertainty='Actual measurement/publication times and gauge datum unverified')
    # Do not hide duplicate candidates by indexing a timestamp to only one row.
    matched = []
    for a in primary:
        candidates = [b for b in secondary if a['epoch_seconds'] is not None and b['epoch_seconds'] is not None
                      and math.floor(a['epoch_seconds']) == math.floor(b['epoch_seconds'])]
        exact = [b for b in candidates if a['epoch_seconds'] == b['epoch_seconds']]
        chosen = candidates[0] if len(candidates) == 1 else None
        matched.append({'primary_path': a['raw_path'], 'primary_time': a['local_time'],
                        'secondary_candidates_same_epoch_second': len(candidates),
                        'exact_timestamp_candidates': len(exact),
                        'secondary_time': chosen['local_time'] if chosen else None,
                        'timestamp_difference_seconds': chosen['epoch_seconds'] - a['epoch_seconds'] if chosen else None,
                        'same_stage': a['stage'] == chosen['stage'] if chosen else None,
                        'stage_difference_m_source_units': chosen['stage'] - a['stage']
                        if chosen and numeric(a['stage']) and numeric(chosen['stage']) else None})
    comparisons = {'exact_timestamp_and_stage_matches': sum(r['exact_timestamp_candidates'] == 1 and r['same_stage'] is True for r in matched),
                   'unique_matches_at_documented_whole_second_precision': sum(r['secondary_candidates_same_epoch_second'] == 1 for r in matched),
                   'same_stage_at_whole_second_precision': sum(r['same_stage'] is True for r in matched),
                   'stage_disagreements_at_whole_second_precision': sum(r['same_stage'] is False for r in matched),
                   'unmatched_or_ambiguous_primary': sum(r['secondary_candidates_same_epoch_second'] != 1 for r in matched),
                   'unmatched_secondary': sum(not any(a['epoch_seconds'] is not None and b['epoch_seconds'] is not None
                       and math.floor(a['epoch_seconds']) == math.floor(b['epoch_seconds']) for a in primary) for b in secondary),
                   'comparisons': matched}
    result = {'status': 'Exploratory QA, not cleaned observations or a training dataset',
              'primary': summary(primary), 'secondary': summary(secondary), 'comparison': comparisons,
              'primary_filename_conflicts': sum(r['filename_epoch_conflict'] for r in primary),
              'secondary_iso_epoch_conflicts': sum(r['iso_epoch_conflict'] for r in secondary),
              'wrong_local_day': sum(r['local_day_conflict'] for r in primary + secondary),
              'station_conflicts': sum(r['station_name_conflict'] for r in primary),
              'secondary_gauge_conflict': response.get('gauge') != 'Rathnapura',
              'rain_null_count': sum(r['rainfall_source_units'] is None for r in secondary),
              'rain_invalid_numeric_count': sum(not numeric(r['rainfall_source_units']) for r in secondary),
              'rain_field_arithmetic_sum_unverified_interval': sum(r['rainfall_source_units'] for r in secondary if numeric(r['rainfall_source_units'])),
              'rain_interval': 'Unverified; sum is not certified daily or hourly rainfall',
              'raw_bytes': sum(r['bytes'] for r in manifest['retrievals'])}
    save_json(SAMPLE / 'exploratory_inspection.json', {'status': result['status'], 'rows': primary + secondary})
    save_json(SAMPLE / 'qa_summary.json', result)
    print(json.dumps(result, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', required=True, choices=('inspect', 'acquire', 'qa'))
    phase = parser.parse_args().phase
    {'inspect': inspect_sources, 'acquire': acquire, 'qa': qa}[phase]()
