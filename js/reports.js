/* ===================== REPORTS MODULE (matching ReportsUI.html) ===================== */
const reportsModule = (() => {
  let activeFilter = 'thisMonth';

  async function load() {
    renderLayout();
    setQuickFilter('thisMonth');
  }

  function renderLayout() {
    document.getElementById('section-reports').innerHTML = `
    <!-- Header -->
    <div class="table-card mb-4" style="overflow:hidden">
      <div style="padding:20px 24px;border-bottom:1px solid #e9ecef;background:linear-gradient(to right,#fff,#f8fafc);display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="background:#dbeafe;padding:12px;border-radius:12px"><i class="bi bi-bar-chart-steps" style="color:#3949ab;font-size:22px"></i></div>
          <div>
            <h4 style="font-weight:800;color:#212529;margin:0;letter-spacing:-0.5px">Strategic Business Intelligence</h4>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <span style="background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-patch-check-fill me-1"></i>System Active</span>
              <span style="color:#9ca3af;font-size:12px">অ্যাডভান্সড ডেটা অ্যানালিটিক্স এবং পারফরম্যান্স ট্র্যাকিং</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="reportsModule.generateReport()" class="btn btn-primary" style="font-size:14px">
            <i class="bi bi-lightning-charge-fill"></i> Execute Analysis
          </button>
          <button onclick="window.print()" class="btn btn-outline" style="padding:8px 14px"><i class="bi bi-printer"></i></button>
        </div>
      </div>
      <div style="padding:20px 24px">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          <span style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;align-self:center;letter-spacing:1px"><i class="bi bi-clock-history me-1"></i>Temporal Presets</span>
          ${[['today','Today'],['yesterday','Yesterday'],['7days','7 Days'],['30days','30 Days'],['thisMonth','This Month'],['lastMonth','Last Month'],['lifetime','∞ Lifetime']].map(([k,l])=>`
          <button id="btn-${k}" onclick="reportsModule.setQuickFilter('${k}')" class="time-filter">${l}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:flex-end">
          <div>
            <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px"><i class="bi bi-calendar-event me-1"></i>Start Date</label>
            <input type="date" id="repStartDate" class="form-control">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px"><i class="bi bi-calendar-check me-1"></i>End Date</label>
            <input type="date" id="repEndDate" class="form-control">
          </div>
          <button onclick="reportsModule.generateReport()" class="btn btn-primary" style="padding:10px 20px"><i class="bi bi-lightning-charge-fill"></i></button>
        </div>
      </div>
    </div>

    <!-- Stats Row (hidden until report generated) -->
    <div id="reportStats" style="display:none;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      ${[['repSales','Revenue','#3949ab','bi-graph-up'],['repExpense','Total Outflow','#e74c3c','bi-cart-dash'],['repCashInHand','Cash Balance','#00acc1','bi-wallet2'],['repNet','Net Profit','#212529','bi-shield-check']].map(([id,lbl,clr,icon])=>`
      <div style="background:#fff;border-radius:12px;padding:18px;border-bottom:4px solid ${clr};box-shadow:0 2px 6px rgba(0,0,0,.05)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <small style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px">${lbl}</small>
            <h3 style="margin:0;font-weight:800;color:#212529" id="${id}">৳0</h3>
          </div>
          <div style="background:${clr}15;padding:12px;border-radius:50%"><i class="bi ${icon}" style="color:${clr};font-size:18px"></i></div>
        </div>
      </div>`).join('')}
    </div>

    <!-- Smart Summary (dark card) -->
    <div id="smartSummary" style="display:none;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:14px;padding:0;margin-bottom:16px;overflow:hidden">
      <div style="padding:20px 24px;display:flex;align-items:center;gap:12px">
        <div style="background:rgba(251,191,36,.2);padding:8px;border-radius:8px"><i class="bi bi-lightning-fill" style="color:#fbbf24;font-size:20px"></i></div>
        <div><h5 style="color:#fff;margin:0;font-weight:700">Strategic Business Intelligence</h5><p style="color:rgba(255,255,255,.5);margin:0;font-size:13px">AI-Powered Performance Insights</p></div>
      </div>
      <div style="padding:0 24px 24px"><div id="summaryContent" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px"></div></div>
    </div>

    <!-- Main Grid -->
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px">
      <!-- LEFT -->
      <div>
        <!-- Trend Analysis -->
        <div class="table-card mb-3" style="overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:14px"><i class="bi bi-bar-chart-fill me-2" style="color:#3949ab"></i>Trend Analysis</div>
          <div style="overflow-x:auto">
            <table class="data-table"><thead><tr><th>Period</th><th>Revenue</th><th>COGS</th><th>Expenses</th><th>Profit</th><th style="text-align:right">Margin</th></tr></thead>
            <tbody id="tallyTableBody"><tr><td colspan="6" style="text-align:center;padding:20px;color:#9ca3af">Run analysis to see trends</td></tr></tbody></table>
          </div>
        </div>
        <!-- Expense by Category -->
        <div class="table-card mb-3" style="overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:14px"><i class="bi bi-pie-chart-fill me-2" style="color:#e74c3c"></i>Expense Analytics by Category</div>
          <div style="overflow-x:auto">
            <table class="data-table"><thead><tr><th>Category</th><th style="text-align:center">Txns</th><th style="text-align:center">Share</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody id="expenseCategoryBody"><tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af">—</td></tr></tbody></table>
          </div>
        </div>
        <!-- AI Predictor -->
        <div id="aiPredictorCard" class="table-card mb-3" style="display:none;border-left:5px solid #06b6d4">
          <div style="padding:14px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:14px"><i class="bi bi-robot me-2" style="color:#06b6d4"></i>AI Advanced Predictor &amp; Direction</div>
          <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="background:#f0f9ff;border:1px solid #e0f2fe;border-radius:10px;padding:14px">
              <small style="color:#9ca3af;font-weight:700;font-size:10px;text-transform:uppercase;display:block;margin-bottom:4px">Forecast (30 Days)</small>
              <div style="font-size:22px;font-weight:800;color:#3949ab" id="aiForecastSale">৳0</div>
              <small style="color:#9ca3af">মাসিক সম্ভাব্য বিক্রয় গতি</small>
            </div>
            <div style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:10px;padding:14px">
              <small style="color:#27ae60;font-weight:700;font-size:10px;text-transform:uppercase;display:block;margin-bottom:4px">Predicted Net Profit</small>
              <div style="font-size:22px;font-weight:800;color:#27ae60" id="aiPredictedNet">৳0</div>
              <small style="color:#9ca3af">সব খরচ বাদে সম্ভাব্য নিট লাভ</small>
            </div>
            <div style="grid-column:1/-1;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><i class="bi bi-piggy-bank-fill" style="color:#d97706;font-size:18px"></i><strong>Financial Force &amp; Savings</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>মুনাফা থেকে জমানোর পরামর্শ (১৫%):</span><strong style="color:#d97706" id="aiSavingsForce">৳0</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:13px"><span>নিরাপদ পণ্য ক্রয় সীমা:</span><strong style="color:#06b6d4" id="aiPurchaseLimit">৳0</strong></div>
            </div>
            <div style="grid-column:1/-1;background:#1e293b;color:#fff;border-radius:10px;padding:14px;font-size:13.5px" id="aiSmartAdvice">
              <i class="bi bi-stars" style="color:#fbbf24;margin-right:8px"></i>AI Analyzing your data…
            </div>
          </div>
        </div>
      </div>
      <!-- RIGHT -->
      <div>
        <!-- Top Performers -->
        <div class="table-card mb-3" style="overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:14px"><i class="bi bi-award-fill me-2" style="color:#f39c12"></i>Top Performers (Revenue)</div>
          <table class="data-table"><thead><tr><th>Product</th><th style="text-align:center">Sold</th><th style="text-align:right">Revenue</th></tr></thead>
          <tbody id="inventoryPerformanceBody"><tr><td colspan="3" style="text-align:center;padding:20px;color:#9ca3af">—</td></tr></tbody></table>
        </div>
        <!-- Business Health -->
        <div id="businessHealthCard" class="table-card" style="display:none;overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:14px"><i class="bi bi-heart-pulse-fill me-2" style="color:#27ae60"></i>Business Health Indicators</div>
          <div style="padding:18px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <small style="font-weight:700;color:#9ca3af;font-size:11px;text-transform:uppercase">Revenue Allocation</small>
              <span id="healthMarginVal" style="background:#27ae60;color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">0% Profit</span>
            </div>
            <div style="height:28px;border-radius:8px;overflow:hidden;background:#f1f5f9;display:flex">
              <div id="barCogs"   style="background:#64748b;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;transition:width .5s;width:0%">COGS</div>
              <div id="barOpex"   style="background:#f43f5e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;transition:width .5s;width:0%">OPEX</div>
              <div id="barProfit" style="background:#10b981;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;transition:width .5s;width:0%">PROFIT</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:14px;text-align:center">
              <div><small style="color:#64748b;font-weight:700;font-size:10px;text-transform:uppercase;display:block">COGS</small><span id="valCogs" style="font-size:20px;font-weight:800">0%</span></div>
              <div><small style="color:#f43f5e;font-weight:700;font-size:10px;text-transform:uppercase;display:block">OPEX</small><span id="valOpex" style="font-size:20px;font-weight:800;color:#f43f5e">0%</span></div>
              <div><small style="color:#10b981;font-weight:700;font-size:10px;text-transform:uppercase;display:block">PROFIT</small><span id="valProfit" style="font-size:20px;font-weight:800;color:#10b981">0%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function setQuickFilter(type) {
    activeFilter = type;
    document.querySelectorAll('.time-filter').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-' + type);
    if (btn) btn.classList.add('active');

    const now = new Date(), s = new Date(), e = new Date();
    if (type==='today'){}
    else if(type==='yesterday'){s.setDate(now.getDate()-1);e.setDate(now.getDate()-1);}
    else if(type==='7days'){s.setDate(now.getDate()-7);}
    else if(type==='30days'){s.setDate(now.getDate()-30);}
    else if(type==='thisMonth'){s.setDate(1);}
    else if(type==='lastMonth'){s=new Date(now.getFullYear(),now.getMonth()-1,1);e=new Date(now.getFullYear(),now.getMonth(),0);}
    else if(type==='lifetime'){s=new Date(2020,0,1);}

    const fmtD = d => d.toISOString().split('T')[0];
    const sEl=document.getElementById('repStartDate'),eEl=document.getElementById('repEndDate');
    if(sEl) sEl.value=fmtD(s); if(eEl) eEl.value=fmtD(e);
    generateReport();
  }

  async function generateReport() {
    const startDate = document.getElementById('repStartDate')?.value;
    const endDate   = document.getElementById('repEndDate')?.value;
    if (!startDate||!endDate) return;
    // Use input date strings directly (no timezone conversion needed)
    const fds = startDate; // YYYY-MM-DD from date input
    const tds = endDate;   // YYYY-MM-DD from date input

    // Parse doc date → YYYY-MM-DD (handles DD/MM/YYYY from Google Sheets import)
    const parseDs = v => {
      if (!v) return '';
      const s = String(v).trim();
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
        const p = s.substring(0,10).split('/');
        return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      }
      return s.substring(0,10);
    };

    try {
      const filterByDate = snap => ({ docs: snap.docs.filter(d => {
        const ds = parseDs(d.data().date);
        return ds >= fds && ds <= tds;
      }) });

      const [allSales, expSnap, prodsSnap, cashSnap] = await Promise.all([
        window.db.collection('sales').get(),
        window.db.collection('expenses').get(),
        window.db.collection('products').get(),
        window.db.collection('cashBook').get()
      ]);

      const salesSnap = filterByDate(allSales);
      const sales    = salesSnap.docs.map(d=>d.data());
      const prods    = prodsSnap.docs.map(d=>({id:d.id,...d.data()}));
      const cashDocs = cashSnap.docs.map(d=>d.data());

      // Filter expenses by date string + status
      const expDocs = expSnap.docs.map(d=>d.data()).filter(e => {
        const ds = (e.date||'').substring(0,10);
        return ds>=fds && ds<=tds && (e.status==='Paid' || e.category==='Meta/Facebook Ads');
      });

      const totalSales    = sales.filter(s=>s.status!=='Returned').reduce((s,d)=>s+(d.total||0),0);
      const totalCOGS     = sales.filter(s=>s.status!=='Returned').reduce((s,d)=>s+(d.cogs||0),0);
      const totalExpenses = expDocs.reduce((s,d)=>s+(d.amount||0),0);
      const netProfit     = totalSales - totalCOGS - totalExpenses;
      const opening       = window.appSettings?.openingCash || 0;
      const cashIn        = cashDocs.filter(e=>e.cashIn>0).reduce((s,e)=>s+(e.cashIn||0),0);
      const cashOut       = cashDocs.filter(e=>e.cashOut>0).reduce((s,e)=>s+(e.cashOut||0),0);
      const cashInHand    = opening + cashIn - cashOut;

      // Show stats
      const statsEl = document.getElementById('reportStats');
      if(statsEl){ statsEl.style.display='grid'; }
      setEl('repSales', fmt(totalSales));
      setEl('repExpense', fmt(totalCOGS + totalExpenses));
      setEl('repCashInHand', fmt(cashInHand));
      const netEl = document.getElementById('repNet');
      if(netEl){ netEl.textContent=fmt(netProfit); netEl.style.color=netProfit>=0?'#27ae60':'#e74c3c'; }

      // Smart Summary
      const smartEl = document.getElementById('smartSummary');
      if(smartEl) smartEl.style.display='block';
      const grossProfit = totalSales - totalCOGS;
      const grossMargin = totalSales>0?(grossProfit/totalSales*100).toFixed(1):0;
      const netMargin   = totalSales>0?(netProfit/totalSales*100).toFixed(1):0;
      const expRatio    = totalSales>0?(totalExpenses/totalSales*100).toFixed(1):0;
      const sc = document.getElementById('summaryContent');
      if(sc) sc.innerHTML = [
        ['৳'+fmt(grossProfit),'Gross Profit','#10b981'],
        [grossMargin+'%','Gross Margin','#3b82f6'],
        [netMargin+'%','Net Margin','#8b5cf6'],
        [expRatio+'%','Exp/Sales Ratio','#f43f5e'],
        [fmt(totalCOGS),'COGS','#64748b'],
        [sales.filter(s=>s.status!=='Returned').length+' txns','Total Sales','#fbbf24']
      ].map(([v,l,c])=>`
        <div style="background:rgba(255,255,255,.06);border-radius:10px;padding:14px">
          <small style="color:rgba(255,255,255,.5);font-size:10px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">${l}</small>
          <div style="font-size:22px;font-weight:800;color:${c}">${v}</div>
        </div>`).join('');

      // Trend Analysis (group by day/week)
      const trendMap = {};
      sales.filter(s=>s.status!=='Returned').forEach(s => {
        const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.date||0);
        const key = d.toISOString().split('T')[0].substring(0,7); // YYYY-MM
        if(!trendMap[key]) trendMap[key]={period:key,revenue:0,cogs:0,expenses:0};
        trendMap[key].revenue+=s.total||0; trendMap[key].cogs+=s.cogs||0;
      });
      expDocs.forEach(e=>{
        const d=e.createdAt?.toDate?e.createdAt.toDate():new Date(e.date||0);
        const key=d.toISOString().split('T')[0].substring(0,7);
        if(!trendMap[key]) trendMap[key]={period:key,revenue:0,cogs:0,expenses:0};
        trendMap[key].expenses+=e.amount||0;
      });
      const tallyBody = document.getElementById('tallyTableBody');
      if(tallyBody){
        const rows = Object.values(trendMap).sort((a,b)=>b.period.localeCompare(a.period));
        tallyBody.innerHTML = rows.length ? rows.map(r=>{
          const prof=r.revenue-r.cogs-r.expenses;
          const margin=r.revenue>0?(prof/r.revenue*100).toFixed(1):'0.0';
          const mc=prof>=0?'#27ae60':'#e74c3c';
          return `<tr>
            <td style="font-weight:700;padding-left:14px">${r.period}</td>
            <td>${fmt(r.revenue)}</td><td style="color:#e74c3c">${fmt(r.cogs)}</td>
            <td style="color:#f39c12">${fmt(r.expenses)}</td>
            <td style="font-weight:700;color:${mc}">${fmt(prof)}</td>
            <td style="text-align:right;color:${mc};font-weight:700;padding-right:14px">${margin}%</td>
          </tr>`;
        }).join('') : '<tr><td colspan="6" style="text-align:center;padding:14px;color:#9ca3af">No data</td></tr>';
      }

      // Expense by category
      const catMap = {};
      expDocs.forEach(e=>{ catMap[e.category||'Other']=(catMap[e.category||'Other']||{count:0,total:0}); catMap[e.category||'Other'].count++; catMap[e.category||'Other'].total+=e.amount||0; });
      const catBody = document.getElementById('expenseCategoryBody');
      if(catBody){
        const cats = Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total);
        catBody.innerHTML = cats.length ? cats.map(([cat,d])=>`<tr>
          <td style="padding-left:14px"><span class="badge badge-warning">${cat}</span></td>
          <td style="text-align:center">${d.count}</td>
          <td style="text-align:center">${totalExpenses>0?(d.total/totalExpenses*100).toFixed(1):'0'}%</td>
          <td style="text-align:right;font-weight:700;color:#e74c3c;padding-right:14px">${fmt(d.total)}</td>
        </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:14px;color:#9ca3af">No expenses</td></tr>';
      }

      // Top Performers
      const perfMap = {};
      sales.filter(s=>s.status!=='Returned').forEach(s=>{
        const p=s.product||'Unknown';
        if(!perfMap[p]) perfMap[p]={name:p,soldQty:0,revenue:0,cogs:0};
        perfMap[p].soldQty+=s.qty||0; perfMap[p].revenue+=s.total||0; perfMap[p].cogs+=s.cogs||0;
      });
      const perfBody = document.getElementById('inventoryPerformanceBody');
      if(perfBody){
        const performers = Object.values(perfMap).sort((a,b)=>b.revenue-a.revenue);
        perfBody.innerHTML = performers.length ? performers.map((p,i)=>`<tr>
          <td style="padding-left:14px"><strong>${p.name}</strong></td>
          <td style="text-align:center"><span class="badge badge-info">${p.soldQty} pcs</span></td>
          <td style="text-align:right;font-weight:700;color:#27ae60;padding-right:14px">${fmt(p.revenue)}</td>
        </tr>`).join('') : '<tr><td colspan="3" style="text-align:center;padding:14px;color:#9ca3af">No sales data</td></tr>';
      }

      // Business Health stacked bar
      const bhCard = document.getElementById('businessHealthCard');
      if(bhCard && totalSales > 0) {
        bhCard.style.display='block';
        const cogsPct  = (totalCOGS/totalSales*100);
        const opexPct  = (totalExpenses/totalSales*100);
        const profPct  = Math.max(0, 100-cogsPct-opexPct);
        setEl('valCogs', cogsPct.toFixed(1)+'%'); setEl('valOpex', opexPct.toFixed(1)+'%'); setEl('valProfit', profPct.toFixed(1)+'%');
        setElStyle('barCogs','width',cogsPct.toFixed(1)+'%'); setElStyle('barOpex','width',opexPct.toFixed(1)+'%'); setElStyle('barProfit','width',profPct.toFixed(1)+'%');
        setEl('healthMarginVal', profPct.toFixed(1)+'% Profit');
      }

      // AI Predictor
      const aiCard = document.getElementById('aiPredictorCard');
      if(aiCard) aiCard.style.display='block';
      const daysDiff = Math.max(1, Math.ceil((to-from)/86400000));
      const forecast30 = Math.round((totalSales/daysDiff)*30);
      const predictedNet = Math.round((netProfit/daysDiff)*30);
      const savings15 = Math.round(predictedNet*0.15);
      const customerDue = (await window.db.collection('customers').get()).docs.reduce((s,d)=>s+(d.data().totalCod||0),0);
      const supplierDue = (await window.db.collection('suppliers').get()).docs.reduce((s,d)=>s+(d.data().currentDue||0),0);
      const purchaseLimit = Math.max(0, cashInHand + customerDue*0.3 - supplierDue);
      setEl('aiForecastSale', fmt(forecast30)); setEl('aiPredictedNet', fmt(predictedNet));
      setEl('aiSavingsForce', fmt(savings15)); setEl('aiPurchaseLimit', fmt(purchaseLimit));
      const advice = document.getElementById('aiSmartAdvice');
      if(advice){
        if(netProfit>0) advice.innerHTML=`<i class="bi bi-stars" style="color:#fbbf24;margin-right:8px"></i>ব্যবসা লাভজনক। মুনাফার ${netMargin}% নেট মার্জিন রয়েছে। নিরাপদ ক্রয় সীমা ${fmt(purchaseLimit)} পর্যন্ত।`;
        else advice.innerHTML=`<i class="bi bi-exclamation-triangle" style="color:#fbbf24;margin-right:8px"></i>এই পিরিয়ডে লোকসান হয়েছে। খরচ কমানো এবং বিক্রয় বাড়ানোর দিকে মনোযোগ দিন।`;
      }

    } catch(e) { toast('Report error: '+e.message,'error'); console.error(e); }
  }

  function setEl(id,v){const el=document.getElementById(id);if(el)el.innerHTML=v;}
  function setElStyle(id,prop,v){const el=document.getElementById(id);if(el)el.style[prop]=v;}

  return { load, setQuickFilter, generateReport };
})();
