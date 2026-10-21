"""Offline six-hour LOOKBACK sensitivity: history eligibility only, no forecasting.

Python 3.9+ standard library. Preserve primary audit and source files unchanged.
Only one aggregate Markdown report is written; no row-level data are exported.
"""
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter, defaultdict
import runpy
import hashlib

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'outputs/ratnapura_stage_trend_6h_sensitivity_audit.md'
H=runpy.run_path(str(ROOT/'src/audit_ratnapura_stage_trend_history.py'))
A=H['A'];P=H['P'];LIMIT=H['LIMIT'];SPLITS=H['SPLITS'];require=H['require']
PRIMARY={('Development',1):12,('Development',3):10,('Development',6):6,
         ('Validation',1):8,('Validation',3):7,('Validation',6):6}


def history_for_lookback(rows,s,anchor,start,end,lookback=21600):
    """Literal duration-parameter adaptation of frozen history_at; no slope.

    Only [s-lookback,anchor) changes. Raw gaps span the oldest selected report
    through anchor. Close chains use the entire same-partition cutoff view.
    """
    require(lookback in [10800,21600],'Only approved 3h/6h configurations allowed')
    require(start<=s<end<=LIMIT,'Final/unknown partition forbidden')
    require(start<=anchor['epoch']<=s-300,'Invalid causal anchor')
    past=[r for r in rows if start<=r['epoch']<=s-300]
    require(past and past[-1]['source_path']==anchor['source_path'],'Anchor is not latest available raw input')
    chains,closemap=A['clusters'](past)
    raw=[r for r in past if s-lookback<=r['epoch']<anchor['epoch']]
    closeids={past[i]['source_path'] for i in closemap}
    times=Counter(r['epoch'] for r in past)
    eligible=[r for r in raw if r['source_path'] not in closeids and times[r['epoch']]==1 and A['finite'](r['stage'])]
    count=len(eligible);span=eligible[-1]['epoch']-eligible[0]['epoch'] if eligible else None
    selectedraw=[r for r in past if eligible and eligible[0]['epoch']<=r['epoch']<=anchor['epoch']]
    gaps=[(a['epoch'],b['epoch']) for a,b in zip(selectedraw,selectedraw[1:]) if b['epoch']-a['epoch']>5400]
    flags=[]
    if count<3:flags.append('fewer_than_three_earlier_reports')
    if span is None or span<5400:flags.append('span_below_90_minutes')
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
    require(all(start<=r['epoch']<anchor['epoch'] and s-lookback<=r['epoch']<=s-300 for r in eligible),'History boundary violation')
    return result


def tests():
    passed=[]
    def check(name,condition):require(condition,name);passed.append(name)
    s=A['epoch']('2026-06-15T12:00');start=s-86400;end=s+86400
    def row(offset,name=None):return dict(epoch=s+offset,stage=1,source_path=str(offset) if name is None else name)
    def hist(offsets,extras=(),lookback=21600,begin=None):
        rs=sorted([row(t) for t in offsets]+[row(-300,'anchor')]+list(extras),key=lambda r:r['epoch'])
        return history_for_lookback(rs,s,next(r for r in rs if r['source_path']=='anchor'),start if begin is None else begin,end,lookback)
    h=hist([-21901,-21600,-18000,-14400,-10800,-7200,-3600])
    check('Exact six-hour left boundary included; outside report excluded',h['count']==6 and h['oldest']==s-21600)
    check('Three earlier observations qualify independently of separate anchor',hist([-10800,-7200,-3600])['eligible'])
    check('Two earlier observations require fallback',not hist([-7200,-3600])['eligible'])
    check('Anchor is never counted among earlier history','anchor' not in hist([-10800,-7200,-3600])['identities'])
    check('Exactly 90-minute span accepted',hist([-9000,-6300,-3600])['eligible'])
    check('Span below 90 minutes rejected',not hist([-8999,-6300,-3600])['eligible'])
    check('Five-minute availability and future neighbour exclusion unchanged',hist([-10800,-7200,-3600],extras=[row(-299,'unavailable'),row(3600,'future')])['eligible'])
    check('Known close-chain members remain excluded',hist([-10800,-7200,-3600],extras=[row(-7199,'close')])['close_excluded']==2)
    check('Outside-window close neighbour still flags boundary report',hist([-21601,-21600,-18000,-14400,-10800,-7200,-3600])['close_excluded']==1)
    check('Raw internal gap invalidates six-hour history','internal_raw_gap_over_90_minutes' in hist([-21600,-14400,-10800,-7200,-3600])['flags'])
    check('Exactly 90-minute raw gap retained',hist([-10800,-5400,-1200])['eligible'])
    check('Split boundary excludes older history',hist([-10800,-7200,-3600],begin=s-8000)['count']==2)
    h=hist([-10800,-7200,-3600]);check('Repeated stages do not invalidate time-supported history',h['eligible'] and h['repeated_stage_pairs']==2)
    rs=[row(-21600),row(-14400),row(-10800),row(-7200),row(-3600),row(-300,'anchor')]
    h3=history_for_lookback(rs,s,rs[-1],start,end,10800);h6=history_for_lookback(rs,s,rs[-1],start,end,21600)
    check('Expanded window may expose old gap without relaxing rule',h3['eligible'] and not h6['eligible'])
    check('Fallback count partitions the same two configurations',sum(h['eligible'] for h in [h3,h6])==1 and sum(not h['eligible'] for h in [h3,h6])==1)
    try:history_for_lookback([],LIMIT+3600,row(0),LIMIT,LIMIT+86400)
    except RuntimeError:passed.append('Final-period history rejected before examination')
    else:raise AssertionError('Final period allowed')
    check('Six-hour synthetic replay deterministic',hist([-10800,-7200,-3600])==hist([-10800,-7200,-3600]))
    return passed


