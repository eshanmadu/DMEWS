"""Offline recent-trend HISTORY eligibility only; never computes a slope or forecast.

Standard-library Python 3.9+, pathlib, macOS/Windows. Reuses the approved
persistence pair builder, never its scoring/metric routines. Only an aggregate
Markdown report is written; all histories and source identities stay in memory.
"""
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter, defaultdict
import runpy
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'outputs/ratnapura_stage_trend_history_eligibility_audit.md'
P=runpy.run_path(str(ROOT/'src/evaluate_ratnapura_stage_persistence.py'))
A=P['AUDIT'];LIMIT=P['LIMIT'];SPLITS=P['SPLITS'];require=P['require']


def forbidden(*args,**kwargs):
    raise RuntimeError('Forecast, score and performance computation forbidden in history audit')


# Fail closed if accidental future code tries to invoke the reused scorer.
for name in ['persistence','metrics','score','test_persistence']:
    P['build_pairs'].__globals__[name]=forbidden


def history_at(rows,s,anchor,start,end):
    """Past-only history: [s-3h, anchor time); anchor itself is excluded.

    Close-chain membership is established across the whole same-partition cutoff
    view, so a neighbour outside the lookback can establish an input ambiguity.
    Raw-gap checks span oldest eligible earlier report through the anchor.
    """
    require(start<=s<end<=LIMIT,'Final/unknown partition forbidden')
    require(start<=anchor['epoch']<=s-300,'Invalid causal anchor')
    past=[r for r in rows if start<=r['epoch']<=s-300]
    require(past and past[-1]['source_path']==anchor['source_path'],'Anchor is not latest available raw input')
    chains,closemap=A['clusters'](past)
    raw=[r for r in past if s-10800<=r['epoch']<anchor['epoch']]
    closeids={past[i]['source_path'] for i in closemap}
    times=Counter(r['epoch'] for r in past)
    eligible=[r for r in raw if r['source_path'] not in closeids and times[r['epoch']]==1 and A['finite'](r['stage'])]
    count=len(eligible);span=eligible[-1]['epoch']-eligible[0]['epoch'] if eligible else None
    selectedraw=[r for r in past if eligible and eligible[0]['epoch']<=r['epoch']<=anchor['epoch']]
    gaps=[(a['epoch'],b['epoch']) for a,b in zip(selectedraw,selectedraw[1:]) if b['epoch']-a['epoch']>5400]
    flags=[]
    if count<3:flags.append('fewer_than_three_earlier_reports')
    if span is None or span<5400:flags.append('span_below_90_minutes')
    # Nonzero time variance is equivalent to >=2 distinct eligible timestamps;
    # no regression, slope, or variance calculation is needed.
    if len({r['epoch'] for r in eligible})<2:flags.append('no_distinct_time_support')
    if gaps:flags.append('internal_raw_gap_over_90_minutes')
    repeats=sum(a['stage']==b['stage'] for a,b in zip(eligible,eligible[1:]))
    blocked_close=[r for r in raw if r['source_path'] in closeids]
    result=dict(s=s,count=count,span_minutes=None if span is None else span/60,
        oldest=None if not eligible else eligible[0]['epoch'],newest=None if not eligible else eligible[-1]['epoch'],
        oldest_age=None if not eligible else (s-eligible[0]['epoch'])/60,
        newest_age=None if not eligible else (s-eligible[-1]['epoch'])/60,
        raw_count=len(raw),close_excluded=len(blocked_close),
        close_chains=len({closemap[i] for i,r in enumerate(past) if r in blocked_close}),
        invalid_excluded=sum(not A['finite'](r['stage']) for r in raw),
        repeated_times_excluded=sum(times[r['epoch']]>1 for r in raw),
        gap_count=len(gaps),repeated_stage_pairs=repeats,flags=flags,
        reason=flags[0] if flags else 'eligible',eligible=not flags,
        identities=tuple(r['source_path'] for r in eligible))
    require(all(start<=r['epoch']<anchor['epoch'] and s-10800<=r['epoch']<=s-300 for r in eligible),'Historical boundary violation')
    return result


