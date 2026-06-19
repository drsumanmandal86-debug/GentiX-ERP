/* ===================== EXPENSES MODULE — with Edit + Delete ===================== */
const expensesModule = (() => {
  let allExpenses = [], curPage = 1;
  const PER_PAGE = 10;

  async function load() { renderLayout(); await fetchExpenses(); }

  async function fetchExpenses() {
    const snap = await window.db.collection('expenses').orderBy('date','desc').get();
    allExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    curPage = 1; renderTable();
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
              <option>Rent</option><option>Electricity</option><option>Salary</option>
              <option>Transport</option><option>Internet</option><option>Tea/Snacks</option>
              <option>Packaging</option><option>Meta/Facebook Ads</option>
              <option>Loan Adjustment</option><option>Savings</option><option>Others</option>
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
          <button class="btn btn-outline btn-sm" onclick="expensesModule.refresh()"><i class="bi bi-arrow-clockwise"></i></button>
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
    const cats = ['Rent','Electricity','Salary','Transport','Internet','Tea/Snacks','Packaging','Meta/Facebook Ads','Loan Adjustment','Savings','Others'];
    openModal('Edit Expense', `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Date *</label>
          <input type="date" id="ee-date" class="form-control" value="${e.date||todayStr()}"></div>
        <div class="form-group"><label class="form-label">Category *</label>
          <select id="ee-cat" class="form-control">
            ${cats.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}
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

  function renderTable() {
    const w = document.getElementById('exp-table-wrapper');
    if (!w) return;
    const tp = Math.ceil(allExpenses.length/PER_PAGE);
    const page = allExpenses.slice((curPage-1)*PER_PAGE, curPage*PER_PAGE);
    if (!page.length) { w.innerHTML='<div class="empty-state"><div class="empty-icon">💸</div><p>No expenses recorded</p></div>'; updatePagination(0); return; }
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
    updatePagination(tp);
  }

  function updatePagination(tp) {
    const i=document.getElementById('expPageInfo'),p=document.getElementById('expPrevBtn'),nx=document.getElementById('expNextBtn');
    if(i) i.textContent=`Page ${curPage} of ${tp||1}`;
    if(p) p.disabled=curPage===1; if(nx) nx.disabled=curPage===tp||tp===0;
  }
  function changePage(step) { const tp=Math.ceil(allExpenses.length/PER_PAGE),np=curPage+step; if(np>=1&&np<=tp){curPage=np;renderTable();} }
  async function refresh() { await fetchExpenses(); }

  return { load, handleCategory, saveExpense, showEdit, update, del, changePage, refresh };
})();
