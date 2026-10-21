"""Registered 6h-lookback OLS trend sensitivity, development/validation ONLY.

Standard-library Python 3.9+, pathlib. One aggregate Markdown report; all cases
remain in memory. No source edits, final-period matching/scoring, or tuning.
"""
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
import runpy
import math
import statistics
import hashlib

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'outputs/ratnapura_stage_trend_6h_sensitivity_development_validation.md'
S=runpy.run_path(str(ROOT/'src/audit_ratnapura_stage_trend_6h_sensitivity.py'))
H=S['H'];A=S['A'];P=S['P'];LIMIT=S['LIMIT'];SPLITS=S['SPLITS'];require=S['require']
EXPECTED={('Development',1):919,('Development',3):831,('Development',6):710,
          ('Validation',1):525,('Validation',3):497,('Validation',6):465}
ELEVATED=4.4425  # already frozen development-only P95, not refitted to errors


def guard(case):
    require(case['split'] in ['Development','Validation'],'Final/unknown split forbidden')
    P['allowed_case'](case)


def ols_slope(reports,anchor,s):
    """OLS on earlier reports only; anchor stage is NOT in fitted slope."""
    require(s<LIMIT and anchor['epoch']<=s-300,'Invalid issuance/anchor')
    require(len(reports)>=3,'Insufficient OLS history')
    require(all(s-21600<=r['epoch']<anchor['epoch'] and r['epoch']<=s-300 for r in reports),'Future/out-of-window regression input')
    require(reports[-1]['epoch']-reports[0]['epoch']>=5400,'Insufficient history span')
    x=[(r['epoch']-anchor['epoch'])/3600 for r in reports];y=[r['stage'] for r in reports]
    xm=math.fsum(x)/len(x);ym=math.fsum(y)/len(y)
    denominator=math.fsum((v-xm)**2 for v in x)
    if denominator<=0:return None
    b=math.fsum((u-xm)*(v-ym) for u,v in zip(x,y))/denominator
    if not math.isfinite(b):return None
    # Independent algebraic OLS check (hours measured from first report).
    z=[(r['epoch']-reports[0]['epoch'])/3600 for r in reports];n=len(z)
    other=(n*math.fsum(u*v for u,v in zip(z,y))-math.fsum(z)*math.fsum(y))/(n*math.fsum(u*u for u in z)-math.fsum(z)**2)
    require(math.isclose(b,other,rel_tol=1e-10,abs_tol=1e-10),'Independent OLS mismatch')
    return b


def extrapolate(anchor,s,h,b):
    require(s<LIMIT and s+h*3600<LIMIT and anchor['epoch']<=s-300,'Final/future extrapolation forbidden')
    pred=anchor['stage']+b*((s+h*3600-anchor['epoch'])/3600)
    require(math.isfinite(pred),'Nonfinite forecast; stop rather than silently repair')
    return pred


def metrics(errors):
    if not errors:return None
    ab=[abs(e) for e in errors];n=len(errors)
    return dict(n=n,mae=math.fsum(ab)/n,rmse=math.sqrt(math.fsum(e*e for e in errors)/n),
                bias=math.fsum(errors)/n,med=statistics.median(ab),p90=A['percentile'](ab,.9))


def skill(p,t):
    return None if p is None or t is None or p['mae']==0 else 1-t['mae']/p['mae']


def show(m):
    if m is None:return 'N=0; unavailable'
    return f'N={m["n"]}; MAE={m["mae"]:.6f}, RMSE={m["rmse"]:.6f}, bias={m["bias"]:+.6f}, median AE={m["med"]:.6f}, P90 AE={m["p90"]:.6f} m'


def paired(cases):
    return metrics([c['pe'] for c in cases]),metrics([c['te'] for c in cases])


def baseline_reference():
    text=(ROOT/'outputs/ratnapura_stage_persistence_development_validation.md').read_text()
    section=text.split('| Split | h | N | MAE (m)',1)[1].split('## 4.',1)[0];out={}
    for line in section.splitlines():
        cells=[v.strip() for v in line.strip().strip('|').split('|')]
        if len(cells)==8 and cells[0] in ['Development','Validation']:
            out[(cells[0],int(cells[1]))]=dict(zip(['n','mae','rmse','bias','med','p90'],[int(cells[2])]+[float(v) for v in cells[3:]]))
    require(len(out)==6,'Cannot parse six frozen persistence metric rows')
    return out