def tests():
    passed=[]
    def check(name,condition):require(condition,name);passed.append(name)
    s=A['epoch']('2026-06-15T12:00');start=s-86400;end=s+86400
    def row(offset,n=None,stage=1):
        return dict(epoch=s+offset,stage=stage,source_path=str(offset) if n is None else n)
    def hist(offsets,anchor=-300,extras=()):
        rows=sorted([row(t) for t in offsets]+[row(anchor,'anchor')]+list(extras),key=lambda r:r['epoch'])
        return history_at(rows,s,next(r for r in rows if r['source_path']=='anchor'),start,end)
    check('Exactly three earlier reports can qualify',hist([-10800,-7200,-3600])['eligible'])
    check('Fewer than three earlier reports requires fallback',not hist([-7200,-3600])['eligible'])
    check('Exactly 90-minute span qualifies',hist([-9000,-6300,-3600])['eligible'])
    check('Span one second below 90 minutes does not qualify',not hist([-8999,-6300,-3600])['eligible'])
    h=hist([-11101,-10800,-7200,-3600]);check('Three-hour left endpoint included; earlier report excluded',h['count']==3 and h['oldest']==s-10800)
    h=hist([-10801,-10800,-7200,-3600]);check('Past close neighbour outside lookback still establishes ambiguity',h['count']==2 and h['close_excluded']==1)
    check('Anchor at five-minute cutoff admitted but excluded from earlier history',hist([-10800,-7200,-3600])['count']==3)
    h=hist([-10800,-7200,-3600],extras=[row(-299,'future-cutoff')]);check('Newer-than-cutoff and future-neighbour exclusion is causal',h['eligible'])
    h=hist([-10800,-7200,-3600],extras=[row(3600,'future')]);check('Future report cannot change eligibility',h['eligible'])
    h=hist([-10800,-7200,-3600],extras=[row(-7199,'close')]);check('Known close-chain reports excluded, not merged',h['close_excluded']==2 and h['count']==2)
    h=hist([-10800,-5000,-2000]);check('Raw gap exceeding 90 minutes invalidates otherwise sufficient history','internal_raw_gap_over_90_minutes' in h['flags'])
    check('Gap exactly 90 minutes remains permitted',hist([-10800,-5400,-1200])['eligible'])
    check('Repeated identical stage values do not invalidate time-supported history',hist([-10800,-7200,-3600])['repeated_stage_pairs']==2 and hist([-10800,-7200,-3600])['eligible'])
    h=hist([-10800,-7200,-3600]);check('Anchor is not counted among three earlier observations','anchor' not in h['identities'])
    rows=[row(-10800),row(-7200),row(-3600),row(-300,'anchor')]
    h=history_at(rows,s,rows[-1],s-8000,end);check('Previous-partition report excluded',h['count']==2)
    h=history_at(rows,s,rows[-1],start,end);check('No time-variance issue for repeated stage values',h['eligible'])
    try:history_at([],LIMIT+3600,row(0),LIMIT,LIMIT+86400)
    except RuntimeError:passed.append('Final-period history request rejected before examination')
    else:raise AssertionError('Final history allowed')
    h1=hist([-10800,-7200,-3600]);h2=hist([-7200,-3600])
    check('Fallback counting partitions audited histories',sum(h['eligible'] for h in [h1,h2])==1 and sum(not h['eligible'] for h in [h1,h2])==1)
    return passed


def describe(histories):
    if not histories:return 'N=0'
    count=Counter(h['count'] for h in histories);spans=[h['span_minutes'] for h in histories if h['span_minutes'] is not None]
    return f'N={len(histories)}; count histogram={dict(sorted(count.items()))}; span min/median/mean/P95/max (min): {A["distribution"](spans)}'


def tally(histories):
    n=len(histories);ok=sum(h['eligible'] for h in histories)
    return f'{ok}/{n} ({100*ok/n:.2f}%) eligible; {n-ok}/{n} ({100*(n-ok)/n:.2f}%) fallback' if n else 'N=0'


