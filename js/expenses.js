/* ===================== EXPENSES MODULE — with Edit + Delete ===================== */
const expensesModule = (() => {
  let allExpenses = [], curPage = 1;
  const PER_PAGE = 10;
  const CATEGORIES = ['Rent','Electricity','Salary','Transport','Internet','Tea/Snacks','Packaging','Meta/Facebook Ads','Loan Adjustment','Savings','Others'];
  let filterCategory = '', filterStatus = '', filterFrom = '', filterTo = '';
  let _reconcileCandidates = [];

  const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  async function load() { renderLayout(); await fetchExpenses(); }

  async function fetchExpenses() {
    const snap = await window.db.collection('expenses').orderBy('date','desc').get();
    allExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    curPage = 1; populateCategoryFilter(); renderTable();
  }

  function renderLayout() {
    document.getElementById('section-expenses').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1.8fr;gap:1.2rem">
      <div class="table-card" style="border-top:5px solid #e74c3c">
        <div style="padding:20px">
          <h5 style="color:#e74c3c;font-weight:700;margin-bottom:18px"><i class="bi bi-wallet2"></i> Add New Expense</h5>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Date *</label>
            <input type="date" id="expDate" class="form-control" value="${todayStr()}">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Category *</label>
            <select id="expCategory" class="form-control" onchange="expensesModule.handleCategory()">
              <option value="">-- Select Category --</option>
              ${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
            </select>
          </div>
          <div id="otherCatDiv" style="display:none;margin-bottom:12px" class="form-group">
            <label class="form-label" style="color:#3949ab">Custom Category</label>
            <input type="text" id="otherCatName" class="form-control" placeholder="Enter category">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Particulars / Detail</label>
            <input type="text" id="expDetail" class="form-control" placeholder="e.g. Shop Rent for June">
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label class="form-label">Amount (৳) *</label>
            <input type="number" id="expAmount" class="form-control" step="0.01" min="1">
          </div>
          <button id="expSubmitBtn" onclick="expensesModule.saveExpense()" class="btn btn-danger" style="width:100%;padding:12px;font-size:15px;justify-content:center">
            <i class="bi bi-check-circle"></i> Save Expense
          </button>
        </div>
      </div>
      <div class="table-card">
        <div style="padding:13px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <h5 style="font-weight:700;color:#6b7280;margin:0"><i class="bi bi-clock-history"></i> Expenses History</h5>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline btn-sm" onclick="expensesModule.previewReconcileFbAds()" title="Sync Meta/Facebook Ads Cash Book payments with expense Paid/Unpaid status"><i class="bi bi-arrow-repeat"></i> Reconcile FB Ads</button>
            <button class="btn btn-outline btn-sm" onclick="expensesModule.auditFbAds()" title="Find duplicate supplier records or mislinked Meta/FB transactions"><i class="bi bi-search"></i> Audit FB Ads</button>
            <button class="btn btn-outline btn-sm" onclick="expensesModule.printLedger()"><i class="bi bi-printer"></i> Print / Save</button>
            <button class="btn btn-outline btn-sm" onclick="expensesModule.refresh()"><i class="bi bi-arrow-clockwise"></i></button>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f6;flex-wrap:wrap">
          <select id="expFilterCategory" class="form-control" style="width:170px" onchange="expensesModule.applyFilter()">
            <option value="">All Categories</option>
          </select>
          <select id="expFilterStatus" class="form-control" style="width:120px" onchange="expensesModule.applyFilter()">
            <option value="">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">From</label>
          <input type="date" id="expFilterFrom" class="form-control" style="width:150px" onchange="expensesModule.applyFilter()">
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">To</label>
          <input type="date" id="expFilterTo" class="form-control" style="width:150px" onchange="expensesModule.applyFilter()">
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">Pick Month</label>
          <input type="month" id="expFilterMonth" class="form-control" style="width:150px" onchange="expensesModule.pickMonth(this.value)">
          <button class="btn btn-outline btn-sm" onclick="expensesModule.clearFilter()">Clear</button>
        </div>
        <div id="exp-table-wrapper" style="overflow-x:auto"><div class="loading-state">Loading…</div></div>
        <div style="padding:10px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <small id="expPageInfo" style="color:#6b7280">Page 1</small>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" id="expPrevBtn" onclick="expensesModule.changePage(-1)">◀</button>
            <button class="btn btn-outline btn-sm" id="expNextBtn" onclick="expensesModule.changePage(1)">▶</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function handleCategory() {
    const cat = document.getElementById('expCategory')?.value;
    const div = document.getElementById('otherCatDiv');
    if(div) div.style.display = cat==='Others'?'block':'none';
  }

  async function saveExpense() {
    const date   = document.getElementById('expDate')?.value;
    const catSel = document.getElementById('expCategory');
    const cat    = catSel?.value==='Others' ? document.getElementById('otherCatName')?.value.trim() : catSel?.value;
    const detail = document.getElementById('expDetail')?.value.trim();
    const amount = n(document.getElementById('expAmount')?.value);
    const btn    = document.getElementById('expSubmitBtn');
    if (!cat)    { toast('Category is required','error'); return; }
    if (!amount) { toast('Amount is required','error'); return; }
    if (!date)   { toast('Date is required','error'); return; }
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Saving…';
    try {
      const batch = window.db.batch();
      const expRef = window.db.collection('expenses').doc();
      batch.set(expRef, { category:cat, particulars:detail, amount, status:'Paid', date, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
      if (cat !== 'Meta/Facebook Ads') {
        const cbRef = window.db.collection('cashBook').doc();
        batch.set(cbRef, { type:'Expense', refId:'', particulars:`Expense: ${cat}${detail?` (${detail})`:''}`, cashIn:0, cashOut:amount, amount, date, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
      }
      await batch.commit();
      // Sync to Google Sheets
      window.SheetsSync?.expense({ date, category:cat, particulars:detail, amount, status:'Paid' });
      toast('Expense Saved!','success');
      document.getElementById('expCategory').value='';
      document.getElementById('expDetail').value='';
      document.getElementById('expAmount').value='';
      document.getElementById('expDate').value=todayStr();
      handleCategory();
      btn.disabled=false; btn.innerHTML='<i class="bi bi-check-circle"></i> Save Expense';
      await fetchExpenses();
    } catch(e) { btn.disabled=false; btn.innerHTML='<i class="bi bi-check-circle"></i> Save Expense'; toast('Error: '+e.message,'error'); }
  }

  /* ── EDIT ── */
  function showEdit(id) {
    const e = allExpenses.find(x=>x.id===id);
    if (!e) return;
    openModal('Edit Expense', `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Date *</label>
          <input type="date" id="ee-date" class="form-control" value="${e.date||todayStr()}"></div>
        <div class="form-group"><label class="form-label">Category *</label>
          <select id="ee-cat" class="form-control">
            ${CATEGORIES.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}
          </select></div>
        <div class="form-group full"><label class="form-label">Particulars</label>
          <input id="ee-detail" class="form-control" value="${e.particulars||''}"></div>
        <div class="form-group"><label class="form-label">Amount (৳) *</label>
          <input type="number" id="ee-amount" class="form-control" value="${e.amount||''}"></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select id="ee-status" class="form-control">
            <option ${(e.status||'Paid')==='Paid'?'selected':''}>Paid</option>
            <option ${e.status==='Unpaid'?'selected':''}>Unpaid</option>
          </select></div>
      </div>`,
      `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
       <button class="btn btn-danger" onclick="expensesModule.update('${id}')">Update Expense</button>`);
  }

  async function update(id) {
    const date   = document.getElementById('ee-date')?.value;
    const cat    = document.getElementById('ee-cat')?.value;
    const detail = document.getElementById('ee-detail')?.value.trim();
    const amount = n(document.getElementById('ee-amount')?.value);
    const status = document.getElementById('ee-status')?.value;
    if (!cat || !amount) { toast('Category and amount are required','error'); return; }
    try {
      await window.db.collection('expenses').doc(id).update({ category:cat, particulars:detail, amount, status, date, updatedAt:firebase.firestore.FieldValue.serverTimestamp() });
      closeModal(); toast('Expense updated!','success'); await fetchExpenses();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  /* ── DELETE ── */
  async function del(id) {
    if (!confirm('Delete this expense? This action cannot be undone.')) return;
    try {
      await window.db.collection('expenses').doc(id).delete();
      toast('Expense deleted','success'); await fetchExpenses();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  function populateCategoryFilter() {
    const sel = document.getElementById('expFilterCategory');
    if (!sel) return;
    const present = new Set(allExpenses.map(e=>e.category).filter(Boolean));
    const ordered = [...CATEGORIES.filter(c=>c!=='Others'&&present.has(c)), ...[...present].filter(c=>!CATEGORIES.includes(c)).sort()];
    sel.innerHTML = '<option value="">All Categories</option>' + ordered.map(c=>`<option value="${c}"${c===filterCategory?' selected':''}>${c}</option>`).join('');
  }

  function filteredExpenses() {
    return allExpenses.filter(e => {
      if (filterCategory && e.category!==filterCategory) return false;
      if (filterStatus && (e.status||'Paid')!==filterStatus) return false;
      if (filterFrom && e.date<filterFrom) return false;
      if (filterTo && e.date>filterTo) return false;
      return true;
    });
  }

  function applyFilter() {
    filterCategory = document.getElementById('expFilterCategory')?.value || '';
    filterStatus   = document.getElementById('expFilterStatus')?.value || '';
    filterFrom     = document.getElementById('expFilterFrom')?.value || '';
    filterTo       = document.getElementById('expFilterTo')?.value || '';
    curPage=1; renderTable();
  }

  function pickMonth(monthVal) {
    if (!monthVal) return;
    const [y,m] = monthVal.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2,'0')}-01`;
    const to   = localDate(new Date(y,m,0));
    const fEl=document.getElementById('expFilterFrom'),tEl=document.getElementById('expFilterTo');
    if(fEl)fEl.value=from; if(tEl)tEl.value=to;
    applyFilter();
  }

  function clearFilter() {
    filterCategory=''; filterStatus=''; filterFrom=''; filterTo='';
    const cEl=document.getElementById('expFilterCategory'),sEl=document.getElementById('expFilterStatus'),
          fEl=document.getElementById('expFilterFrom'),tEl=document.getElementById('expFilterTo'),mEl=document.getElementById('expFilterMonth');
    if(cEl)cEl.value=''; if(sEl)sEl.value=''; if(fEl)fEl.value=''; if(tEl)tEl.value=''; if(mEl)mEl.value='';
    curPage=1; renderTable();
  }

  function renderTable() {
    const w = document.getElementById('exp-table-wrapper');
    if (!w) return;
    const list = filteredExpenses();
    const tp = Math.ceil(list.length/PER_PAGE);
    const page = list.slice((curPage-1)*PER_PAGE, curPage*PER_PAGE);
    if (!page.length) { w.innerHTML='<div class="empty-state"><div class="empty-icon">💸</div><p>No matching expenses found</p></div>'; updatePagination(0,0); return; }
    w.innerHTML = `<table class="data-table"><thead><tr>
      <th>Date</th><th>Category</th><th>Detail</th><th>Status</th><th style="text-align:right">Amount</th><th>Actions</th>
    </tr></thead><tbody>
    ${page.map(e=>`<tr>
      <td><small style="color:#9ca3af">${fmtDate(e.date)}</small></td>
      <td><span class="badge badge-warning">${e.category||'—'}</span></td>
      <td>${e.particulars||'—'}</td>
      <td><span class="badge ${(e.status||'Paid')==='Paid'?'badge-success':'badge-danger'}">${e.status||'Paid'}</span></td>
      <td style="text-align:right;font-weight:700;color:#e74c3c">${fmt(e.amount)}</td>
      <td>
        <button class="action-btn" onclick="expensesModule.showEdit('${e.id}')" title="Edit"><i class="bi bi-pencil-square"></i></button>
        <button class="action-btn" onclick="expensesModule.del('${e.id}')" title="Delete"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join('')}
    </tbody></table>`;
    updatePagination(tp,list.length);
  }

  function updatePagination(tp,total) {
    const i=document.getElementById('expPageInfo'),p=document.getElementById('expPrevBtn'),nx=document.getElementById('expNextBtn');
    if(i) i.textContent=`Page ${curPage} of ${tp||1}${total!=null?' ('+total+' entries)':''}`;
    if(p) p.disabled=curPage===1; if(nx) nx.disabled=curPage===tp||tp===0;
  }
  function changePage(step) { const tp=Math.ceil(filteredExpenses().length/PER_PAGE),np=curPage+step; if(np>=1&&np<=tp){curPage=np;renderTable();} }
  async function refresh() { await fetchExpenses(); }

  /* ── Print / Save Ledger (respects current category/status/date filter) ── */
  function printLedger() {
    const rows = [...filteredExpenses()].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    if (!rows.length) { toast('কোনো ডেটা নেই','error'); return; }

    const totalAmount  = rows.reduce((s,e)=>s+(e.amount||0),0);
    const paidAmount   = rows.filter(e=>(e.status||'Paid')==='Paid').reduce((s,e)=>s+(e.amount||0),0);
    const unpaidAmount = rows.filter(e=>e.status==='Unpaid').reduce((s,e)=>s+(e.amount||0),0);
    const catLabel    = filterCategory || 'All Categories';
    const statusLabel = filterStatus || 'All Status';
    const rangeLabel  = (filterFrom||filterTo) ? `${filterFrom?fmtDate(filterFrom):'Start'} – ${filterTo?fmtDate(filterTo):'Today'}` : 'Lifetime';
    const today = new Date().toLocaleDateString('en-BD',{day:'2-digit',month:'long',year:'numeric'});

    const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Expense Ledger — ${catLabel}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
  .tk{font-family:'Noto Sans Bengali','Inter',Arial,sans-serif}
  .page{max-width:920px;margin:0 auto;padding:30px 36px}
  .hdr{border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end}
  h1{font-size:19px;font-weight:800;color:#1e3a5f}
  .sub{font-size:11px;color:#64748b;margin-top:3px}
  .summary{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
  .sum-card{flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;border-left:4px solid}
  .sum-label{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .sum-val{font-size:18px;font-weight:800;margin-top:3px;font-family:'Noto Sans Bengali','Inter',Arial,sans-serif}
  table{width:100%;border-collapse:collapse}
  th{background:#1e3a5f;color:#fff;padding:8px 12px;font-size:11px;font-weight:700;text-align:left}
  th.r{text-align:right}
  td{padding:7px 12px;border-bottom:1px solid #e9ecef;font-size:12px}
  tr.unpaid td{background:#fef2f2}
  .r{text-align:right}
  .footer{border-top:1px solid #e9ecef;padding-top:12px;margin-top:18px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
  .no-print{background:#1e3a5f;color:#fff;padding:10px 36px;display:flex;gap:10px;align-items:center}
  .bp{background:#fff;color:#1e3a5f;border:none;padding:7px 18px;border-radius:6px;font-weight:800;cursor:pointer;font-size:12px}
  .bg{background:#22c55e;color:#fff;border:none;padding:7px 18px;border-radius:6px;font-weight:800;cursor:pointer;font-size:12px}
  @media print{.no-print{display:none}@page{margin:1cm;size:A4}}
</style></head><body>
<div class="no-print">
  <button class="bp" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button class="bg" onclick="dlImg()">📷 Download as Image</button>
</div>
<div class="page" id="rpt">
  <div class="hdr">
    <div>
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">GentiX Fashion ERP</div>
      <h1>Expense Ledger — ${catLabel}</h1>
      <div class="sub">Status: ${statusLabel} &nbsp;·&nbsp; Period: ${rangeLabel}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b"><strong>Generated:</strong> ${today}</div>
  </div>

  <div class="summary">
    <div class="sum-card" style="border-left-color:#3949ab"><div class="sum-label">Transactions</div><div class="sum-val">${rows.length}</div></div>
    <div class="sum-card" style="border-left-color:#e74c3c"><div class="sum-label">Total Amount</div><div class="sum-val tk" style="color:#e74c3c">${fmt(totalAmount)}</div></div>
    <div class="sum-card" style="border-left-color:#27ae60"><div class="sum-label">Paid</div><div class="sum-val tk" style="color:#27ae60">${fmt(paidAmount)}</div></div>
    <div class="sum-card" style="border-left-color:${unpaidAmount>0?'#f59e0b':'#27ae60'}"><div class="sum-label">Unpaid</div><div class="sum-val tk" style="color:${unpaidAmount>0?'#f59e0b':'#27ae60'}">${fmt(unpaidAmount)}</div></div>
  </div>

  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Particulars</th><th>Status</th><th class="r">Amount</th></tr></thead>
    <tbody>
      ${rows.map(e=>`<tr class="${e.status==='Unpaid'?'unpaid':''}">
        <td style="white-space:nowrap;color:#6b7280">${fmtDate(e.date)}</td>
        <td>${e.category||'—'}</td>
        <td>${e.particulars||'—'}</td>
        <td>${e.status||'Paid'}</td>
        <td class="r tk" style="font-weight:700;color:#e74c3c">${fmt(e.amount)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer"><div>GentiX Fashion ERP — Expense Ledger Report</div><div>${today}</div></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script>
async function dlImg(){
  const np=document.querySelectorAll('.no-print');
  np.forEach(e=>e.style.display='none');
  const c=await html2canvas(document.getElementById('rpt'),{scale:2,backgroundColor:'#fff',useCORS:true});
  np.forEach(e=>e.style.display='flex');
  const a=document.createElement('a');
  a.download='Expense_Ledger_${catLabel.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().substring(0,10)}.png';
  a.href=c.toDataURL('image/png');a.click();
}
</script>
</body></html>`;

    const win=window.open('','_blank','width=1000,height=750,scrollbars=yes');
    win.document.write(html); win.document.close();
  }

  /* ── Audit FB Ads: find data-integrity issues that would make Reconcile's numbers wrong ──
     Reconcile trusts (a) there's exactly one "Meta/Facebook Ads" supplier record and (b) every real
     Cash Book payment to it is a clean `type:'Supplier'` entry with `refId` pointing at that record.
     If either assumption breaks — a duplicate supplier doc, or a payment logged as a different type,
     or with a typo'd category — Reconcile will silently under/over-count. This is read-only: it just
     surfaces suspects for a human to judge, since deciding whether a stray entry "really" belongs to
     Meta/Facebook Ads needs judgment this tool can't make on its own. Once a human confirms a stray
     entry IS a real Meta/Facebook Ads payment, "Relink" converts it into a proper Supplier payment
     (type:'Supplier', refId: the supplier) so Reconcile picks it up on the next run. */
  let _auditSupplierId = '';

  async function auditFbAds() {
    try {
      const suppSnap = await window.db.collection('suppliers').where('name','==','Meta/Facebook Ads').get();
      const supplierDocs = suppSnap.docs.map(d=>({id:d.id,...d.data()}));
      const supplierIds = supplierDocs.map(s=>s.id);
      _auditSupplierId = supplierDocs[0]?.id || '';

      const [cbAllSnap, expAllSnap] = await Promise.all([
        window.db.collection('cashBook').get(),
        window.db.collection('expenses').get()
      ]);
      const allCb  = cbAllSnap.docs.map(d=>({id:d.id,...d.data()}));
      const allExp = expAllSnap.docs.map(d=>({id:d.id,...d.data()}));

      const kw = /meta|facebook|\bfb\b/i;

      // Cash Book entries that mention Meta/Facebook/FB but aren't a clean Supplier payment to a known Meta supplier id
      const unlinkedCb = allCb.filter(c => kw.test(c.particulars||'') && !(c.type==='Supplier' && supplierIds.includes(c.refId)));
      const unlinkedCbTotal = unlinkedCb.reduce((s,c)=>s+(c.cashOut||c.amount||0),0);

      // Expense entries whose category resembles Meta/Facebook Ads but isn't an exact match (would be silently excluded from lifetime-spent calc)
      const unlinkedExp = allExp.filter(e => { const cat=(e.category||'').trim(); return kw.test(cat) && cat!=='Meta/Facebook Ads'; });
      const unlinkedExpTotal = unlinkedExp.reduce((s,e)=>s+(e.amount||0),0);

      openModal('Audit: Meta/Facebook Ads Data Integrity', `
        <div style="margin-bottom:16px">
          <strong style="font-size:13px">Supplier records named "Meta/Facebook Ads":</strong> ${supplierDocs.length}
          ${supplierDocs.length>1
            ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-top:8px;color:#991b1b;font-size:13px"><i class="bi bi-exclamation-triangle-fill"></i> <strong>${supplierDocs.length}টি duplicate supplier record</strong> paoya geche! Cash Book-er kono payment ekটার against jete pare r Dashboard onno ekটার currentDue dekhay — eta boro mismatch-er karon hote pare.</div>`
            : `<div style="color:#27ae60;font-size:13px;margin-top:4px"><i class="bi bi-check-circle-fill"></i> Duplicate nei.</div>`}
          ${supplierDocs.map(s=>`<div style="font-size:12px;color:#6b7280;margin-top:4px">ID: <code>${s.id}</code> — currentDue: ${fmt(s.currentDue||0)}</div>`).join('')}
        </div>

        <div style="margin-bottom:16px">
          <strong style="font-size:13px">Cash Book-e "Meta/Facebook/FB" shobdo ache emon transaction, kintu Supplier Payment hishebe properly linked na:</strong> ${unlinkedCb.length}
          ${unlinkedCb.length ? `
          <div style="max-height:220px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-top:8px">
            <table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Particulars</th><th style="text-align:right">Cash Out</th><th>Action</th></tr></thead>
            <tbody>${unlinkedCb.map(c=>`<tr>
              <td style="white-space:nowrap;color:#6b7280">${fmtDate(c.date)}</td>
              <td>${c.type||'—'}</td>
              <td>${c.particulars||'—'}</td>
              <td style="text-align:right;font-weight:700;color:#e74c3c">${fmt(c.cashOut||c.amount||0)}</td>
              <td>${_auditSupplierId?`<button class="btn btn-outline btn-sm" onclick="expensesModule.relinkCashBookToFbAds('${c.id}')">Relink</button>`:'—'}</td>
            </tr>`).join('')}</tbody></table>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#9ca3af">Mot: ${fmt(unlinkedCbTotal)} — real FB ad payment hole "Relink" click korun, tahole eta Meta/Facebook Ads-er proper Supplier Payment hishebe count hobe. Tarpor "Reconcile FB Ads" abar chalan.</div>`
            : `<div style="color:#27ae60;font-size:13px;margin-top:4px"><i class="bi bi-check-circle-fill"></i> Kichu paoya jayni — shob FB-related Cash Book entry thik link kora ache.</div>`}
        </div>

        <div>
          <strong style="font-size:13px">Expense-e "Meta/Facebook/FB" shobdo ache emon category, kintu "Meta/Facebook Ads" exact match na (miscategorized hote pare):</strong> ${unlinkedExp.length}
          ${unlinkedExp.length ? `
          <div style="max-height:220px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-top:8px">
            <table class="data-table"><thead><tr><th>Date</th><th>Category</th><th>Particulars</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${unlinkedExp.map(e=>`<tr>
              <td style="white-space:nowrap;color:#6b7280">${fmtDate(e.date)}</td>
              <td>${e.category||'—'}</td>
              <td>${e.particulars||'—'}</td>
              <td style="text-align:right;font-weight:700;color:#e74c3c">${fmt(e.amount||0)}</td>
            </tr>`).join('')}</tbody></table>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#9ca3af">Mot: ${fmt(unlinkedExpTotal)}</div>`
            : `<div style="color:#27ae60;font-size:13px;margin-top:4px"><i class="bi bi-check-circle-fill"></i> Kichu paoya jayni.</div>`}
        </div>`,
        `<button class="btn btn-outline" onclick="closeModal()">Close</button>`,
        'modal-lg');
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function relinkCashBookToFbAds(cbId) {
    if (!_auditSupplierId) { toast('Meta/Facebook Ads supplier ID paoya jayni','error'); return; }
    if (!confirm('Ei transaction-take Meta/Facebook Ads-er Supplier Payment hishebe relink korte chan?\n\nEr por "Reconcile FB Ads" abar chalale eta due calculation-e count hobe.')) return;
    try {
      await window.db.collection('cashBook').doc(cbId).update({
        type: 'Supplier', refId: _auditSupplierId,
        relinkedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('Relink kora hoyeche! Ekhon "Reconcile FB Ads" chalan due thik korar jonno.','success');
      await auditFbAds();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  /* ── Reconcile FB Ads: sync Cash Book payments to Meta/Facebook Ads with expense Paid/Unpaid status
     AND correct any drift in the supplier's currentDue ──
     Cash Book payments to a supplier only decrement the supplier's aggregate currentDue — they never
     touch the individual `expenses` line items created by the FB Ad Tracker. Also, currentDue is only
     ever incremented if the "Meta/Facebook Ads" supplier record already existed at the time an ad spend
     was logged (fbtracker.js silently skips the increment otherwise) — so currentDue can drift below the
     true lifetime total even when the Paid/Unpaid flags are accurate. This tool recomputes the correct
     due directly from source (lifetime spent − lifetime paid), fixes the supplier record to match, and
     marks the oldest unpaid transactions as Paid (whole-transaction only, oldest-first) up to whatever
     portion of the lifetime payment total isn't already reflected in Paid expenses. */
  let _reconcileSupplierId = '', _reconcileCorrectDue = 0;

  async function previewReconcileFbAds() {
    try {
      const suppSnap = await window.db.collection('suppliers').where('name','==','Meta/Facebook Ads').get();
      if (suppSnap.empty) { toast('Meta/Facebook Ads supplier khuje pawa jayni (Suppliers module dekhun)','error'); return; }
      const supplierDoc = suppSnap.docs[0];
      const supplierId = supplierDoc.id;
      const recordedDue = supplierDoc.data().currentDue || 0;

      const cbSnap = await window.db.collection('cashBook').where('type','==','Supplier').where('refId','==',supplierId).get();
      const lifetimePaid = cbSnap.docs.reduce((s,d)=>s+(d.data().cashOut||d.data().amount||0),0);

      const fbExpenses = allExpenses.filter(e=>e.category==='Meta/Facebook Ads');
      const lifetimeSpent = fbExpenses.reduce((s,e)=>s+(e.amount||0),0);
      const alreadyPaid = fbExpenses.filter(e=>(e.status||'Paid')==='Paid').reduce((s,e)=>s+(e.amount||0),0);
      const correctDue = lifetimeSpent - lifetimePaid;
      const dueDrift = recordedDue - correctDue;

      const unpaidList = fbExpenses.filter(e=>e.status==='Unpaid').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const unreconciled = lifetimePaid - alreadyPaid;
      _reconcileCandidates = [];
      let remaining = Math.max(0, unreconciled);
      for (const exp of unpaidList) {
        if ((exp.amount||0) > remaining) break;
        _reconcileCandidates.push(exp);
        remaining -= (exp.amount||0);
      }
      const coveredTotal = _reconcileCandidates.reduce((s,e)=>s+(e.amount||0),0);
      _reconcileSupplierId = Math.abs(dueDrift)>1 ? supplierId : '';
      _reconcileCorrectDue = correctDue;

      if (!_reconcileCandidates.length && Math.abs(dueDrift)<=1) {
        openModal('Reconcile FB Ads Payment Status', `
          <div style="padding:10px 0;color:#27ae60;font-weight:600"><i class="bi bi-check-circle-fill"></i> Already accurate — lifetime spent (${fmt(lifetimeSpent)}) − lifetime paid (${fmt(lifetimePaid)}) already matches recorded Due ebong Paid/Unpaid status. Notun kono action lagbe na.</div>`,
          `<button class="btn btn-outline" onclick="closeModal()">Close</button>`);
        return;
      }

      openModal('Reconcile FB Ads Payment Status', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;border-left:3px solid #3949ab">
            <small style="color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;display:block">Lifetime Spent</small>
            <strong style="font-size:16px;color:#3949ab">${fmt(lifetimeSpent)}</strong>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;border-left:3px solid #27ae60">
            <small style="color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;display:block">Lifetime Paid (Cash Book)</small>
            <strong style="font-size:16px;color:#27ae60">${fmt(lifetimePaid)}</strong>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;border-left:3px solid ${Math.abs(dueDrift)>1?'#e74c3c':'#27ae60'}">
            <small style="color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;display:block">Dashboard Due (recorded)</small>
            <strong style="font-size:16px;color:${Math.abs(dueDrift)>1?'#e74c3c':'#27ae60'}">${fmt(recordedDue)}</strong>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;border-left:3px solid #3949ab">
            <small style="color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;display:block">Correct Due (recalculated)</small>
            <strong style="font-size:16px;color:#3949ab">${fmt(correctDue)}</strong>
          </div>
        </div>
        ${Math.abs(dueDrift)>1?`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:14px;color:#991b1b;font-size:13px">
          <i class="bi bi-exclamation-triangle-fill"></i> Dashboard-e dekhano Due, accurate hisheb theke ${fmt(Math.abs(dueDrift))} ${dueDrift>0?'beshi':'kom'} dekhachhe — shombhoboto kichu purono FB Ad expense "Meta/Facebook Ads" supplier record create howar age log hoyeche, tai currentDue-e jog hoyni. Apply korle eta ${fmt(correctDue)}-e correct hoye jabe.
        </div>`:''}
        ${_reconcileCandidates.length?`<p style="font-size:13px;color:#374151;margin-bottom:10px">Nicher <strong>${_reconcileCandidates.length}টি</strong> shobcheye purono unpaid transaction (mot ${fmt(coveredTotal)}) <strong>Paid</strong> hishebe mark kora hobe:</p>
        <div style="max-height:220px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px">
          <table class="data-table"><thead><tr><th>Date</th><th>Particulars</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>
            ${_reconcileCandidates.map(e=>`<tr>
              <td style="white-space:nowrap;color:#6b7280">${fmtDate(e.date)}</td>
              <td>${e.particulars||'—'}</td>
              <td style="text-align:right;font-weight:700;color:#e74c3c">${fmt(e.amount)}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>
        ${remaining>0?`<p style="font-size:12px;color:#9ca3af;margin-top:8px">Baki ${fmt(remaining)} kono purbo transaction-e pura cover hocche na, tai chhoa hoyni.</p>`:''}`:`<p style="font-size:13px;color:#9ca3af">Paid/Unpaid status already accurate ache — shudhu Due value-ta correct kora hobe.</p>`}`,
        `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
         <button class="btn btn-primary" onclick="expensesModule.applyReconcileFbAds()"><i class="bi bi-check-circle"></i> Confirm &amp; Apply</button>`,
        'modal-lg');
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function applyReconcileFbAds() {
    if (!_reconcileCandidates.length && !_reconcileSupplierId) { closeModal(); return; }
    try {
      const batch = window.db.batch();
      _reconcileCandidates.forEach(exp => {
        batch.update(window.db.collection('expenses').doc(exp.id), { status:'Paid', reconciledAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      if (_reconcileSupplierId) {
        batch.update(window.db.collection('suppliers').doc(_reconcileSupplierId), { currentDue: _reconcileCorrectDue });
      }
      await batch.commit();
      const total = _reconcileCandidates.reduce((s,e)=>s+(e.amount||0),0);
      closeModal();
      const parts = [];
      if (_reconcileCandidates.length) parts.push(`${_reconcileCandidates.length}টি transaction (${fmt(total)}) Paid mark`);
      if (_reconcileSupplierId) parts.push(`Due correct kore ${fmt(_reconcileCorrectDue)}`);
      toast(parts.join(' + ')+' করা হয়েছে','success');
      _reconcileCandidates = []; _reconcileSupplierId=''; _reconcileCorrectDue=0;
      await fetchExpenses();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  return { load, handleCategory, saveExpense, showEdit, update, del, changePage, refresh, applyFilter, pickMonth, clearFilter, printLedger, previewReconcileFbAds, applyReconcileFbAds, auditFbAds, relinkCashBookToFbAds };
})();
