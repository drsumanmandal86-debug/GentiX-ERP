/* ===================== BUSINESS OVERVIEW MODULE ===================== */
const overviewModule = (() => {
  let myChart = null;
  let allSales=[], allExpenses=[], allProducts=[], allCash=[];
  let currentPeriod = 'thisMonth';

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
    const opex=exps.reduce((s,d)=>s+(d.amount||0),0);
    const adCost=exps.filter(e=>(e.category||'').match(/facebook|meta/i)).reduce((s,d)=>s+(d.amount||0),0);
    const net=rev-cogs-opex;
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
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${PERIODS.map(([k,l])=>`<button class="ov-pb${k===currentPeriod?' active':''}" id="ovbtn-${k}" onclick="overviewModule.setPeriod('${k}')">${l}</button>`).join('')}
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
        ${[['#22c55e','Monthly Revenue'],['#ef4444','Total Cost'],['#3b82f6','Net Profit'],['#f59e0b','ROI % →']].map(([c,l])=>`
        <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;font-weight:600">
          <div style="width:24px;height:3px;background:${c};border-radius:2px"></div>${l}
        </div>`).join('')}
      </div>
    </div>

    <!-- Monthly breakdown -->
    <div class="table-card mb-3" style="overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px">
        <i class="bi bi-table me-2" style="color:#3949ab"></i>Monthly Breakdown
      </div>
      <div style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Month</th><th style="text-align:right">Revenue</th><th style="text-align:right">COGS</th>
          <th style="text-align:right">Expenses</th><th style="text-align:right">Ad Spend</th>
          <th style="text-align:right">Net Profit</th><th style="text-align:right">Margin</th>
        </tr></thead><tbody id="ov-monthly-table"></tbody></table>
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

    const monthData={};
    const add=key=>{if(!monthData[key])monthData[key]={rev:0,cogs:0,opex:0,adCost:0,txns:0};};

    allSales.filter(s=>{const ds=parseDs(s.date);return ds>=fromDs&&ds<=toDs&&s.status!=='Returned';}).forEach(s=>{
      const key=(parseDs(s.date)||'').substring(0,7);if(!key)return;add(key);
      monthData[key].rev+=s.total||0;
      const bp=costMap[(s.product||'').trim().toLowerCase()]||s.buyPrice||0;
      monthData[key].cogs+=(s.qty||0)*bp;monthData[key].txns++;
    });

    allExpenses.filter(e=>{const ds=parseDs(e.date);return ds>=fromDs&&ds<=toDs&&(e.status==='Paid'||e.category==='Meta/Facebook Ads');}).forEach(e=>{
      const key=(parseDs(e.date)||'').substring(0,7);if(!key)return;add(key);
      monthData[key].opex+=e.amount||0;
      if((e.category||'').match(/facebook|meta/i))monthData[key].adCost+=e.amount||0;
    });

    const months=Object.keys(monthData).sort();

    // KPI totals
    let tR=0,tC=0,tE=0,tA=0,tT=0;
    months.forEach(m=>{tR+=monthData[m].rev;tC+=monthData[m].cogs;tE+=monthData[m].opex;tA+=monthData[m].adCost;tT+=monthData[m].txns;});
    const tN=tR-tC-tE,mg=tR>0?(tN/tR*100).toFixed(1):0;
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

    const labels=months.map(m=>{const[y,mo]=m.split('-');return(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1])+` '${y.substring(2)}`;});
    const revD=months.map(m=>monthData[m].rev);
    const costD=months.map(m=>monthData[m].cogs+monthData[m].opex);
    const netD=months.map(m=>monthData[m].rev-monthData[m].cogs-monthData[m].opex);
    let cumNet=0;
    const roiD=months.map(m=>{cumNet+=monthData[m].rev-monthData[m].cogs-monthData[m].opex;return inv>0?parseFloat((cumNet/inv*100).toFixed(1)):0;});

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

    // Monthly table
    const tb=document.getElementById('ov-monthly-table');
    if(tb){
      tb.innerHTML=[...months].reverse().map(m=>{
        const d=monthData[m];const net=d.rev-d.cogs-d.opex;
        const mg=d.rev>0?(net/d.rev*100).toFixed(1):'0.0';const nc2=net>=0?'#27ae60':'#e74c3c';
        const[y,mo]=m.split('-');const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1];
        return`<tr>
          <td style="font-weight:700;padding-left:14px">${mn} ${y}</td>
          <td style="text-align:right;font-weight:700;color:#27ae60">${fmt(d.rev)}</td>
          <td style="text-align:right;color:#6b7280">${fmt(d.cogs)}</td>
          <td style="text-align:right;color:#e67e22">${fmt(d.opex)}</td>
          <td style="text-align:right;color:#e74c3c">${fmt(d.adCost)}</td>
          <td style="text-align:right;font-weight:800;color:${nc2}">${fmt(net)}</td>
          <td style="text-align:right;padding-right:14px"><span style="background:${nc2}18;color:${nc2};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${mg}%</span></td>
        </tr>`;
      }).join('');
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
      tb.innerHTML=rows.map(r=>{
        const delta=r.a-r.b;
        const pct=r.b!==0?(delta/Math.abs(r.b)*100).toFixed(1):null;
        const better=r.higherGood?(delta>0):(delta<0);
        const worse=r.higherGood?(delta<0):(delta>0);
        const dc=delta===0?'delta-neu':better?'delta-pos':'delta-neg';
        const arrow=delta===0?'→':delta>0?'▲':'▼';
        const fmtVal=v=>r.isMoney?fmt(v):v.toFixed(r.unit==='%'?1:0)+(r.unit||'');
        const sign=delta>=0?'+':'';
        return`<div class="cmp-metric-row">
          <span style="color:#e2e8f0;font-weight:700">${r.label}</span>
          <span style="text-align:right;color:#3b82f6;font-weight:700">${fmtVal(r.a)}</span>
          <span style="text-align:right;color:#8b5cf6;font-weight:700">${fmtVal(r.b)}</span>
          <span style="text-align:right" class="${dc}">${sign}${r.isMoney?fmt(delta):delta.toFixed(r.unit==='%'?1:0)+(r.unit||'')} ${arrow}</span>
          <span style="text-align:right" class="${dc}">${pct!==null?sign+pct+'%':'—'}</span>
        </div>`;
      }).join('');
    }

    document.getElementById('cmp-result').style.display='block';
    document.getElementById('cmp-result').scrollIntoView({behavior:'smooth',block:'start'});
  }

  return{load,setPeriod,runComparison,toggleCustom};
})();