def main():
    require(not REPORT.exists(),'Refusing report overwrite')
    oldtests=A['test_rules']();newtests=tests()
    allrows,inventory,_=A['LIB']['verify_inventory']();require(len(allrows)==3355,'Inventory mismatch')
    rows=[r for r in allrows if r['epoch']<LIMIT];del allrows
    require(len(rows)==2195,'Allowed source count mismatch')
    pairs,gaps=P['build_pairs'](rows)  # includes exact six-count gate; never scores
    require(all(len(pairs[k]['cases'])==n for k,n in P['EXPECTED'].items()),'Pair count mismatch')
    newtests.append('All six horizon-specific approved pair counts reproduce before history audit')
    unique={}
    for (split,h),r in pairs.items():
        start,end=next((a,b) for name,a,b in SPLITS if name==split)
        for c in r['cases']:
            key=(split,c['s'])
            if key not in unique:unique[key]=history_at(rows,c['s'],c['input'],start,end)
    # Repeated-history deterministic check; no slope/value extrapolation.
    for (split,s),history in unique.items():
        start,end=next((a,b) for name,a,b in SPLITS if name==split)
        anchor,why=A['input_at'](rows,s,start);require(why is None,'Unexpected input state')
        require(history==history_at(rows,s,anchor,start,end),'History reproducibility failed')
    newtests.append('Repeated past-only histories reproduce exactly')
    newtests.append('Only Development/Validation unique issuance histories exist')
    require(all(split in ['Development','Validation'] and s<LIMIT for split,s in unique),'Final-period history leaked')
    # Context only: the existing descriptive threshold is not estimated anew.
    windows=[];run=[]
    for r in rows:
        if r['stage']>=5.54:
            if run and r['epoch']-run[-1]['epoch']>5400:windows.append(run);run=[]
            run.append(r)
        elif run:windows.append(run);run=[]
    if run:windows.append(run)
    require(len(windows)==5,'Pre-final descriptive window count changed')
    lines=['# Ratnapura recent-trend history eligibility and fallback audit','',
      '**Scope:** Eligibility only. No slope, extrapolation, forecast, prediction error or performance metric computed. No final-period history or target table generated.',
      '**Generated UTC:** '+datetime.now(timezone.utc).isoformat(),'',
      '## 1. Verified inventory and unchanged comparison sample','',
      'All **3,355** original bodies passed manifest/index integrity verification using the existing consolidated verifier: byte size, SHA-256, indexed Git blobs, unique source identities and exact observation file sets. Original acquisition pins are preserved. This is original-pin verification, not newly established cross-snapshot equivalence. After integrity checks, all records at/after 1 September 2026 were discarded, leaving **2,195 June–August reports**.', '',
      'The existing persistence `build_pairs` function reproduces the six approved case counts before this audit proceeds. Its `main`, `score`, prediction functions and performance-metric routines are not invoked; those scoring entry points are replaced in this new process with rejecting guards. Existing files are not edited.', '',
      '| Split | Horizon | Approved and reproduced pair count |','|---|---:|---:|']
    for (split,h),r in pairs.items():lines.append(f'| {split} | {h}h | {len(r["cases"])} |')
    lines += ['', '## 2. Frozen history rules and interpretations','',
      'Protocol sections 3.2 and 4 specify **L=3 elapsed hours anchored at issuance s**, not at latest input t₀. Select **s−3h ≤ tᵢ < t₀**, additionally tᵢ≤s−5min and in the same partition. The current persistence-anchor report is excluded from the three earlier-report minimum. Left lookback boundary is inclusive; anchor boundary is exclusive. No future report participates in close-cluster decisions.', '',
      'Require at least three eligible earlier reports, at least 90 minutes between oldest/newest eligible earlier reports, and at least two distinct reporting timestamps (nonzero time support). Repeated stage values are retained and do not invalidate time support. No numerical regression or time variance is computed.', '',
      'Close-chain membership is evaluated on the whole same-partition past-only cutoff view, including neighbours before the lookback start. Members of known adjacent ≤300-second chains, nonfinite stages and repeated timestamps are excluded from the selected history; nothing is merged. Later neighbours never change that historical state.', '',
      '**Internal gaps are explicitly specified, not absent:** protocol section 4.4 says a consecutive raw reporting interval >90 minutes within selected history through t₀ invalidates trend estimation. This audit checks consecutive raw reports from the oldest eligible earlier report through t₀, including the final earlier-report-to-anchor link. It does not treat a gap caused only by excluding close-chain records as a missing raw reporting interval.', '',
      '**Residual endpoint interpretation:** the phrase “within selected history through t₀” is operationalized as the closed range from the oldest eligible selected report through t₀. A gap ending before that oldest report is not internal. This is consistent with the audited positive-duration convention; the frozen protocol is not amended. No ambiguity exists about issuance anchoring, anchor exclusion, minimum count/span or the >90-minute invalidation rule.', '',
      'All existing issuance/matching rules remain: past-only five-minute cutoff, input age ≤90min, abstention on a known-close latest input, first forward target within 15min, original target-close/context/gap exclusions, six-hour warmup and strict 6h30m end embargo. No new issuance schedule or target sample is introduced.', '',
      '## 3. Trend-history eligibility and persistence fallback by split/horizon','',
      '| Split | h | Approved pairs | Trend-eligible | Persistence fallback | Eligibility | Fallback | Primary fallback reasons |',
      '|---|---:|---:|---:|---:|---|---|---|']
    group_hist={}
    for (split,h),r in pairs.items():
        hs=[unique[(split,c['s'])] for c in r['cases']];group_hist[(split,h)]=hs
        n=len(hs);ok=sum(x['eligible'] for x in hs);reasons=Counter(x['reason'] for x in hs if not x['eligible'])
        lines.append(f'| {split} | {h} | {n} | {ok} | {n-ok} | {ok}/{n} ({100*ok/n:.2f}%) | {n-ok}/{n} ({100*(n-ok)/n:.2f}%) | {dict(reasons)} |')
    lines += ['', 'Each denominator is the original persistence-eligible forecast–target sample. Fallback does not delete a case or alter its target. First-failure reason order: fewer than three → span below 90min → insufficient distinct times → internal raw gap. Marginal quality flags below can overlap and must not be added as disjoint losses.', '',
      '### Unique issuance level','',
      '| Split | Unique issuance union across approved horizons | Eligibility / fallback | First-failure reasons |','|---|---:|---|---|']
    for split,_,_ in SPLITS:
        hs=[v for (sp,s),v in unique.items() if sp==split]
        lines.append(f'| {split} | {len(hs)} | {tally(hs)} | {dict(Counter(h["reason"] for h in hs if not h["eligible"]))} |')
    lines += ['', 'Unique issuance means at least one already-approved usable horizon pair. It does **not** mean every input-eligible scheduled issuance; those with no usable target at any horizon are outside this task’s approved pair sample. The same history is computed once and reused for all its approved horizons; differences by horizon reflect target-sample selection, not horizon-dependent history rules.', '',
      '## 4. History count, span and reporting-time distributions','',
      '| Split / h | Eligible earlier-report count and span distribution (all histories, including fallback) |','|---|---|']
    for (split,h),hs in group_hist.items():lines.append(f'| {split} / {h}h | {describe(hs)} |')
    lines += ['', '| Split (unique issuances) | Trend-eligible histories | Oldest eligible report age at issuance (min) | Newest eligible earlier report age (min) |','|---|---|---|---|']
    for split,_,_ in SPLITS:
        hs=[v for (sp,s),v in unique.items() if sp==split]
        lines.append(f'| {split} | {describe([h for h in hs if h["eligible"]])} | {A["distribution"]([h["oldest_age"] for h in hs if h["oldest_age"] is not None])} | {A["distribution"]([h["newest_age"] for h in hs if h["newest_age"] is not None])} |')
    lines += ['', 'Oldest/newest age columns summarize all nonempty histories; the trend-eligible-history column separately summarizes qualifying histories. Oldest/newest timestamps are retained only in memory. Their ages above are relative to each issuance; no row-level history or target export is saved. Spans use eligible earlier reports only, not the excluded anchor. Empty histories have undefined span and are excluded only from span summaries, with count histogram retaining their zero count.', '',
      '## 5. History quality, close events, gaps and split boundaries','',
      '| Split (unique issuance) | Histories with removed close-chain reports | Removed close memberships (repeated histories count again) | Histories with internal raw gaps | Histories with repeated stage pairs | Marginal failure flags |','|---|---:|---:|---:|---:|---|']
    for split,_,_ in SPLITS:
        hs=[v for (sp,s),v in unique.items() if sp==split]
        flags=Counter(f for h in hs for f in h['flags'])
        lines.append(f'| {split} | {sum(h["close_excluded"]>0 for h in hs)} | {sum(h["close_excluded"] for h in hs)} | {sum(h["gap_count"]>0 for h in hs)} | {sum(h["repeated_stage_pairs"]>0 for h in hs)} | {dict(flags)} |')
    lines += ['',
      'All histories are constrained to the issuance partition; no selected report crosses a split. Prior-partition history is intentionally not carried into validation. No future neighbour or outcome is passed into history_at. Time support is distinct reporting proxies, not proof of independent physical observations.',
      f'Observed invalid numeric historical exclusions: {sum(h["invalid_excluded"] for h in unique.values())}; repeated-timestamp exclusions: {sum(h["repeated_times_excluded"] for h in unique.values())}. Source-path conflicts are absent by integrity verification. Upstream measurement/revision IDs are not available in the archived bodies, so the absence of detectable conflicts does not establish unambiguous measurement identity or revision history.', '',
      '## 6. Monthly, near-gap and elevated-window variation','',
      '| Month (unique approved issuances) | N | Eligibility / fallback |','|---|---:|---|']
    monthly=defaultdict(list)
    for (split,s),h in unique.items():monthly[datetime.fromtimestamp(s,A['LOCAL']).strftime('%Y-%m')].append(h)
    for month,hs in sorted(monthly.items()):lines.append(f'| {month} | {len(hs)} | {tally(hs)} |')
    lines += ['',
      'Near-gap diagnostic is **past-only**: an already-observed >90-minute raw gap ends at or before the current anchor, and within three hours before issuance. It is a reporting-quality stratum, not a new exclusion or a physical completeness claim.', '',
      '| Split (unique issuance) | Past near-gap | Other |','|---|---|---|']
    anchors={(split,c['s']):c['input']['epoch'] for (split,h),r in pairs.items() for c in r['cases']}
    for split,_,_ in SPLITS:
        near=[];other=[]
        for (sp,s),h in unique.items():
            if sp!=split:continue
            flag=any(b<=anchors[(sp,s)] and 0<=s-b<=10800 for a,b in gaps)
            (near if flag else other).append(h)
        lines.append(f'| {split} | {tally(near)} | {tally(other)} |')
    lines += ['', '### Previously identified elevated reporting windows','',
      'Uses only the five previously identified ≥5.54m windows within June–August, without re-estimating that descriptive threshold or reading final-period outcomes. No new development P95 or errors are computed. Two complementary views follow: issuance occurring in the reporting window, and history of approved pairs whose target lies in the window. Target-based strata are retrospective context only, never inputs to history eligibility. These windows are not verified floods.', '',
      '| Window, local reporting start → end | Unique approved issuances inside window | Eligibility / fallback |','|---|---:|---|']
    for w in windows:
        hs=[h for (split,s),h in unique.items() if w[0]['epoch']<=s<=w[-1]['epoch']]
        lines.append(f'| {w[0]["time"]} → {w[-1]["time"]} | {len(hs)} | {tally(hs)} |')
    lines += ['', '| Window | h | Approved target-in-window pairs | History eligibility / fallback |','|---|---:|---:|---|']
    for w in windows:
        ids={r['source_path'] for r in w}
        for h in [1,3,6]:
            hs=[unique[(split,c['s'])] for (split,hh),r in pairs.items() if hh==h for c in r['cases'] if c['target']['source_path'] in ids]
            lines.append(f'| {w[0]["time"]} → {w[-1]["time"]} | {h} | {len(hs)} | {tally(hs)} |')
    lines += ['', '## 7. Deterministic validation','']
    lines += ['- PASS (existing audit): '+t for t in oldtests]+['- PASS (history audit): '+t for t in newtests]
    lines += ['', 'Synthetic fixtures are in-memory software tests only. No source observation was changed. Reused score/prediction functions are guarded to raise; no existing persistence performance tests are run because those calculate predictions/errors. No trend slope or time-regression routine exists in this script.', '',
      '## 8. Interpretation, limitations and recommendation','',
      'The frozen rule requires **three earlier reports plus a separate anchor** inside an issuance-anchored three-hour window. With approximately hourly reports and a latest-input age often close to an hour, only two earlier reports may be available. Count-driven fallback can therefore be frequent even in a continuous hourly-like archive. Do not silently include the anchor, shift lookback to t₀, extend it, or count close submissions as independent observations to improve eligibility.', '',
      'The primary later comparison must retain every original approved pair and use persistence fallback when history is insufficient. A trend-only subset would differ from the full persistence sample and could favour particular reporting conditions. Any common-trend-history secondary comparison must evaluate both methods on precisely the same subset and expose fallback rates. Eligibility alone does not demonstrate that a trend forecast improves persistence.', '',
      'Original physical measurement time, station equivalence to 003HD007, gauge datum, first-publication availability and revision semantics remain unverified. The five-minute buffer does not prove availability. Distinct reporting paths and repeated values do not establish independent measurements. Reporting-time span is not a verified physical sampling span. Target- and history-quality exclusions select the analysed sample. No seasonal, flood-event, cascade or operational early-warning claim follows.', '',
      '**NO-GO for treating the frozen three-hour configuration as an informative general trend-performance experiment at this stage.** Only 13 development and eight validation unique issuances qualify, and every approved target-in-window pair in the five previously identified elevated windows requires fallback. A separately authorized frozen-rule comparison remains technically possible, but would be almost entirely persistence and cannot establish meaningful broad trend behaviour. Keep the original sample and primary rule unchanged. The already registered six-hour-lookback sensitivity is a defensible next eligibility investigation; adopting it as a replacement primary rule would require a separately approved protocol amendment.', '',
      '**One smallest next step:** approve a development/validation-only history eligibility audit of the already registered six-hour-lookback sensitivity, keeping the three-hour primary results intact and all other rules unchanged. Do not calculate slopes or forecasts in that next audit, and keep September–October reserved. No alternative lookback is executed in this task.', '',
      '## 9. Reproduction and evidence','',
      'Created only this report and `ML-Service/src/audit_ratnapura_stage_trend_history.py`. No row-level target/history dataset, new raw data, dashboard asset or API. The script refuses report overwrite.', '',
      '```text','ML-Service/.venv/bin/python ML-Service/src/audit_ratnapura_stage_trend_history.py',
      '& .\\ML-Service\\.venv\\Scripts\\python.exe .\\ML-Service\\src\\audit_ratnapura_stage_trend_history.py','```','',
      'Read-only evidence SHA-256 checksums:','']
    for name in ['outputs/ratnapura_stage_baseline_evaluation_protocol.md','outputs/ratnapura_stage_baseline_eligibility_audit.md','outputs/ratnapura_stage_persistence_development_validation.md','src/audit_ratnapura_stage_baseline_eligibility.py','src/evaluate_ratnapura_stage_persistence.py']:
        lines.append(f'- `{name}` — `{hashlib.sha256((ROOT/name).read_bytes()).hexdigest()}`')
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')
    print('PASS: 3355 integrity verified; exact six pair counts; final records excluded from histories')
    for key,hs in group_hist.items():print(key,tally(hs),dict(Counter(h['reason'] for h in hs)))
    for split,_,_ in SPLITS:
        hs=[v for (sp,s),v in unique.items() if sp==split];print('Unique',split,len(hs),tally(hs))
    print('Tests:',len(oldtests),'existing +',len(newtests),'history/invariants; no slopes/forecasts/errors computed')
    print('Created',REPORT)


if __name__=='__main__':main()
