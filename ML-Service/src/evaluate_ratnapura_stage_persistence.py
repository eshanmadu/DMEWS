"""Offline persistence experiment: June–July development and August validation ONLY.

No final-period matching/scoring. Standard library, Python 3.9+, macOS/Windows.
Existing audit helpers are loaded without executing their report-producing main.
Only one aggregate Markdown report is saved; cases remain in memory.
"""
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
import runpy
import hashlib
import statistics
import math
import json

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'outputs/ratnapura_stage_persistence_development_validation.md'
AUDIT=runpy.run_path(str(ROOT/'src/audit_ratnapura_stage_baseline_eligibility.py'))
LOCAL=AUDIT['LOCAL'];finite=AUDIT['finite'];percentile=AUDIT['percentile']
LIMIT=AUDIT['epoch']('2026-09-01T00:00')
SPLITS=tuple(AUDIT['SPLITS'][:2])
EXPECTED={('Development',1):1113,('Development',3):1009,('Development',6):876,
          ('Validation',1):587,('Validation',3):549,('Validation',6):510}


def require(ok,message):
    if not ok:raise RuntimeError(message)


def allowed_case(case):
    require(case['split'] in ['Development','Validation'],'Final/unknown split forbidden')
    require(case['s']<LIMIT and case['input']['epoch']<LIMIT and case['target']['epoch']<LIMIT,'Final-period forecast/target forbidden')
    require(case['input']['epoch']<=case['s']-300,'Future/unavailable input forbidden')
    require(case['s']-case['input']['epoch']<=5400,'Stale input forbidden')
    require(case['s']+case['h']*3600<=case['target']['epoch']<=case['s']+case['h']*3600+900,'Invalid elapsed-time target')


def persistence(case):
    allowed_case(case)
    # Prediction depends exclusively on the approved historical input value.
    return case['input']['stage']


def metrics(errors):
    if not errors:return None
    absolute=[abs(e) for e in errors]
    return dict(n=len(errors),mae=statistics.mean(absolute),rmse=math.sqrt(statistics.mean(e*e for e in errors)),
                bias=statistics.mean(errors),median_absolute=statistics.median(absolute),p90_absolute=percentile(absolute,.9))


def build_pairs(rows):
    require(all(r['epoch']<LIMIT for r in rows),'Final records cannot enter matching')
    ts=[r['epoch'] for r in rows];_,cmap=AUDIT['clusters'](rows)
    gaps=[(a['epoch'],b['epoch']) for a,b in zip(rows,rows[1:]) if b['epoch']-a['epoch']>5400]
    result={}
    for split,start,end in SPLITS:
        candidates=[];reason_counts=Counter();scheduled=0
        for hour in range(int((end-start)/3600)):
            s=start+hour*3600
            if not AUDIT['scheduled'](s,start,end):continue
            scheduled+=1;r,reason=AUDIT['input_at'](rows,s,start)
            if reason:reason_counts[reason]+=1;continue
            candidates.append((s,r))
        for h in [1,3,6]:
            cases=[];funnel=Counter();seen=set();matched=0
            for s,r in candidates:
                i,reason=AUDIT['first_target'](rows,s+h*3600,end)
                if reason:funnel[reason]+=1;continue
                matched+=1;target=rows[i];q=target['epoch']
                if not finite(target['stage']):funnel['invalid_target']+=1;continue
                if (i>0 and ts[i-1]==q) or (i+1<len(ts) and ts[i+1]==q):funnel['duplicate_time_target']+=1;continue
                if i in cmap:funnel['close_target']+=1;continue
                # Frozen audited covered-time interpretation. No September context needed.
                if q+300>=end or q+300>ts[-1]:funnel['insufficient_target_context']+=1;continue
                if any(AUDIT['gap_intersects'](a,b,r['epoch'],q) for a,b in gaps):funnel['continuity_gap']+=1;continue
                if target['source_path'] in seen:funnel['target_reuse_same_horizon']+=1;continue
                seen.add(target['source_path'])
                case=dict(split=split,h=h,s=s,input=r,target=target)
                allowed_case(case)
                require(start<=r['epoch'] and q+300<end,'Partition context violation')
                cases.append(case)
            require(len(cases)+sum(funnel.values())==len(candidates),'Exclusion accounting mismatch')
            result[(split,h)]=dict(scheduled=scheduled,eligible=len(candidates),cases=cases,funnel=dict(funnel),matched=matched,input_reasons=dict(reason_counts))
    # Entire count gate completes BEFORE any prediction or error is calculated.
    require(set(result)==set(EXPECTED),'Unexpected evaluation split')
    for key,n in EXPECTED.items():require(len(result[key]['cases'])==n,'Approved usable count mismatch: '+str(key))
    return result,gaps


