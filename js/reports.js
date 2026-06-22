/* ===================== REPORTS MODULE — Full GAS feature parity ===================== */
const reportsModule = (() => {
  let _totalSales=0,_netPct=0,_grossPct=0,_totalExpOnly=0,_cashInHand=0,_stockValue=0;
  let _logData=[],_logPage=1;
  const LOG_PER=10;

  async function load(){ renderLayout(); setQuickFilter('thisMonth'); }

  // Local date string YYYY-MM-DD (no UTC shift)
  const localDate = d => {
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  function renderLayout(){
    document.getElementById('section-reports').innerHTML=`
    <!-- Header Card -->
    <div class="table-card mb-3" style="overflow:hidden">
      <div style="padding:18px 22px;border-bottom:1px solid #e9ecef;background:linear-gradient(to right,#fff,#f8fafc);display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="background:#dbeafe;padding:10px;border-radius:10px"><i class="bi bi-bar-chart-steps" style="color:#3949ab;font-size:20px"></i></div>
          <div>
            <h5 style="font-weight:800;color:#212529;margin:0">Strategic Business Intelligence</h5>
            <span style="background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-patch-check-fill me-1"></i>System Active</span>
            <span style="color:#9ca3af;font-size:12px;margin-left:8px">অ্যাডভান্সড ডেটা অ্যানালিটিক্স</span>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="reportsModule.generateReport()" class="btn btn-primary" style="font-size:13px"><i class="bi bi-lightning-charge-fill"></i> Execute Analysis</button>
          <button onclick="window.print()" class="btn btn-outline" style="padding:8px 12px"><i class="bi bi-printer"></i></button>
        </div>
      </div>
      <div style="padding:16px 22px">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center">
          <span style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px"><i class="bi bi-clock-history"></i> Presets</span>
          ${[['today','Today'],['yesterday','Yesterday'],['7days','7 Days'],['30days','30 Days'],['thisMonth','This Month'],['lastMonth','Last Month'],['lifetime','∞ Lifetime']].map(([k,l])=>`
          <button id="btn-${k}" onclick="reportsModule.setQuickFilter('${k}')" class="time-filter">${l}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:flex-end">
          <div>
            <label style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block;margin-bottom:5px">Start Date</label>
            <input type="date" id="repStartDate" class="form-control">
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block;margin-bottom:5px">End Date</label>
            <input type="date" id="repEndDate" class="form-control">
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block;margin-bottom:5px">Analysis Mode</label>
            <select id="reportMode" class="form-control" style="font-weight:700;color:#3949ab">
              <option value="Daily">Daily Granularity</option>
              <option value="Weekly" selected>Weekly Aggregation</option>
              <option value="Monthly">Monthly Overview</option>
            </select>
          </div>
          <button onclick="reportsModule.generateReport()" class="btn btn-primary" style="padding:10px 16px"><i class="bi bi-lightning-charge-fill"></i></button>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <div id="reportStats" style="display:none;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
      ${[['repSales','Revenue','#3949ab','bi-graph-up'],['repExpense','Total Outflow','#e74c3c','bi-cart-dash'],['repCashInHand','Cash Balance','#00acc1','bi-wallet2'],['repNet','Net Profit','#212529','bi-shield-check']].map(([id,lbl,clr,icon])=>`
      <div style="background:#fff;border-radius:12px;padding:16px;border-bottom:4px solid ${clr};box-shadow:0 2px 6px rgba(0,0,0,.05)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><small style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px">${lbl}</small>
          <h3 style="margin:0;font-weight:800;color:#212529" id="${id}">৳0</h3></div>
          <div style="background:${clr}18;padding:10px;border-radius:50%"><i class="bi ${icon}" style="color:${clr};font-size:16px"></i></div>
        </div>
      </div>`).join('')}
    </div>

    <!-- Smart Summary (dark) -->
    <div id="smartSummary" style="display:none;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:14px;padding:0;margin-bottom:14px;overflow:hidden">
      <div style="padding:16px 22px;display:flex;align-items:center;gap:10px">
        <div style="background:rgba(251,191,36,.2);padding:7px;border-radius:8px"><i class="bi bi-lightning-fill" style="color:#fbbf24;font-size:18px"></i></div>
        <div><h6 style="color:#fff;margin:0;font-weight:700">Strategic Business Intelligence</h6><p style="color:rgba(255,255,255,.5);margin:0;font-size:12px">AI-Powered Performance Insights</p></div>
      </div>
      <div style="padding:0 22px 20px"><div id="summaryContent" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"></div></div>
    </div>

    <!-- Main 2-col grid -->
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-bottom:14px">
      <div>
        <!-- Trend Analysis -->
        <div class="table-card mb-3" style="overflow:hidden">
          <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px"><i class="bi bi-bar-chart-fill me-2" style="color:#3949ab"></i>Trend Analysis</div>
          <div style="overflow-x:auto">
            <table class="data-table"><thead><tr><th>Period</th><th>Revenue</th><th>Profit</th><th style="text-align:right">Margin</th></tr></thead>
            <tbody id="tallyTableBody"><tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af">Run analysis to see trends</td></tr></tbody></table>
          </div>
        </div>
        <!-- Expense by Category -->
        <div class="table-card mb-3" style="overflow:hidden">
          <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px"><i class="bi bi-pie-chart-fill me-2" style="color:#e74c3c"></i>Expense Analytics by Category</div>
          <div style="overflow-x:auto">
            <table class="data-table"><thead><tr><th>Category</th><th style="text-align:center">Txns</th><th style="text-align:center">Share</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody id="expenseCategoryBody"><tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af">—</td></tr></tbody></table>
          </div>
        </div>
        <!-- AI Predictor -->
        <div id="aiPredictorCard" class="table-card mb-3" style="display:none;border-left:5px solid #06b6d4">
          <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px"><i class="bi bi-robot me-2" style="color:#06b6d4"></i>AI Advanced Predictor &amp; Direction</div>
          <div style="padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:#f0f9ff;border:1px solid #e0f2fe;border-radius:10px;padding:12px">
              <small style="color:#9ca3af;font-weight:700;font-size:10px;text-transform:uppercase;display:block;margin-bottom:4px">Forecast (30 Days)</small>
              <div style="font-size:20px;font-weight:800;color:#3949ab" id="aiForecastSale">৳0</div>
              <small style="color:#9ca3af">মাসিক সম্ভাব্য বিক্রয় গতি</small>
            </div>
            <div style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:10px;padding:12px">
              <small style="color:#27ae60;font-weight:700;font-size:10px;text-transform:uppercase;display:block;margin-bottom:4px">Predicted Net Profit</small>
              <div style="font-size:20px;font-weight:800;color:#27ae60" id="aiPredictedNet">৳0</div>
              <small style="color:#9ca3af">সব খরচ বাদে সম্ভাব্য নিট লাভ</small>
            </div>
            <div style="grid-column:1/-1;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:12px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="bi bi-piggy-bank-fill" style="color:#d97706;font-size:16px"></i><strong style="font-size:13px">Financial Force &amp; Savings</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>মুনাফা থেকে জমানোর পরামর্শ (১৫%):</span><strong style="color:#d97706" id="aiSavingsForce">৳0</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:12px"><span>নিরাপদ পণ্য ক্রয় সীমা:</span><strong style="color:#06b6d4" id="aiPurchaseLimit">৳0</strong></div>
            </div>
            <div style="grid-column:1/-1;background:#1e293b;color:#fff;border-radius:10px;padding:12px;font-size:13px" id="aiSmartAdvice">
              <i class="bi bi-stars" style="color:#fbbf24;margin-right:8px"></i>AI Analyzing your data…
            </div>
          </div>
        </div>
      </div>

      <div>
        <!-- Top Performers -->
        <div class="table-card mb-3" style="overflow:hidden">
          <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px"><i class="bi bi-award-fill me-2" style="color:#f39c12"></i>Top Performers (Revenue)</div>
          <table class="data-table"><thead><tr><th>Product</th><th style="text-align:center">Sold</th><th style="text-align:right">Revenue</th></tr></thead>
          <tbody id="inventoryPerformanceBody"><tr><td colspan="3" style="text-align:center;padding:20px;color:#9ca3af">—</td></tr></tbody></table>
        </div>
        <!-- Business Health -->
        <div id="businessHealthCard" class="table-card mb-3" style="display:none;overflow:hidden">
          <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px"><i class="bi bi-heart-pulse-fill me-2" style="color:#27ae60"></i>Business Health Indicators</div>
          <div style="padding:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <small style="font-weight:700;color:#9ca3af;font-size:10px;text-transform:uppercase">Revenue Allocation</small>
              <span id="healthMarginVal" style="background:#27ae60;color:#fff;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">0% Profit</span>
            </div>
            <div style="height:26px;border-radius:8px;overflow:hidden;background:#f1f5f9;display:flex;margin-bottom:10px">
              <div id="barCogs" style="background:#64748b;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;transition:width .5s;width:0%">COGS</div>
              <div id="barOpex" style="background:#f43f5e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;transition:width .5s;width:0%">OPEX</div>
              <div id="barProfit" style="background:#10b981;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;transition:width .5s;width:0%">PROFIT</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;margin-bottom:14px">
              <div><small style="color:#64748b;font-weight:700;font-size:10px;text-transform:uppercase;display:block">COGS</small><span id="valCogs" style="font-size:18px;font-weight:800">0%</span></div>
              <div><small style="color:#f43f5e;font-weight:700;font-size:10px;text-transform:uppercase;display:block">OPEX</small><span id="valOpex" style="font-size:18px;font-weight:800;color:#f43f5e">0%</span></div>
              <div><small style="color:#10b981;font-weight:700;font-size:10px;text-transform:uppercase;display:block">PROFIT</small><span id="valProfit" style="font-size:18px;font-weight:800;color:#10b981">0%</span></div>
            </div>
            <hr style="margin:10px 0;opacity:.2">
            <div style="margin-bottom:10px">
              <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;cursor:default" onclick="reportsModule._sTap()">
                <small style="color:#9ca3af;font-weight:700;font-size:9px;text-transform:uppercase;display:block;margin-bottom:2px">Avg Margin</small>
                <div style="font-size:16px;font-weight:800;color:#3949ab" id="healthSavingsAmt">0%</div>
              </div>
            </div>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <small style="color:#3949ab;font-weight:700;font-size:10px;text-transform:uppercase">Liquidity (Cash vs Stock)</small>
                <small id="healthRatioText" style="background:#3949ab;color:#fff;padding:1px 8px;border-radius:20px;font-size:10px;font-weight:700">0:0</small>
              </div>
              <div style="height:10px;border-radius:5px;overflow:hidden;display:flex">
                <div id="healthCashBar" style="background:#3949ab;width:50%;transition:width .5s"></div>
                <div id="healthStockBar" style="background:#f59e0b;width:50%;transition:width .5s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;font-weight:700">
                <span style="color:#3949ab">CASH IN HAND</span><span style="color:#f59e0b">STOCK VALUE</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Goal Planner (right col — matches GAS layout) -->
        <div id="goalPlannerCard" class="table-card mb-3" style="display:none;border-left:5px solid #6366f1">
          <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700;font-size:13px"><i class="bi bi-compass-fill me-2" style="color:#6366f1"></i>Financial Goal Planner</span>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin:0">
              <input type="checkbox" id="useCustomProfit" onchange="reportsModule.updateGoalCalc()"> Custom Profit %
            </label>
          </div>
          <div style="padding:14px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
              <div>
                <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block;margin-bottom:5px">Estimated Expense (৳)</label>
                <input type="number" id="estExpenseInput" class="form-control" placeholder="0" oninput="reportsModule.updateGoalCalc()">
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block;margin-bottom:5px">Target Profit %</label>
                <input type="number" id="targetProfitPct" class="form-control" value="15" disabled oninput="reportsModule.updateGoalCalc()">
              </div>
            </div>
            <div style="background:#f8fafc;border:1px dashed #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <small style="font-weight:700;color:#9ca3af">PROGRESS TO TARGET</small>
                <span id="goalProgressPct" style="background:#6366f1;color:#fff;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">0%</span>
              </div>
              <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                <div id="goalProgressBar" style="height:100%;background:#6366f1;width:0%;transition:width .5s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px">
                <span style="color:#9ca3af">Achieved: <strong id="goalAchievedVal">৳0</strong></span>
                <span style="color:#9ca3af">Target: <strong id="goalTargetVal">৳0</strong></span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-top:1px solid #f3f4f6">
              <span style="color:#9ca3af"><i class="bi bi-shield-lock me-1"></i>Survival Sales Target</span>
              <strong style="color:#e74c3c" id="survivalTargetVal">৳0</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-top:1px solid #f3f4f6">
              <span style="color:#9ca3af"><i class="bi bi-graph-up-arrow me-1"></i>Remaining Sales Needed</span>
              <strong style="color:#3949ab" id="remainingSalesVal">৳0</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Inventory Performance Matrix -->
    <div id="productMatrixCard" class="table-card mb-3" style="display:none;overflow:hidden">
      <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;font-weight:700;font-size:13px"><i class="bi bi-layers-half me-2" style="color:#3949ab"></i>Inventory Performance Matrix</div>
      <div style="overflow-x:auto">
        <table class="data-table"><thead><tr><th>Product</th><th style="text-align:center">In Stock</th><th style="text-align:center">Stock Value</th><th style="text-align:center">Sold Qty</th><th style="text-align:center">COGS</th><th style="text-align:right">Gross Profit</th></tr></thead>
        <tbody id="productMatrixBody"></tbody></table>
      </div>
    </div>

    <!-- Transaction Log -->
    <div id="detailedLogCard" class="table-card" style="display:none;overflow:hidden">
      <div style="padding:13px 16px;border-bottom:1px solid #e9ecef;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:13px"><i class="bi bi-clock-history me-2" style="color:#6b7280"></i>Transaction Log</span>
        <small id="logCount" style="color:#9ca3af;font-weight:700">0 records</small>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody id="txLogBody"></tbody></table>
      </div>
      <div style="padding:10px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
        <small id="logPageInfo" style="color:#9ca3af"></small>
        <div id="logPagination" style="display:flex;gap:4px"></div>
      </div>
    </div>`;
  }

  function setQuickFilter(type){
    document.querySelectorAll('.time-filter').forEach(b=>b.classList.remove('active'));
    const btn=document.getElementById('btn-'+type);if(btn)btn.classList.add('active');
    const now=new Date();let s=new Date(now),e=new Date(now);
    if(type==='yesterday'){s.setDate(now.getDate()-1);e.setDate(now.getDate()-1);}
    else if(type==='7days'){s.setDate(now.getDate()-6);}
    else if(type==='30days'){s.setDate(now.getDate()-29);}
    else if(type==='thisMonth'){s=new Date(now.getFullYear(),now.getMonth(),1);}
    else if(type==='lastMonth'){s=new Date(now.getFullYear(),now.getMonth()-1,1);e=new Date(now.getFullYear(),now.getMonth(),0);}
    else if(type==='lifetime'){s=new Date(2020,0,1);}
    const sEl=document.getElementById('repStartDate'),eEl=document.getElementById('repEndDate');
    if(sEl)sEl.value=localDate(s);if(eEl)eEl.value=localDate(e);
    generateReport();
  }

  async function generateReport(){
    const fds=document.getElementById('repStartDate')?.value;
    const tds=document.getElementById('repEndDate')?.value;
    const mode=document.getElementById('reportMode')?.value||'Weekly';
    if(!fds||!tds)return;

    const parseDs=v=>{
      if(!v)return'';const s=String(v).trim();
      if(/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)){const p=s.substring(0,10).split('/');return`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;}
      return s.substring(0,10);
    };

    const periodKey=(dateStr,m)=>{
      const d=new Date(dateStr+'T00:00:00');
      if(m==='Daily')return dateStr;
      if(m==='Weekly'){const MM=dateStr.substring(5,7);const wk=Math.ceil(d.getDate()/7);return`W${wk}-${MM}`;}
      return dateStr.substring(0,7);
    };

    try{
      const[allSales,expSnap,prodsSnap,cashSnap,custSnap,suppSnap]=await Promise.all([
        window.db.collection('sales').get(),
        window.db.collection('expenses').get(),
        window.db.collection('products').get(),
        window.db.collection('cashBook').get(),
        window.db.collection('customers').get(),
        window.db.collection('suppliers').get()
      ]);

      const prods=prodsSnap.docs.map(d=>({id:d.id,...d.data()}));
      const costMap={};prods.forEach(p=>{if(p.name)costMap[p.name.trim().toLowerCase()]=p.buyPrice||0;});

      const sales=allSales.docs.map(d=>d.data()).filter(s=>{
        const ds=parseDs(s.date);return ds>=fds&&ds<=tds&&s.status!=='Returned';
      });
      const expDocs=expSnap.docs.map(d=>d.data()).filter(e=>{
        const ds=parseDs(e.date);return ds>=fds&&ds<=tds&&(e.status==='Paid'||e.category==='Meta/Facebook Ads');
      });
      const cashDocs=cashSnap.docs.map(d=>d.data());

      // Core metrics
      const totalSales=sales.reduce((s,d)=>s+(d.total||0),0);
      const totalCOGS=sales.reduce((s,d)=>{
        const bp=costMap[(d.product||'').trim().toLowerCase()]||d.buyPrice||0;
        return s+(d.qty||0)*bp;
      },0);
      const totalExpenses=expDocs.reduce((s,d)=>s+(d.amount||0),0);
      const netProfit=totalSales-totalCOGS-totalExpenses;
      const opening=window.appSettings?.openingCash||0;
      const cashIn=cashDocs.filter(e=>e.cashIn>0).reduce((s,e)=>s+(e.cashIn||0),0);
      const cashOut=cashDocs.filter(e=>e.cashOut>0).reduce((s,e)=>s+(e.cashOut||0),0);
      const cashInHand=opening+cashIn-cashOut;
      const stockValue=prods.reduce((s,p)=>s+(p.currentStock||0)*(p.buyPrice||0),0);
      const customerDue=custSnap.docs.reduce((s,d)=>s+(d.data().totalCod||0),0);
      const supplierDue=suppSnap.docs.reduce((s,d)=>s+(d.data().currentDue||0),0);

      // Store for Goal Planner / AI
      _totalSales=totalSales;_totalExpOnly=totalExpenses;_cashInHand=cashInHand;_stockValue=stockValue;
      const grossProfit=totalSales-totalCOGS;
      _grossPct=totalSales>0?(grossProfit/totalSales*100):0;
      _netPct=totalSales>0?(netProfit/totalSales*100):0;

      // Stats Row
      const sEl=document.getElementById('reportStats');if(sEl)sEl.style.display='grid';
      setEl('repSales',fmt(totalSales));setEl('repExpense',fmt(totalCOGS+totalExpenses));setEl('repCashInHand',fmt(cashInHand));
      const nEl=document.getElementById('repNet');if(nEl){nEl.textContent=fmt(netProfit);nEl.style.color=netProfit>=0?'#27ae60':'#e74c3c';}

      // Smart Summary
      const expCatMap={};expDocs.forEach(e=>{const c=e.category||'Other';expCatMap[c]=(expCatMap[c]||{count:0,total:0});expCatMap[c].count++;expCatMap[c].total+=e.amount||0;});
      const topExpCat=Object.entries(expCatMap).sort((a,b)=>b[1].total-a[1].total)[0];
      const perfMap2={};sales.forEach(s=>{const p=s.product||'Unknown';if(!perfMap2[p])perfMap2[p]={rev:0};perfMap2[p].rev+=s.total||0;});
      const topProd=Object.entries(perfMap2).sort((a,b)=>b[1].rev-a[1].rev)[0];
      const expRatio=totalSales>0?(totalExpenses/totalSales*100).toFixed(1):0;
      const summEl=document.getElementById('smartSummary');if(summEl)summEl.style.display='block';
      const sc=document.getElementById('summaryContent');
      if(sc)sc.innerHTML=[
        [topExpCat?topExpCat[0]:'None','Top Expense','#f43f5e',topExpCat?fmt(topExpCat[1].total):''],
        [topProd?topProd[0]:'None','Top Product','#fbbf24','High Performer'],
        [expRatio+'%','Opex Ratio','#06b6d4','of Revenue'],
        [fmt(stockValue),'Total Assets','#10b981','Current Stock']
      ].map(([v,l,c,sub])=>`
        <div style="background:rgba(255,255,255,.06);border-radius:10px;padding:12px;border-top:3px solid ${c}">
          <small style="color:rgba(255,255,255,.5);font-size:9px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">${l}</small>
          <div style="font-size:16px;font-weight:800;color:${c};margin-bottom:2px">${v}</div>
          <small style="color:rgba(255,255,255,.4)">${sub}</small>
        </div>`).join('');

      // Trend Analysis
      const trendMap={};
      sales.forEach(s=>{
        const ds=parseDs(s.date);if(!ds)return;
        const key=periodKey(ds,mode);
        if(!trendMap[key])trendMap[key]={period:key,revenue:0,cogs:0,expenses:0};
        const bp=costMap[(s.product||'').trim().toLowerCase()]||s.buyPrice||0;
        trendMap[key].revenue+=s.total||0;trendMap[key].cogs+=(s.qty||0)*bp;
      });
      expDocs.forEach(e=>{
        const ds=parseDs(e.date);if(!ds)return;
        const key=periodKey(ds,mode);
        if(!trendMap[key])trendMap[key]={period:key,revenue:0,cogs:0,expenses:0};
        trendMap[key].expenses+=e.amount||0;
      });
      const tallyBody=document.getElementById('tallyTableBody');
      if(tallyBody){
        const rows=Object.values(trendMap).sort((a,b)=>b.period.localeCompare(a.period));
        tallyBody.innerHTML=rows.length?rows.map(r=>{
          const prof=r.revenue-r.cogs-r.expenses;
          const margin=r.revenue>0?(prof/r.revenue*100).toFixed(1):'0.0';
          const mc=prof>=0?'#27ae60':'#e74c3c';
          return`<tr>
            <td style="font-weight:700;padding-left:14px">${r.period}</td>
            <td style="font-weight:700">${fmt(r.revenue)}</td>
            <td style="font-weight:700;color:${mc}">${fmt(prof)}</td>
            <td style="text-align:right;padding-right:14px"><span style="background:${mc}18;color:${mc};padding:2px 8px;border-radius:20px;font-size:12px;font-weight:700">${margin}%</span></td>
          </tr>`;
        }).join(''):'<tr><td colspan="4" style="text-align:center;padding:14px;color:#9ca3af">No data</td></tr>';
      }

      // Expense by Category
      const catBody=document.getElementById('expenseCategoryBody');
      if(catBody){
        const cats=Object.entries(expCatMap).sort((a,b)=>b[1].total-a[1].total);
        catBody.innerHTML=cats.length?cats.map(([cat,d])=>`<tr>
          <td style="padding-left:14px"><span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700">${cat}</span></td>
          <td style="text-align:center">${d.count}</td>
          <td style="text-align:center;font-weight:700;color:#3949ab">${totalExpenses>0?(d.total/totalExpenses*100).toFixed(1):0}%</td>
          <td style="text-align:right;font-weight:700;color:#e74c3c;padding-right:14px">${fmt(d.total)}</td>
        </tr>`).join(''):'<tr><td colspan="4" style="text-align:center;padding:14px;color:#9ca3af">No expenses</td></tr>';
      }

      // Top Performers
      const perfMap={};
      sales.forEach(s=>{
        const p=s.product||'Unknown';if(!perfMap[p])perfMap[p]={name:p,soldQty:0,revenue:0};
        perfMap[p].soldQty+=s.qty||0;perfMap[p].revenue+=s.total||0;
      });
      const performers=Object.values(perfMap).sort((a,b)=>b.revenue-a.revenue);
      const perfBody=document.getElementById('inventoryPerformanceBody');
      if(perfBody)perfBody.innerHTML=performers.length?performers.slice(0,8).map(p=>`<tr>
        <td style="padding-left:14px;font-weight:700">${p.name}</td>
        <td style="text-align:center"><span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${p.soldQty} pcs</span></td>
        <td style="text-align:right;font-weight:700;color:#27ae60;padding-right:14px">${fmt(p.revenue)}</td>
      </tr>`).join(''):'<tr><td colspan="3" style="text-align:center;padding:14px;color:#9ca3af">No sales data</td></tr>';

      // Business Health
      const bhCard=document.getElementById('businessHealthCard');
      if(bhCard&&totalSales>0){
        bhCard.style.display='block';
        const cogsPct=totalCOGS/totalSales*100,opexPct=totalExpenses/totalSales*100,profPct=Math.max(0,100-cogsPct-opexPct);
        setEl('valCogs',cogsPct.toFixed(1)+'%');setEl('valOpex',opexPct.toFixed(1)+'%');setEl('valProfit',profPct.toFixed(1)+'%');
        ['barCogs','barOpex','barProfit'].forEach((id,i)=>{ const el=document.getElementById(id);if(el)el.style.width=[cogsPct,opexPct,profPct][i].toFixed(1)+'%';});
        setEl('healthMarginVal',profPct.toFixed(1)+'% Profit');
        const totalSavings=expSnap.docs.map(d=>d.data()).filter(e=>e.category==='Savings').reduce((s,e)=>s+(e.amount||0),0);
        const avgMargin=totalSales>0?(((totalSales-totalCOGS)/totalSales)*100).toFixed(1):'0.0';
        const savEl=document.getElementById('healthSavingsAmt');
        if(savEl){savEl.textContent=avgMargin+'%';savEl.dataset.s=fmt(totalSavings);savEl.dataset.orig=avgMargin+'%';}
        const assetTotal=cashInHand+stockValue;
        const cashRatio=assetTotal>0?(cashInHand/assetTotal*100):50,stRatio=100-cashRatio;
        const cashBar=document.getElementById('healthCashBar'),stBar=document.getElementById('healthStockBar');
        if(cashBar)cashBar.style.width=cashRatio+'%';if(stBar)stBar.style.width=stRatio+'%';
        setEl('healthRatioText',`${Math.round(cashRatio)}:${Math.round(stRatio)}`);
      }

      // Inventory Performance Matrix
      const pmCard=document.getElementById('productMatrixCard');if(pmCard)pmCard.style.display='block';
      const pmBody=document.getElementById('productMatrixBody');
      if(pmBody){
        const prodPerf={};
        prods.forEach(p=>{prodPerf[p.name]={name:p.name,stock:p.currentStock||0,bp:p.buyPrice||0,soldQty:0,revenue:0};});
        sales.forEach(s=>{const p=prodPerf[s.product];if(p){p.soldQty+=s.qty||0;p.revenue+=s.total||0;}});
        const pmRows=Object.values(prodPerf).sort((a,b)=>b.revenue-a.revenue);
        pmBody.innerHTML=pmRows.map(p=>{
          const sv=p.stock*p.bp,cogs=p.soldQty*p.bp,gp=p.revenue-cogs;
          return`<tr>
            <td style="padding-left:14px;font-weight:700">${p.name}</td>
            <td style="text-align:center"><span style="color:${p.stock===0?'#e74c3c':p.stock<10?'#f39c12':'#27ae60'};font-weight:700">${p.stock}</span></td>
            <td style="text-align:center;color:#6b7280;font-weight:700">${fmt(sv)}</td>
            <td style="text-align:center"><span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${p.soldQty}</span></td>
            <td style="text-align:center;color:#e74c3c;font-weight:700">${fmt(cogs)}</td>
            <td style="text-align:right;font-weight:700;color:${gp>=0?'#27ae60':'#e74c3c'};padding-right:14px">${fmt(gp)}</td>
          </tr>`;
        }).join('');
      }

      // AI Predictor
      const aiCard=document.getElementById('aiPredictorCard');if(aiCard)aiCard.style.display='block';
      const fromD=new Date(fds+'T00:00:00'),toD=new Date(tds+'T00:00:00');
      const daysDiff=Math.max(1,Math.ceil((toD-fromD)/86400000)+1);
      const forecast30=Math.round((totalSales/daysDiff)*30);
      const predictedNet=Math.round((netProfit/daysDiff)*30);
      const savings15=Math.max(0,Math.round(predictedNet*0.15));
      const purchaseLimit=Math.max(0,cashInHand+customerDue*0.3-supplierDue);
      setEl('aiForecastSale',fmt(forecast30));setEl('aiPredictedNet',fmt(predictedNet));
      setEl('aiSavingsForce',fmt(savings15));setEl('aiPurchaseLimit',fmt(purchaseLimit));
      const advice=document.getElementById('aiSmartAdvice');
      if(advice){
        const opR=(totalExpenses/(totalSales||1))*100;
        if(opR>25)advice.innerHTML=`<i class="bi bi-exclamation-triangle-fill" style="color:#fbbf24;margin-right:8px"></i>খরচ কমানোর সুযোগ আছে! ৫% কমাতে পারলে নিট প্রফিট আরও ${fmt(Math.round(forecast30*0.012))} বাড়তে পারে।`;
        else if(stockValue>cashInHand*2)advice.innerHTML=`<i class="bi bi-info-circle-fill" style="color:#06b6d4;margin-right:8px"></i>স্টকে অনেক মাল কিন্তু হাতে ক্যাশ কম। স্টক ক্লিয়ারেন্স সেলে ফোকাস দিন।`;
        else if(netProfit>0)advice.innerHTML=`<i class="bi bi-check-circle-fill" style="color:#10b981;margin-right:8px"></i>ব্যবসা লাভজনক (${_netPct.toFixed(1)}% নেট মার্জিন)। দৈনিক গড় সেল ${fmt(Math.round(totalSales/daysDiff))} থেকে ১০% বাড়ানোর চেষ্টা করুন।`;
        else advice.innerHTML=`<i class="bi bi-exclamation-triangle" style="color:#fbbf24;margin-right:8px"></i>এই পিরিয়ডে লোকসান। খরচ কমানো এবং বিক্রয় বাড়ানোর দিকে মনোযোগ দিন।`;
      }

      // Goal Planner
      const gpCard=document.getElementById('goalPlannerCard');if(gpCard)gpCard.style.display='block';
      const savedExp=localStorage.getItem('gx_est_exp')||'';
      const estExpEl=document.getElementById('estExpenseInput');if(estExpEl&&!estExpEl.value)estExpEl.value=savedExp;
      updateGoalCalc();

      // Transaction Log
      const logCard=document.getElementById('detailedLogCard');if(logCard)logCard.style.display='block';
      _logData=[
        ...sales.map(s=>({date:parseDs(s.date),desc:(s.product||'Sale')+(s.customerName?` → ${s.customerName}`:''),type:'Sale',amount:s.total||0})),
        ...expDocs.map(e=>({date:parseDs(e.date),desc:(e.category||'Expense')+(e.particulars?`: ${e.particulars}`:''),type:'Expense',amount:e.amount||0}))
      ].sort((a,b)=>b.date.localeCompare(a.date));
      _logPage=1;renderLogPage();

    }catch(e){toast('Report error: '+e.message,'error');console.error(e);}
  }

  function updateGoalCalc(){
    const estExpEl=document.getElementById('estExpenseInput');
    const estExp=parseFloat(estExpEl?.value)||0;
    localStorage.setItem('gx_est_exp',estExp);
    const useCustom=document.getElementById('useCustomProfit')?.checked;
    const tpEl=document.getElementById('targetProfitPct');if(tpEl)tpEl.disabled=!useCustom;
    const targetPct=useCustom?(parseFloat(tpEl?.value)||0):_netPct;
    const gm=_grossPct/100;
    const survivalTarget=gm>0?(estExp/gm):0;
    const desiredNm=targetPct/100;
    const growthTarget=(gm-desiredNm>0)?(estExp/(gm-desiredNm)):survivalTarget;
    setEl('survivalTargetVal',fmt(Math.round(survivalTarget)));
    setEl('goalTargetVal',fmt(Math.round(growthTarget)));
    setEl('goalAchievedVal',fmt(Math.round(_totalSales)));
    const remaining=Math.max(0,growthTarget-_totalSales);
    setEl('remainingSalesVal',fmt(Math.round(remaining)));
    const progress=growthTarget>0?Math.min(100,(_totalSales/growthTarget*100)):0;
    const pb=document.getElementById('goalProgressBar');if(pb)pb.style.width=progress+'%';
    setEl('goalProgressPct',Math.round(progress)+'%');
  }

  function renderLogPage(){
    const start=(_logPage-1)*LOG_PER,end=Math.min(start+LOG_PER,_logData.length);
    const page=_logData.slice(start,end);
    const tb=document.getElementById('txLogBody');
    if(tb)tb.innerHTML=page.map(r=>`<tr>
      <td style="padding-left:14px;color:#6b7280;font-weight:700">${fmtDate(r.date)}</td>
      <td style="font-weight:600">${r.desc}</td>
      <td><span style="background:${r.type==='Sale'?'#d1fae5':'#fee2e2'};color:${r.type==='Sale'?'#065f46':'#991b1b'};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${r.type}</span></td>
      <td style="text-align:right;font-weight:700;padding-right:14px;color:${r.type==='Sale'?'#27ae60':'#e74c3c'}">${fmt(r.amount)}</td>
    </tr>`).join('');
    setEl('logCount',_logData.length+' records');
    setEl('logPageInfo',`Showing ${start+1}–${end} of ${_logData.length}`);
    const totalPgs=Math.ceil(_logData.length/LOG_PER);
    const pg=document.getElementById('logPagination');
    if(pg){
      let html='';
      for(let i=1;i<=totalPgs;i++){
        if(i===1||i===totalPgs||(i>=_logPage-1&&i<=_logPage+1)){
          html+=`<button onclick="reportsModule.goToLogPage(${i})" class="btn btn-outline btn-sm" style="${i===_logPage?'background:#3949ab;color:#fff;border-color:#3949ab':''};padding:4px 10px;font-size:12px">${i}</button>`;
        } else if(i===_logPage-2||i===_logPage+2){html+='<span style="padding:4px 4px;color:#9ca3af">…</span>';}
      }
      pg.innerHTML=html;
    }
  }

  function goToLogPage(p){_logPage=p;renderLogPage();}

  function setEl(id,v){const el=document.getElementById(id);if(el)el.innerHTML=v;}

  let _sTapC=0,_sTapT=null,_sHide=null;
  function _sTap(){
    clearTimeout(_sTapT);
    _sTapC++;
    _sTapT=setTimeout(()=>{_sTapC=0;},1200);
    if(_sTapC>=3){
      _sTapC=0;clearTimeout(_sTapT);clearTimeout(_sHide);
      const el=document.getElementById('healthSavingsAmt');
      if(!el)return;
      el.textContent=el.dataset.s||'৳0';
      el.style.color='#15803d';
      _sHide=setTimeout(()=>{el.textContent=el.dataset.orig||'0%';el.style.color='#3949ab';},8000);
    }
  }

  return{load,setQuickFilter,generateReport,updateGoalCalc,goToLogPage,_sTap};
})();
