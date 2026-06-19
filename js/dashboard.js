/* ===================== DASHBOARD MODULE (Fixed all formulas + expense logic) =====================
   Formula sources verified from original GAS Code.gs getSummaryReport():

   totalCapital  = cashInHand + stockValue + customerDue - supplierDue  (Net Worth)
   roi           = ((totalCapital - totalInvestment) / totalInvestment) * 100
   buyingLimit   = max(0, cashInHand + customerDue*0.3 - supplierDue)
   totalExpenses = Paid expenses + ALL Meta/Facebook Ads (regardless of payment status)
   totalInvestment = cashBook entries where category === 'Investment'
   cashInHand    = openingCash + all cashBook cashIn - all cashBook cashOut
   forecast30D   = max(0, round(netProfit / daysOld * 30))
   breakEvenText = "৳ X (Y%)" where Y = expRatio = expenses/sales*100
================================================================= */
const dashModule = (() => {
  let period = 'lifetime';

  async function load() {
    setActivePeriod(period);
    await refresh();
  }

  function setActivePeriod(p) {
    period = p;
    document.querySelectorAll('.time-filter').forEach(b => {
      b.classList.toggle('active', b.dataset.period === p);
    });
  }

  async function refresh() {
    try {
      const range = window.getDateRange(period);

      const [salesSnap, products, customers, suppliers, cashSnap, expAllSnap] = await Promise.all([
        fetchWithRange('sales', range),
        window.db.collection('products').get(),
        window.db.collection('customers').get(),
        window.db.collection('suppliers').get(),
        window.db.collection('cashBook').get(),
        window.db.collection('expenses').get()
      ]);

      const salesDocs    = salesSnap.docs.map(d => d.data());
      const productDocs  = products.docs.map(d => d.data());
      const customerDocs = customers.docs.map(d => d.data());
      const supplierDocs = suppliers.docs.map(d => d.data());
      const cashDocs     = cashSnap.docs.map(d => d.data());
      const expAllDocs   = expAllSnap.docs.map(d => d.data());

      // Filter expenses by date range
      const expDocs = expAllDocs.filter(e => {
        if (!range) return true;
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.date || 0);
        return d >= range.from && d <= range.to;
      });

      // ── Core Metrics ──
      const activeSales  = salesDocs.filter(s => s.status !== 'Returned');
      const totalSales   = activeSales.reduce((s,d) => s+(d.total||0), 0);
      const totalCOGS    = activeSales.reduce((s,d) => s+(d.cogs||0), 0);

      // FIXED: Only 'Paid' expenses + ALL 'Meta/Facebook Ads' (Unpaid FB ads still count as expense)
      const totalExpenses = expDocs
        .filter(e => e.status === 'Paid' || e.category === 'Meta/Facebook Ads')
        .reduce((s,e) => s+(e.amount||0), 0);

      const netProfit = totalSales - totalCOGS - totalExpenses;

      // Stock value (all inventory, not date-filtered)
      const stockValue  = productDocs.reduce((s,p) => s+(p.currentStock||0)*(p.buyPrice||0), 0);

      // Customer & Supplier dues (always lifetime totals)
      const customerDue = customerDocs.reduce((s,d) => s+(d.totalCod||d.totalDue||0), 0);
      const supplierDue = supplierDocs.reduce((s,d) => s+(d.currentDue||d.totalDue||0), 0);

      // Cash in hand: opening + all cashBook in - all cashBook out
      const openingCash = window.appSettings?.openingCash || 0;
      const totalCashIn  = cashDocs.filter(e => (e.cashIn||0) > 0).reduce((s,e) => s+(e.cashIn||0), 0);
      const totalCashOut = cashDocs.filter(e => (e.cashOut||0) > 0).reduce((s,e) => s+(e.cashOut||0), 0);
      const cashInHand   = openingCash + totalCashIn - totalCashOut;

      // FIXED: Investment = cashBook entries with category 'Investment'
      const totalInvestment = cashDocs
        .filter(e => e.type === 'Investment' || e.category === 'Investment')
        .reduce((s,e) => s+(e.cashIn||e.amount||0), 0) || (window.appSettings?.totalInvestment || 0);

      // FIXED: Total Capital = Net Worth (NOT a manual setting)
      const totalCapital = cashInHand + stockValue + customerDue - supplierDue;

      // FIXED: ROI = ((NetWorth - Investment) / Investment) * 100
      const roi = totalInvestment > 0
        ? ((totalCapital - totalInvestment) / totalInvestment * 100).toFixed(1)
        : '0.0';

      // FIXED: Safe Buying Limit formula from original Code.gs
      const buyingLimit = Math.max(0, cashInHand + (customerDue * 0.3) - supplierDue);

      // Exp/Sales Ratio
      const expRatio = totalSales > 0 ? (totalExpenses / totalSales * 100).toFixed(1) : '0.0';

      // FIXED: Break-Even Point
      const grossProfit   = totalSales - totalCOGS;
      const breakEvenAmt  = (grossProfit > 0 && totalSales > 0)
        ? Math.round(totalExpenses / (grossProfit / totalSales)) : 0;
      const breakEvenText = `${fmt(breakEvenAmt)} (${expRatio}%)`;

      // FIXED: 30D Forecast
      const bizStart = window.appSettings?.businessStart
        ? new Date(window.appSettings.businessStart) : new Date('2026-01-01');
      const daysOld   = Math.max(1, Math.ceil((new Date() - bizStart) / 86400000));
      const forecast30 = Math.max(0, Math.round((netProfit / daysOld) * 30));

      // ── Update DOM ──
      const updates = {
        'dash-total-sales': fmt(totalSales),
        'dash-cash-hand':   fmt(cashInHand),
        'dash-stock-value': fmt(stockValue),
        'dash-expenses':    fmt(totalExpenses),
        'dash-capital':     fmt(totalCapital),
        'dash-cust-due':    fmt(customerDue),
        'dash-supp-due':    fmt(supplierDue),
        'dash-net-profit':  fmt(netProfit),
        'dash-breakeven':   breakEvenText,
        'dash-cogs':        fmt(totalCOGS),
        'dash-investment':  fmt(totalInvestment),
        'dash-roi':         roi + '%',
        'dash-forecast':    fmt(forecast30),
        'dash-safe-buying': fmt(buyingLimit),
        'dash-exp-ratio':   expRatio + '%'
      };
      Object.entries(updates).forEach(([id,val]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = val;
      });

      // Net Profit card color
      const profitCard = document.getElementById('dash-profit-card');
      if (profitCard) {
        profitCard.classList.toggle('profit-pos', netProfit >= 0);
        profitCard.classList.toggle('profit-neg', netProfit < 0);
      }

      await loadBottomCards(productDocs, salesDocs, supplierDocs);

    } catch(e) {
      console.error('Dashboard error:', e);
      toast('Dashboard error: ' + e.message, 'error');
    }
  }

  async function fetchWithRange(col, range) {
    let q = window.db.collection(col);
    if (range) q = q.where('createdAt','>=',range.from).where('createdAt','<=',range.to);
    return q.get();
  }

  async function loadBottomCards(products, sales, suppliers) {
    // Top Selling Items — aggregate from sales items
    const salesMap = {};
    sales.filter(s=>s.status!=='Returned').forEach(s => {
      const name = s.product || 'Unknown';
      salesMap[name] = (salesMap[name]||0) + (s.qty||0);
    });
    const topSelling = Object.entries(salesMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const topEl = document.getElementById('dash-top-selling');
    if (topEl) topEl.innerHTML = topSelling.length
      ? topSelling.map(([name,qty]) => `
          <div class="info-row">
            <span class="info-name">${name}</span>
            <span class="info-badge sold">${qty} Sold</span>
          </div>`).join('')
      : '<div class="empty-state" style="padding:14px"><p>No sales data yet</p></div>';

    // Low Stock Alerts
    const lowStock = products.filter(p => (p.currentStock||0) < 10)
      .sort((a,b) => (a.currentStock||0)-(b.currentStock||0)).slice(0,5);
    const lowEl = document.getElementById('dash-low-stock');
    if (lowEl) lowEl.innerHTML = lowStock.length
      ? lowStock.map(p => `
          <div class="info-row">
            <span class="info-name">${p.name}</span>
            <span class="info-badge ${(p.currentStock||0)===0?'zero':'low'}">${p.currentStock||0} left</span>
          </div>`).join('')
      : '<div class="empty-state" style="padding:14px"><p style="color:#27ae60">✓ All items well-stocked</p></div>';

    // Payable Suppliers (sorted by due amount)
    const payable = suppliers.filter(s=>(s.currentDue||s.totalDue||0)>0)
      .sort((a,b)=>(b.currentDue||b.totalDue||0)-(a.currentDue||a.totalDue||0)).slice(0,5);
    const payEl = document.getElementById('dash-payable-suppliers');
    if (payEl) payEl.innerHTML = payable.length
      ? payable.map(s => `
          <div class="info-row">
            <span class="info-name">${s.name}</span>
            <span class="info-due">${fmt(s.currentDue||s.totalDue||0)}</span>
          </div>`).join('')
      : '<div class="empty-state" style="padding:14px"><p>No pending supplier dues</p></div>';
  }

  return { load, refresh, setActivePeriod };
})();