def tests():
    passed=[]
    def check(name,ok):require(ok,name);passed.append(name)
    s=A['epoch']('2026-06-15T12:00');t0=s-1800
    reports=[dict(epoch=t0-k*3600,stage=10-2*k,source_path=str(k)) for k in [3,2,1]]
    anchor=dict(epoch=t0,stage=50,source_path='anchor')
    b=ols_slope(reports,anchor,s)
    check('OLS slope uses strictly earlier reports, excludes different-valued anchor',math.isclose(b,2))
    check('Anchor extrapolation includes anchor age at nominal one-hour horizon',math.isclose(extrapolate(anchor,s,1,b),53))
    check('Nominal six-hour horizon extrapolates 6.5 hours after anchor',math.isclose(extrapolate(anchor,s,6,b),63))
    check('Constant earlier stages yield zero trend',ols_slope([dict(r,stage=4) for r in reports],anchor,s)==0)
    for name,fn in [('Future report rejected by slope',lambda:ols_slope(reports+[dict(epoch=s,stage=0)],anchor,s)),
                    ('Final-period extrapolation rejected',lambda:extrapolate(anchor,LIMIT,1,b)),
                    ('Final-period case guard rejects before scoring',lambda:guard(dict(split='Final',s=LIMIT)))]:
        try:fn()
        except RuntimeError:passed.append(name)
        else:raise AssertionError(name)
    m=metrics([-1,2]);check('Known MAE/RMSE/bias and percentile fixture',m['mae']==1.5 and math.isclose(m['rmse'],math.sqrt(2.5)) and m['bias']==.5 and math.isclose(m['p90'],1.9))
    check('MAE skill sign and value',math.isclose(skill(dict(mae=2),dict(mae=1)),.5))
    check('Zero persistence MAE skill is unavailable',skill(dict(mae=0),dict(mae=0)) is None)
    check('No clipping or hard forecast bounds',extrapolate(dict(anchor,stage=-2),s,1,-2)<0)
    return passed