def signature(result):
    return [(key,[(c['s'],c['input']['source_path'],c['target']['source_path']) for c in r['cases']]) for key,r in result.items()]


def score(result):
    scored={}
    for key,r in result.items():
        require(key in EXPECTED,'Forbidden evaluation key')
        scored[key]=[dict(c,prediction=persistence(c),error=persistence(c)-c['target']['stage']) for c in r['cases']]
    return scored


def test_persistence():
    tests=[]
    def check(name,condition):
        require(condition,name);tests.append(name)
    s=AUDIT['epoch']('2026-06-10T12:00');inp=dict(epoch=s-600,stage=2.0,source_path='test-input')
    case=dict(split='Development',h=1,s=s,input=inp,target=dict(epoch=s+3600,stage=3.0,source_path='test-target'))
    check('Persistence returns latest eligible historical stage',persistence(case)==2)
    changed=dict(case,target=dict(case['target'],stage=900))
    check('Changing future target value cannot change prediction',persistence(changed)==2)
    for name,bad in [('Final-period case rejected',dict(case,split='Final',s=LIMIT)),
                     ('Final target rejected',dict(case,target=dict(case['target'],epoch=LIMIT))),
                     ('Input after availability cutoff rejected',dict(case,input=dict(inp,epoch=s-299))),
                     ('Wrong elapsed horizon rejected',dict(case,target=dict(case['target'],epoch=s+3600-1)))]:
        try:persistence(bad)
        except RuntimeError:tests.append(name)
        else:raise AssertionError(name)
    m=metrics([-1,2]);check('Bias sign is predicted minus observed',m['bias']==.5)
    check('MAE and median absolute error known fixture',m['mae']==1.5 and m['median_absolute']==1.5)
    check('RMSE known fixture',math.isclose(m['rmse'],math.sqrt(2.5)))
    check('P90 uses frozen linear percentile',math.isclose(m['p90_absolute'],1.9))
    check('Empty subgroup yields unavailable metrics',metrics([]) is None)
    return tests


def fmt(m):
    if m is None:return 'N=0; unavailable'
    return f"N={m['n']}; MAE={m['mae']:.6f}, RMSE={m['rmse']:.6f}, bias={m['bias']:+.6f}, median AE={m['median_absolute']:.6f}, P90 AE={m['p90_absolute']:.6f} m"


