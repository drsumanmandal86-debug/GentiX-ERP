/* ===================== CSV IMPORT MODULE =====================
   Google Sheets → CSV download → এই tool দিয়ে Firebase-এ import
================================================================= */
window.ImportTool = (() => {

  // ── CSV Parser ──
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
    if (lines.length < 2) return [];
    return lines.slice(1).map(line => {
      const cols = []; let field = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { cols.push(field.trim().replace(/^"|"$/g,'')); field = ''; }
        else { field += c; }
      }
      cols.push(field.trim().replace(/^"|"$/g,''));
      return cols;
    }).filter(r => r.some(c => c !== ''));
  }

  // ── Batch write to Firestore (500 per batch) ──
  async function batchWrite(collection, docs, progressFn) {
    const BATCH = 400;
    let done = 0;
    for (let i = 0; i < docs.length; i += BATCH) {
      const chunk = docs.slice(i, i + BATCH);
      const batch = window.db.batch();
      chunk.forEach(d => {
        const id = d._id; delete d._id;
        const ref = id ? window.db.collection(collection).doc(id) : window.db.collection(collection).doc();
        batch.set(ref, { ...d, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      done += chunk.length;
      if (progressFn) progressFn(done, docs.length);
    }
    return done;
  }

  const n = v => parseFloat(String(v).replace(/[৳,\s]/g,'')) || 0;
  const s = v => String(v||'').trim();

  // Convert any date format → YYYY-MM-DD
  // Handles: DD/MM/YYYY, DD/MM/YYYY HH:MM:SS, YYYY-MM-DD, Date objects
  const d = v => {
    try {
      if (!v) return '';
      // Google Sheets Date object → ISO
      if (v instanceof Date) {
        return v.toISOString().substring(0,10);
      }
      const str = String(v).trim();
      if (!str) return '';
      // Already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0,10);
      // DD/MM/YYYY or DD/MM/YYYY HH:MM:SS (Google Sheets default)
      const parts = str.substring(0,10).split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year.padStart(4,'0')}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
      }
      return str.substring(0,10);
    } catch(e) { return ''; }
  };;

  // ── Collection mappers (Google Sheet columns → Firestore fields) ──
  const MAPPERS = {
    // Sales: Date | CustID | Product | Qty | Price | Total | Status | SaleID
    sales: rows => rows.map((r,i) => ({
      _id: s(r[7]) || ('SL-IMP-'+i),
      saleId: s(r[7]) || ('SL-IMP-'+i),
      date: d(r[0]), customerId: s(r[1]), customerName: s(r[1]),
      product: s(r[2]), qty: n(r[3]), price: n(r[4]),
      total: n(r[5]), cogs: 0, status: s(r[6])||'Active'
    })).filter(r => r.product || r.saleId),

    // Purchases: Date | SupplierID | Product | Qty | Price | Total
    purchases: rows => rows.map((r,i) => ({
      _id: 'PUR-IMP-'+i,
      date: d(r[0]), supplierId: s(r[1]), supplierName: s(r[1]),
      product: s(r[2]), qty: n(r[3]), price: n(r[4]), total: n(r[5])
    })).filter(r => r.product),

    // Expenses: Date | ID | Category | Particulars | Amount | Status
    expenses: rows => rows.map((r,i) => ({
      _id: s(r[1]) || ('EXP-IMP-'+i),
      date: d(r[0]), category: s(r[2]),
      particulars: s(r[3]), amount: n(r[4]),
      status: s(r[5])||'Paid'
    })).filter(r => r.amount > 0),

    // Cash Book: Date | RefID | Particulars | CashIn | CashOut | Type | Balance
    cashBook: rows => rows.map((r,i) => ({
      _id: 'CB-IMP-'+i,
      date: d(r[0]), refId: s(r[1]), particulars: s(r[2]),
      cashIn: n(r[3]), cashOut: n(r[4]), type: s(r[5]),
      amount: n(r[3])||n(r[4])
    })).filter(r => r.cashIn > 0 || r.cashOut > 0),

    // Inventory: Date | ID | Name | Category | Subcategory | Price | Qty
    products: rows => rows.map((r,i) => ({
      _id: s(r[1]) || ('PRD-IMP-'+i),
      name: s(r[2]), category: s(r[3]), subcategory: s(r[4]),
      buyPrice: n(r[5]), sellPrice: n(r[5]),
      currentStock: n(r[6]), minStock: 10, unit: 'pcs'
    })).filter(r => r.name),

    // Customers: Date | ID | Name | Phone | Address | TotalOrder | TotalCOD
    customers: rows => rows.map((r,i) => ({
      _id: s(r[1]) || ('CUST-IMP-'+i),
      name: s(r[2]), phone: s(r[3]), address: s(r[4]),
      totalOrder: n(r[5]), totalCod: n(r[6])
    })).filter(r => r.name),

    // Suppliers: Date | ID | Name | Phone | Address | Due
    suppliers: rows => rows.map((r,i) => ({
      _id: s(r[1]) || ('SUP-IMP-'+i),
      name: s(r[2]), phone: s(r[3]), address: s(r[4]),
      currentDue: n(r[5]), totalPurchase: 0
    })).filter(r => r.name),

    // Personal Ledger: Date | Name | Note | CashIn | CashOut | Balance
    personalLedger: rows => rows.map((r,i) => ({
      _id: 'PL-IMP-'+i,
      date: d(r[0]), personName: s(r[1]), note: s(r[2]),
      cashIn: n(r[3]), cashOut: n(r[4]), runBalance: n(r[5])
    })).filter(r => r.personName),

    // FB_Ad_Settings: Ad Name | Status | Lifetime Spent
    // NOTE: Firestore doc IDs cannot contain '/' — replace with '-'
    fbAdSettings: rows => rows.map((r,i) => {
      const name = s(r[0]);
      const safeId = name.replace(/\//g,'-').replace(/[.#$[\]]/g,'_').substring(0,100) || ('AD-IMP-'+i);
      return { _id: safeId, name, status: s(r[1])||'Active', lifetimeSpent: n(r[2]) };
    }).filter(r => r.name),

    // FB_Ad_Logs: Date | Ad Name | Lifetime USD | Daily USD | Rate | Total BDT
    fbAdLogs: rows => rows.map((r,i) => ({
      _id: 'FBLOG-IMP-'+i,
      date: d(r[0]), adName: s(r[1]),
      lifetimeSpent: n(r[2]), dailyUSD: n(r[3]),
      rate: n(r[4])||129, totalBDT: n(r[5])
    })).filter(r => r.adName)
  };

  const LABELS = {
    sales: 'Sales', purchases: 'Purchases', expenses: 'Expenses',
    cashBook: 'Cash Book', products: 'Inventory', customers: 'Customers',
    suppliers: 'Suppliers', personalLedger: 'Personal Ledger',
    fbAdSettings: 'FB Ad Settings', fbAdLogs: 'FB Ad Logs'
  };

  // ── Render the import UI in Settings ──
  function renderImportUI(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div style="border:2px solid #dbeafe;border-radius:12px;overflow:hidden;margin-bottom:14px">
        <div style="background:#eff6ff;padding:14px 16px;border-bottom:1px solid #dbeafe;display:flex;align-items:center;gap:8px">
          <i class="bi bi-file-earmark-arrow-up" style="color:#3949ab;font-size:18px"></i>
          <div>
            <h6 style="font-weight:700;font-size:14px;color:#1e40af;margin:0">Google Sheets → Firebase Import</h6>
            <small style="color:#6b7280">CSV download করে এখানে import করুন</small>
          </div>
        </div>
        <div style="padding:16px">
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12.5px;color:#92400e">
            <strong>কীভাবে করবেন:</strong><br>
            Google Sheet → যে tab import করতে চান → <strong>File → Download → Comma Separated Values (.csv)</strong> → নিচে সেই collection select করে file choose করুন
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="importCards">
            ${Object.entries(LABELS).map(([col, label]) => `
            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fff">
              <div style="font-weight:600;font-size:13px;color:#374151;margin-bottom:8px">
                ${getIcon(col)} ${label}
                <span id="imp-count-${col}" style="font-size:11px;color:#27ae60;margin-left:6px"></span>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <input type="file" id="imp-file-${col}" accept=".csv" style="font-size:11px;flex:1;border:1px solid #e5e7eb;border-radius:5px;padding:4px">
                <button onclick="ImportTool.importCSV('${col}')" class="btn btn-primary btn-sm" style="white-space:nowrap;font-size:12px;padding:5px 10px">
                  <i class="bi bi-upload"></i> Import
                </button>
              </div>
              <div id="imp-bar-${col}" style="display:none;margin-top:6px">
                <div style="background:#e5e7eb;border-radius:4px;height:5px;overflow:hidden">
                  <div id="imp-prog-${col}" style="background:#3949ab;height:100%;width:0%;transition:width .3s"></div>
                </div>
                <small id="imp-msg-${col}" style="font-size:11px;color:#6b7280"></small>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  function getIcon(col) {
    const icons = { sales:'🛒', purchases:'🛍️', expenses:'💸', cashBook:'📒',
      products:'📦', customers:'👥', suppliers:'🏭', personalLedger:'📔',
      fbAdSettings:'📘', fbAdLogs:'📊' };
    return icons[col] || '📄';
  }

  // ── Main import function ──
  async function importCSV(collection) {
    const fileEl = document.getElementById('imp-file-' + collection);
    if (!fileEl || !fileEl.files[0]) { toast('CSV file select করুন','error'); return; }

    const file = fileEl.files[0];
    const barEl = document.getElementById('imp-bar-' + collection);
    const progEl = document.getElementById('imp-prog-' + collection);
    const msgEl = document.getElementById('imp-msg-' + collection);
    const countEl = document.getElementById('imp-count-' + collection);

    if (barEl) barEl.style.display = 'block';
    if (msgEl) msgEl.textContent = 'Reading CSV…';

    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows.length) { toast('CSV-তে কোনো data নেই','error'); return; }

    const mapper = MAPPERS[collection];
    if (!mapper) { toast('Unknown collection','error'); return; }

    const docs = mapper(rows);
    if (!docs.length) { toast('Valid rows পাওয়া যায়নি — column order check করুন','warning'); return; }

    if (msgEl) msgEl.textContent = `${docs.length} rows importing…`;

    try {
      const imported = await batchWrite(collection, docs, (done, total) => {
        const pct = Math.round(done/total*100);
        if (progEl) progEl.style.width = pct + '%';
        if (msgEl) msgEl.textContent = `${done}/${total} (${pct}%)`;
      });

      if (progEl) progEl.style.width = '100%';
      if (progEl) progEl.style.background = '#27ae60';
      if (msgEl) msgEl.textContent = `✓ Done!`;
      if (countEl) countEl.textContent = `✓ ${imported} imported`;
      toast(`${LABELS[collection]}: ${imported} records imported!`, 'success');
      fileEl.value = '';
    } catch(e) {
      if (msgEl) msgEl.textContent = 'Error: ' + e.message;
      toast('Import error: ' + e.message, 'error');
    }
  }

  return { renderImportUI, importCSV };
})();