def comparison(items):
    n=len(items);a=sum(x[0]['eligible'] for x in items);b=sum(x[1]['eligible'] for x in items)
    gain=sum(not x[0]['eligible'] and x[1]['eligible'] for x in items)
    lost=sum(x[0]['eligible'] and not x[1]['eligible'] for x in items)
    return n,a,b,n-b,gain,lost


def line(label,items):
    n,a,b,f,g,l=comparison(items)
    if not n:return f'| {label} | 0 | 0 | 0 | 0 | unavailable | unavailable | 0 | unavailable | 0 / 0 |'
    return f'| {label} | {n} | {a} | {b} | {f} | {b}/{n} ({100*b/n:.2f}%) | {f}/{n} ({100*f/n:.2f}%) | {b-a:+d} | {100*(b-a)/n:+.2f} pp | {g} / {l} |'


HEADER=['| Group | Same approved denominator | 3h eligible | 6h eligible | 6h fallback | 6h eligibility | 6h fallback rate | Net extra eligible | Improvement | Newly eligible / lost eligibility |',
        '|---|---:|---:|---:|---:|---|---|---:|---|---|']


def main():
    require(not REPORT.exists(),'Refusing report overwrite')
    oldtests=A['test_rules']();primarytests=H['tests']();newtests=tests()
    allrows,inventory,_=A['LIB']['verify_inventory']();require(len(allrows)==3355,'Inventory mismatch')
    rows=[r for r in allrows if r['epoch']<LIMIT];del allrows
    pairs,gaps=P['build_pairs'](rows)  # approved six-count gate, no scorer
    unique={};anchors={}
    for (split,h),r in pairs.items():
        start,end=next((a,b) for name,a,b in SPLITS if name==split)
        for c in r['cases']:
            key=(split,c['s'])
            if key not in unique:
                primary=H['history_at'](rows,c['s'],c['input'],start,end)
                require(primary==history_for_lookback(rows,c['s'],c['input'],start,end,10800),'Primary adaptation differs')
                unique[key]=[primary];anchors[key]=c['input']
    for key,expected in PRIMARY.items():
        sp,h=key;require(sum(unique[(sp,c['s'])][0]['eligible'] for c in pairs[key]['cases'])==expected,'Frozen primary count mismatch '+str(key))
    require(sum(x[0]['eligible'] for (sp,s),x in unique.items() if sp=='Development')==13,'Primary unique development mismatch')
    require(sum(x[0]['eligible'] for (sp,s),x in unique.items() if sp=='Validation')==8,'Primary unique validation mismatch')
    newtests.append('All approved pair counts and six frozen primary eligibility counts reproduced before sensitivity')
    for (split,s),hs in unique.items():
        start,end=next((a,b) for name,a,b in SPLITS if name==split)
        sensitivity=history_for_lookback(rows,s,anchors[(split,s)],start,end,21600)
        require(sensitivity==history_for_lookback(rows,s,anchors[(split,s)],start,end,21600),'Sensitivity nondeterminism')
        hs.append(sensitivity)
    newtests.append('All actual sensitivity histories reproduce exactly; only pre-final issuances processed')
    # Independent eligibility calculation: direct adjacent-neighbour flags rather
    # than shared cluster helper; no slope, prediction or error is calculated.
    for (split,s),hs in unique.items():
        start,end=next((a,b) for name,a,b in SPLITS if name==split)
        past=[r for r in rows if start<=r['epoch']<=s-300];blocked=set()
        for a,b in zip(past,past[1:]):
            if b['epoch']-a['epoch']<=300:blocked.update([a['source_path'],b['source_path']])
        selected=[r for r in past if s-21600<=r['epoch']<anchors[(split,s)]['epoch'] and r['source_path'] not in blocked]
        rawsegment=[r for r in past if selected and selected[0]['epoch']<=r['epoch']<=anchors[(split,s)]['epoch']]
        ok=len(selected)>=3 and selected[-1]['epoch']-selected[0]['epoch']>=5400 and not any(b['epoch']-a['epoch']>5400 for a,b in zip(rawsegment,rawsegment[1:]))
        require(ok==hs[1]['eligible'],'Independent check mismatch')
    newtests.append('Independent six-hour eligibility check passes on every actual unique issuance')
    grouped={key:[unique[(key[0],c['s'])] for c in r['cases']] for key,r in pairs.items()}
    windows=[];run=[]
    for r in rows:
        if r['stage']>=5.54:
            if run and r['epoch']-run[-1]['epoch']>5400:windows.append(run);run=[]
            run.append(r)
        elif run:windows.append(run);run=[]
    if run:windows.append(run)
    require(len(windows)==5,'Pre-final descriptive windows changed')
    lines=['# Six-hour recent-trend history-lookback sensitivity audit','',
      '**Scope:** Eligibility only. No slope, extrapolation, prediction, forecasting error or performance metric. Three-hour primary unchanged; six-hour duration is a registered sensitivity, not a replacement primary.',
      '**Generated UTC:** '+datetime.now(timezone.utc).isoformat(),'',
      '## 1. Integrity, scope and reproduced baseline','',
      'All **3,355 / 3,355** original records passed existing manifest SHA-256, indexed Git-blob, byte-size, source identity and exact file-set checks. Original acquisition revisions remain unchanged; this is not a new cross-snapshot equivalence claim. Only integrity verification reads final-period records. They are then discarded, leaving **2,195 June–August reports**; no September–October histories, targets, eligibility tables, outcomes or scores are constructed.', '',
      'Reused approved `build_pairs` reproduces development **1,113 / 1,009 / 876** and validation **587 / 549 / 510** pairs at 1h/3h/6h. The existing primary history implementation reproduces **12 / 10 / 6** and **8 / 7 / 6** eligible pairs, and **13 / 1,220** versus **8 / 628** at unique-issuance level, before six-hour histories are examined. Original scripts and reports are not edited or run through their main routines.', '',
      '## 2. One-factor sensitivity and unchanged rules','',
      'The only changed parameter is **L: 3h → 6h**, still anchored at issuance s. Select eligible earlier reports in **[s−L,t₀)**; left boundary inclusive, anchor excluded. Minimum three earlier reports plus a separate anchor, ≥90-minute earlier-report span and distinct reporting times remain required. Stages may repeat without invalidating time support.', '',
      'Same-partition cutoff is tᵢ≤s−5min. Close-chain membership uses only the complete past cutoff view, including neighbours outside the lookback. Known close members, invalid numeric reports and repeated timestamps remain excluded. Latest-anchor selection, age ≤90min, target matching, no replacement, target-context and gap policies are unchanged.', '',
      'Internal raw gaps >90min are checked from oldest selected eligible earlier report through t₀, including the anchor link. Expanding the window can expose older gaps and **lose** some previously eligible cases; do not assume monotonic eligibility. No internal-gap exclusion is relaxed, and no shortened post-gap subwindow is substituted.', '',
      'Development [1 June,1 August), validation [1 August,1 September), exact hourly issuance, six-hour warmup and strict s+6h30min<partition-end embargo remain. No earlier-partition history enters validation. The duration-parameterized function was checked for exact agreement with the original function at L=3h on every actual unique issuance.', '',
      '## 3. Same-pair eligibility and fallback by split/horizon','']+HEADER
    for (split,h),items in grouped.items():lines.append(line(f'{split} / {h}h',items))
    lines += ['', 'Absolute improvement is net eligible count (6h−3h); percentage-point improvement uses the unchanged approved-pair denominator. Newly gained and lost histories are shown separately so older-gap effects are visible. Repeated targets/issuances across horizons are dependent cases, not independent physical events.', '',
      '| Split / h | First-failure fallback reasons (6h) | Marginal flags (can overlap) |','|---|---|---|']
    for (split,h),items in grouped.items():
        lines.append(f'| {split} / {h}h | {dict(Counter(b["reason"] for a,b in items if not b["eligible"]))} | {dict(Counter(f for a,b in items for f in b["flags"]))} |')
    lines += ['', 'Reason order unchanged: count → span → distinct time support → internal raw gap. Fallback retains every original comparison pair and its persistence value in a future authorized comparison; none is removed here.', '',
      '## 4. Unique-issuance and monthly coverage','']+HEADER
    for split,_,_ in SPLITS:lines.append(line(split,[x for (sp,s),x in unique.items() if sp==split]))
    lines += ['', 'Unique issuances are the union of issuances with at least one approved usable target horizon; they are not all hourly opportunities or all input-eligible issuances. One history is reused across horizons. Thus horizon variation reflects matching/continuity sample selection, not a different history rule.', '']+HEADER
    monthly=defaultdict(list)
    for (split,s),x in unique.items():monthly[datetime.fromtimestamp(s,A['LOCAL']).strftime('%Y-%m')].append(x)
    for month,items in sorted(monthly.items()):lines.append(line(month,items))
    lines += ['', '## 5. Six-hour history quality','',
      '| Split / h | All earlier-report counts and spans | Qualifying histories only | Oldest age for qualifying histories (minutes) |','|---|---|---|---|']
    for (split,h),items in grouped.items():
        hs=[b for a,b in items];ok=[b for b in hs if b['eligible']]
        lines.append(f'| {split} / {h}h | {H["describe"](hs)} | {H["describe"](ok)} | {A["distribution"]([b["oldest_age"] for b in ok])} |')
    lines += ['', '| Split (unique issuance) | Any internal raw gap | Otherwise count/span/time-supported but gap-blocked | Newly qualified with an internal >90min gap | Histories with removed close reports | Removed close memberships | Histories with repeated stage pairs | Eligible oldest report >3h old |','|---|---:|---:|---:|---:|---:|---:|---:|']
    for split,_,_ in SPLITS:
        items=[x for (sp,s),x in unique.items() if sp==split];hs=[b for a,b in items]
        blocked=sum(b['gap_count']>0 and b['count']>=3 and b['span_minutes']>=90 for b in hs)
        admitted=sum(not a['eligible'] and b['eligible'] and b['gap_count']>0 for a,b in items)
        require(admitted==0,'Gap rule relaxed unexpectedly')
        lines.append(f'| {split} | {sum(b["gap_count"]>0 for b in hs)} | {blocked} | {admitted} | {sum(b["close_excluded"]>0 for b in hs)} | {sum(b["close_excluded"] for b in hs)} | {sum(b["repeated_stage_pairs"]>0 for b in hs)} | {sum(b["eligible"] and b["oldest_age"]>180 for b in hs)} |')
    lines += ['',
      'The extra histories frequently use reports more than three hours old; this is intentional six-hour context, **not** permission to use a stale latest anchor. All actual approved anchors retain the ≤90min age limit: zero stale latest anchors were admitted. No selected history crosses a split, no earlier-report age exceeds six hours and no admitted history includes an internal raw gap >90min. Gap-blocked expanded histories are counted above; a longer window does not justify bridging them.',
      f'Invalid-stage historical exclusions: {sum(x[1]["invalid_excluded"] for x in unique.values())}; repeated-timestamp exclusions: {sum(x[1]["repeated_times_excluded"] for x in unique.values())}. Source identity conflicts are absent by the verifier, but measurement/revision identity remains unresolved. Close memberships and repeated stage pairs recur across overlapping histories and must not be counted as distinct records.', '',
      '### Past near-gap variation','',
      'To preserve the existing temporal stratum, near-gap means an already observed >90min raw gap ends by the current anchor and within **three hours** before issuance. The diagnostic radius is not enlarged with lookback; it does not alter eligibility.', '']+HEADER
    for split,_,_ in SPLITS:
        near=[];other=[]
        for (sp,s),x in unique.items():
            if sp!=split:continue
            flag=any(b<=anchors[(sp,s)]['epoch'] and 0<=s-b<=10800 for a,b in gaps)
            (near if flag else other).append(x)
        lines.append(line(split+' past near-gap',near));lines.append(line(split+' other',other))
    lines += ['', '## 6. Previously identified elevated-stage windows','',
      'Only the five existing June–August ≥5.54m descriptive windows are reconstructed. The threshold is neither re-estimated nor optimized; it is contextual elevated-reporting analysis, not an official warning threshold or confirmed flood label. Target-in-window membership is retrospective stratification and never informs causal history selection. No final-period window is examined.', '',
      '### Unique approved issuance times inside each window','']+HEADER
    for w in windows:
        items=[x for (split,s),x in unique.items() if w[0]['epoch']<=s<=w[-1]['epoch']]
        lines.append(line(w[0]['time']+' → '+w[-1]['time'],items))
    lines += ['', '### Approved pairs whose target report is inside each window','']+HEADER
    for w in windows:
        ids={r['source_path'] for r in w}
        for h in [1,3,6]:
            items=[unique[(split,c['s'])] for (split,hh),r in pairs.items() if hh==h for c in r['cases'] if c['target']['source_path'] in ids]
            lines.append(line(w[0]['time']+' → '+w[-1]['time']+f' / {h}h',items))
    lines += ['', '## 7. Deterministic tests and independent checks','']
    lines += ['- PASS (existing issuance audit): '+t for t in oldtests]
    lines += ['- PASS (frozen primary history tests): '+t for t in primarytests]
    lines += ['- PASS (sensitivity tests/invariants): '+t for t in newtests]
    lines += ['', 'Synthetic fixtures are in-memory software tests only. The independent actual-data check uses direct adjacent-neighbour screening and raw-gap scanning; it does not estimate slopes or perform forecasting. All actual primary dictionaries were compared, not only total counts. Repeated sensitivity execution reproduces complete history dictionaries.', '',
      '## 8. Interpretation, limitations and recommendation','',
      'Eligibility gains establish that a longer history window is available, **not** that a linear extrapolation over it is accurate. Older stage history may reflect a different local trend, especially near reported peaks; slope stability remains untested. All timing/publication assumptions, unresolved station 003HD007 crosswalk, datum stability, revisions, dependent observations and June–October seasonal limitations remain.', '',
      'The registered L=6h sensitivity is not adopted as the primary method. Any eventual comparison must keep the exact same persistence-eligible pairs, use fallback on six-hour-ineligible cases, report fallback prevalence and compare both methods on identical samples. Do not select a subset to favour trend or claim independent flood-event skill. September–October remains reserved.', '',
      '**Conditional GO for a separately approved development/validation six-hour recent-trend-with-persistence-fallback comparison**, labelled as the registered sensitivity. The audit measures available history, not performance. Preserve the three-hour primary results and require separate approval before estimating a slope or scoring predictions.', '',
      '**One smallest next step:** review these sensitivity counts and approve, if satisfactory, a development/validation-only implementation and comparison of the registered six-hour trend sensitivity against persistence on the unchanged approved pairs. No trend forecasting is implemented in this task.', '',
      '## 9. Reproduction and evidence','',
      'Created only this report and `ML-Service/src/audit_ratnapura_stage_trend_6h_sensitivity.py`. Standard-library Python 3.9+, pathlib; no package installation/network. Refuses report overwrite. No row-level histories, target datasets or dashboard assets saved.', '',
      '```text','ML-Service/.venv/bin/python ML-Service/src/audit_ratnapura_stage_trend_6h_sensitivity.py',
      '& .\\ML-Service\\.venv\\Scripts\\python.exe .\\ML-Service\\src\\audit_ratnapura_stage_trend_6h_sensitivity.py','```','',
      'Frozen local evidence SHA-256 checksums:','']
    for name in ['outputs/ratnapura_stage_baseline_evaluation_protocol.md','outputs/ratnapura_stage_baseline_eligibility_audit.md','outputs/ratnapura_stage_trend_history_eligibility_audit.md','src/audit_ratnapura_stage_trend_history.py','outputs/ratnapura_stage_persistence_development_validation.md']:
        lines.append(f'- `{name}` — `{hashlib.sha256((ROOT/name).read_bytes()).hexdigest()}`')
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')
    print('PASS: 3355 records verified; approved pairs and 3h eligible counts reproduced')
    for key,items in grouped.items():print(key,comparison(items),'reasons',dict(Counter(b['reason'] for a,b in items if not b['eligible'])))
    for split,_,_ in SPLITS:print('Unique',split,comparison([x for (sp,s),x in unique.items() if sp==split]))
    print('Tests:',len(oldtests),'issuance,',len(primarytests),'primary history,',len(newtests),'sensitivity/invariants; no slopes/forecasts/errors')
    print('Created',REPORT)


if __name__=='__main__':main()
