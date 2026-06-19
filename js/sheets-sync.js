/* ===================== GOOGLE SHEETS SYNC MODULE =====================
   Firebase web app → Google Apps Script Web App → Google Sheets

   কীভাবে কাজ করে:
   1. Firebase-এ data save হয়
   2. Background-এ GAS Web App URL-এ POST করে
   3. GAS আপনার existing Sheet-এ row append করে
   4. Sync fail হলেও app বন্ধ হবে না
================================================================= */

window.SheetsSync = (() => {

  // GAS Web App URL — Settings থেকে পড়ে
  function getUrl() {
    return window.appSettings?.sheetsWebAppUrl || '';
  }

  // Core sync function — fire-and-forget (background)
  async function sync(type, data) {
    const url = getUrl();
    if (!url || url.trim() === '') return; // URL না থাকলে skip

    try {
      await fetch(url, {
        method: 'POST',
        // 'no-cors' — GAS CORS restriction bypass, response পড়া যাবে না কিন্তু data যাবে
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type, data })
      });
      console.log('[Sheets Sync] ✓', type);
    } catch (e) {
      // Silent fail — Firestore save already done, sheet sync optional
      console.warn('[Sheets Sync] Background sync skipped:', e.message);
    }
  }

  // ── Public sync methods (called from each module after Firebase save) ──

  /** Sale recorded */
  const sale = (d) => sync('sale', {
    date: d.date, saleId: d.saleId, customerId: d.customerId,
    product: d.product, qty: d.qty, price: d.price,
    total: d.total, status: d.status || 'Active'
  });

  /** Purchase recorded */
  const purchase = (d) => sync('purchase', {
    date: d.date, supplierId: d.supplierId,
    product: d.product, qty: d.qty, price: d.price, total: d.total
  });

  /** Expense recorded */
  const expense = (d) => sync('expense', {
    date: d.date, category: d.category,
    particulars: d.particulars, amount: d.amount, status: d.status || 'Paid'
  });

  /** Cash Book entry */
  const cashBook = (d) => sync('cashbook', {
    date: d.date, refId: d.refId, particulars: d.particulars,
    cashIn: d.cashIn || 0, cashOut: d.cashOut || 0, type: d.type
  });

  /** New product added to Inventory */
  const inventory = (d) => sync('inventory_add', {
    name: d.name, category: d.category, subcategory: d.subcategory,
    buyPrice: d.buyPrice, currentStock: d.currentStock
  });

  /** New customer added */
  const customer = (d) => sync('customer_add', {
    name: d.name, phone: d.phone, address: d.address
  });

  /** New supplier added */
  const supplier = (d) => sync('supplier_add', {
    name: d.name, phone: d.phone, address: d.address
  });

  /** Personal Ledger entry */
  const personalLedger = (d) => sync('personal_ledger', {
    date: d.date, personName: d.personName,
    note: d.note, cashIn: d.cashIn || 0, cashOut: d.cashOut || 0
  });

  /** FB Ad daily log */
  const fbLog = (d) => sync('fb_log', {
    date: d.date, adName: d.adName, lifetimeSpent: d.lifetimeSpent,
    dailyUSD: d.dailyUSD, rate: d.rate, totalBDT: d.totalBDT
  });

  /** New FB Ad created */
  const fbAdAdd = (d) => sync('fb_ad_add', {
    name: d.name, status: d.status, lifetimeSpent: d.lifetimeSpent || 0
  });

  return { sale, purchase, expense, cashBook, inventory, customer, supplier, personalLedger, fbLog, fbAdAdd };
})();
