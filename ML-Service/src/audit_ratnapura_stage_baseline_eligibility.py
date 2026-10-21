"""Offline primary issuance/matching audit only; no predictions or errors.

Python 3.9+ standard library. Reuses existing inventory verifier without running
its report generator. All issuance/target identities stay in memory; only the
aggregate Markdown report is written. Synthetic test fixtures are in memory only.
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from bisect import bisect_left, bisect_right
import runpy
import json
import statistics
import hashlib

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'outputs/ratnapura_stage_baseline_eligibility_audit.md'
# run_path avoids generating __pycache__ in the research source directory.
LIB=runpy.run_path(str(ROOT/'src/analyze_ratnapura_stage_consolidated.py'))
LOCAL=LIB['LOCAL'];finite=LIB['finite'];percentile=LIB['percentile']


def epoch(text):
    return datetime.fromisoformat(text).replace(tzinfo=LOCAL).timestamp()


SPLITS=[('Development',epoch('2026-06-01T00:00'),epoch('2026-08-01T00:00')),
        ('Validation',epoch('2026-08-01T00:00'),epoch('2026-09-01T00:00')),
        ('Final',epoch('2026-09-01T00:00'),epoch('2026-10-19T00:00'))]


def clusters(rows):
    """Adjacent <=300-second chains; identity map, not deduplication."""
    result=[];run=[]
    for i,r in enumerate(rows):
        if run and r['epoch']-rows[run[-1]]['epoch']>300:
            if len(run)>1:result.append(run)
            run=[]
        run.append(i)
    if len(run)>1:result.append(run)
    return result,{i:k for k,g in enumerate(result) for i in g}


def input_at(rows,s,start):
    """Only past rows enter this function; future neighbours are never checked."""
    c=s-300
    view=[r for r in rows if start<=r['epoch']<=c]
    if not view:return None,'no_past_input'
    last=view[-1]
    if len(view)>1 and last['epoch']-view[-2]['epoch']<=300:
        return last,'known_close_input'
    if not finite(last['stage']):return last,'invalid_input'
    if s-last['epoch']>5400:return last,'stale_input'
    return last,None


def scheduled(s,start,end):
    return s>=start+21600 and s+23400<end


def first_target(rows,u,end):
    ts=[r['epoch'] for r in rows];i=bisect_left(ts,u)
    if i==len(rows) or rows[i]['epoch']>u+900:return None,'no_target_in_window'
    if rows[i]['epoch']>=end:return None,'cross_split_target'
    return i,None


def gap_intersects(a,b,lo,hi):
    # Positive-duration overlap excludes merely touching a known endpoint.
    return b-a>5400 and max(a,lo)<min(b,hi)


def reuse_counts(cases):
    counts=Counter(x['target']['source_path'] for x in cases)
    return {'distinct_targets':len(counts),'reused_targets':sum(n>1 for n in counts.values()),
            'excess_assignments':sum(n-1 for n in counts.values()),'maximum_uses':max(counts.values(),default=0),
            'multiplicity':dict(sorted(Counter(counts.values()).items()))}


def distribution(values):
    if not values:return 'N=0; unavailable'
    return f'N={len(values)}; min={min(values):.4f}, median={statistics.median(values):.4f}, mean={statistics.mean(values):.4f}, P95={percentile(values,.95):.4f}, max={max(values):.4f}'


def test_rules():
    tests=[]
    def row(t,n='x'):
        return {'epoch':t,'stage':1.0,'source_path':n}
    def check(name,condition):
        if not condition:raise AssertionError(name)
        tests.append(name)
    s=100000
    r,why=input_at([row(s-300)],s,0);check('Input exactly five minutes old included',why is None)
    r,why=input_at([row(s-299)],s,0);check('Input newer than five-minute cutoff excluded',why=='no_past_input')
    check('Input exactly 90 minutes old included',input_at([row(s-5400)],s,0)[1] is None)
    check('Input older than 90 minutes excluded',input_at([row(s-5401)],s,0)[1]=='stale_input')
    for seconds,ok in [(0,True),(900,True),(901,False),(-1,False)]:
        i,why=first_target([row(s+seconds)],s,s+10000)
        check('Target offset '+str(seconds)+' seconds', (i is not None)==ok)
    check('300-second pair is close',len(clusters([row(0),row(300)])[0])==1)
    check('301-second pair is not close',len(clusters([row(0),row(301)])[0])==0)
    check('Chained close cluster includes all members',len(clusters([row(0),row(250),row(500)])[0][0])==3)
    # This later neighbour is unavailable at cutoff and cannot change the input.
    check('Future neighbour does not retrospectively exclude input',input_at([row(s-301),row(s-299)],s,0)[1] is None)
    check('Known close latest report causes abstention',input_at([row(s-400),row(s-300)],s,0)[1]=='known_close_input')
    check('Target at partition end excluded',first_target([row(s)],s,s)[1]=='cross_split_target')
    end=200000
    check('Embargo equality excluded',not scheduled(end-23400,0,end))
    check('Six-hour target plus 15m and 5m context inside retained hourly boundary',scheduled(epoch('2026-07-31T17:00'),SPLITS[0][1],SPLITS[0][2]) and epoch('2026-07-31T17:00')+21600+900+300<SPLITS[0][2])
    check('Warmup equality included',scheduled(21600,0,100000))
    check('Prior-partition input excluded',input_at([row(999)],7000,1000)[1]=='no_past_input')
    a=datetime.fromisoformat('2026-06-01T06:00:00+05:30');b=datetime.fromisoformat('2026-06-01T00:30:00+00:00')
    check('Timezone-aware equal instants order identically',a.timestamp()==b.timestamp())
    target=row(1)
    check('Repeated target assignments quantified',reuse_counts([{'target':target},{'target':target}])['excess_assignments']==1)
    check('Gap ending at known input does not overlap evaluated interval',not gap_intersects(0,6000,6000,7000))
    check('Gap spanning evaluated interval excluded',gap_intersects(0,6000,1000,5000))
    return tests


def main():
    if REPORT.exists():raise RuntimeError('Refusing to overwrite existing report')
    tests=test_rules();rows,inventory,refs=LIB['verify_inventory']()
    ts=[r['epoch'] for r in rows];byid={r['source_path']:i for i,r in enumerate(rows)}
    cs,cmap=clusters(rows);rawpairs=list(zip(rows,rows[1:]));longgaps=[(a['epoch'],b['epoch']) for a,b in rawpairs if b['epoch']-a['epoch']>5400]
    stats={};monthstats=defaultdict(Counter);allmatches=[];usable=[];issuances=[];boundary_errors=[]
    known_clusters=set();future_clusters=set();target_clusters=set();retained_future=[]
    for split,start,end in SPLITS:
        total=int((end-start)/3600);candidates=[];warm=embargo=0;reasons=Counter()
        for j in range(total):
            s=start+j*3600
            if s<start+21600:warm+=1;continue
            if s+23400>=end:embargo+=1;continue
            r,reason=input_at(rows,s,start);month=datetime.fromtimestamp(s,LOCAL).strftime('%Y-%m')
            monthstats[month]['scheduled']+=1
            if reason:
                reasons[reason]+=1;monthstats[month][reason]+=1
                if reason=='known_close_input':known_clusters.add(cmap[byid[r['source_path']]])
                continue
            assert start<=r['epoch']<=s-300 and s-r['epoch']<=5400
            candidates.append((s,r));issuances.append((split,s,r));monthstats[month]['eligible']+=1
            idx=byid[r['source_path']]
            if idx in cmap:future_clusters.add(cmap[idx])
        base={'all_hours':total,'warmup':warm,'embargo':embargo,'scheduled':total-warm-embargo,'eligible':len(candidates),'input_reasons':dict(reasons),
              'age_minutes':[(s-r['epoch'])/60 for s,r in candidates]}
        for h in [1,3,6]:
            record=dict(base);funnel=Counter();flags=Counter();matched=[];final=[];seen=set()
            for s,r in candidates:
                i,reason=first_target(rows,s+h*3600,end)
                if reason:funnel[reason]+=1;continue
                target=rows[i];case={'split':split,'h':h,'s':s,'input':r,'target':target,'i':i};matched.append(case);allmatches.append(case)
                q=target['epoch'];idx=byid[r['source_path']]
                if i in cmap:flags['close_target']+=1;target_clusters.add(cmap[i])
                if idx in cmap:flags['input_later_discovered_close']+=1
                badgap=any(gap_intersects(a,b,r['epoch'],q) for a,b in longgaps)
                if badgap:flags['continuity_gap']+=1
                # Ex-post target QA, never a modification of input eligibility.
                if not finite(target['stage']):funnel['invalid_target']+=1;continue
                if (i>0 and ts[i-1]==q) or (i+1<len(ts) and ts[i+1]==q):funnel['duplicate_time_target']+=1;continue
                if i in cmap:funnel['close_target']+=1;continue
                if q+300>=end or q+300>ts[-1]:funnel['insufficient_target_context']+=1;continue
                if badgap:funnel['continuity_gap']+=1;continue
                identity=target['source_path']
                if identity in seen:funnel['target_reuse_same_horizon']+=1;continue
                seen.add(identity);final.append(case);usable.append(case)
                if idx in cmap:retained_future.append(case)
                assert target['epoch']>=s+h*3600 and target['epoch']<=s+h*3600+900
                assert r['source_path']!=identity and start<=q<end and q+300<end
            record.update(funnel=dict(funnel),flags=dict(flags),matched=matched,final=final)
            assert len(final)+sum(funnel.values())==len(candidates)
            stats[(split,h)]=record
    # Primary audit stores no target rows, stage targets or feature table on disk.
    # Reproduce only the ten existing descriptive windows, not a new threshold.
    windows=[];run=[]
    for r in rows:
        if r['stage']>=5.54:
            if run and r['epoch']-run[-1]['epoch']>5400:windows.append(run);run=[]
            run.append(r)
        elif run:windows.append(run);run=[]
    if run:windows.append(run)
    assert len(windows)==10
    lines=['# Ratnapura forecast-issuance eligibility and target-matching audit','',
      '**Scope:** Offline primary-protocol feasibility only. No baseline predictions, forecasting errors, performance metrics or trained models. No row-level target table saved.',
      '**Generated UTC:** '+datetime.now(timezone.utc).isoformat(), '',
      '## 1. Integrity and specification','',
      'All **3,355 / 3,355** records passed the existing consolidated verifier: original manifest SHA-256 and byte sizes, indexed Git blob identity, source URL/revision and station/name semantics, unique source paths, and exact observation file sets. No missing or extra bodies. Original acquisition revisions are retained. This verifies original pinned provenance, not new cross-snapshot equivalence or physical observation validity.', '',
      'Coverage: **2026-06-01T00:04:39+05:30 through 2026-10-18T23:05:10+05:30**. The archive has 146 >90-minute reporting gaps and 71 close pairs. See [consolidated QA](ratnapura_stage_consolidated_qa.md) and [approved protocol](ratnapura_stage_baseline_evaluation_protocol.md). No network access. Existing inventory verifier was loaded with runpy; its report-producing main routine was not called.', '',
      '| Batch | Verified | Original revision | Raw bytes |','|---|---:|---|---:|']
    lines += [f'| `{f}` | {n} | `{rev}` | {size} |' for f,n,rev,size,_ in inventory]
    lines += ['', '## 2. Explicit primary implementation and provisional interpretations','',
      '- Exact local hourly schedule; cutoff c=s−5 minutes inclusive. The latest raw report in the partition at/before c is inspected. Known-close latest input causes abstention, with no reach-back. Age 90 minutes is inclusive. No future row or neighbour is consulted for eligibility.',
      '- Past close chains use only the cutoff view. For its latest row, the previous raw row ≤300 seconds earlier is sufficient to determine known membership. Later full-archive cluster labels are attached for audit only and never rewrite input state.',
      '- First raw report at/after s+h is selected if ≤15 minutes late. No earlier target, interpolation, value-based choice, or replacement of a bad first candidate. Matching count means time-matched **before** outcome QA; usable count means after the full funnel.',
      '- Full-archive target-close membership is an explicit ex-post outcome filter. Finite/duplicate-time checks precede close filtering, then target-context, continuity and within-horizon reuse checks. Marginal flags are also retained to expose overlapping causes.',
      '- **Provisional gap interpretation:** “intersects [t₀,q]” means positive-duration overlap, not merely touching an observed endpoint. A long gap ending exactly at the known input is not a later continuity failure. This resolves unspecified interval-end semantics without changing the >90-minute threshold.',
      '- **Provisional target context interpretation:** q+5 minutes must be before the partition end and no later than the archive last proxy. This is covered archive time, not a requirement for a new report within five minutes (which would be unsuitable for an approximately hourly feed). It is not proof of measurement/publication completeness.',
      '- This task audits primary issuance and target eligibility for persistence feasibility. Trend slope/history eligibility and registered sensitivity configurations are **not run**; no slope, forecast, target-derived error or performance is calculated.', '',
      '## 3. Issuance schedule and input eligibility','',
      '| Split | All local hourly candidates | Warmup removed | End embargo removed | Scheduled after rules | Input eligible | Ineligible | Reasons | Age distribution (minutes) |',
      '|---|---:|---:|---:|---:|---:|---:|---|---|']
    for split,_,_ in SPLITS:
        r=stats[(split,1)]
        lines.append(f'| {split} | {r["all_hours"]} | {r["warmup"]} | {r["embargo"]} | {r["scheduled"]} | {r["eligible"]} | {r["scheduled"]-r["eligible"]} | {r["input_reasons"]} | {distribution(r["age_minutes"])} |')
    lines += ['', 'All candidate hours cover the 140 local calendar dates; warmup/end embargo exclusions precede the scheduled denominator. End embargo uses the strict inequality in the protocol. Input reasons are mutually exclusive, evaluated as no input → known close → invalid numeric → stale.', '',
      '| Month | Scheduled after boundary rules | Input eligible | Input ineligibility counts |','|---|---:|---:|---|']
    for month,c in sorted(monthstats.items()):lines.append(f'| {month} | {c["scheduled"]} | {c["eligible"]} | {dict((k,v) for k,v in c.items() if k not in ["scheduled","eligible"])} |')
    lines += ['', '## 4. Horizon matching and final usable pairs','',
      '| Split | Horizon (h) | Scheduled | Input eligible | Time-matched | Unmatched | Close-target excluded | Final usable | Usable / scheduled | Usable / input eligible | First-failure outcome exclusions |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|']
    for (split,h),r in stats.items():
        n=len(r['final']);lines.append(f'| {split} | {h} | {r["scheduled"]} | {r["eligible"]} | {len(r["matched"])} | {r["funnel"].get("no_target_in_window",0)} | {r["funnel"].get("close_target",0)} | {n} | {n}/{r["scheduled"]} ({100*n/r["scheduled"]:.2f}%) | {n}/{r["eligible"]} ({100*n/r["eligible"]:.2f}%) | {r["funnel"]} |')
    lines += ['', '| Split | h | Time-matched lateness (minutes) | Usable lateness (minutes) | Usable actual horizon (minutes) | Marginal flags among time matches |', '|---|---:|---|---|---|---|']
    for (split,h),r in stats.items():
        late=lambda xs:[(x['target']['epoch']-x['s']-h*3600)/60 for x in xs]
        lines.append(f'| {split} | {h} | {distribution(late(r["matched"]))} | {distribution(late(r["final"]))} | {distribution([(x["target"]["epoch"]-x["s"])/60 for x in r["final"]])} | {r["flags"]} |')
    lines += ['', '### Consolidated horizon totals', '',
      '| Horizon | All calendar candidates | Scheduled | Input eligible | Time matched | Final usable | Usable / all candidates | Usable / scheduled | Usable / eligible |',
      '|---|---:|---:|---:|---:|---:|---|---|---|']
    scheduled_total=sum(stats[(sp,1)]['scheduled'] for sp,_,_ in SPLITS)
    eligible_total=len(issuances)
    eligibility_note=f'Overall issuance eligibility: **{eligible_total}/{scheduled_total} ({100*eligible_total/scheduled_total:.2f}%)** after warmup/embargo; {eligible_total}/3360 ({100*eligible_total/3360:.2f}%) of all calendar candidates.'
    for h in [1,3,6]:
        n=sum(len(stats[(sp,h)]['final']) for sp,_,_ in SPLITS)
        matched=sum(len(stats[(sp,h)]['matched']) for sp,_,_ in SPLITS)
        lines.append(f'| {h}h | 3360 | {scheduled_total} | {eligible_total} | {matched} | {n} | {n}/3360 ({100*n/3360:.2f}%) | {n}/{scheduled_total} ({100*n/scheduled_total:.2f}%) | {n}/{eligible_total} ({100*n/eligible_total:.2f}%) |')
    lines += ['',eligibility_note]
    lines += ['', 'For each horizon, input eligibility is the same; matching and outcome exclusions differ. No-match means no report within the declared forward window, not a proven missing physical measurement. Targets excluded for close membership are not replaced. Continuity filtering is retrospective sample selection, not an input/issuance rule. All funnel totals were asserted to equal eligible issuance counts.', '',
      '## 5. Close events, future discovery and target dependence','',
      f'The 71 close pairs form **{len(cs)} candidate-close chains**, containing **{len(cmap)} raw records**. Clusters affecting latest eligible/attempted inputs and matched outcomes below are distinct chain counts, not independent measurements.',
      f'- Known-close latest inputs caused {sum(stats[(split,1)]["input_reasons"].get("known_close_input",0) for split,_,_ in SPLITS)} issuance abstentions, involving {len(known_clusters)} distinct chains.',
      f'- {len(future_clusters)} chains affected eligible inputs whose close membership was not yet visible at cutoff; {sum(byid[r["source_path"]] in cmap for _,s,r in issuances)} eligible issuances used such inputs. In these cases the later close neighbour was after cutoff, possibly before issuance or after issuance; those categories are separated below.',
      f'- Time-matched targets involved {len(target_clusters)} chains. Final usable pairs retaining inputs later identified as close: {len(retained_future)}. These are retained because the input was eligible in its past-only view; no future neighbour rewrites that decision.', '',
      '| Later-neighbour discovery category | Eligible issuance count | Final usable pairs (all horizons) |','|---|---:|---:|']
    def discovery(s,r):
        idx=byid[r['source_path']]
        if idx not in cmap:return 'not_later_close'
        # Eligible clustered row can only be the first member, with later neighbour unavailable.
        nxt=rows[idx+1]['epoch']
        return 'neighbour after issuance' if nxt>s else 'neighbour after cutoff, at/before issuance'
    dc=Counter(discovery(s,r) for _,s,r in issuances);fc=Counter(discovery(x['s'],x['input']) for x in usable)
    for k in ['neighbour after issuance','neighbour after cutoff, at/before issuance']:lines.append(f'| {k} | {dc[k]} | {fc[k]} |')
    lines += ['', '| Assignment set | Reuse summary |','|---|---|',f'| All time matches, all horizons/splits | {reuse_counts(allmatches)} |',f'| Final usable, all horizons/splits | {reuse_counts(usable)} |']
    for h in [1,3,6]:lines.append(f'| Final usable, horizon {h}h only | {reuse_counts([x for x in usable if x["h"]==h])} |')
    lines += ['', 'Reused targets across horizons remain allowed and correlated; these are multiple evaluations of one archived report, not duplicated source records or independent events. Within each horizon/partition, target uniqueness is enforced after earlier exclusions (earliest eligible issuance wins). Hourly forward 15-minute windows are disjoint, so same-horizon reuse is not expected. Serial dependence and overlapping input histories remain even without target reuse.', '',
      '## 6. Chronological split and context audit','',
      '- Development: [1 June, 1 August); validation: [1 August, 1 September); final: [1 September, 19 October), all local midnight boundaries.',
      '- Six-hour warmup is inclusive at start+6h. End condition is strictly s+6h30m<end. The hourly grid retains the last issuance at 17:00 on each final partition date; a worst-case 6h+15m target plus five-minute context ends by 23:20, inside that partition.',
      '- Every selected input was asserted inside its issuance partition and at/before cutoff. Every usable target and five-minute context was asserted inside the same partition. No cross-partition target or inappropriate prior-partition input was retained.',
      '- Earlier observations within the same partition are permitted causal history. Earlier-partition data could legitimately serve operational rolling lookback but is prohibited by this primary cold-start protocol. No trend lookback or fitted-model training was performed here.',
      '- The strict 6h30m embargo is sufficient on this hourly grid. For an arbitrary minute-level issuance schedule, a future 30-minute sensitivity plus five-minute target context would require an explicit 6h35m bound or separate context exclusion. **No amendment is necessary for this primary hourly audit**; do not generalize its boundary proof to other schedules.',
      '- Previous full-archive descriptive QA already exposed final-period summaries. No final-period predictions or errors were calculated; outcome matching here is feasibility metadata, not an untouched external test.', '',
      '## 7. Previously identified elevated-stage windows','',
      'Reproduced only the existing ≥5.54 m descriptive runs (split by below-threshold reports or >90-minute gaps). This is outcome-coverage auditing, not a new training threshold, official flood threshold or confirmed event catalogue. Counts are unique target reports per window; same report may appear at multiple horizons.', '',
      '| Existing window (local start → end) | Source reports | h | Unique time-matched targets | Unique final usable targets |','|---|---:|---:|---:|---:|']
    for w in windows:
        ids={r['source_path'] for r in w}
        for h in [1,3,6]:
            a={x['target']['source_path'] for x in allmatches if x['h']==h and x['target']['source_path'] in ids};b={x['target']['source_path'] for x in usable if x['h']==h and x['target']['source_path'] in ids}
            lines.append(f'| {w[0]["time"]} → {w[-1]["time"]} | {len(w)} | {h} | {len(a)} | {len(b)} |')
    lines += ['', '## 8. Deterministic offline tests','']+['- PASS: '+t for t in tests]
    lines += ['', 'Synthetic timestamp fixtures are in-memory software tests only; no raw observation was altered or manufactured as research data. Actual-data invariants also check cutoff, age, partition membership, target window, source identity separation, complete funnel accounting and exact ten-window reproduction.', '',
      '## 9. Limitations, ambiguities and decision','',
      'The positive-overlap gap convention and covered-time target-context convention above are provisional interpretations of unspecified endpoint language; the approved protocol file was not changed. Latest-input ambiguity follows its explicit abstention rule. All exclusions preserve raw observations. Target-quality filters are ex-post and can make the usable subset cleaner than a real deployment stream.', '',
      'Reporting/edit proxies are not verified measurement or publication times. The five-minute buffer is not verified latency. Historical revision availability cannot be reconstructed perfectly; known code-level temporal ordering does not solve source revision leakage. Public station equivalence to 003HD007, gauge datum/stability and independence of distinct submissions remain unverified. A singleton later found close is not a verified measurement. The June–October archive does not establish seasonal or operational generalization.', '',
      '**GO, conditional on review, for a separately approved persistence-baseline implementation** on the audited primary cases. Enough matched cases exist to justify a limited retrospective comparison; no assertion of skill or operational early warning follows. Preserve the registered rule interpretations and all coverage denominators. Trend feasibility/sensitivities and a development-only elevated threshold need separate authorized steps; none is inferred from this audit.', '',
      '**One smallest next step:** review this audit and explicitly approve the two documented rule interpretations, then authorize persistence-only implementation with the unchanged primary matching/split policy. Do not begin it during this task.', '',
      '## 10. Reproduction and created files','',
      'Created only `ML-Service/src/audit_ratnapura_stage_baseline_eligibility.py` and this report. Standard-library Python 3.9+; no packages/network required. No row-level target table, raw copies, model-ready export or dashboard asset was saved.', '',
      '```text','ML-Service/.venv/bin/python ML-Service/src/audit_ratnapura_stage_baseline_eligibility.py',
      '& .\\ML-Service\\.venv\\Scripts\\python.exe .\\ML-Service\\src\\audit_ratnapura_stage_baseline_eligibility.py','```','',
      'The script refuses to overwrite the report; it does not modify the existing verifier or protocol. Source hashes remain in their original manifests. Evidence: consolidated QA/verifier, protocol and record revision review. Original-pin versus newer-pin equivalence limitations are inherited from consolidated QA.']
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(lines)+'\n')
    print('PASS integrity: 3355; deterministic tests:',len(tests),'clusters',len(cs),'members',len(cmap))
    for split,_,_ in SPLITS:
        r=stats[(split,1)];print(split,'all',r['all_hours'],'scheduled',r['scheduled'],'eligible',r['eligible'],'input reasons',r['input_reasons'])
        for h in [1,3,6]:
            r=stats[(split,h)];print(h,'matched',len(r['matched']),'usable',len(r['final']),'exclusions',r['funnel'])
    print('Target reuse',reuse_counts(usable));print('Created',REPORT)


if __name__=='__main__':main()
