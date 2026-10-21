"""Local-only historical hydrograph and validation; no resampling or prediction.

Run from any directory with the ML-Service virtual environment's Python.
Existing outputs are never overwritten. Paths support macOS and Windows.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import math
import os
import tempfile

# Keep Matplotlib's font/config cache out of the repository and user home.
_CACHE = tempfile.TemporaryDirectory(prefix='ratnapura-hydrograph-mpl-')
os.environ['MPLCONFIGDIR'] = _CACHE.name
import matplotlib
matplotlib.use('Agg')  # File rendering; no GUI, server or network connection.
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/raw/ratnapura_stage_month_2026-09-11_to_2026-10-10'
PNG = ROOT / 'outputs/visualization/ratnapura_stage_month_hydrograph.png'
SVG = PNG.with_suffix('.svg')
REPORT = ROOT / 'outputs/ratnapura_stage_hydrograph_validation.md'
COMMIT = 'baffd0a5fea232d05de7bcb80f3405740f1a1851'
LOCAL = timezone(timedelta(hours=5, minutes=30), 'Asia/Colombo')
DPI = 180
WIDTH, HEIGHT = 18, 12


def require(condition, message):
    if not condition:
        raise RuntimeError('VALIDATION FAIL: '+message)


def digest(body):
    return hashlib.sha256(body).hexdigest()


def read_data():
    """Raw bodies are authoritative; the manifest and QA are checked against them."""
    manifest=json.loads((DATA/'manifest.json').read_text())
    index=json.loads((DATA/'source_index/approved_records.json').read_text())
    qa=json.loads((DATA/'exploratory_qa.json').read_text())
    require(manifest['commit']==index['commit']==COMMIT,'source revision')
    require(manifest['status']=='complete_verified' and manifest['verified_records']==723,'completed manifest')
    require(len(manifest['records'])==len(index['records'])==len(qa['rows'])==723,'record counts')
    indexed={r['path']:r for r in index['records']}
    listed={r['path']:r for r in manifest['records']}
    observed={str(p.relative_to(DATA)) for p in (DATA/'observations').rglob('*') if p.is_file()}
    require(len(indexed)==len(listed)==723 and set(indexed)==set(listed)==observed,'exact raw file set')
    qa_rows={r['raw_path']:r for r in qa['rows']}
    require(set(qa_rows)==set(indexed),'QA source identities')
    rows=[]
    for path,entry in listed.items():
        for key in ['source_revision','url','git_blob_sha1','bytes']:
            require(entry[key]==indexed[path][key],path+' indexed '+key)
        body=(DATA/path).read_bytes()
        require(len(body)==entry['bytes'] and digest(body)==entry['sha256'],path+' SHA-256/size')
        git_hash=hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()
        require(git_hash==entry['git_blob_sha1'],path+' Git blob')
        raw=json.loads(body);t=raw.get('time_ut');stage=raw.get('water_level_m')
        require(type(t) is int and type(stage) in [int,float] and math.isfinite(stage),'original numeric timestamp/stage')
        require(raw.get('station_name')=='Rathnapura','public station name')
        dt=datetime.fromtimestamp(t,timezone.utc).astimezone(LOCAL)
        filename=datetime.strptime(entry['name'],'%Y-%m-%d-%H-%M-%S.json').replace(tzinfo=LOCAL)
        require(filename.timestamp()==t and dt.date().isoformat()==entry['day'],'filename/local day')
        require(entry['day'] in index['days'] and dt.utcoffset()==timedelta(hours=5,minutes=30),'timezone/window')
        old=qa_rows[path]
        require(old['raw_time_ut']==old['report_epoch']==t and old['stage_raw']==stage,'QA raw values/times')
        require(old['report_local']==dt.isoformat() and old['source_url']==entry['url'],'QA time/source')
        rows.append({'path':path,'epoch':t,'stage':stage,'datetime':dt,'sha256':digest(body)})
    rows.sort(key=lambda r:(r['epoch'],r['path']))
    require(len({r['path'] for r in rows})==723,'no removed/merged identities')
    require(sum(listed[r['path']]['bytes'] for r in rows)==60633,'source byte total')
    # Check the human QA report's key figures too, without rewriting it.
    text=(ROOT/'outputs/ratnapura_stage_month_qa.md').read_text()
    for value in [COMMIT,'723 indexed / 723 downloaded / 723 verified','0.66, 6.86','24 |','10 |']:
        require(value in text,'expected existing report finding: '+value)
    return rows,qa


def validate_flags(rows,qa):
    pairs=[]
    for i,(a,b) in enumerate(zip(rows,rows[1:])):
        pairs.append({'index':i,'from_path':a['path'],'to_path':b['path'],
                      'from':a['datetime'].isoformat(),'to':b['datetime'].isoformat(),
                      'minutes':(b['epoch']-a['epoch'])/60,
                      'from_stage':a['stage'],'to_stage':b['stage'],
                      'change_m':b['stage']-a['stage']})
    gaps=[p for p in pairs if p['minutes']>90]
    close=[p for p in pairs if p['minutes']<=5]
    rise=max((p for p in pairs if p['change_m']>0),key=lambda p:p['change_m'])
    fall=min((p for p in pairs if p['change_m']<0),key=lambda p:p['change_m'])
    old=qa['overall']
    for actual,expected in [(gaps,old['gaps_over_90_minutes']),(close,old['close_events_at_most_5_minutes'])]:
        require([{k:v for k,v in p.items() if k!='index'} for p in actual]==expected,'gap/close pair identities, times and values')
    for actual,expected in [(rise,old['largest_positive_change']),(fall,old['largest_negative_change'])]:
        require({k:v for k,v in actual.items() if k!='index'}==expected,'rise/fall annotation provenance')
    require(len(gaps)==24 and len(close)==10,'expected QA flag counts')
    require([min(r['stage'] for r in rows),max(r['stage'] for r in rows)]==old['stage_range_m']==[0.66,6.86],'stage range')
    require([rows[0]['datetime'].isoformat(),rows[-1]['datetime'].isoformat()]==old['span_local'],'reporting span')
    return pairs,gaps,close,rise,fall


def draw(rows,pairs,gaps,close,rise,fall):
    times=[r['datetime'] for r in rows]
    x=np.array(mdates.date2num(times));y=np.array([r['stage'] for r in rows],dtype=np.float64)
    allowed=[p['index'] for p in pairs if p['minutes']<=90]
    segments=np.array([[[x[i],y[i]],[x[i+1],y[i+1]]] for i in allowed])
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'svg.fonttype':'none'})
    fig=plt.figure(figsize=(WIDTH,HEIGHT),dpi=DPI,facecolor='#f7f9fc')
    grid=fig.add_gridspec(2,1,height_ratios=[3.2,1.65],left=0.065,right=0.975,top=0.87,bottom=0.13,hspace=0.37)
    ax=fig.add_subplot(grid[0]);ax.set_facecolor('white')
    fig.text(0.065,0.96,'Ratnapura | Historical reported river stage',fontsize=22,fontweight='bold',color='#16324b')
    fig.text(0.065,0.925,'11 September–10 October 2026  •  Archive reporting/edit times  •  Asia/Colombo (UTC+05:30)',fontsize=12,color='#41566b')
    fig.text(0.975,0.96,'RESEARCH QA\nNo forecasts',ha='right',va='top',fontsize=11,color='#6b4e7d')
    lines=LineCollection(segments,colors='#327fa2',linewidths=1.05,alpha=0.8,zorder=2)
    ax.add_collection(lines)
    points=ax.scatter(x,y,s=11,color='#135d83',edgecolors='none',zorder=3)
    gap_artists=[]
    previous_mid=None
    label_row=0
    for j,p in enumerate(gaps,1):
        i=p['index'];gap_artists.append(ax.axvspan(x[i],x[i+1],color='#e6a44a',alpha=0.18,zorder=0))
        midpoint=(x[i]+x[i+1])/2
        # Offset only crowded IDs; the shaded gap's actual times never move.
        label_row=1-label_row if previous_mid is not None and midpoint-previous_mid<0.18 else 0
        ax.text(midpoint,0.015+label_row*0.075,f'G{j:02d}',transform=ax.get_xaxis_transform(),rotation=90,ha='center',va='bottom',fontsize=6.5,color='#92530e')
        previous_mid=midpoint
    endpoint_indices=[j for p in close for j in [p['index'],p['index']+1]]
    close_artist=ax.scatter(x[endpoint_indices],y[endpoint_indices],marker='D',s=58,facecolors='none',edgecolors='#a94f0b',linewidths=1.3,zorder=4)
    for j,p in enumerate(close,1):
        i=p['index']+1
        ax.annotate(f'C{j:02d}',(x[i],y[i]),xytext=(0,11 if j%2 else -17),textcoords='offset points',ha='center',fontsize=8,color='#984b0f',fontweight='bold')
    annotation_texts=[]
    for p,title,color,position in [(rise,'Largest report rise','#22704c',(0.08,0.83)),(fall,'Largest report fall','#a13442',(0.34,0.83))]:
        i=p['index'];ax.scatter(x[[i,i+1]],y[[i,i+1]],s=65,marker='o',facecolors='none',edgecolors=color,linewidths=1.7,zorder=5)
        text=f"{title}: {p['change_m']:+.2f} m\n{p['minutes']:.2f} min · {rows[i]['datetime']:%d %b}\n{rows[i]['datetime']:%H:%M:%S} → {rows[i+1]['datetime']:%H:%M:%S}"
        artist=ax.annotate(text,xy=(x[i+1],y[i+1]),xytext=position,textcoords='axes fraction',fontsize=9,color=color,
                          bbox={'boxstyle':'round,pad=0.5','fc':'white','ec':color,'alpha':0.95},
                          arrowprops={'arrowstyle':'->','color':color,'lw':1.1},zorder=6)
        annotation_texts.append((artist,p))
    ax.set_xlim(mdates.date2num(datetime(2026,9,11,tzinfo=LOCAL)),mdates.date2num(datetime(2026,10,11,tzinfo=LOCAL)))
    ax.set_ylim(0.25,7.35)
    ax.xaxis.set_major_locator(mdates.DayLocator(interval=3,tz=LOCAL))
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%d %b',tz=LOCAL))
    ax.xaxis.set_minor_locator(mdates.DayLocator(tz=LOCAL))
    ax.set_xlabel('Archive reporting/edit time — Asia/Colombo (UTC+05:30)',labelpad=9)
    ax.set_ylabel('Reported river stage (m; source convention)')
    ax.grid(axis='y',color='#dfe6ec',linewidth=0.7);ax.set_axisbelow(True)
    for spine in ['top','right']:ax.spines[spine].set_visible(False)
    legend=[Line2D([],[],marker='o',linestyle='-',color='#135d83',markersize=4,label='All 723 reports; line only when interval ≤90 min'),
            Patch(facecolor='#e6a44a',alpha=0.3,label='G01–G24: >90 min gap; line broken'),
            Line2D([],[],marker='D',linestyle='none',markerfacecolor='none',markeredgecolor='#a94f0b',markersize=7,label='C01–C10: pair ≤5 min; both retained')]
    ax.legend(handles=legend,loc='upper center',bbox_to_anchor=(0.5,1.105),ncol=3,frameon=False,fontsize=9)
    detail=fig.add_subplot(grid[1]);detail.axis('off')
    detail.set_title('Close-event detail — distinct archived reports, not verified independent measurements',loc='left',fontsize=12,fontweight='bold',color='#16324b',pad=14)
    table_rows=[]
    for j,p in enumerate(close,1):
        a=rows[p['index']]['datetime'];b=rows[p['index']+1]['datetime']
        table_rows.append([f'C{j:02d}',a.strftime('%d %b %Y'),a.strftime('%H:%M:%S'),b.strftime('%H:%M:%S'),f"{p['from_stage']:.2f} → {p['to_stage']:.2f}",f"{p['minutes']*60:g}"])
    table=detail.table(cellText=table_rows,colLabels=['Flag','Local date','First report','Next report','Stage A → B (m)','Seconds apart'],
                       cellLoc='left',colLoc='left',colWidths=[0.07,0.19,0.17,0.17,0.23,0.17],bbox=[0,0,1,1])
    table.auto_set_font_size(False);table.set_fontsize(10)
    for (r,c),cell in table.get_celld().items():
        cell.set_edgecolor('#dde5ed');cell.set_linewidth(0.5)
        cell.set_facecolor('#e8eef5' if r==0 else ('#ffffff' if r%2 else '#f2f5f9'))
        if r==0:cell.set_text_props(weight='bold',color='#16324b')
    fig.text(0.065,0.075,'Historical source reports only. Edit/report times are not verified measurement times; datum and station-to-003HD007 identity are unverified.',fontsize=10,color='#4b5968')
    fig.text(0.065,0.048,'No interpolation, smoothing, hourly resampling or deduplication. Flag overlays identify existing points; they add no observations. No predictions.',fontsize=10,color='#4b5968')
    fig.text(0.975,0.022,f'Source: nuuuwan/lk_irrigation · {COMMIT[:12]} · Stage range 0.66–6.86 m',ha='right',fontsize=9,color='#617387')

    # Artist-level checks verify the actual data sent to Matplotlib, not just inputs.
    offsets=np.asarray(points.get_offsets())
    require(offsets.shape==(723,2),'main observation artist has exactly 723 points')
    np.testing.assert_array_equal(offsets[:,0],x)
    np.testing.assert_array_equal(offsets[:,1],y)
    actual_segments=lines.get_segments()
    require(len(actual_segments)==len(allowed)==722-24,'one segment per eligible consecutive pair')
    for segment,i in zip(actual_segments,allowed):
        np.testing.assert_array_equal(segment,[[x[i],y[i]],[x[i+1],y[i+1]]])
        require(rows[i+1]['epoch']-rows[i]['epoch']<=5400,'no segment crosses a reporting gap')
    require(set(allowed).isdisjoint(p['index'] for p in gaps),'all 24 gaps disconnected')
    require(len(gap_artists)==24,'all gaps visibly shaded')
    np.testing.assert_array_equal(np.asarray(close_artist.get_offsets()),np.column_stack([x[endpoint_indices],y[endpoint_indices]]))
    require(len(endpoint_indices)==20 and len(table_rows)==10,'both endpoints and a detail row for every close pair')
    for j,(text,p) in enumerate(annotation_texts):
        require(f"{p['change_m']:+.2f}" in text.get_text(),'annotation change label')
    require(ax.get_ylim()[0]<=min(y) and ax.get_ylim()[1]>=max(y),'all stages inside visible axis range')
    for xx,row in zip(x,rows):
        dt=mdates.num2date(xx,tz=LOCAL)
        require(abs(dt.timestamp()-row['epoch'])<0.00001,'display-time round-trip within 10 microseconds')
        require(dt.utcoffset()==timedelta(hours=5,minutes=30),'display timezone')
    return fig,{'observations':723,'line_segments':len(allowed),'gap_discontinuities':24,'close_pairs':10,'flag_endpoint_overlays':20,
                'polygon_gaps_shaded':len(gap_artists),'stage_range':[min(y),max(y)],'display_time_tolerance_seconds':0.00001}


def make_report(rows,qa,gaps,close,rise,fall,checks):
    parts=['# Ratnapura historical stage hydrograph validation', '',
        '**Result:** PASS — standalone historical visualization; not forecasting or model training.',
        '**Validation date (UTC):** '+datetime.now(timezone.utc).isoformat(), '',
        '## Source and authoritative local evidence', '',
        f'Source revision: `{COMMIT}` of nuuuwan/lk_irrigation. Input folder: `ML-Service/data/raw/ratnapura_stage_month_2026-09-11_to_2026-10-10/`. All data were read locally; no network was accessed.', '',
        '| Evidence | Role |', '|---|---|',
        '| `observations/YYYY-MM-DD/*.json` | Authoritative unchanged `time_ut`, original `water_level_m`, public station label |',
        '| `manifest.json` | Source URLs/revision, raw paths, byte counts, SHA-256, Git blob identities, research retrieval times |',
        '| `source_index/approved_records.json` | Pinned approved 723-path allow-list and blob/size identities |',
        '| `exploratory_qa.json` | Existing per-record inspection and exact gap, close-event and largest-change comparisons |',
        '| `ML-Service/outputs/ratnapura_stage_month_qa.md` | Existing human QA report; key counts/range checked without modification |', '',
        'Reporting span, Asia/Colombo: **'+rows[0]['datetime'].isoformat()+' to '+rows[-1]['datetime'].isoformat()+'**. Date membership and filename agreement were verified against each raw epoch. Asia/Colombo is represented explicitly as UTC+05:30 for this 2026 window, with no reliance on the operating system timezone.', '',
        '## Outputs and method', '',
        f'PNG: `{PNG.relative_to(ROOT.parent)}` — **{WIDTH*DPI} × {HEIGHT*DPI} pixels**, {DPI} dpi. SVG: `{SVG.relative_to(ROOT.parent)}` — vector output, {WIDTH*72} × {HEIGHT*72} point canvas.', '',
        'The main scatter artist contains all **723 original observations**, in chronological reporting order. Sorting changes neither raw timestamps nor values. The line comprises exactly **698 separate two-point segments**, one per consecutive pair separated by no more than 90 minutes. All **24 intervals greater than 90 minutes** are disconnected, amber-shaded and labelled G01–G24. No regular-hour grid, interpolation, smoothing, deletion or aggregation is used.', '',
        'All **10 pairs separated by 0–300 seconds inclusive** have both endpoints overlaid as orange diamonds and labelled C01–C10. The full-width detail table makes the two timestamps and values legible even where seconds-apart points overlap at month scale. The 20 endpoint overlays and rise/fall rings refer to existing observations; they are not additional independent observations. Coincident/nearby points can visually overlap in the monthly chart, so a raster cannot prove point count by visual counting alone; the artist-level checks and detail table address that limitation.', '',
        '## Validation checks', '',
        '| Check | Result |', '|---|---|',
        '| Expected manifest/index/raw/QA identities | PASS: exact same 723 unique source paths; no extra or missing raw files |',
        '| Raw integrity | PASS: all 723 byte counts, SHA-256 and indexed Git blob SHA-1 values |',
        '| Original numeric values/timestamps | PASS: every raw stage/epoch matches existing exploratory QA and actual main-artist coordinates; no source modification |',
        '| Point count | PASS: main artist offsets shape `(723, 2)`; 723 distinct source identities retained |',
        '| Gaps and discontinuities | PASS: exact identities/times/values agree with existing QA; 24 absent connecting segments and 24 labelled/shaded spans |',
        '| Close pairs | PASS: exact existing QA pairs; 20 endpoint overlays and 10 labelled detail rows |',
        '| Largest rise/fall | PASS: source paths, timestamps, values, intervals and deltas agree with existing QA |',
        '| Timezone | PASS: explicit UTC+05:30 axis formatter and local dates; displayed date-coordinate round-trip within 10 microseconds |',
        '| Stage range | PASS: raw and QA range **0.66–6.86 m**; all values within visible axis limits |',
        '| Rendered PNG dimensions | PASS: decoded image shape matches 2160 rows × 3240 columns |', '',
        'The 10-microsecond tolerance concerns floating-point plotting-date representation only. Original integer source epochs remain unchanged; no timestamp rounding, reconstruction or fabricated timestamps were used.', '',
        '### Annotated changes', '',
        '| Annotation | Reporting times, Asia/Colombo | Values (m) | Change (m) | Interval |', '|---|---|---|---:|---|']
    for name,p in [('Largest report rise',rise),('Largest report fall',fall)]:
        parts.append(f"| {name} | {p['from']} → {p['to']} | {p['from_stage']} → {p['to_stage']} | {p['change_m']:+.2f} | {p['minutes']:.6f} minutes |")
    parts += ['', '### Gap-label cross-reference', '', '| Plot flag | From, local | To, local | Minutes |', '|---|---|---|---:|']
    for j,p in enumerate(gaps,1):parts.append(f"| G{j:02d} | {p['from']} | {p['to']} | {p['minutes']:.3f} |")
    parts += ['', '### Close-event cross-reference', '', '| Plot flag | First / next local reporting times | Stage A / B (m) | Seconds |', '|---|---|---|---:|']
    for j,p in enumerate(close,1):parts.append(f"| C{j:02d} | {p['from']} / {p['to']} | {p['from_stage']} / {p['to_stage']} | {p['minutes']*60:g} |")
    parts += ['', '## Discrepancies and limitations', '',
        '**No discrepancy found** between raw records, manifest, approved index, exploratory QA and the checked key findings in the existing report. No existing source or report was adjusted.', '',
        'Reported time is an upstream reporting/edit proxy, not verified physical measurement time. Gauge datum, equivalence to official station 003HD007 and revision semantics remain unverified. Source metres are retained; no discharge conversion or warning thresholds are shown. Reporting gaps are not proof of missing physical measurements; abrupt changes and close events are not independently corroborated hydrological events or corrections.', '',
        'Matplotlib '+matplotlib.__version__+' and NumPy '+np.__version__+' were already installed. The Agg backend rendered locally without a server, GUI, package installation or network access. A temporary system directory holds Matplotlib font/config cache, leaving repository and user configuration untouched. The initial library availability check reported an unwritable default home cache and fell back to a temporary directory; plotting explicitly avoids that path.', '',
        'The PNG is ready for visual inspection and the SVG offers a scalable version for reading flag details. These are static historical research artifacts, not an interactive data explorer. Automated checks establish data/artist consistency and output dimensions; visual inspection is separately recorded below. Windows execution is not tested here, although pathlib, standard datetime and an explicit timezone keep paths/time handling portable.', '',
        '**Dashboard suitability:** suitable as a historical research panel after visual acceptance, provided gap/close-event legend and the measurement-time/datum/identity limitations remain visible. No Leaflet or frontend integration was performed.', '',
        '**One smallest next step:** Review the PNG/SVG at full size and approve or request layout changes before any dashboard integration.', '',
        '## Reproduction and preservation', '',
        'Script: `ML-Service/src/plot_ratnapura_stage_month.py`. It refuses existing output destinations, so regeneration requires separately approved replacement or new output names; it does not reacquire or modify observations.', '',
        '```text',
        'ML-Service/.venv/bin/python ML-Service/src/plot_ratnapura_stage_month.py',
        r'& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\plot_ratnapura_stage_month.py',
        '```', '',
        'Source-manifest SHA-256: `'+digest((DATA/'manifest.json').read_bytes())+'`.',
        'Exploratory-QA SHA-256: `'+digest((DATA/'exploratory_qa.json').read_bytes())+'`.',
        'PNG SHA-256: `'+digest(PNG.read_bytes())+'`.',
        'SVG SHA-256: `'+digest(SVG.read_bytes())+'`.', '',
        'Only the new plotting script, PNG, SVG and this validation report were created. Existing raw records/manifests, acquisition scripts, research reports, DEMs, watershed exports, Leaflet files and teammates’ files were not modified. No Git operation or model training occurred.']
    with REPORT.open('x',encoding='utf-8') as f:f.write('\n'.join(parts)+'\n')


def main():
    for path in [PNG,SVG,REPORT]:
        if path.exists():raise FileExistsError('Preserving existing output: '+str(path))
    rows,qa=read_data()
    pairs,gaps,close,rise,fall=validate_flags(rows,qa)
    fig,checks=draw(rows,pairs,gaps,close,rise,fall)
    PNG.parent.mkdir(parents=True,exist_ok=True)
    # Use exclusive file handles; even a concurrent output cannot be overwritten.
    with PNG.open('xb') as f:fig.savefig(f,format='png',dpi=DPI,facecolor=fig.get_facecolor())
    with SVG.open('xb') as f:fig.savefig(f,format='svg',facecolor=fig.get_facecolor())
    plt.close(fig)
    pixels=plt.imread(PNG)
    require(pixels.shape[:2]==(HEIGHT*DPI,WIDTH*DPI),'PNG dimensions')
    make_report(rows,qa,gaps,close,rise,fall,checks)
    print('PASS',json.dumps(checks))
    print('Created',PNG,SVG,REPORT,sep='\n')


if __name__=='__main__':
    main()