def main():
    require(not REPORT.exists(),'Refusing report overwrite')
    oldtests=A['test_rules']();htests=H['tests']();stests=S['tests']();newtests=tests()
    allrows,inventory,_=A['LIB']['verify_inventory']();require(len(allrows)==3355,'Inventory mismatch')
    rows=[r for r in allrows if r['epoch']<LIMIT];del allrows
    require(len(rows)==2195,'Allowed source count mismatch')
    result,gaps=P['build_pairs'](rows)  # six exact approved-pair gates, no scoring
    cache={};byid={r['source_path']:r for r in rows}
    for (split,h),r in result.items():
        start,end=next((a,b) for name,a,b in SPLITS if name==split)
        for c in r['cases']:
            key=(split,c['s'])
            if key not in cache:cache[key]=S['history_for_lookback'](rows,c['s'],c['input'],start,end,21600)
    for key,n in EXPECTED.items():
        require(sum(cache[(key[0],c['s'])]['eligible'] for c in result[key]['cases'])==n,'Approved 6h eligibility count mismatch '+str(key))
    newtests.append('All pair and six-hour history-eligibility counts gated before scoring')
    # Approved threshold/reference read before errors; no final records inspected.
    require(A['percentile']([r['stage'] for r in rows if r['epoch']<SPLITS[0][2]],.95)==ELEVATED,'Frozen development threshold mismatch')
    reference=baseline_reference()
    slopes={}
    for (split,s),hist in cache.items():
        anchor=next(c['input'] for (sp,h),r in result.items() if sp==split for c in r['cases'] if c['s']==s)
        reports=[byid[name] for name in hist['identities']]
        slopes[(split,s)]=ols_slope(reports,anchor,s) if hist['eligible'] else None
    def score_allowed():
        scored={}
        for key,r in result.items():
            cs=[]
            for c in r['cases']:
                guard(c);hist=cache[(key[0],c['s'])];b=slopes[(key[0],c['s'])]
                pp=c['input']['stage'];fallback=b is None
                tp=pp if fallback else extrapolate(c['input'],c['s'],c['h'],b)
                cs.append(dict(c,hist=hist,slope=b,fallback=fallback,pred_p=pp,pred_t=tp,
                    pe=pp-c['target']['stage'],te=tp-c['target']['stage']))
            scored[key]=cs
        return scored
    scored=score_allowed();again=score_allowed();require(scored==again,'Non-deterministic scores')
    newtests.append('Repeated predictions/errors and source identities identical')
    for key,cs in scored.items():
        require(sum(not c['fallback'] for c in cs)==EXPECTED[key],'Unexpected numerical fallback')
        m,_=paired(cs)
        for name,value in reference[key].items():
            require(m[name]==value if name=='n' else abs(m[name]-value)<=.000000500001,'Persistence reference mismatch')
        for c in cs:
            if c['fallback']:require(c['pred_t']==c['pred_p'] and c['te']==c['pe'],'Fallback differs from persistence')
            require(c['input']['epoch']<=c['s']-300 and c['target']['epoch']<LIMIT,'Temporal contamination')
    newtests.append('Recomputed persistence matches all six prior rows within 0.000000500001 m rounding tolerance')
    newtests.append('All fallback predictions/errors equal persistence exactly')
    newtests.append('All trend-active cases share identical persistence input/target identities')
    newtests.append('Every actual OLS slope passes independent algebraic numerical check')
    newtests.append('September–October never enters matching, history estimation or scoring')
    def near_gap(c):
        lo=c['input']['epoch'];hi=c['target']['epoch']
        return any((b<=lo and lo-b<=10800) or (a>=hi and a-hi<=10800) for a,b in gaps)
    def comparison_row(label,cs):
        p,t=paired(cs)
        if p is None:return f'| {label} | 0 | unavailable | unavailable | unavailable |'
        return f'| {label} | {len(cs)} | {show(p)} | {show(t)} | {skill(p,t) if skill(p,t) is not None else "undefined"} |'
    lines=['# Registered six-hour-lookback recent-trend sensitivity versus persistence','',
      '**Scope:** June–July development and August validation only. Frozen three-hour primary is unchanged. No final-period predictions, targets or errors; no tuning or model training.',
      '**Generated UTC:** '+datetime.now(timezone.utc).isoformat(),'',
      '## 1. Integrity, frozen sample and algorithm','',
      'All **3,355** original reports passed the existing original-manifest/index SHA-256, byte-size, Git-blob, unique-source and exact file-set checks. September–October records are discarded immediately after integrity verification. Only **2,195 June–August records** enter matching and histories. Original acquisition revisions remain; this is not a new cross-snapshot equivalence claim.', '',
      'Approved pair counts and six-hour eligible counts were asserted **before any actual prediction/error**. Both methods use exactly the same source-pair identities and exclusion sample. The existing audited pair builder and sensitivity history function are reused without editing their files. No prior scoring main routine is invoked.', '',
      'Frozen policies: hourly local issuance; input proxy ≤s−5min and age ≤90min; same-partition history [s−6h,t₀), including the left boundary and excluding the anchor; at least three earlier reports spanning ≥90min; past-only close-chain exclusions; internal raw gap >90min invalidates history. Existing forward 15min target matching, target-close/context/gap filtering, six-hour warmup and strict 6h30min end embargo remain unchanged. Positive-duration gap overlap and covered-time target-context interpretations are retained.', '',
      '**Exact estimator:** xᵢ=(tᵢ−t₀)/3600; b=Σ[(xᵢ−x̄)(yᵢ−ȳ)]/Σ[(xᵢ−x̄)²], using only eligible reports strictly earlier than t₀. The anchor stage is not fitted. **Prediction:** ŷ_T(s,h)=y₀+b(s+h−t₀)/3600, at the nominal elapsed horizon, not at the late matched target. Persistence ŷ_P=y₀. Trend-ineligible/nonfinite-slope cases fall back to y₀. Nonfinite forecasts stop; no clipping, bounds, smoothing, interpolated targets or parameter tuning.', '',
      'The estimator, anchor and extrapolation origin are explicit in protocol section 3.2; no essential ambiguity required a new rule. Longer historical support does not imply locally stable slope.', '',
      '## 2. Reproduced counts, coverage and primary all-pair results','',
      '| Split | h | Approved N | Trend active | Persistence fallback | Coverage N/scheduled; N/input-eligible |','|---|---:|---:|---:|---:|---|']
    for (split,h),cs in scored.items():
        r=result[(split,h)];n=len(cs);active=sum(not c['fallback'] for c in cs)
        lines.append(f'| {split} | {h} | {n} | {active} | {n-active} | {n}/{r["scheduled"]} ({100*n/r["scheduled"]:.2f}%); {n}/{r["eligible"]} ({100*n/r["eligible"]:.2f}%) |')
    lines += ['', 'Error sign is **prediction−reported target**; positive bias means overprediction. MAE=mean(|e|), RMSE=sqrt(mean(e²)), bias=mean(e). Median/P90 absolute error use the same linear-interpolated percentile definition as prior reports. **Skill=1−trend-with-fallback MAE/persistence MAE**; positive improves persistence. Differences below are trend minus persistence (negative improves). Zero persistence MAE makes relative skill undefined.', '',
      '| Split | h | Persistence MAE / RMSE / bias (m) | Trend+fallback MAE / RMSE / bias (m) | ΔMAE / ΔRMSE (m) | MAE skill |','|---|---:|---|---|---|---|']
    for (split,h),cs in scored.items():
        p,t=paired(cs)
        lines.append(f'| {split} | {h} | {p["mae"]:.6f} / {p["rmse"]:.6f} / {p["bias"]:+.6f} | {t["mae"]:.6f} / {t["rmse"]:.6f} / {t["bias"]:+.6f} | {t["mae"]-p["mae"]:+.6f} / {t["rmse"]-p["rmse"]:+.6f} | {skill(p,t):+.6f} |')
    lines += ['', '| Split / h | Persistence median / P90 AE (m) | Trend+fallback median / P90 AE (m) |','|---|---|---|']
    for (split,h),cs in scored.items():
        p,t=paired(cs);lines.append(f'| {split} / {h}h | {p["med"]:.6f} / {p["p90"]:.6f} | {t["med"]:.6f} / {t["p90"]:.6f} |')
    lines += ['', 'Recomputed persistence agrees with every prior metric field within **0.000000500001 m**, allowing six-decimal report rounding. Pair counts agree exactly. No method-specific sample selection; coverage remains the approved persistence coverage. Serial dependence and cross-horizon target reuse prevent interpreting these N values as independent events.', '',
      '## 3. Trend-active and fallback-specific paired results','',
      '| Split / h / subset | N | Persistence | Trend+fallback | MAE skill |','|---|---:|---|---|---|']
    for (split,h),cs in scored.items():
        for label,predicate in [('trend active',lambda c:not c['fallback']),('fallback',lambda c:c['fallback'])]:
            lines.append(comparison_row(f'{split} / {h}h / {label}',[c for c in cs if predicate(c)]))
    lines += ['', 'Fallback values equal persistence exactly; active-subset metrics compare both methods on the identical historically eligible cases. The active subset is secondary and must not replace the full-sample comparison. No additional numerical fallbacks occurred after the history gate.', '',
      '## 4. Stage, direction and reporting-gap subsets','',
      'The previously frozen development-derived elevated threshold **4.4425 m** is reused unchanged (and independently reproduced from development records). Subgroups use matched target stage. Ordinary is below threshold; elevated is at/above. These are exploratory reported-stage strata, not verified floods or warning levels.', '',
      'Higher/lower/unchanged target versus anchor use the existing descriptive direction definitions; they are retrospective outcome categories, never model inputs. No rapid-rise/fall magnitude threshold was predefined, so **no new threshold-based rapid-change category** is invented. Large changes and reversals are illustrated below instead.', '',
      'Near-gap uses the existing persistence diagnostic: input within three hours after a >90min raw gap ends, or target within three hours before a gap starts. This is retrospective stratification, not an eligibility change or evidence of missing physical measurements.', '',
      '| Split / h / subset | N | Persistence | Trend+fallback | MAE skill |','|---|---:|---|---|---|']
    for (split,h),cs in scored.items():
        groups=[('ordinary',[c for c in cs if c['target']['stage']<ELEVATED]),('elevated',[c for c in cs if c['target']['stage']>=ELEVATED]),
                ('higher target',[c for c in cs if c['target']['stage']>c['input']['stage']]),('lower target',[c for c in cs if c['target']['stage']<c['input']['stage']]),
                ('unchanged target',[c for c in cs if c['target']['stage']==c['input']['stage']]),('near reporting gap',[c for c in cs if near_gap(c)]),('other',[c for c in cs if not near_gap(c)])]
        for label,subset in groups:lines.append(comparison_row(f'{split} / {h}h / {label}',subset))
    lines += ['', '## 5. Validation large-error examples and reversals','',
      'Three largest absolute validation errors for **each method and each horizon**, ranked after scoring for interpretation only. Examples can repeat across methods/horizons. “Opposed slope” means the earlier fitted slope and anchor-to-target net change have opposite signs, a descriptive reversal indication rather than a physical turning-point observation. Forecasts beyond the observed range are retained, not clipped.', '',
      '| Rank by method / h | Issuance and target proxy (local) | History count / span (min) | Reported target; persistence; trend (m) | Absolute errors P / T (m) | Fallback; slope (m/h); opposed slope | Source input → target; history endpoints; gaps |','|---|---|---|---|---|---|---|']
    for h in [1,3,6]:
        cs=scored[('Validation',h)]
        for method,field in [('persistence','pe'),('trend','te')]:
            for c in sorted(cs,key=lambda c:(-abs(c[field]),c['s']))[:3]:
                s=datetime.fromtimestamp(c['s'],A['LOCAL']).isoformat();hist=c['hist'];slope=c['slope']
                opposed=slope is not None and slope*(c['target']['stage']-c['input']['stage'])<0
                endpoints=(hist['identities'][0],hist['identities'][-1]) if hist['identities'] else ()
                lines.append(f'| {method} / {h}h | {s} → {c["target"]["time"]} | {hist["count"]} / {hist["span_minutes"]} | {c["target"]["stage"]:.6f}; {c["pred_p"]:.6f}; {c["pred_t"]:.6f} | {abs(c["pe"]):.6f} / {abs(c["te"]):.6f} | {c["fallback"]}; {slope}; {opposed} | `{c["input"]["source_path"]}` → `{c["target"]["source_path"]}`; `{endpoints}`; history >90min gaps={hist["gap_count"]}, future continuity gap=0, near gap={near_gap(c)} |')
    lines += ['', '### Validation descriptive reversal counts (trend-active only)','',
      '| h | Active | Opposed slope/net-change sign | Trend farther from target than persistence in opposed cases | Upper overshoot / lower undershoot in opposed cases | Negative trend forecasts (all active) |','|---|---:|---:|---:|---|---:|']
    for h in [1,3,6]:
        active=[c for c in scored[('Validation',h)] if not c['fallback']]
        opposed=[c for c in active if c['slope']*(c['target']['stage']-c['input']['stage'])<0]
        upper=sum(c['pred_t']>max(c['input']['stage'],c['target']['stage']) for c in opposed)
        lower=sum(c['pred_t']<min(c['input']['stage'],c['target']['stage']) for c in opposed)
        lines.append(f'| {h} | {len(active)} | {len(opposed)} | {sum(abs(c["te"])>abs(c["pe"]) for c in opposed)} | {upper} / {lower} | {sum(c["pred_t"]<0 for c in active)} |')
    lines += ['', 'Opposed-sign cases mathematically move the forecast away from the eventual net change; they expose the risk of extrapolating older history, not evidence that a verified physical reversal occurred. No error case led to tuning, clipping, changed exclusions or changed targets.', '',
      '## 6. Deterministic tests and independent checks','']
    lines += ['- PASS (existing issuance): '+t for t in oldtests]+['- PASS (existing primary-history): '+t for t in htests]+['- PASS (existing sensitivity): '+t for t in stests]+['- PASS (trend evaluation): '+t for t in newtests]
    lines += ['', 'All fixtures are in-memory software tests, not research training data. Every actual slope was cross-checked against an algebraically independent OLS formula. Real-input history identities came from the existing independently checked eligibility method. Predictions were repeated and compared exactly; no confidence interval assumes independent hourly rows.', '',
      '## 7. Scientific limitations and experiment decision','',
      'Reporting/edit clocks, actual measurement times, public first availability, revisions, official station 003HD007 equivalence and datum stability remain unverified. A five-minute buffer is a proxy, not proven latency. Constant datum offset would cancel errors but unverified changes need not. Older six-hour history may be less locally representative. Ex-post target quality and continuity exclusions select a cleaner sample. The limited seasonal window, single major August high-stage episode, dependent reports and prior descriptive exposure limit generalization.', '',
      'This is a registered **six-hour sensitivity**, not a revision of the three-hour primary. It is stage-only retrospective comparison, not a rainfall model, verified flood forecast, cascade-disaster mechanism or operational warning service. September–October remains untouched by matching, slope estimation and scoring.', '']
    for h in [1,3,6]:
        p,t=paired(scored[('Validation',h)])
        lines.append(f'- Validation {h}h: MAE skill {skill(p,t):+.6f}; ΔRMSE {t["rmse"]-p["rmse"]:+.6f} m. '+('MAE improves.' if t['mae']<p['mae'] else 'MAE does not improve.'))
    lines += ['', '**Recommendation:** keep persistence as the preferred working baseline for all three horizons on the available validation evidence. Retain the six-hour trend sensitivity as a documented negative research comparator, not as an improvement or an operational candidate: validation MAE and RMSE worsen at every horizon. Some median errors and rising-stage signed bias improve, but these do not offset larger absolute errors and reversal overshoot. Do not promote the sensitivity to primary, tune on validation or unlock final evaluation.', '',
      '**One smallest next step:** review the paired validation and reversal evidence and document a baseline-selection decision, including which comparator to retain for later models, before authorizing another experiment. No new model or final-period evaluation is started here.', '',
      '## 8. Reproduction and frozen evidence','',
      'Created only this report and `ML-Service/src/evaluate_ratnapura_stage_trend_6h_sensitivity.py`. Standard-library Python 3.9+, pathlib; no dependencies/network. Refuses report overwrite. No row-level forecast dataset, API, model artifact or dashboard export saved.', '',
      '```text','ML-Service/.venv/bin/python ML-Service/src/evaluate_ratnapura_stage_trend_6h_sensitivity.py',
      '& .\\ML-Service\\.venv\\Scripts\\python.exe .\\ML-Service\\src\\evaluate_ratnapura_stage_trend_6h_sensitivity.py','```','',
      'Read-only source evidence SHA-256:','']
    for name in ['outputs/ratnapura_stage_baseline_evaluation_protocol.md','outputs/ratnapura_stage_baseline_eligibility_audit.md','outputs/ratnapura_stage_trend_history_eligibility_audit.md','outputs/ratnapura_stage_trend_6h_sensitivity_audit.md','outputs/ratnapura_stage_persistence_development_validation.md','src/audit_ratnapura_stage_trend_6h_sensitivity.py','src/evaluate_ratnapura_stage_persistence.py']:
        lines.append(f'- `{name}` — `{hashlib.sha256((ROOT/name).read_bytes()).hexdigest()}`')
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')
    print('PASS: integrity 3355; allowed source records 2195; exact pair/history gates; final scored 0')
    for key,cs in scored.items():
        p,t=paired(cs);print(key,'P',p,'T',t,'skill',skill(p,t))
    print('Tests',len(oldtests),len(htests),len(stests),len(newtests));print('Created',REPORT)


if __name__=='__main__':main()
