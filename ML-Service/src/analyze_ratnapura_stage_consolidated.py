"""Offline, read-only source audit; writes only one Markdown report.

Python 3.9+, standard library, pathlib; macOS and Windows. No model targets,
resampling, raw copies, network calls or predictions are produced.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from collections import Counter, defaultdict
from urllib.parse import urlparse
import hashlib
import json
import math
import statistics

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw'
REPORT = ROOT / 'outputs/ratnapura_stage_consolidated_qa.md'
PIN = '4f47a297db0da993ca8e05ba4bdc422c082add38'
OLD = 'baffd0a5fea232d05de7bcb80f3405740f1a1851'
BASE = 'data/rwlds/kalu-ganga-basin/kalu-ganga-river/rathnapura-station/2026/'
BATCHES = [
 ('ratnapura_stage_batch_2026-06-01_to_2026-06-30',709),
 ('ratnapura_stage_batch_2026-07-01_to_2026-07-31',747),
 ('ratnapura_stage_batch_2026-08-01_to_2026-08-31',739),
 ('ratnapura_stage_batch_2026-09-01_to_2026-09-10',246),
 ('ratnapura_stage_month_2026-09-11_to_2026-10-10',723),
 ('ratnapura_stage_pilot_2026-10-11_to_2026-10-17',167),
 ('ratnapura_stage_sample_2026-10-18',24),
]
LOCAL = timezone(timedelta(hours=5, minutes=30), 'Asia/Colombo')


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def digest(body):
    return hashlib.sha256(body).hexdigest()


def gitblob(body):
    return hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()


def load(path):
    return json.loads(path.read_bytes())


def finite(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)


def percentile(values, p):
    """Linear interpolation at (n-1)*p; analytical summaries only."""
    xs=sorted(values);k=(len(xs)-1)*p;i=int(k)
    return xs[i]+(xs[min(i+1,len(xs)-1)]-xs[i])*(k-i)


def local(epoch):
    return datetime.fromtimestamp(epoch,timezone.utc).astimezone(LOCAL).isoformat()


def verify_inventory():
    rows=[];inventory=[];identities=set();references=[]
    for folder,expected in BATCHES:
        directory=RAW/folder;m=load(directory/'manifest.json')
        revision=m.get('commit',m.get('github_commit'))
        require(revision in [PIN,OLD], 'Unexpected source revision')
        refs=[]
        # Check indexed metadata against its original HTTP receipt before use.
        if 'records' in m:
            for path in sorted((directory/'source_index').glob('*_tree.json')):
                receipt=load(path.with_suffix(path.suffix+'.receipt.json'));body=path.read_bytes()
                require(len(body)==receipt['bytes'] and digest(body)==receipt['sha256'],'Tree receipt mismatch')
                tree=json.loads(body);month=path.name[:7]
                require(tree.get('truncated') is False,'Truncated tree')
                refs.extend(dict(x,source_path=BASE+month+'/'+x['path']) for x in tree['tree'] if x['type']=='blob')
                references.append((str(path.relative_to(ROOT)),digest(body)))
            records=m['records'];observations=directory/'observations'
        else:
            paths=sorted((directory/'indexes').glob('*.json')) if (directory/'indexes').exists() else [directory/'source_metadata/github_day_listing.json']
            for path in paths:
                receipts=[x for x in m['retrievals'] if x.get('status')==200 and x['path']==str(path.relative_to(directory))]
                require(len(receipts)==1,'Ambiguous index receipt')
                receipt=receipts[0];body=path.read_bytes()
                require(len(body)==receipt['bytes'] and digest(body)==receipt['sha256'],'Index checksum mismatch')
                require('ref='+revision in receipt['url'],'Index revision mismatch')
                refs.extend(dict(x,source_path=x['path']) for x in json.loads(body))
                references.append((str(path.relative_to(ROOT)),digest(body)))
            records=[];observations=directory/'github_records'
            for receipt in m['retrievals']:
                if receipt.get('status')!=200 or not receipt['path'].startswith('github_records/'):continue
                source=receipt['url'].split('/'+revision+'/',1)[1]
                records.append(dict(receipt,source_path=source,source_revision=revision))
        indexed={x['source_path']:x for x in refs}
        require(len(indexed)==len(refs),'Duplicate index source paths')
        require(len(records)==expected,'Batch record count mismatch: '+folder)
        paths=set();size=0
        for entry in records:
            source=entry['source_path'];path=directory/entry['path']
            require(directory.resolve() in path.resolve().parents,'Unsafe local path')
            require(source not in identities,'Cross-batch duplicate source: '+source)
            identities.add(source);paths.add(path)
            require(source in indexed,'Missing indexed source: '+source)
            ix=indexed[source];body=path.read_bytes();size+=len(body)
            require(len(body)==entry['bytes']==ix['size'],'Size mismatch: '+source)
            require(digest(body)==entry['sha256'],'SHA-256 mismatch: '+source)
            require(gitblob(body)==ix['sha'],'Indexed Git blob mismatch: '+source)
            if 'git_blob_sha1' in entry:require(entry['git_blob_sha1']==ix['sha'],'Manifest blob mismatch')
            url='https://raw.githubusercontent.com/nuuuwan/lk_irrigation/'+revision+'/'+source
            require(entry['url']==url,'Source URL mismatch')
            if 'source_revision' in entry:require(entry['source_revision']==revision,'Record revision mismatch')
            filename=Path(source).name
            dt=datetime.strptime(filename,'%Y-%m-%d-%H-%M-%S.json').replace(tzinfo=LOCAL)
            require(source==BASE+dt.strftime('%Y-%m')+'/'+dt.date().isoformat()+'/'+filename,'Unexpected source naming')
            raw=json.loads(body);epoch=raw.get('time_ut');stage=raw.get('water_level_m')
            require(finite(epoch) and epoch==dt.timestamp(),'Reporting proxy/filename inconsistency')
            require(raw.get('station_name')=='Rathnapura','Unexpected station label')
            rows.append(dict(source_path=source,local_path=str(path.relative_to(ROOT)),revision=revision,url=url,
                sha256=entry['sha256'],git_blob=ix['sha'],retrieved_utc=entry.get('retrieved_utc'),
                original_timestamp=epoch,original_record=raw,epoch=epoch,time=local(epoch),day=dt.date().isoformat(),
                stage=stage,stage_present='water_level_m' in raw,batch=folder,
                ids={k:v for k,v in raw.items() if k.lower() in ['objectid','globalid','event_id','measurement_id','edit_id']}))
        actual={p for p in observations.rglob('*') if p.is_file()}
        require(len(paths)==expected and actual==paths,'Missing or extra unmanifested observation files')
        inventory.append((folder,expected,revision,size,digest((directory/'manifest.json').read_bytes())))
    require(len(rows)==3355,'Consolidated count mismatch')
    rows.sort(key=lambda r:(r['epoch'],r['source_path']))
    return rows,inventory,references


def pairs(rows):
    return [dict(a=a,b=b,seconds=b['epoch']-a['epoch'],change=b['stage']-a['stage'] if finite(a['stage']) and finite(b['stage']) else None) for a,b in zip(rows,rows[1:])]


def describe_change(pair):
    if pair is None:return 'None'
    return f"{pair['change']:+.4f} m; {pair['a']['time']} → {pair['b']['time']}; {pair['seconds']/60:.4f} min; `{pair['a']['source_path']}` → `{pair['b']['source_path']}`"


def main():
    require(not REPORT.exists(),'Refusing to overwrite existing report')
    rows,inventory,references=verify_inventory();ps=pairs(rows)
    stages=[r['stage'] for r in rows if finite(r['stage'])];intervals=[p['seconds']/60 for p in ps]
    days=Counter(r['day'] for r in rows);months=defaultdict(list)
    for r in rows:months[r['day'][:7]].append(r)
    expected_days=[(date(2026,6,1)+timedelta(days=i)).isoformat() for i in range(140)]
    require(sorted(days)==expected_days,'Coverage differs from 140 approved local dates')
    groups=defaultdict(list);idgroups=defaultdict(list)
    for r in rows:
        groups[r['epoch']].append(r)
        for key,value in r['ids'].items():
            if value is not None:idgroups[(key,str(value))].append(r)
    conflicts=[g for g in groups.values() if len({str(r['stage']) for r in g})>1]
    gaps=[p for p in ps if p['seconds']>5400];close=[p for p in ps if p['seconds']<=300]
    changes=[p for p in ps if finite(p['change'])]
    rises=sorted([p for p in changes if p['change']>0],key=lambda p:p['change'],reverse=True)
    falls=sorted([p for p in changes if p['change']<0],key=lambda p:p['change'])
    # Descriptive high-stage runs, without interpreting them as physical events.
    threshold=percentile(stages,.95);runs=[];run=[]
    for r in rows:
        if finite(r['stage']) and r['stage']>=threshold:
            if run and r['epoch']-run[-1]['epoch']>5400:runs.append(run);run=[]
            run.append(r)
        elif run:runs.append(run);run=[]
    if run:runs.append(run)
    lines=['# Consolidated Ratnapura historical stage quality and coverage assessment','',
      '**Status:** Read-only offline research QA; no model-ready dataset, targets or predictions. All times below are Asia/Colombo reporting/edit proxies, not verified physical measurement times.',
      '**Generated UTC:** '+datetime.now(timezone.utc).isoformat(),'',
      '## 1. Verified inventory and source provenance','',
      'Source: https://github.com/nuuuwan/lk_irrigation. Requested comparison snapshot: `'+PIN+'`. Original acquisition revisions are retained; no manifest is relabelled to a newer pin.', '',
      '| Batch folder under `data/raw/` | Verified records | Original revision | Raw bytes | Manifest SHA-256 |','|---|---:|---|---:|---|']
    lines += [f'| `{f}` | {n} | `{rev}` | {size} | `{h}` |' for f,n,rev,size,h in inventory]
    lines += ['',f'**3,355 / 3,355 records passed** manifest SHA-256, indexed Git-blob identity and byte-size checks; total original bytes: {sum(x[3] for x in inventory):,}. Every primary observation file is accounted for. No missing or extra observation files, duplicate source paths, source URL/revision conflicts, station-label mismatch, or filename/reporting-proxy mismatch was accepted. Secondary API responses and metadata files are not counted as observations.', '',
      'Index responses were checked against their original saved HTTP receipt checksums/sizes. Original pinned month-tree/day-listing membership was checked for every body. Local metadata is evidence of archived identity, not a cryptographic attestation of provider accuracy. The prior `ratnapura_remaining_archive_acquisition_plan.md` reported unchanged blob identities across the old and requested snapshots. This run independently verifies original-pin membership; it does **not** newly prove requested-pin membership for October records where the newer October tree is unavailable locally. Earlier acquisition provenance is preserved rather than assumed identical.', '',
      '## 2. Full-period coverage and reporting quality','',
      '| Measure | Result |','|---|---|',
      f"| Exact first / last reporting proxies | {rows[0]['time']} / {rows[-1]['time']} |",
      f'| Covered dates / reporting events | {len(days)} / {len(rows)} |',
      '| Entirely unrepresented dates within 1 June–18 October | 0 |',
      f'| Interval minimum / median / mean / maximum, minutes | {min(intervals):.6f} / {statistics.median(intervals):.6f} / {statistics.mean(intervals):.6f} / {max(intervals):.6f} |',
      f"| Interval percentiles P1/P5/P25/P50/P75/P90/P95/P99, minutes | {', '.join(f'{percentile(intervals,p):.6f}' for p in [.01,.05,.25,.5,.75,.9,.95,.99])} |",
      f'| Gaps strictly >90 min / >3h / >6h / >12h | {len(gaps)} / {sum(p["seconds"]>10800 for p in ps)} / {sum(p["seconds"]>21600 for p in ps)} / {sum(p["seconds"]>43200 for p in ps)} |',
      f'| Close consecutive reporting pairs ≤5 min | {len(close)} |',
      f'| Duplicate timestamp records / conflicting timestamp groups | {sum(len(g)-1 for g in groups.values())} / {len(conflicts)} |',
      f'| Consecutive unchanged-value pairs | {sum(p["change"]==0 for p in changes)} |',
      f'| Finite numeric stage / missing field / null / invalid non-null | {len(stages)} / {sum(not r["stage_present"] for r in rows)} / {sum(r["stage_present"] and r["stage"] is None for r in rows)} / {sum(r["stage_present"] and r["stage"] is not None and not finite(r["stage"]) for r in rows)} |',
      f'| Stage min / max / mean / median, source metres | {min(stages):.6f} / {max(stages):.6f} / {statistics.mean(stages):.6f} / {statistics.median(stages):.6f} |',
      f'| Rows supplying upstream object/event/measurement IDs | {sum(bool(r["ids"]) for r in rows)} |','',
      'All 3,354 consecutive intervals, including six cross-batch transitions, enter the overall statistics. Percentiles use linear interpolation at `(n−1)×p`. Stage mean/median are report-weighted, not time-weighted; irregular and repeated reporting can bias them. Absent upstream IDs make ID-based revision/conflict checks unavailable. Close pairs remain distinct reports, not automatically independent measurements or revisions.', '',
      '### Monthly summaries','',
      '| Month | Dates | Reports | Min–max stage (m) | Mean / median stage (m) | Within-month >90 min gaps / ≤5 min pairs |','|---|---:|---:|---|---|---|']
    for month,rs in months.items():
        vals=[r['stage'] for r in rs if finite(r['stage'])];pp=pairs(rs)
        lines.append(f'| {month} | {len({r["day"] for r in rs})} | {len(rs)} | {min(vals):.4f}–{max(vals):.4f} | {statistics.mean(vals):.6f} / {statistics.median(vals):.6f} | {sum(p["seconds"]>5400 for p in pp)} / {sum(p["seconds"]<=300 for p in pp)} |')
    lines += ['', 'October covers only 1–18 October; this is not a full-month or annual climatology.', '',
      '### Cross-batch boundaries','', '| Final report | Next report | Interval (min) | Stage A → B (m) | >90 min |','|---|---|---:|---|---|']
    for p in ps:
        if p['a']['batch']!=p['b']['batch']:lines.append(f'| {p["a"]["time"]} | {p["b"]["time"]} | {p["seconds"]/60:.6f} | {p["a"]["stage"]} → {p["b"]["stage"]} | {p["seconds"]>5400} |')
    lines += ['', '### Five largest consecutive rises and falls','']
    lines += ['- Rise: '+describe_change(p) for p in rises[:5]]+['- Fall: '+describe_change(p) for p in falls[:5]]
    lines += ['', '### All reporting gaps exceeding 90 minutes','', '| From reporting time | To reporting time | Minutes | Cross batch |','|---|---|---:|---|']
    for p in sorted(gaps,key=lambda p:p['seconds'],reverse=True):lines.append(f'| {p["a"]["time"]} | {p["b"]["time"]} | {p["seconds"]/60:.6f} | {p["a"]["batch"]!=p["b"]["batch"]} |')
    lines += ['', '### All close-event pairs','', '| From reporting time | To reporting time | Seconds | Stage A → B (m) |','|---|---|---:|---|']
    for p in close:lines.append(f'| {p["a"]["time"]} | {p["b"]["time"]} | {p["seconds"]} | {p["a"]["stage"]} → {p["b"]["stage"]} |')
    lines += ['', '## 3. Elevated-stage candidate reporting periods','',
      f'Exploratory rule: stage ≥ full-window 95th percentile (**{threshold:.6f} m**). A run ends at a below-threshold/invalid report or a reporting gap >90 minutes. No interpolation or official warning threshold is used. All runs, including singleton runs, are shown. These are high-stage reporting windows, **not confirmed floods or independent events**. Splitting at gaps prevents an unsupported assertion of continuous elevated stage.', '',
      '| Start reporting time | End reporting time | Peak (m) | Reports | Internal >90 min gaps | Largest rise / fall (m; elapsed min) | Crosses batch |','|---|---|---:|---:|---:|---|---|']
    for run in runs:
        pp=pairs(run);up=max((p for p in pp if p['change']>0),key=lambda p:p['change'],default=None);down=min((p for p in pp if p['change']<0),key=lambda p:p['change'],default=None)
        short=lambda p:f'{p["change"]:+.4f}; {p["seconds"]/60:.4f}' if p else 'None'
        lines.append(f'| {run[0]["time"]} | {run[-1]["time"]} | {max(r["stage"] for r in run):.4f} | {len(run)} | {sum(p["seconds"]>5400 for p in pp)} | {short(up)} / {short(down)} | {len({r["batch"] for r in run})>1} |')
    lines += ['', 'Runs are listed chronologically; peak values indicate descriptive prominence only; shared weather or split gaps can make multiple runs part of one physical episode. See the full gap table for interruptions before/after each run. Largest changes in this table refer only to consecutive reports inside each run, not unseen onset/recession behaviour.', '',
      '## 4. Forecasting-baseline feasibility — assessment only','',
      '| Experiment | Assessment | Required safeguards before evaluation |','|---|---|---|',
      '| Persistence | Feasible as a proposed retrospective reporting-time comparator; not executed | Use only stage already available at issuance; define target-matching tolerance, gap exclusions and revision policy first. |',
      '| Recent-trend baseline | Feasible as a limited proposal; not executed | Fit slope using actual elapsed reporting time from prior available reports; flag near-zero intervals, stale history and possible revisions; no future interpolation. |',
      '| One hour | Potentially testable; most intervals are near an hour, but next report is not automatically a one-hour target | Specify an elapsed-time target window, count eligible pairs, exclude ambiguous issuance clusters or evaluate sensitivity; no claim of exact measurement horizon. |',
      '| Three hours | Potentially testable from multi-report histories | Require documented lag availability and target tolerance; prohibit future revisions/backfilled inputs and report missing-window attrition. |',
      '| Six hours | Potentially testable, with greater horizon mismatch and persistence uncertainty | Use actual elapsed times, purge targets crossing train/test boundaries and assess event dependence; longer horizon is not automatically more defensible. |','',
      'No horizon-specific targets, model-ready tables or forecasts were constructed. Counts here establish reporting availability, not eligible training-pair counts or independent flood-event counts. A one-hour label would mean a future reported stage near a declared elapsed horizon under provisional semantics, not verified physical stage exactly one hour later.', '',
      'Future protocol: chronological development/validation/final-test blocks by reporting date, never random row splitting. Fit transformations and any thresholds on training only. Purge at least the maximum forecast horizon from split-crossing labels; also define historical input lookback and dependent-window handling. Keep clustered high-stage episodes together where practical and publish split stage/event coverage. Do not tune on the final test period.', '',
      'Reporting/edit time may follow physical measurement, and historical first publication is not established. Current archived revisions may not reproduce what was visible at a historical issuance time. Use explicit reporting-proxy assumptions, retain retrieval/original revision metadata, exclude future reports from features, never resolve a past conflict using later information, and compare sensitivity with/without flagged close clusters. This bounds an exploratory retrospective experiment; it cannot establish operational lead time. Without rainfall it assesses autoregressive stage behaviour, not rainfall-driven forecasting or causal cascade prediction.', '',
      '## 5. Scientific limitations and recommended next step','',
      'Measurement timestamps, station equivalence to official 003HD007, gauge datum/stability, relocation history, source revisions and first availability remain unverified. Reporting gaps do not prove missing physical measurements. Large changes and high-stage runs are not independently verified flood events. Public access/code licensing does not settle observation redistribution rights; retain original attribution. The provisional V2 watershed area/location discrepancy is unresolved and has not been used to adjust stage values.', '',
      'This 140-date window samples June–October only; it does not establish annual seasonality, out-of-season skill, independent event sufficiency, or operational early-warning readiness. More older data may improve temporal diversity but will not resolve time semantics or datum.', '',
      '**Priority recommendation: Option 2 first — a limited exploratory forecasting-baseline feasibility protocol**, before further acquisition. The current verified archive is sufficient to specify and audit target-time eligibility and leakage controls; use that exercise to determine what additional data would add. Option 1 (May/earlier acquisition) remains useful for later temporal coverage, but more of the same source does not by itself solve the principal scientific ambiguities.', '',
      '**One smallest next step:** approve a documentation-only baseline evaluation protocol defining reporting-time issuance, horizon tolerances, close-event/revision handling, chronological splits, eligibility checks and MAE/RMSE/bias plus persistence skill evaluation. Do not generate targets or fit/evaluate models until that protocol is reviewed.', '',
      '## 6. Daily coverage','', '| Local date | Source reports |','|---|---:|']
    lines += [f'| {day} | {days[day]} |' for day in expected_days]
    lines += ['', '## 7. Reproducibility and evidence references','',
      'Run from the repository root (offline, existing Python; no third-party packages):','', '```text',
      'ML-Service/.venv/bin/python ML-Service/src/analyze_ratnapura_stage_consolidated.py',
      '& .\\ML-Service\\.venv\\Scripts\\python.exe .\\ML-Service\\src\\analyze_ratnapura_stage_consolidated.py','```','',
      'The script refuses to overwrite this report. All record rows remain in memory only. Source paths for extreme changes are explicit above; remaining daily/gap/period results reproduce from original records and the stated algorithms. Invalid timestamps or identity/integrity failures stop before report creation. Stage-quality issues are counted and retained.', '',
      'Existing context: `ratnapura_remaining_archive_acquisition_plan.md`, batch QA reports for June/July/August/September/month/pilot, `ratnapura_record_revision_review.md`, `ratnapura_observation_semantics_review.md`, and `ratnapura_stage_sample_qa.md`. Existing reports are not rewritten.', '',
      'Pinned local index files and SHA-256 checksums used in this audit:','']
    lines += [f'- `{path}` — `{h}`' for path,h in references]
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')
    print('PASS: 3355 records, 140 dates, source identity / size / SHA-256 / indexed blobs / exact observation file sets')
    print('Coverage:',rows[0]['time'],rows[-1]['time'])
    print('Gaps >90min / >3h / >6h / >12h:',len(gaps),*[sum(p['seconds']>t for p in ps) for t in [10800,21600,43200]])
    print('Close pairs:',len(close),'duplicate timestamps:',sum(len(g)-1 for g in groups.values()),'unchanged:',sum(p['change']==0 for p in changes))
    print('Intervals min/median/mean/max:',min(intervals),statistics.median(intervals),statistics.mean(intervals),max(intervals))
    print('Stage min/max/mean/median:',min(stages),max(stages),statistics.mean(stages),statistics.median(stages))
    print('P95 stage:',threshold,'elevated runs:',len(runs));print('Report:',REPORT)


if __name__=='__main__':
    main()