def main():
    require(not REPORT.exists(),'Refusing to overwrite existing report')
    old_tests=AUDIT['test_rules']();tests=test_persistence()
    raw,inventory,_=AUDIT['LIB']['verify_inventory']()
    require(len(raw)==3355,'Archive inventory mismatch')
    # Final-period values are used only by the existing integrity verifier.
    # Discard immediately; no final-period schedule, targets, clusters or errors.
    rows=[r for r in raw if r['epoch']<LIMIT];del raw
    require(len(rows)==2195,'Development/validation source count mismatch')
    result,gaps=build_pairs(rows)
    tests.append('All six approved pair counts reproduced before scoring')
    repeated,_=build_pairs(rows)
    require(signature(result)==signature(repeated),'Non-deterministic eligibility')
    tests.append('Repeated eligibility reproduces identical source identities')
    # Freeze the protocol's development-only percentile BEFORE inspecting errors.
    dev_cutoff=percentile([r['stage'] for r in rows if r['epoch']<SPLITS[0][2]],.95)
    scored=score(result);scored_again=score(repeated)
    require(scored==scored_again,'Non-deterministic predictions/errors')
    tests.append('Repeated evaluation produces identical predictions/errors and metrics')
    require(all(c['target']['epoch']<LIMIT and c['s']<LIMIT for cs in scored.values() for c in cs),'Final leakage')
    tests.append('Every scored issuance/input/target is before final-period boundary')
    # Independent check of each persistence prediction and target window.
    for key,cs in scored.items():
        for c in cs:
            past=[r for r in rows if dict((x[0],x[1]) for x in SPLITS)[c['split']]<=r['epoch']<=c['s']-300]
            require(c['input']['source_path']==past[-1]['source_path'],'Latest report mismatch')
            require(c['prediction']==past[-1]['stage'],'Historical persistence mismatch')
            require(not any(AUDIT['gap_intersects'](a,b,c['input']['epoch'],c['target']['epoch']) for a,b in gaps),'Gap mismatch')
    tests.append('All actual predictions use latest eligible past stage; retained gaps and time windows rechecked')
    def near_gap(c):
        lo=c['input']['epoch'];hi=c['target']['epoch']
        return any((b<=lo and lo-b<=10800) or (a>=hi and a-hi<=10800) for a,b in gaps)
    lines=['# Ratnapura persistence baseline — development and validation only','',
      '**Scope:** Limited retrospective reporting-proxy experiment. September–October final evaluation was not matched or scored.',
      '**Generated UTC:** '+datetime.now(timezone.utc).isoformat(),'',
      '## 1. Integrity, provenance and frozen policy','',
      'All **3,355 / 3,355** original records passed the existing verifier (manifest SHA-256/size, indexed Git blobs, original source paths/revisions, exact file sets). After integrity verification, all records at/after **1 September 2026 00:00 Asia/Colombo** were discarded from the experiment. Exactly **2,195** June–August records remained. Original records/manifests and historical research scripts were unchanged.', '',
      'No protocol/audit contradiction requiring a rule change was identified. The approved audit interpretations resolve endpoint/context ambiguities and are frozen:', '',
      '- Gap intersection means **positive-duration overlap** with [input time,target time]; merely touching an observed endpoint does not exclude a case.',
      '- Target context means target+5 minutes is before partition end and no later than the last covered proxy, not another observation within five minutes.',
      '- Close inputs: latest report in the past-only cutoff view causes abstention if in a known ≤300-second chain; no reach-back. Target close-chain exclusion is retrospective outcome QA, with no replacement.',
      '- Exact local hourly issuance; reports ≤issuance−5 minutes, input age ≤90 minutes; no future neighbour changes past input state.',
      '- First raw report at/after issuance+h, ≤15 minutes late; no earlier substitute or interpolation.',
      '- Development [1 June,1 August), validation [1 August,1 September); six-hour warmup and strict issuance+6h30m<partition-end embargo. No earlier-partition input is carried into validation.', '',
      'Primary eligibility rules are reused from the audit helpers. The orchestration is restricted to its first two partitions; the existing audit main is never called. No final-period schedule, target matching, close-chain analysis or performance calculation is executed.', '',
      '## 2. Reproduced eligibility and coverage','',
      '| Split | h | Calendar hours | Scheduled | Input eligible | Time matched | Evaluated N | N / scheduled | N / input eligible | Outcome exclusions |',
      '|---|---:|---:|---:|---:|---:|---:|---|---|---|']
    for (split,h),r in result.items():
        n=len(r['cases']);hours=1464 if split=='Development' else 744
        lines.append(f'| {split} | {h} | {hours} | {r["scheduled"]} | {r["eligible"]} | {r["matched"]} | {n} | {n}/{r["scheduled"]} ({100*n/r["scheduled"]:.2f}%) | {n}/{r["eligible"]} ({100*n/r["eligible"]:.2f}%) | {r["funnel"]} |')
    lines += ['', 'All six expected counts were required to match **before scoring any case**. A mismatch stops evaluation. Each partition removes six warmup and six end-embargo hourly opportunities. Repeated source-target use across horizons is correlated, not extra independent observations.', '',
      '## 3. Persistence equation and metrics','',
      '**ŷ(s,h)=y₀**, the original latest eligible input stage. No fitting, recent-trend model, smoothing, clipping or interpolation. Error **e=predicted−observed**; positive bias is overprediction.', '',
      'MAE=mean(|e|); RMSE=sqrt(mean(e²)); bias=mean(e); median AE=median(|e|); P90 AE is the linear-interpolated 90th percentile of |e| using (N−1)p. Units are source metres. No persistence-relative skill, confidence intervals or independent-row significance claims.', '',
      '| Split | h | N | MAE (m) | RMSE (m) | Bias (m) | Median AE (m) | P90 AE (m) |',
      '|---|---:|---:|---:|---:|---:|---:|---:|']
    for (split,h),cs in scored.items():
        m=metrics([c['error'] for c in cs]);lines.append(f'| {split} | {h} | {m["n"]} | {m["mae"]:.6f} | {m["rmse"]:.6f} | {m["bias"]:+.6f} | {m["median_absolute"]:.6f} | {m["p90_absolute"]:.6f} |')
    lines += ['', '## 4. Input ages, actual horizons and target lateness','',
      '| Split | h | Input age (minutes) | Target lateness beyond nominal (minutes) | Actual elapsed horizon (minutes) |',
      '|---|---:|---|---|---|']
    for (split,h),cs in scored.items():
        lines.append(f'| {split} | {h} | {AUDIT["distribution"]([(c["s"]-c["input"]["epoch"])/60 for c in cs])} | {AUDIT["distribution"]([(c["target"]["epoch"]-c["s"]-h*3600)/60 for c in cs])} | {AUDIT["distribution"]([(c["target"]["epoch"]-c["s"])/60 for c in cs])} |')
    lines += ['', 'These comparisons are nominal 1h/3h/6h **reported-stage** horizons with up to 15-minute late targets. The held input itself is often almost an hour old. Thus the physical measurement-to-measurement interval and real public-warning lead time are not established.', '',
      '## 5. Elevated-stage and ordinary-stage errors','',
      f'Primary subgroup rule follows protocol section 8: **development-only P95 = {dev_cutoff:.6f} m**, computed from June–July reports before any error inspection and held fixed for August. Elevated means matched target stage ≥cutoff; ordinary means below. This is an exploratory outcome stratum, not a flood threshold. No eligibility or prediction depends on this stratum.', '',
      '| Split | h | Subgroup | Error summary |','|---|---:|---|---|']
    for (split,h),cs in scored.items():
        for name,selected in [('elevated',[c for c in cs if c['target']['stage']>=dev_cutoff]),('ordinary',[c for c in cs if c['target']['stage']<dev_cutoff])]:
            lines.append(f'| {split} | {h} | {name} | {fmt(metrics([c["error"] for c in selected]))} |')
    lines += ['', 'For continuity with prior descriptive QA only, the already published **5.54 m** whole-archive cutoff is shown separately below. Its value was known before this experiment and was not changed after error inspection. It is **not** the primary development-frozen threshold, and its earlier use of final-period distribution makes it unsuitable as a newly claimed leakage-free training threshold. No final-period record is consulted to apply this already documented constant.', '',
      '| Split | h | Contextual ≥5.54 m | Contextual <5.54 m |','|---|---:|---|---|']
    for (split,h),cs in scored.items():
        lines.append(f'| {split} | {h} | {fmt(metrics([c["error"] for c in cs if c["target"]["stage"]>=5.54]))} | {fmt(metrics([c["error"] for c in cs if c["target"]["stage"]<5.54]))} |')
    lines += ['', '## 6. Reporting-gap proximity and directional behaviour','',
      'All retained cases have no >90-minute reporting gap with positive overlap between input and target. For descriptive analysis only, “near gap” means input is within three hours after a >90-minute gap ends, or target is within three hours before a gap begins. This symmetric, retrospective flag is not an issuance feature or evidence of physical missing measurements. It does not change the evaluated cases. The three-hour display radius is fixed here without optimizing errors.', '',
      '| Split | h | Near-gap errors | Other errors |','|---|---:|---|---|']
    for (split,h),cs in scored.items():lines.append(f'| {split} | {h} | {fmt(metrics([c["error"] for c in cs if near_gap(c)]))} | {fmt(metrics([c["error"] for c in cs if not near_gap(c)]))} |')
    lines += ['', 'Post-hoc rising/falling categories compare target report with input report. Persistence necessarily underpredicts a higher target and overpredicts a lower target; these signs are mathematical consequences, not demonstrated flood dynamics. No physical rate is inferred from edit timestamps.', '',
      '| Split | h | Higher target than input | Lower target than input | Unchanged target |','|---|---:|---|---|---|']
    for (split,h),cs in scored.items():
        groups=[[c for c in cs if c['error']<0],[c for c in cs if c['error']>0],[c for c in cs if c['error']==0]]
        lines.append(f'| {split} | {h} | '+ ' | '.join(fmt(metrics([c['error'] for c in g])) for g in groups)+' |')
    lines += ['', '## 7. Large-error examples (three largest absolute errors per split/horizon)','',
      'Examples are selected after scoring solely to inspect failure characteristics; they do not tune or remove cases. Multiple examples can refer to the same episode or target at different horizons. An isolated large report change may be a hydrological change, reporting/revision issue or both; none is independently established as a flood.', '',
      '| Split / h | Issuance, local | Input / target reporting proxies, local | Input → target stage (m) | Signed error (m) | Source identities |',
      '|---|---|---|---|---:|---|']
    for (split,h),cs in scored.items():
        for c in sorted(cs,key=lambda x:(-abs(x['error']),x['s']))[:3]:
            local=datetime.fromtimestamp(c['s'],LOCAL).isoformat()
            lines.append(f'| {split} / {h}h | {local} | {c["input"]["time"]} → {c["target"]["time"]} | {c["input"]["stage"]} → {c["target"]["stage"]} | {c["error"]:+.6f} | `{c["input"]["source_path"]}` → `{c["target"]["source_path"]}` |')
    lines += ['', 'Large-error examples expose persistence lag on steep changes in reported stage. Longer-horizon errors combine longer extrapolation with a different selected sample because continuity/matching exclusions increase; do not attribute every cross-horizon difference solely to horizon length.', '',
      '## 8. Deterministic and regression validation','']
    lines += ['- PASS (existing audit): '+t for t in old_tests]+['- PASS (persistence): '+t for t in tests]
    lines += ['', 'Repeated execution was tested by rebuilding eligibility and rescoring in memory twice, with exact source-identity, prediction and error equality. Output timestamps are naturally run-specific; numerical experiment results are deterministic. In-memory synthetic fixtures test software only, not research observations. Final-period guards reject final cases before prediction; no final-period targets are generated to test real-data scores.', '',
      '## 9. Scientific limitations and recommendation','',
      'This experiment predicts archived reported stage under unverified availability assumptions. Reporting/edit proxies are not proven physical measurement times or public first-availability clocks; the five-minute buffer does not fix delayed publications/revisions. Historical as-of reconstruction remains incomplete. Official 003HD007 identity equivalence, gauge datum/stability, relocation and independence of distinct reports remain unverified.', '',
      'Ex-post close-target and gap-continuity filters select a cleaner subset and reduce coverage, especially at longer horizons. Retrospective outcome strata and gap proximity flags are not deployable features. Overlapping histories, serial dependence and cross-horizon target reuse invalidate independent-hour confidence claims. No operational warning threshold, verified flood-event skill or seasonal generalization is demonstrated.', '',
      'Validation contains one previously described major August elevated-stage reporting window; development elevated runs may be linked. Errors on these correlated periods cannot establish general flood resilience. This is not a rainfall model, landslide model, causal cascade predictor or operational early-warning service. No source values or eligibility decisions were adjusted to improve performance.', '',
      '**GO for a separately approved recent-trend baseline comparison on these same development/validation cases**, with the frozen lookback/minimum-history/fallback protocol, full fallback accounting and identical target cases. This recommendation establishes a useful reference comparator, not evidence that trend will improve it. The September–October final evaluation remains unscored.', '',
      '**One smallest next step:** review this persistence report, then approve a development/validation-only trend-history eligibility audit (no slope predictions yet) to quantify valid three-hour histories and required persistence fallbacks before authorizing trend evaluation.', '',
      '## 10. Reproduction and frozen evidence','',
      'Created only this report and `ML-Service/src/evaluate_ratnapura_stage_persistence.py`. Standard-library Python 3.9+; no network/dependency installation. Refuses report overwrite. No model-ready dataset, row-level prediction export, API or dashboard asset was saved.', '',
      '```text','ML-Service/.venv/bin/python ML-Service/src/evaluate_ratnapura_stage_persistence.py',
      '& .\\ML-Service\\.venv\\Scripts\\python.exe .\\ML-Service\\src\\evaluate_ratnapura_stage_persistence.py','```','',
      'Frozen read-only policy/evidence SHA-256 checksums:','']
    for name in ['outputs/ratnapura_stage_baseline_evaluation_protocol.md','outputs/ratnapura_stage_baseline_eligibility_audit.md','src/audit_ratnapura_stage_baseline_eligibility.py','outputs/ratnapura_stage_consolidated_qa.md']:
        lines.append(f'- `{name}` — `{hashlib.sha256((ROOT/name).read_bytes()).hexdigest()}`')
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')
    print('PASS: 3355 integrity-verified; 2195 pre-final records; all approved counts matched BEFORE scoring')
    print('Development-only P95:',dev_cutoff)
    for key,cs in scored.items():print(key,metrics([c['error'] for c in cs]))
    print('Existing tests:',len(old_tests),'persistence tests/invariants:',len(tests),'final cases scored: 0')
    print('Created',REPORT)


if __name__=='__main__':main()
