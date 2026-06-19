/* ===================== DASHBOARD MODULE ===================== */
const dashModule = (() => {
  let period = 'lifetime';

  // Local date string YYYY-MM-DD (no UTC offset issue)
  function localStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth()+1).padStart(2,'0');
    const d = String(dateObj.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  // Parse doc date → YYYY-MM-DD regardless of format
  function parseDocDate(v) {
    if (!v) return '';
    const s = String(v).trim();
    // DD/MM/YYYY or DD/MM/YYYY HH:MM:SS
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
      const parts = s.substring(0,10).split('/');
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    // YYYY-MM-DD
    return s.substring(0,10);
  }

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

      // Date strings for range (LOCAL, not UTC)
      let fromStr = '', toStr = '';
      if (range) {
        fromStr = localStr(range.from);
        toStr   = localStr(range.to);
      }

      // Fetch all collections
      const [salesSnap, products, customers, suppliers, cashSnap, expAllSnap] = await Promise.all([
        window.db.collection('sales').get(),
        window.db.collection('products').get(),
        window.db.collection('customers').get(),
        window.db.collection('suppliers').get(),
        window.db.collection('cashBook').get(),
        window.db.collection('expenses').get()
      ]);

      // Filter by date (handle both YYYY-MM-DD and DD/MM/YYYY stored dates)
      const filterDocs = (snap) => {
        if (!range) return snap.docs.map(d => d.data());
        return snap.docs
          .filter(d => {
            const ds = parseDocDate(d.data().date);
            return ds >= fromStr && ds <= toStr;
          })
          .map(d => d.data());
      };

      const salesDocs    = filterDocs(salesSnap);
      const productDocs  = products.docs.map(d => d.data());
      const customerDocs = customers.docs.map(d => d.data());
      const supplierDocs = suppliers.docs.map(d => d.data());
      const cashDocs     = cashSnap.docs.map(d => d.data()); // cash always lifetime
      const expAllDocs   = expAllSnap.docs.map(d => d.data());

      // Filter expenses same way
      const expDocs = range
        ? expAllDocs.filter(e => {
            const ds = parseDocDate(e.date);
            return ds >= fromStr && ds <= toStr &&
              (e.status === 'Paid' || e.category === 'Meta/Facebook Ads');
          })
        : expAllDocs.filter(e => e.status === 'Paid' || e.category === 'Meta/Facebook Ads');

      // ── Core Metrics ──
      // Match original GAS logic: exclude only "Returned", include "Adjustment" (negative amounts reduce total)
      const activeSales = salesDocs.filter(s => s.status !== 'Returned');
      const totalSales  = activeSales.reduce((s,d) => s+(d.total||0), 0);

      // COGS: calculate dynamically from product buy prices (matches GAS costMap approach)
      // This handles imported sales that have cogs=0
      const costMap = {};
      productDocs.forEach(p => {
        if (p.name) costMap[p.name.trim().toLowerCase()] = p.buyPrice || 0;
      });
      // Adjustment entries have negative qty → naturally reduces COGS (return reverses cost)
      const totalCOGS = activeSales
        .reduce((s,d) => {
          const buyPrice = costMap[(d.product||'').trim().toLowerCase()] || d.buyPrice || 0;
          return s + (d.qty||0) * buyPrice;
        }, 0);

      const totalExpenses = expDocs.reduce((s,e) => s+(e.amount||0), 0);
      const netProfit     = totalSales - totalCOGS - totalExpenses;

      // Stock (always lifetime)
      const stockValue = productDocs.reduce((s,p) => s+(p.currentStock||0)*(p.buyPrice||0), 0);

      // Customer & Supplier dues (always lifetime)
      const customerDue = customerDocs.reduce((s,d) => s+(d.totalCod||d.totalDue||0), 0);
      const supplierDue = supplierDocs.reduce((s,d) => s+(d.currentDue||d.totalDue||0), 0);

      // Cash in hand (always lifetime)
      const openingCash = window.appSettings?.openingCash || 0;
      const totalCashIn  = cashDocs.filter(e=>(e.cashIn||0)>0).reduce((s,e)=>s+(e.cashIn||0),0);
      const totalCashOut = cashDocs.filter(e=>(e.cashOut||0)>0).reduce((s,e)=>s+(e.cashOut||0),0);
      const cashInHand   = openingCash + totalCashIn - totalCashOut;

      // Investment (from cashBook Investment type, always lifetime)
      const totalInvestment = cashDocs
        .filter(e => e.type==='Investment' || e.category==='Investment')
        .reduce((s,e)=>s+(e.cashIn||e.amount||0),0) || (window.appSettings?.totalInvestment||0);

      // Capital (Net Worth, always lifetime)
      const totalCapital = cashInHand + stockValue + customerDue - supplierDue;

      // ROI
      const roi = totalInvestment > 0
        ? ((totalCapital - totalInvestment) / totalInvestment * 100).toFixed(1) : '0.0';

      // Safe Buying
      const buyingLimit = Math.max(0, cashInHand + (customerDue * 0.3) - supplierDue);

      // Ratios
      const expRatio = totalSales > 0 ? (totalExpenses / totalSales * 100).toFixed(1) : '0.0';

      // Break-Even
      const grossProfit = totalSales - totalCOGS;
      const beAmt = (grossProfit > 0 && totalSales > 0)
        ? Math.round(totalExpenses / (grossProfit / totalSales)) : 0;
      const breakEvenText = `${fmt(beAmt)} (${expRatio}%)`;

      // 30D Forecast — use period's own days (not lifetime days) so Yesterday/7days are accurate
      const bizStart = window.appSettings?.businessStart
        ? new Date(window.appSettings.businessStart) : new Date('2026-01-01');
      const periodDays = range
        ? Math.max(1, Math.round((range.to - range.from) / 86400000) + 1)
        : Math.max(1, Math.ceil((new Date() - bizStart) / 86400000));
      const forecast30 = Math.max(0, Math.round((netProfit / periodDays) * 30));

      // ── Update DOM ──
      const fmtN = v => Number(v||0).toLocaleString('en-IN', {maximumFractionDigits:0});
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

      // Profit card color
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

  async function loadBottomCards(products, sales, suppliers) {
    // Top Selling
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
      : '<div class="empty-state" style="padding:14px"><p>No sales data</p></div>';

    // Stock Status — all products sorted by stock ascending, color-coded
    const allStock = [...products].sort((a,b)=>(a.currentStock||0)-(b.currentStock||0));
    const lowEl = document.getElementById('dash-low-stock');
    if (lowEl) {
      const stockBadge = (qty) => {
        if (qty === 0) return ['zero','#e74c3c','Out of Stock'];
        if (qty < 10)  return ['low','#e67e22','Very Low'];
        if (qty < 100) return ['','#f39c12','Low Stock'];
        return ['','#27ae60','In Stock'];
      };
      lowEl.style.maxHeight = '240px';
      lowEl.style.overflowY = 'auto';
      lowEl.innerHTML = allStock.length
        ? allStock.map(p => {
            const qty = p.currentStock || 0;
            const [cls, color, label] = stockBadge(qty);
            return `<div class="info-row" style="border-bottom:1px solid #f3f4f6;padding:7px 0">
              <span class="info-name" style="font-size:13px">${p.name}</span>
              <span style="font-size:12px;font-weight:700;color:${color};background:${color}18;padding:2px 8px;border-radius:20px;white-space:nowrap">${qty} pcs</span>
            </div>`;
          }).join('')
        : '<div class="empty-state" style="padding:14px"><p>No inventory data</p></div>';
    }

    // Payable Suppliers
    const payable = suppliers.filter(s=>(s.currentDue||s.totalDue||0)>0)
      .sort((a,b)=>(b.currentDue||b.totalDue||0)-(a.currentDue||a.totalDue||0)).slice(0,5);
    const payEl = document.getElementById('dash-payable-suppliers');
    if (payEl) payEl.innerHTML = payable.length
      ? payable.map(s=>`
          <div class="info-row">
            <span class="info-name">${s.name}</span>
            <span class="info-due">${fmt(s.currentDue||s.totalDue||0)}</span>
          </div>`).join('')
      : '<div class="empty-state" style="padding:14px"><p>No pending dues</p></div>';
  }

  return { load, refresh, setActivePeriod };
})();
