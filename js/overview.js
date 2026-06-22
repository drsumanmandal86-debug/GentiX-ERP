/* ===================== BUSINESS OVERVIEW MODULE ===================== */
const overviewModule = (() => {
  let myChart = null;
  let allSales=[], allExpenses=[], allProducts=[], allCash=[];
  let currentPeriod = 'thisMonth';
  let pickedMonth = '';

  const localDate = d => {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const parseDs = v => {
    if(!v) return '';
    const s=String(v).trim();
    if(/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)){
      const p=s.substring(0,10).split('/');
      return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    }
    return s.substring(0,10);
  };

  // Convert period key → {s, e} date strings
  function periodToRange(p, cf, ct){
    const now=new Date(); let s, e=localDate(now);
    switch(p){
      case 'today': s=localDate(now); break;
      case 'yesterday': { const d=new Date(now);d.setDate(d.getDate()-1);s=e=localDate(d); break; }
      case 'thisWeek': { const d=new Date(now);d.setDate(d.getDate()-((d.getDay()||7)-1));s=localDate(d); break; }
      case 'lastWeek': {
        const st=new Date(now);st.setDate(st.getDate()-((st.getDay()||7)-1)-7);
        const en=new Date(st);en.setDate(en.getDate()+6);
        s=localDate(st);e=localDate(en); break;
      }
      case 'thisMonth': s=localDate(new Date(now.getFullYear(),now.getMonth(),1)); break;
      case 'lastMonth': {
        s=localDate(new Date(now.getFullYear(),now.getMonth()-1,1));
        e=localDate(new Date(now.getFullYear(),now.getMonth(),0)); break;
      }
      case '3months': { const d=new Date(now);d.setMonth(d.getMonth()-3);s=localDate(d); break; }
      case '6months': { const d=new Date(now);d.setMonth(d.getMonth()-6);s=localDate(d); break; }
      case '12months': { const d=new Date(now);d.setMonth(d.getMonth()-12);s=localDate(d); break; }
      case '24months': { const d=new Date(now);d.setMonth(d.getMonth()-24);s=localDate(d); break; }
      case 'thisYear': s=`${now.getFullYear()}-01-01`; break;
      case 'lastYear': s=`${now.getFullYear()-1}-01-01`; e=`${now.getFullYear()-1}-12-31`; break;
      case 'custom': s=cf||localDate(now); e=ct||localDate(now); break;
      case 'pickMonth': {
        const m=pickedMonth||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        s=`${m}-01`;
        const lastDay=new Date(parseInt(m.split('-')[0]),parseInt(m.split('-')[1]),0).getDate();
        e=`${m}-${String(lastDay).padStart(2,'0')}`;
        break;
      }
      default: s='2020-01-01';
    }
    return {s,e};
  }

  // Calculate all metrics for a date range
  function calcMetrics(fromDs, toDs){
    const costMap={};
    allProducts.forEach(p=>{if(p.name) costMap[p.name.trim().toLowerCase()]=p.buyPrice||0;});

    const sales=allSales.filter(s=>{
      const ds=parseDs(s.date);
      return ds>=fromDs && ds<=toDs && s.status!=='Returned';
    });
    const exps=allExpenses.filter(e=>{
      const ds=parseDs(e.date);
      return ds>=fromDs && ds<=toDs && (e.status==='Paid'||e.category==='Meta/Facebook Ads');
    });

    const rev=sales.reduce((s,d)=>s+(d.total||0),0);
    const cogs=sales.reduce((s,d)=>{
      const bp=costMap[(d.product||'').trim().toLowerCase()]||d.buyPrice||0;
      return s+(d.qty||0)*bp;
    },0);
    const adCost=exps.filter(e=>(e.category||'').match(/facebook|meta/i)).reduce((s,d)=>s+(d.amount||0),0);
    const opex=exps.filter(e=>!(e.category||'').match(/facebook|meta/i)).reduce((s,d)=>s+(d.amount||0),0);
    const net=rev-cogs-opex-adCost; // both expense types subtracted
    const gross=rev-cogs;
    return { rev, cogs, opex, adCost, net, gross, txns:sales.length,
      netMargin:rev>0?(net/rev*100):0, grossMargin:rev>0?(gross/rev*100):0 };
  }

  // Period display label
  function periodLabel(p){
    return {today:'Today',yesterday:'Yesterday',thisWeek:'This Week',lastWeek:'Last Week',
      thisMonth:'This Month',lastMonth:'Last Month','3months':'Last 3M','6months':'Last 6M',
      '12months':'Last 12M','24months':'Last 24M',thisYear:'This Year',lastYear:'Last Year',custom:'Custom'}[p]||p;
  }

  async function load(){
    renderLayout();
    await fetchAll();
    renderChart(currentPeriod);
    renderInvestmentProgress();
  }

  async function fetchAll(){
    const[sS,eS,pS,cS]=await Promise.all([
      window.db.collection('sales').get(),
      window.db.collection('expenses').get(),
      window.db.collection('products').get(),
      window.db.collection('cashBook').get()
    ]);
    allSales=sS.docs.map(d=>d.data());
    allExpenses=eS.docs.map(d=>d.data());
    allProducts=pS.docs.map(d=>d.data());
    allCash=cS.docs.map(d=>d.data());
  }

  const PERIODS=[
    ['thisMonth','This Month'],['lastMonth','Last Month'],
    ['3months','3M'],['6months','6M'],['12months','12M'],['24months','24M'],
    ['thisYear','This Year'],['lastYear','Last Year'],['all','All Time']
  ];
  const CMP_OPTS=[
    ['today','Today'],['yesterday','Yesterday'],['thisWeek','This Week'],['lastWeek','Last Week'],
    ['thisMonth','This Month'],['lastMonth','Last Month'],
    ['3months','Last 3M'],['6months','Last 6M'],['12months','Last 12M'],['24months','Last 24M'],
    ['thisYear','This Year'],['lastYear','Last Year'],['custom','Custom Range']
  ];

  function renderLayout(){
    document.getElementById('section-overview').innerHTML=`
    <style>
      .ov-pb{border:1px solid #334155;background:transparent;color:#94a3b8;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
      .ov-pb.active{background:#3b82f6;color:#fff;border-color:#3b82f6}
      .ov-kpi{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px 18px;flex:1;min-width:130px}
      .ov-kpi-label{color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px}
      .ov-kpi-val{color:#fff;font-size:20px;font-weight:800;margin-bottom:2px}
      .ov-kpi-sub{font-size:11px;font-weight:600;color:#64748b}
      .cmp-period-sel{background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;width:100%}
      .cmp-metric-row{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 80px;align-items:center;padding:10px 14px;border-bottom:1px solid #1e293b;font-size:13px}
      .cmp-metric-row:nth-child(even){background:rgba(255,255,255,.02)}
      .delta-pos{color:#22c55e;font-weight:700} .delta-neg{color:#ef4444;font-weight:700} .delta-neu{color:#64748b}
    </style>

    <!-- Main dark card -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);border-radius:18px;padding:22px;margin-bottom:14px">

      <!-- Title + Period filters -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h5 style="color:#fff;font-weight:800;margin:0">Business Investment vs Capital Performance</h5>
          <p style="color:#475569;font-size:12px;margin:3px 0 0">Sales · Cost · Profit · ROI — Dynamic Chart</p>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          ${PERIODS.map(([k,l])=>`<button class="ov-pb${k===currentPeriod?' active':''}" id="ovbtn-${k}" onclick="overviewModule.setPeriod('${k}')">${l}</button>`).join('')}
          <button class="ov-pb${currentPeriod==='pickMonth'?' active':''}" id="ovbtn-pickMonth" onclick="overviewModule.toggleMonthPicker()" title="যেকোনো মাস বেছে নিন" style="display:flex;align-items:center;gap:4px"><i class="bi bi-calendar3"></i> Pick Month</button>
          <input type="month" id="ov-month-picker" style="display:none;background:#1e293b;border:1px solid #475569;color:#e2e8f0;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer" onchange="overviewModule.setPickMonth(this.value)">
        </div>
      </div>

      <!-- KPI Cards -->
      <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap" id="ov-kpi-row">
        <div class="ov-kpi"><div class="ov-kpi-label"><i class="bi bi-graph-up me-1"></i>Total Sales</div>
          <div class="ov-kpi-val" id="ov-total-sales">৳0</div><div class="ov-kpi-sub" id="ov-sales-sub">—</div></div>
        <div class="ov-kpi"><div class="ov-kpi-label"><i class="bi bi-box-seam me-1"></i>COGS</div>
          <div class="ov-kpi-val" id="ov-total-cogs">৳0</div><div class="ov-kpi-sub">Sold item cost</div></div>
        <div class="ov-kpi"><div class="ov-kpi-label"><i class="bi bi-receipt me-1"></i>Expenses</div>
          <div class="ov-kpi-val" id="ov-total-exp">৳0</div><div class="ov-kpi-sub" id="ov-adcost-sub">Ad: ৳0</div></div>
        <div class="ov-kpi"><div class="ov-kpi-label"><i class="bi bi-shield-check me-1"></i>Net Profit</div>
          <div class="ov-kpi-val" id="ov-net-profit">৳0</div><div class="ov-kpi-sub" id="ov-margin-sub">0% margin</div></div>
        <div class="ov-kpi"><div class="ov-kpi-label"><i class="bi bi-speedometer2 me-1"></i>ROI</div>
          <div class="ov-kpi-val" id="ov-roi">0%</div><div class="ov-kpi-sub">On investment</div></div>
      </div>

      <!-- Chart canvas -->
      <div style="position:relative;height:320px;background:rgba(0,0,0,.2);border-radius:12px;padding:14px">
        <canvas id="ovChart"></canvas>
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:14px;margin-top:12px;flex-wrap:wrap;justify-content:center">
        ${[['#22c55e','Revenue'],['#ef4444','Total Cost (COGS+Exp)'],['#3b82f6','Net Profit Trend'],['#f59e0b','ROI % →']].map(([c,l])=>`
        <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;font-weight:600">
          <div style="width:24px;height:3px;background:${c};border-radius:2px"></div>${l}
        </div>`).join('')}
      </div>
    </div>

    <!-- Investment Recovery Progress -->
    <div id="ov-invest-section" style="margin-bottom:14px"></div>

    <!-- Monthly breakdown -->
    <div class="table-card mb-3" style="overflow:hidden">
      <div id="ov-breakdown-header" style="padding:12px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center">
        <span id="ov-breakdown-title"><i class="bi bi-table me-2" style="color:#3949ab"></i>Monthly Breakdown</span>
        <button onclick="overviewModule.printBreakdown()" class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 12px;font-weight:700"><i class="bi bi-printer me-1"></i>Print / Save</button>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Month</th><th style="text-align:right">Revenue</th><th style="text-align:right">COGS</th>
          <th style="text-align:right">Cash In (SF)</th>
          <th style="text-align:right">Expenses</th><th style="text-align:right">Ad Spend</th>
          <th style="text-align:right">Net Profit</th><th style="text-align:right">Margin</th>
        </tr></thead><tbody id="ov-monthly-table"></tbody></table>
      </div>
    </div>

    <!-- ===== BUSINESS HEALTH CARDS ===== -->
    <div id="ov-health-section" style="display:none;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px" id="ov-health-cards"></div>
    </div>

    <!-- Audit Report Section -->
    <div class="table-card mb-3" style="overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px">
        <i class="bi bi-file-earmark-bar-graph-fill me-2" style="color:#3949ab"></i>CA Audit Report — Period Selector
      </div>
      <div style="padding:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block;margin-bottom:5px">From Date</label>
            <input type="date" id="auditFrom" class="form-control">
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block;margin-bottom:5px">To Date</label>
            <input type="date" id="auditTo" class="form-control">
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          <button onclick="overviewModule.setAuditPreset('thisMonth')" class="btn btn-outline btn-sm" style="font-size:11px">This Month</button>
          <button onclick="overviewModule.setAuditPreset('lastMonth')" class="btn btn-outline btn-sm" style="font-size:11px">Last Month</button>
          <button onclick="overviewModule.setAuditPreset('thisYear')" class="btn btn-outline btn-sm" style="font-size:11px">This Year</button>
          <button onclick="overviewModule.setAuditPreset('lastYear')" class="btn btn-outline btn-sm" style="font-size:11px">Last Year</button>
          <button onclick="overviewModule.setAuditPreset('lifetime')" class="btn btn-outline btn-sm" style="font-size:11px">&#8734; Lifetime</button>
        </div>
        <button onclick="overviewModule.generateAuditReport()" class="btn btn-primary" style="width:100%;justify-content:center;font-size:13px;font-weight:700;padding:11px">
          <i class="bi bi-file-earmark-bar-graph-fill me-2"></i>Generate CA Audit Report (PDF/Image)
        </button>
      </div>
    </div>

    <!-- ===== COMPARISON SECTION ===== -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:18px;padding:22px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <div style="background:rgba(99,102,241,.2);padding:8px;border-radius:8px">
          <i class="bi bi-arrow-left-right" style="color:#818cf8;font-size:18px"></i>
        </div>
        <div>
          <h5 style="color:#fff;font-weight:800;margin:0">Period Comparison</h5>
          <p style="color:#475569;font-size:12px;margin:0">যেকোনো দুটো সময় তুলনা করুন</p>
        </div>
      </div>

      <!-- Period selectors -->
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin-bottom:14px">
        <div>
          <label style="color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;display:block;margin-bottom:6px">Period A</label>
          <select id="cmpA" class="cmp-period-sel" onchange="overviewModule.toggleCustom('A')">
            ${CMP_OPTS.map(([k,l])=>`<option value="${k}"${k==='thisMonth'?' selected':''}>${l}</option>`).join('')}
          </select>
          <div id="cmpA-custom" style="display:none;margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <input type="date" id="cmpA-from" class="form-control" style="background:#1e293b;color:#e2e8f0;border-color:#334155;font-size:12px">
            <input type="date" id="cmpA-to" class="form-control" style="background:#1e293b;color:#e2e8f0;border-color:#334155;font-size:12px">
          </div>
        </div>
        <div style="color:#475569;font-weight:800;font-size:18px;text-align:center;padding-top:16px">VS</div>
        <div>
          <label style="color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;display:block;margin-bottom:6px">Period B</label>
          <select id="cmpB" class="cmp-period-sel" onchange="overviewModule.toggleCustom('B')">
            ${CMP_OPTS.map(([k,l])=>`<option value="${k}"${k==='lastMonth'?' selected':''}>${l}</option>`).join('')}
          </select>
          <div id="cmpB-custom" style="display:none;margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <input type="date" id="cmpB-from" class="form-control" style="background:#1e293b;color:#e2e8f0;border-color:#334155;font-size:12px">
            <input type="date" id="cmpB-to" class="form-control" style="background:#1e293b;color:#e2e8f0;border-color:#334155;font-size:12px">
          </div>
        </div>
      </div>

      <button onclick="overviewModule.runComparison()" class="btn btn-primary" style="width:100%;font-size:13px;font-weight:700;padding:10px;justify-content:center;margin-bottom:16px">
        <i class="bi bi-lightning-charge-fill me-2"></i>Run Comparison
      </button>

      <!-- Comparison result -->
      <div id="cmp-result" style="display:none">
        <!-- Side by side KPI mini -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px" id="cmp-kpi-row"></div>
        <!-- Comparison table -->
        <div style="background:#0f172a;border-radius:12px;overflow:hidden">
          <div class="cmp-metric-row" style="background:#1e293b;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border:none">
            <span>Metric</span><span id="cmp-col-a" style="text-align:right">Period A</span>
            <span id="cmp-col-b" style="text-align:right">Period B</span>
            <span style="text-align:right">Δ Change</span><span style="text-align:right">%</span>
          </div>
          <div id="cmp-table-body"></div>
        </div>
      </div>
    </div>`;
  }

  function toggleMonthPicker(){
    const picker=document.getElementById('ov-month-picker');
    if(!picker)return;
    const isHidden=picker.style.display==='none'||!picker.style.display;
    picker.style.display=isHidden?'inline-block':'none';
    if(isHidden){if(pickedMonth)picker.value=pickedMonth;picker.focus();}
  }

  function setPickMonth(val){
    if(!val)return;
    pickedMonth=val;
    currentPeriod='pickMonth';
    document.querySelectorAll('[id^="ovbtn-"]').forEach(b=>b.classList.remove('active'));
    const btn=document.getElementById('ovbtn-pickMonth');
    if(btn){btn.classList.add('active');const[y,mo]=val.split('-');btn.innerHTML=`<i class="bi bi-calendar3"></i> ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1]} ${y}`;}
    const picker=document.getElementById('ov-month-picker');if(picker)picker.style.display='none';
    renderChart('pickMonth');
  }

  function printBreakdown(){
    const tableEl=document.getElementById('ov-monthly-table');
    const theadEl=document.querySelector('#ov-monthly-table')?.closest('table')?.querySelector('thead');
    const titleEl=document.getElementById('ov-breakdown-title');
    if(!tableEl||!theadEl)return;
    const title=(titleEl?.textContent||'Breakdown').trim();
    const tableHtml=`<table>${theadEl.outerHTML}<tbody>${tableEl.innerHTML}</tbody></table>`;
    const today=new Date().toLocaleDateString('en-BD',{day:'2-digit',month:'long',year:'numeric'});
    const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:0}
  .page{max-width:960px;margin:0 auto;padding:28px 36px}
  .hdr{border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
  h1{font-size:18px;font-weight:800;color:#1e3a5f}
  .sub{font-size:11px;color:#64748b;margin-top:3px}
  table{width:100%;border-collapse:collapse}
  th{background:#1e3a5f;color:#fff;padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  td{padding:8px 12px;border-bottom:1px solid #e9ecef;font-size:12px}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{margin-top:18px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between;border-top:1px solid #e9ecef;padding-top:10px}
  .no-print{background:#1e3a5f;color:#fff;padding:10px 36px;display:flex;gap:10px;align-items:center}
  .btn-p{background:#fff;color:#1e3a5f;border:none;padding:7px 18px;border-radius:6px;font-weight:800;cursor:pointer;font-size:12px}
  .btn-i{background:#22c55e;color:#fff;border:none;padding:7px 18px;border-radius:6px;font-weight:800;cursor:pointer;font-size:12px}
  @media print{.no-print{display:none}@page{margin:1cm;size:A4 landscape}}
</style>
</head><body>
<div class="no-print">
  <button class="btn-p" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button class="btn-i" onclick="dlImg()">📷 Download as Image</button>
  <span style="font-size:12px;opacity:.7;margin-left:8px">Print করতে PDF option বেছে নিন</span>
</div>
<div class="page" id="rpt">
  <div class="hdr">
    <div><h1>GentiX Fashion ERP</h1><div class="sub">${title}</div></div>
    <div style="text-align:right;font-size:11px;color:#64748b"><div><strong>Generated:</strong> ${today}</div><div><strong>System:</strong> GentiX ERP v2.0</div></div>
  </div>
  ${tableHtml}
  <div class="footer"><div>GentiX Fashion ERP — Management Report</div><div>${today}</div></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script>
async function dlImg(){
  const np=document.querySelectorAll('.no-print');
  np.forEach(e=>e.style.display='none');
  const c=await html2canvas(document.getElementById('rpt'),{scale:2,backgroundColor:'#fff',useCORS:true});
  np.forEach(e=>e.style.display='flex');
  const a=document.createElement('a');
  a.download='GentiX_${title.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().substring(0,10)}.png';
  a.href=c.toDataURL('image/png');a.click();
}
</script>
</body></html>`;
    const win=window.open('','_blank','width=1000,height=750,scrollbars=yes');
    win.document.write(html);win.document.close();
  }

  function toggleCustom(side){
    const sel=document.getElementById(`cmp${side}`);
    const box=document.getElementById(`cmp${side}-custom`);
    if(!box)return;
    box.style.display=sel.value==='custom'?'grid':'none';
  }

  function setPeriod(p){
    currentPeriod=p;
    document.querySelectorAll('[id^="ovbtn-"]').forEach(b=>b.classList.remove('active'));
    const btn=document.getElementById('ovbtn-'+p);if(btn)btn.classList.add('active');
    renderChart(p);
  }

  function renderChart(period){
    const{s:fromDs,e:toDs}=periodToRange(period);
    const costMap={};allProducts.forEach(p=>{if(p.name)costMap[p.name.trim().toLowerCase()]=p.buyPrice||0;});

    // Daily view for single-month/week periods; Monthly view for multi-month periods
    const DAILY_PERIODS=['today','yesterday','thisWeek','lastWeek','thisMonth','lastMonth','pickMonth'];
    const isDaily=DAILY_PERIODS.includes(period);
    const keyFn=ds=>isDaily?ds:ds.substring(0,7);

    const monthData={};
    const add=key=>{if(!monthData[key])monthData[key]={rev:0,cogs:0,opex:0,adCost:0,txns:0,cashIn:0};};

    // Pre-fill every day in range for daily view (shows 0 on days with no data)
    if(isDaily){
      const cur=new Date(fromDs+'T00:00:00'),end=new Date(toDs+'T00:00:00');
      while(cur<=end){add(localDate(cur));cur.setDate(cur.getDate()+1);}
    }

    allSales.filter(s=>{const ds=parseDs(s.date);return ds>=fromDs&&ds<=toDs&&s.status!=='Returned';}).forEach(s=>{
      const ds=parseDs(s.date);const key=keyFn(ds);if(!key)return;add(key);
      monthData[key].rev+=s.total||0;
      const bp=costMap[(s.product||'').trim().toLowerCase()]||s.buyPrice||0;
      monthData[key].cogs+=(s.qty||0)*bp;monthData[key].txns++;
    });

    allExpenses.filter(e=>{const ds=parseDs(e.date);return ds>=fromDs&&ds<=toDs&&(e.status==='Paid'||e.category==='Meta/Facebook Ads');}).forEach(e=>{
      const ds=parseDs(e.date);const key=keyFn(ds);if(!key)return;add(key);
      const isFB=(e.category||'').match(/facebook|meta/i);
      if(isFB) monthData[key].adCost+=e.amount||0;  // FB Ads → adCost only
      else     monthData[key].opex+=e.amount||0;     // Other expenses → opex only
    });

    allCash.filter(c=>{const ds=parseDs(c.date);return ds>=fromDs&&ds<=toDs&&(c.cashIn||0)>0&&c.type!=='Investment';}).forEach(c=>{
      const ds=parseDs(c.date);const key=keyFn(ds);if(!key)return;add(key);
      monthData[key].cashIn+=(c.cashIn||0);
    });

    const months=Object.keys(monthData).sort();

    // KPI totals
    let tR=0,tC=0,tE=0,tA=0,tT=0;
    months.forEach(m=>{tR+=monthData[m].rev;tC+=monthData[m].cogs;tE+=monthData[m].opex;tA+=monthData[m].adCost;tT+=monthData[m].txns;});
    const tN=tR-tC-tE-tA, mg=tR>0?(tN/tR*100).toFixed(1):0; // net = revenue - cogs - expenses - ad spend
    const inv=allCash.filter(e=>e.type==='Investment'||e.category==='Investment').reduce((s,e)=>s+(e.cashIn||e.amount||0),0)||window.appSettings?.totalInvestment||0;
    const roi=inv>0?(tN/inv*100).toFixed(1):0;
    const nc=tN>=0?'#22c55e':'#ef4444';

    document.getElementById('ov-total-sales').textContent=fmt(tR);
    document.getElementById('ov-sales-sub').textContent=tT+' transactions';
    document.getElementById('ov-total-cogs').textContent=fmt(tC);
    document.getElementById('ov-total-exp').textContent=fmt(tE);
    document.getElementById('ov-adcost-sub').textContent='Ad: '+fmt(tA);
    const npEl=document.getElementById('ov-net-profit');if(npEl){npEl.textContent=fmt(tN);npEl.style.color=nc;}
    const msEl=document.getElementById('ov-margin-sub');if(msEl){msEl.textContent=mg+'% margin';msEl.style.color=nc;}
    const roiEl=document.getElementById('ov-roi');if(roiEl){roiEl.textContent=roi+'%';roiEl.style.color=parseFloat(roi)>=0?'#22c55e':'#ef4444';}

    // Chart
    if(myChart){myChart.destroy();myChart=null;}
    const ctx=document.getElementById('ovChart')?.getContext('2d');
    if(!ctx||!months.length)return;

    // Label format: daily = "19 Jun", monthly = "Jun '26"
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels=months.map(m=>{
      if(isDaily){const[y,mo,dy]=m.split('-');return`${parseInt(dy)} ${MN[parseInt(mo)-1]}`;}
      const[y,mo]=m.split('-');return`${MN[parseInt(mo)-1]} '${y.substring(2)}`;
    });
    const revD=months.map(m=>monthData[m].rev);
    const costD=months.map(m=>monthData[m].cogs+monthData[m].opex+monthData[m].adCost);
    const netD=months.map(m=>monthData[m].rev-monthData[m].cogs-monthData[m].opex-monthData[m].adCost);
    let cumNet=0;
    const roiD=months.map(m=>{cumNet+=monthData[m].rev-monthData[m].cogs-monthData[m].opex-monthData[m].adCost;return inv>0?parseFloat((cumNet/inv*100).toFixed(1)):0;});

    myChart=new Chart(ctx,{
      data:{labels,datasets:[
        {type:'bar',label:'Revenue',data:revD,backgroundColor:'rgba(34,197,94,.5)',borderColor:'rgba(34,197,94,.8)',borderWidth:1,borderRadius:4,order:3,yAxisID:'y'},
        {type:'bar',label:'Total Cost',data:costD,backgroundColor:'rgba(239,68,68,.4)',borderColor:'rgba(239,68,68,.7)',borderWidth:1,borderRadius:4,order:4,yAxisID:'y'},
        {type:'line',label:'Net Profit',data:netD,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.08)',borderWidth:2.5,pointRadius:3,pointBackgroundColor:'#3b82f6',tension:.4,fill:true,order:1,yAxisID:'y'},
        {type:'line',label:'ROI %',data:roiD,borderColor:'#f59e0b',backgroundColor:'transparent',borderWidth:2,pointRadius:3,pointBackgroundColor:'#f59e0b',tension:.4,order:0,yAxisID:'y2',borderDash:[5,3]}
      ]},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{backgroundColor:'rgba(15,23,42,.95)',borderColor:'rgba(255,255,255,.1)',borderWidth:1,
            titleColor:'#e2e8f0',bodyColor:'#94a3b8',padding:12,
            callbacks:{
              title:i=>`📅 ${i[0].label}`,
              label:i=>{const v=i.parsed.y;if(i.dataset.yAxisID==='y2')return` ROI: ${v}%`;return` ${i.dataset.label}: ৳${Math.abs(v).toLocaleString('en-IN')}`;}
            }
          }
        },
        scales:{
          x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#64748b',font:{size:10,weight:'600'}}},
          y:{position:'left',grid:{color:'rgba(255,255,255,.07)'},ticks:{color:'#64748b',font:{size:10},
            callback:v=>{if(Math.abs(v)>=100000)return'৳'+(v/100000).toFixed(1)+'L';if(Math.abs(v)>=1000)return'৳'+(v/1000).toFixed(0)+'K';return'৳'+v;}}},
          y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:'#f59e0b',font:{size:10,weight:'700'},callback:v=>v+'%'}}
        }
      }
    });

    // Table header label update
    const titleEl=document.getElementById('ov-breakdown-title');
    if(titleEl){
      let titleTxt=isDaily?'Daily Breakdown':'Monthly Breakdown';
      if(period==='pickMonth'&&pickedMonth){const[y,mo]=pickedMonth.split('-');titleTxt=`Daily Breakdown — ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1]} ${y}`;}
      titleEl.innerHTML=`<i class="bi bi-table me-2" style="color:#3949ab"></i>${titleTxt}`;
    }
    const thPeriod=document.querySelector('#ov-monthly-table')?.closest('table')?.querySelector('th');
    if(thPeriod) thPeriod.textContent=isDaily?'Date':'Month';

    // Breakdown table rows
    const tb=document.getElementById('ov-monthly-table');
    if(tb){
      const rowKeys=[...months].reverse(); // newest first — both daily and monthly descending
      tb.innerHTML=rowKeys.filter(m=>{ // hide zero-rows for daily if nothing happened
        const d=monthData[m];return !isDaily||(d.rev>0||d.cogs>0||d.opex>0||d.adCost>0||d.txns>0);
      }).map(m=>{
        const d=monthData[m];const net=d.rev-d.cogs-d.opex-d.adCost; // net = rev - cogs - other_exp - fb_ads
        const mg=d.rev>0?(net/d.rev*100).toFixed(1):'0.0';const nc2=net>=0?'#27ae60':'#e74c3c';
        let label;
        if(isDaily){const[y,mo,dy]=m.split('-');label=`${parseInt(dy)} ${MN[parseInt(mo)-1]} ${y}`;}
        else{const[y,mo]=m.split('-');label=`${MN[parseInt(mo)-1]} ${y}`;}
        const rowBg=d.rev===0?'background:#fafafa':'';
        return`<tr style="${rowBg}">
          <td style="font-weight:700;padding-left:14px">${label}${d.txns>0?`<small style="color:#9ca3af;font-size:10px;margin-left:6px">${d.txns} txns</small>`:''}</td>
          <td style="text-align:right;font-weight:700;color:#27ae60">${d.rev>0?fmt(d.rev):'—'}</td>
          <td style="text-align:right;color:#6b7280">${d.cogs>0?fmt(d.cogs):'—'}</td>
          <td style="text-align:right;font-weight:700;color:#3949ab">${d.cashIn>0?fmt(d.cashIn):'—'}</td>
          <td style="text-align:right;color:#e67e22">${d.opex>0?fmt(d.opex):'—'}</td>
          <td style="text-align:right;color:#e74c3c">${d.adCost>0?fmt(d.adCost):'—'}</td>
          <td style="text-align:right;font-weight:800;color:${nc2}">${(d.rev>0||d.opex>0||d.adCost>0)?fmt(net):'—'}</td>
          <td style="text-align:right;padding-right:14px">${d.rev>0?`<span style="background:${nc2}18;color:${nc2};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${mg}%</span>`:'—'}</td>
        </tr>`;
      }).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:#9ca3af">No data for selected period</td></tr>';
    }
  }

  function runComparison(){
    const pA=document.getElementById('cmpA')?.value,pB=document.getElementById('cmpB')?.value;
    const cfA=document.getElementById('cmpA-from')?.value,ctA=document.getElementById('cmpA-to')?.value;
    const cfB=document.getElementById('cmpB-from')?.value,ctB=document.getElementById('cmpB-to')?.value;
    const rA=periodToRange(pA,cfA,ctA),rB=periodToRange(pB,cfB,ctB);
    const mA=calcMetrics(rA.s,rA.e),mB=calcMetrics(rB.s,rB.e);
    const lA=periodLabel(pA),lB=periodLabel(pB);

    // Side-by-side KPI
    const kpiRow=document.getElementById('cmp-kpi-row');
    if(kpiRow){
      const mkKpi=(label,metrics,color)=>`
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px">
          <div style="color:${color};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">${label}</div>
          ${[['Revenue',fmt(metrics.rev),'#22c55e'],['COGS',fmt(metrics.cogs),'#94a3b8'],['Expenses',fmt(metrics.opex),'#f87171'],['Ad Spend',fmt(metrics.adCost),'#fb923c'],['Net Profit',fmt(metrics.net),metrics.net>=0?'#22c55e':'#ef4444'],['Net Margin',metrics.netMargin.toFixed(1)+'%',metrics.netMargin>=0?'#22c55e':'#ef4444'],['Txns',metrics.txns,'#94a3b8']].map(([k,v,c])=>`
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px">
            <span style="color:#64748b;font-weight:600">${k}</span>
            <span style="color:${c};font-weight:800">${v}</span>
          </div>`).join('')}
        </div>`;
      kpiRow.innerHTML=mkKpi(lA,mA,'#3b82f6')+mkKpi(lB,mB,'#8b5cf6');
    }

    // Comparison table
    document.getElementById('cmp-col-a').textContent=lA;
    document.getElementById('cmp-col-b').textContent=lB;

    const rows=[
      {label:'Revenue',      a:mA.rev,      b:mB.rev,      higherGood:true,  isMoney:true},
      {label:'COGS',         a:mA.cogs,     b:mB.cogs,     higherGood:false, isMoney:true},
      {label:'Expenses',     a:mA.opex,     b:mB.opex,     higherGood:false, isMoney:true},
      {label:'FB Ad Spend',  a:mA.adCost,   b:mB.adCost,   higherGood:false, isMoney:true},
      {label:'Gross Profit', a:mA.gross,    b:mB.gross,    higherGood:true,  isMoney:true},
      {label:'Net Profit',   a:mA.net,      b:mB.net,      higherGood:true,  isMoney:true},
      {label:'Gross Margin', a:mA.grossMargin,b:mB.grossMargin,higherGood:true,isMoney:false,unit:'%'},
      {label:'Net Margin',   a:mA.netMargin,b:mB.netMargin,higherGood:true,  isMoney:false,unit:'%'},
      {label:'Transactions', a:mA.txns,     b:mB.txns,     higherGood:true,  isMoney:false,unit:' txns'}
    ];

    const tb=document.getElementById('cmp-table-body');
    if(tb){
      // Verdict header
      const profitDelta=mA.net-mB.net;
      const verdictColor=profitDelta>=0?'#22c55e':'#ef4444';
      const verdictIcon=profitDelta>=0?'▲ লাভ বেশি':'▼ ক্ষতি বেশি';
      const verdictText=profitDelta>=0
        ?`${lA} তে ${fmt(Math.abs(profitDelta))} বেশি লাভ হয়েছে`
        :`${lA} তে ${fmt(Math.abs(profitDelta))} কম লাভ হয়েছে`;
      const verdictHtml=`<div style="background:${verdictColor}15;border:1px solid ${verdictColor}40;border-radius:10px;padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">${profitDelta>=0?'📈':'📉'}</span>
        <div>
          <div style="color:${verdictColor};font-weight:800;font-size:13px">${verdictIcon}</div>
          <div style="color:#94a3b8;font-size:12px">${verdictText} (${mB.net!==0?((profitDelta/Math.abs(mB.net))*100).toFixed(1):0}% পরিবর্তন)</div>
        </div>
      </div>`;

      tb.innerHTML=verdictHtml+rows.map(r=>{
        const delta=r.a-r.b;
        const pct=r.b!==0?(delta/Math.abs(r.b)*100).toFixed(1):null;
        const better=r.higherGood?(delta>0):(delta<0);
        const dc=delta===0?'delta-neu':better?'delta-pos':'delta-neg';
        const arrow=delta===0?'→':delta>0?'▲':'▼';
        const fmtVal=v=>r.isMoney?fmt(v):v.toFixed(r.unit==='%'?1:0)+(r.unit||'');
        const sign=delta>=0?'+':'';
        // Highlight Net Profit row specially
        const isProfit=r.label==='Net Profit';
        return`<div class="cmp-metric-row" style="${isProfit?'border-left:3px solid '+verdictColor+';background:rgba(255,255,255,.04)':''}">
          <span style="color:${isProfit?'#fff':'#e2e8f0'};font-weight:${isProfit?'800':'700'}">${isProfit?'💰 ':''} ${r.label}</span>
          <span style="text-align:right;color:#3b82f6;font-weight:700">${fmtVal(r.a)}</span>
          <span style="text-align:right;color:#8b5cf6;font-weight:700">${fmtVal(r.b)}</span>
          <span style="text-align:right" class="${dc}">${sign}${r.isMoney?fmt(Math.abs(delta)):Math.abs(delta).toFixed(r.unit==='%'?1:0)+(r.unit||'')} ${arrow}</span>
          <span style="text-align:right" class="${dc}">${pct!==null?sign+pct+'%':'—'}</span>
        </div>`;
      }).join('');
    }

    document.getElementById('cmp-result').style.display='block';
    document.getElementById('cmp-result').scrollIntoView({behavior:'smooth',block:'start'});
  }

  // ===== CA AUDIT REPORT =====
  function setAuditPreset(type){
    const now=new Date();let s,e=localDate(now);
    if(type==='thisMonth'){s=localDate(new Date(now.getFullYear(),now.getMonth(),1));}
    else if(type==='lastMonth'){s=localDate(new Date(now.getFullYear(),now.getMonth()-1,1));e=localDate(new Date(now.getFullYear(),now.getMonth(),0));}
    else if(type==='thisYear'){s=`${now.getFullYear()}-01-01`;}
    else if(type==='lastYear'){s=`${now.getFullYear()-1}-01-01`;e=`${now.getFullYear()-1}-12-31`;}
    else{s='2020-01-01';}
    const fEl=document.getElementById('auditFrom'),tEl=document.getElementById('auditTo');
    if(fEl)fEl.value=s;if(tEl)tEl.value=e;
  }

  async function generateAuditReport(){
    const btn=document.querySelector('[onclick*="generateAuditReport"]');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Generating…';}
    try{
      // Date range from inputs (fallback: this month)
      const now=new Date();
      const fdsEl=document.getElementById('auditFrom');
      const tdsEl=document.getElementById('auditTo');
      const fromDs=fdsEl?.value||localDate(new Date(now.getFullYear(),now.getMonth(),1));
      const toDs=tdsEl?.value||localDate(now);

      // Period label for report
      const isLifetime=fromDs<='2020-01-02';
      const fmtD=ds=>{ const[y,m,d]=ds.split('-'); const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return`${parseInt(d)} ${mn[parseInt(m)-1]} ${y}`; };
      const periodStr=isLifetime?`Lifetime (Up to ${fmtD(toDs)})`:`${fmtD(fromDs)} — ${fmtD(toDs)}`;

      // Fetch settings
      const cfgSnap=await window.db.collection('settings').doc('config').get();
      const cfg=cfgSnap.exists?cfgSnap.data():{};
      const loanBase=cfg.loanBase||602500;

      // ── P&L: filtered by selected period ──
      const costMap={};allProducts.forEach(p=>{if(p.name)costMap[p.name.trim().toLowerCase()]=p.buyPrice||0;});
      const activeSales=allSales.filter(s=>{ const ds=parseDs(s.date); return ds>=fromDs&&ds<=toDs&&s.status!=='Returned'; });
      const totalRev=activeSales.reduce((s,d)=>s+(d.total||0),0);
      const totalCOGS=activeSales.reduce((s,d)=>{ const bp=costMap[(d.product||'').trim().toLowerCase()]||d.buyPrice||0; return s+(d.qty||0)*bp; },0);
      const paidExp=allExpenses.filter(e=>{ const ds=parseDs(e.date); return ds>=fromDs&&ds<=toDs&&(e.status==='Paid'||e.category==='Meta/Facebook Ads'); });
      const totalExp=paidExp.reduce((s,d)=>s+(d.amount||0),0);
      const adCost=paidExp.filter(e=>(e.category||'').match(/facebook|meta/i)).reduce((s,d)=>s+(d.amount||0),0);
      const otherExp=totalExp-adCost;
      const grossProfit=totalRev-totalCOGS;
      const netProfit=totalRev-totalCOGS-totalExp;
      const grossMargin=totalRev>0?(grossProfit/totalRev*100).toFixed(1):0;
      const netMargin=totalRev>0?(netProfit/totalRev*100).toFixed(1):0;

      // ── Balance Sheet: always current state (as of today) ──
      const cashInSum=allCash.filter(e=>(e.cashIn||0)>0).reduce((s,e)=>s+(e.cashIn||0),0);
      const cashOutSum=allCash.filter(e=>(e.cashOut||0)>0).reduce((s,e)=>s+(e.cashOut||0),0);
      const cashInHand=(window.appSettings?.openingCash||0)+cashInSum-cashOutSum;
      const stockVal=allProducts.reduce((s,p)=>s+(p.currentStock||0)*(p.buyPrice||0),0);
      const custDue=(await window.db.collection('customers').get()).docs.reduce((s,d)=>s+(d.data().totalCod||0),0);
      const suppDue=(await window.db.collection('suppliers').get()).docs.reduce((s,d)=>s+(d.data().currentDue||0),0);
      const totalAssets=cashInHand+stockVal+custDue;
      const netCapital=totalAssets-suppDue;

      // ── Capital & Loan: lifetime ──
      const totalInv=allCash.filter(e=>e.type==='Investment'||e.category==='Investment').reduce((s,e)=>s+(e.cashIn||e.amount||0),0)||window.appSettings?.totalInvestment||loanBase;
      const capitalGrowth=netCapital-totalInv;
      const roi=totalInv>0?(capitalGrowth/totalInv*100).toFixed(1):0;
      const loanRecovered=allExpenses.filter(e=>e.category==='Loan Adjustment'&&(e.status==='Paid'||!e.status)).reduce((s,d)=>s+(d.amount||0),0);
      const loanPct=loanBase>0?(loanRecovered/loanBase*100).toFixed(1):0;
      const loanRemaining=Math.max(0,loanBase-loanRecovered);

      // ── Self-funding (based on selected period) ──
      const fromDate=new Date(fromDs+'T00:00:00'),toDate=new Date(toDs+'T00:00:00');
      const daysDiff=Math.max(1,Math.ceil((toDate-fromDate)/86400000)+1);
      const monthsDiff=Math.max(1,daysDiff/30.5);
      const avgMonthlyRev=totalRev/monthsDiff;
      const avgMonthlyExp=(totalCOGS+totalExp)/monthsDiff;
      const avgMonthlyProfit=netProfit/monthsDiff;
      const cashRunway=avgMonthlyExp>0?(cashInHand/avgMonthlyExp).toFixed(1):0;
      const selfFundable=avgMonthlyProfit>0;

      // ── Product performance (selected period) ──
      const perfMap={};activeSales.forEach(s=>{const p=s.product||'Unknown';if(!perfMap[p])perfMap[p]={rev:0,qty:0};perfMap[p].rev+=s.total||0;perfMap[p].qty+=s.qty||0;});
      const topProds=Object.entries(perfMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);

      const today=new Date().toLocaleDateString('en-BD',{day:'2-digit',month:'long',year:'numeric'});

      // Build report HTML
      const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>GentiX Business Report</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:0}
  .tk{font-family:'Noto Sans Bengali','Inter',Arial,sans-serif}
  .page{max-width:920px;margin:0 auto;padding:32px 40px}
  h1{font-size:22px;font-weight:800;color:#1e3a5f;letter-spacing:-0.5px}
  h2{font-size:13px;font-weight:600;color:#475569;margin-top:2px}
  .hdr{border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
  .hdr-right{text-align:right;font-size:11px;color:#64748b;line-height:1.9}
  .period-badge{display:inline-block;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;margin-top:5px}
  .section{margin-bottom:22px}
  .section-title{background:#1e3a5f;color:#fff;padding:7px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-radius:4px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse}
  td,th{padding:7px 12px;border:1px solid #e2e8f0;font-size:12px}
  th{background:#f1f5f9;font-weight:700;color:#374151}
  .total-row td{background:#eff6ff;font-weight:800;font-size:13px}
  .profit-row td{background:#f0fdf4;color:#166534;font-weight:800;font-size:13px}
  .loss-row td{background:#fef2f2;color:#991b1b;font-weight:800;font-size:13px}
  .right{text-align:right}.center{text-align:center}
  .indent{padding-left:28px!important;color:#475569}
  .progress-bar{height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin:4px 0}
  .progress-fill{height:100%;border-radius:6px}
  .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:16px}
  .kpi-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;border-left:4px solid}
  .kpi-label{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .kpi-val{font-size:19px;font-weight:800;margin-top:3px;font-family:'Noto Sans Bengali','Inter',Arial,sans-serif}
  .cash-highlight{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #4ade80;border-radius:10px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:16px}
  .green{color:#166534}.red{color:#991b1b}.blue{color:#1e40af}
  .footer{border-top:2px solid #e2e8f0;padding-top:14px;margin-top:20px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between;align-items:center}
  .stamp{border:2px solid #1e3a5f;border-radius:50%;width:72px;height:72px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#1e3a5f;text-align:center;line-height:1.3}
  .no-print{background:#1e3a5f;color:#fff;padding:12px 40px;display:flex;gap:10px;align-items:center}
  .btn-w{background:#fff;color:#1e3a5f;border:none;padding:8px 20px;border-radius:6px;font-weight:800;cursor:pointer;font-size:12px}
  .btn-g{background:#22c55e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:800;cursor:pointer;font-size:12px}
  @media print{.no-print{display:none}@page{margin:1cm;size:A4}}
</style>
</head><body>
<div class="no-print">
  <button class="btn-w" onclick="window.print()">🖨️ Save as PDF (Print)</button>
  <button class="btn-g" onclick="dlImg()">📷 Download as Image</button>
  <span style="font-size:11px;opacity:.6;margin-left:8px">Print dialog খুলে "Save as PDF" বেছে নিন</span>
</div>
<div class="page" id="report-body">

  <!-- Header -->
  <div class="hdr">
    <div>
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Prepared by</div>
      <h1>GentiX Fashion ERP</h1>
      <h2>Business Performance & Financial Report</h2>
      <div class="period-badge">📅 ${periodStr}</div>
    </div>
    <div class="hdr-right">
      <div><strong>Report Date:</strong> ${today}</div>
      <div><strong>Report Type:</strong> Management Accounts</div>
      <div><strong>Business:</strong> Dr. Suman — Polo Shirt</div>
      <div><strong>System:</strong> GentiX ERP v2.0</div>
    </div>
  </div>

  <!-- Cash in Hand highlight -->
  <div class="cash-highlight">
    <div style="background:#4ade80;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">💵</div>
    <div style="flex:1">
      <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.8px;margin-bottom:2px">Cash in Hand (Current Balance)</div>
      <div style="font-size:26px;font-weight:800;color:#166534;font-family:'Noto Sans Bengali','Inter',Arial,sans-serif">${fmt(cashInHand)}</div>
      <div style="font-size:11px;color:#4ade80aa;margin-top:2px">Opening: ${fmt(window.appSettings?.openingCash||0)} &nbsp;|&nbsp; Total In: ${fmt(cashInSum)} &nbsp;|&nbsp; Total Out: ${fmt(cashOutSum)}</div>
    </div>
  </div>

  <!-- Quick KPIs -->
  <div class="section">
    <div class="kpi-grid">
      ${[[fmt(totalRev),'Total Revenue','#166534','#f0fdf4'],[fmt(totalCOGS),'Total COGS','#1e40af','#eff6ff'],[fmt(totalExp),'Total Expenses','#b45309','#fffbeb'],[netProfit>=0?fmt(netProfit):'('+fmt(Math.abs(netProfit))+')','Net Profit',netProfit>=0?'#166534':'#991b1b',netProfit>=0?'#f0fdf4':'#fef2f2'],[roi+'%','Lifetime ROI',parseFloat(roi)>=0?'#166534':'#991b1b','#eff6ff'],[fmt(netCapital),'Net Capital','#1e3a5f','#f8fafc']].map(([v,l,c,bg])=>`
      <div class="kpi-card" style="border-left-color:${c};background:${bg}"><div class="kpi-label">${l}</div><div class="kpi-val" style="color:${c}">${v}</div></div>`).join('')}
    </div>
  </div>

  <!-- 1. Income Statement -->
  <div class="section">
    <div class="section-title">1. Income Statement (P&L) — ${periodStr}</div>
    <table>
      <tr><th>Particulars</th><th class="right"><span class="tk">Amount (৳)</span></th><th class="right">% of Revenue</th></tr>
      <tr><td><strong>Gross Revenue (Sales)</strong></td><td class="right tk"><strong>${fmt(totalRev)}</strong></td><td class="right">100%</td></tr>
      <tr><td class="indent">Less: Cost of Goods Sold (COGS)</td><td class="right tk">(${fmt(totalCOGS)})</td><td class="right">${totalRev>0?(totalCOGS/totalRev*100).toFixed(1):0}%</td></tr>
      <tr class="total-row"><td><strong>Gross Profit</strong></td><td class="right tk green"><strong>${fmt(grossProfit)}</strong></td><td class="right green"><strong>${grossMargin}%</strong></td></tr>
      <tr><td class="indent">Less: FB / Meta Ad Spend</td><td class="right tk">(${fmt(adCost)})</td><td class="right">${totalRev>0?(adCost/totalRev*100).toFixed(1):0}%</td></tr>
      <tr><td class="indent">Less: Other Operating Expenses</td><td class="right tk">(${fmt(otherExp)})</td><td class="right">${totalRev>0?(otherExp/totalRev*100).toFixed(1):0}%</td></tr>
      <tr class="${netProfit>=0?'profit-row':'loss-row'}"><td><strong>NET PROFIT ${netProfit<0?'(LOSS)':''}</strong></td><td class="right tk"><strong>${netProfit>=0?fmt(netProfit):'('+fmt(Math.abs(netProfit))+')'}</strong></td><td class="right"><strong>${netMargin}%</strong></td></tr>
    </table>
  </div>

  <!-- 2. Balance Sheet -->
  <div class="section">
    <div class="section-title">2. Balance Sheet — Current Position (As of ${today})</div>
    <table>
      <tr><th colspan="2">ASSETS</th><th class="right"><span class="tk">Amount (৳)</span></th></tr>
      <tr style="background:#f0fdf4"><td colspan="2"><strong>💵 Cash in Hand</strong></td><td class="right tk green"><strong>${fmt(cashInHand)}</strong></td></tr>
      <tr><td colspan="2" class="indent">Stock / Inventory Value</td><td class="right tk">${fmt(stockVal)}</td></tr>
      <tr><td colspan="2" class="indent">Customer Receivables (COD Due)</td><td class="right tk">${fmt(custDue)}</td></tr>
      <tr class="total-row"><td colspan="2"><strong>TOTAL ASSETS</strong></td><td class="right tk blue"><strong>${fmt(totalAssets)}</strong></td></tr>
      <tr><th colspan="2">LIABILITIES</th><th></th></tr>
      <tr><td colspan="2" class="indent">Supplier Payables (Due)</td><td class="right tk">${fmt(suppDue)}</td></tr>
      <tr class="total-row"><td colspan="2"><strong>TOTAL LIABILITIES</strong></td><td class="right tk red"><strong>${fmt(suppDue)}</strong></td></tr>
      <tr class="${netCapital>=0?'profit-row':'loss-row'}"><td colspan="2"><strong>NET CAPITAL (EQUITY)</strong></td><td class="right tk"><strong>${fmt(netCapital)}</strong></td></tr>
    </table>
  </div>

  <!-- 3. Capital Growth -->
  <div class="section">
    <div class="section-title">3. Capital Growth Analysis — Lifetime</div>
    <table>
      <tr><th>Particulars</th><th class="right"><span class="tk">Amount (৳)</span></th><th class="right">Notes</th></tr>
      <tr><td>Total Investment Made</td><td class="right tk">${fmt(totalInv)}</td><td>Personal + Loan capital</td></tr>
      <tr><td>Current Net Capital</td><td class="right tk">${fmt(netCapital)}</td><td>Assets − Liabilities</td></tr>
      <tr class="${capitalGrowth>=0?'profit-row':'loss-row'}"><td><strong>Capital Growth / (Erosion)</strong></td><td class="right tk"><strong>${capitalGrowth>=0?'+':'-'}${fmt(Math.abs(capitalGrowth))}</strong></td><td><strong>ROI: ${roi}%</strong></td></tr>
    </table>
    <div style="margin-top:10px;padding:10px;background:#f0f9ff;border-radius:6px;font-size:12px">
      <strong>Verdict:</strong> ${capitalGrowth>=0?`Business capital grew by ${fmt(capitalGrowth)} (${roi}% ROI). Investment is generating positive returns.`:`Business capital reduced by ${fmt(Math.abs(capitalGrowth))}. Needs attention to recover original investment.`}
    </div>
  </div>

  <!-- 4. Loan Recovery -->
  <div class="section">
    <div class="section-title">4. Loan Recovery Progress — Lifetime</div>
    <table>
      <tr><td><strong>Original Loan / Base Investment</strong></td><td class="right tk">${fmt(loanBase)}</td></tr>
      <tr><td>Amount Recovered (via Loan Adjustment expenses)</td><td class="right tk green">${fmt(loanRecovered)}</td></tr>
      <tr><td>Remaining to Recover</td><td class="right tk ${loanRemaining>0?'red':'green'}">${fmt(loanRemaining)}</td></tr>
    </table>
    <div style="margin-top:8px">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:3px">
        <span>Recovery Progress</span><span>${loanPct}% Complete</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100,parseFloat(loanPct))}%;background:${parseFloat(loanPct)>=100?'#22c55e':'#3b82f6'}"></div></div>
    </div>
  </div>

  <!-- 5. Self-Funding Capability -->
  <div class="section">
    <div class="section-title">5. Business Self-Funding Capability — ${periodStr}</div>
    <table>
      <tr><th>Metric</th><th class="right">Value</th><th>Interpretation</th></tr>
      <tr><td>Avg Monthly Revenue</td><td class="right tk">${fmt(Math.round(avgMonthlyRev))}</td><td>Based on ${monthsDiff.toFixed(1)} months in selected period</td></tr>
      <tr><td>Avg Monthly Total Cost</td><td class="right tk">${fmt(Math.round(avgMonthlyExp))}</td><td>COGS + Operating Expenses</td></tr>
      <tr><td>Avg Monthly Net Profit</td><td class="right tk ${avgMonthlyProfit>=0?'green':'red'}">${avgMonthlyProfit>=0?'+':''}${fmt(Math.round(avgMonthlyProfit))}</td><td>${avgMonthlyProfit>=0?'Generating surplus each month':'Monthly deficit — needs attention'}</td></tr>
      <tr><td>Cash Runway</td><td class="right blue">${cashRunway} months</td><td>Current cash can sustain ${cashRunway} months of expenses</td></tr>
      <tr class="${selfFundable?'profit-row':'loss-row'}"><td><strong>Self-Funding Status</strong></td><td class="right"><strong>${selfFundable?'✓ CAPABLE':'✗ NOT YET'}</strong></td><td><strong>${selfFundable?'Business runs on its own profits':'Requires external capital support'}</strong></td></tr>
    </table>
  </div>

  <!-- 6. Top Products -->
  <div class="section">
    <div class="section-title">6. Product Performance — ${periodStr}</div>
    <table>
      <tr><th>Product</th><th class="right">Units Sold</th><th class="right"><span class="tk">Revenue (৳)</span></th><th class="right">Share</th></tr>
      ${topProds.length?topProds.map(([name,d])=>`<tr><td>${name}</td><td class="right">${d.qty.toLocaleString()}</td><td class="right tk">${fmt(d.rev)}</td><td class="right">${totalRev>0?(d.rev/totalRev*100).toFixed(1):0}%</td></tr>`).join(''):'<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:14px">No sales data for selected period</td></tr>'}
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <div>Generated by <strong>GentiX Fashion ERP</strong> | ${today}</div>
      <div>This is a system-generated management report. For official use, please verify with CA.</div>
    </div>
    <div class="stamp">GentiX<br>ERP<br>Report</div>
  </div>

</div>
<script>
async function downloadImage(){
  const el=document.getElementById('report-body');
  const noprint=document.querySelectorAll('.no-print');
  noprint.forEach(e=>e.style.display='none');
  const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true});
  noprint.forEach(e=>e.style.display='');
  const link=document.createElement('a');
  link.download='GentiX_Business_Report_${new Date().toISOString().substring(0,10)}.png';
  link.href=canvas.toDataURL('image/png');link.click();
}
</script>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
</body></html>`;

      const win=window.open('','_blank','width=960,height=800,scrollbars=yes');
      win.document.write(html);win.document.close();
    }catch(e){toast('Report error: '+e.message,'error');}
    finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="bi bi-file-earmark-bar-graph-fill me-2"></i>Generate CA Audit Report (PDF/Image)';}}
  }

  function renderInvestmentProgress() {
    const el = document.getElementById('ov-invest-section');
    if (!el) return;

    // Total investment base from settings (default 6,02,500)
    const baseInvest = window.appSettings?.totalInvestment || 602500;

    // Loan Adjustment expenses = investment recovery amount
    const recovered = allExpenses
      .filter(e => e.category === 'Loan Adjustment' && (e.status === 'Paid' || !e.status))
      .reduce((s, e) => s + (e.amount || 0), 0);

    const remaining = Math.max(0, baseInvest - recovered);
    const pct = baseInvest > 0 ? Math.min(100, (recovered / baseInvest) * 100) : 0;
    const pctRound = pct.toFixed(1);
    const isComplete = pct >= 100;

    // Color based on progress
    const barColor = pct < 30 ? '#ef4444' : pct < 60 ? '#f59e0b' : pct < 90 ? '#3b82f6' : '#22c55e';
    const statusText = isComplete
      ? '🎉 Investment সম্পূর্ণ উদ্ধার হয়েছে!'
      : pct >= 75 ? '🔥 প্রায় শেষ! আর একটু বাকি।'
      : pct >= 50 ? '✅ অর্ধেকের বেশি উদ্ধার হয়েছে।'
      : pct >= 25 ? '📈 ভালো অগ্রগতি হচ্ছে।'
      : '⏳ Investment উদ্ধার শুরু হয়েছে।';

    el.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px;padding:22px;position:relative;overflow:hidden">
      <!-- Background decoration -->
      <div style="position:absolute;top:-30px;right:-30px;width:150px;height:150px;background:${barColor}10;border-radius:50%"></div>
      <div style="position:absolute;bottom:-20px;left:-20px;width:100px;height:100px;background:${barColor}08;border-radius:50%"></div>

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <div style="background:${barColor}25;padding:8px;border-radius:8px">
              <i class="bi bi-graph-up-arrow" style="color:${barColor};font-size:18px"></i>
            </div>
            <h5 style="color:#fff;font-weight:800;margin:0">Investment Recovery Tracker</h5>
          </div>
          <p style="color:#475569;font-size:12px;margin:0">Loan Adjustment expenses → total investment recovery progress</p>
        </div>
        <div style="background:${barColor}20;border:1px solid ${barColor}40;border-radius:10px;padding:8px 16px;text-align:center">
          <div style="color:${barColor};font-size:26px;font-weight:800">${pctRound}%</div>
          <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase">Recovered</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <small style="color:#94a3b8;font-weight:600;font-size:11px">৳0</small>
          <small style="color:#94a3b8;font-weight:600;font-size:11px">Total Investment: ${fmt(baseInvest)}</small>
        </div>
        <div style="height:14px;background:rgba(255,255,255,.06);border-radius:50px;overflow:hidden;position:relative">
          <div id="invest-bar" style="height:100%;width:0%;background:linear-gradient(90deg,${barColor}99,${barColor});border-radius:50px;transition:width 1.5s cubic-bezier(.25,.8,.25,1);position:relative">
            ${pct > 10 ? `<div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:9px;font-weight:800;color:#fff">${pctRound}%</div>` : ''}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <small style="color:${barColor};font-size:10px;font-weight:700">Recovered: ${fmt(recovered)}</small>
          <small style="color:#ef4444;font-size:10px;font-weight:700">Remaining: ${fmt(remaining)}</small>
        </div>
      </div>

      <!-- 3 KPI cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;text-align:center">
          <div style="color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Total Investment</div>
          <div style="color:#fff;font-size:16px;font-weight:800">${fmt(baseInvest)}</div>
          <div style="color:#475569;font-size:10px">মোট বিনিয়োগ</div>
        </div>
        <div style="background:${barColor}12;border:1px solid ${barColor}30;border-radius:10px;padding:12px;text-align:center">
          <div style="color:${barColor};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Recovered</div>
          <div style="color:${barColor};font-size:16px;font-weight:800">${fmt(recovered)}</div>
          <div style="color:#475569;font-size:10px">উদ্ধার হয়েছে</div>
        </div>
        <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:12px;text-align:center">
          <div style="color:#ef4444;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Remaining</div>
          <div style="color:#ef4444;font-size:16px;font-weight:800">${fmt(remaining)}</div>
          <div style="color:#475569;font-size:10px">এখনও বাকি</div>
        </div>
      </div>

      <!-- Status message -->
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 14px;font-size:12.5px;color:#94a3b8">
        ${statusText}
        ${!isComplete ? `<span style="color:#64748b"> — আরও ${fmt(remaining)} recover করতে হবে।</span>` : ''}
      </div>
    </div>`;

    // Animate progress bar after render
    setTimeout(() => {
      const bar = document.getElementById('invest-bar');
      if (bar) bar.style.width = pct + '%';
    }, 100);
  }

  return{load,setPeriod,runComparison,toggleCustom,generateAuditReport,toggleMonthPicker,setPickMonth,printBreakdown,setAuditPreset};
})();
