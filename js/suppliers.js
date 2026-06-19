/* ===================== SUPPLIERS MODULE (matching original: totalPurchase + currentDue) ===================== */
const suppliersModule = (() => {
  let suppliers = [], searchTerm = '';

  async function load() {
    renderLayout();
    await fetchSuppliers();
  }

  async function fetchSuppliers() {
    const snap = await window.db.collection('suppliers').orderBy('name').get();
    suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats(); renderTable();
  }

  function renderLayout() {
    document.getElementById('section-suppliers').innerHTML = `
      <div class="page-header">
        <h2 class="page-heading"><i class="bi bi-truck"></i> Supplier Directory</h2>
        <button class="btn btn-primary" style="background:#00838f" onclick="suppliersModule.showAdd()"><i class="bi bi-plus-circle"></i> Add Supplier</button>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Total Suppliers</div><div class="stat-value sv-blue" id="sup-count">0</div></div>
        <div class="stat-card"><div class="stat-label">Total Purchases</div><div class="stat-value sv-green" id="sup-total">৳0</div></div>
        <div class="stat-card"><div class="stat-label">Total Paid</div><div class="stat-value sv-green" id="sup-paid">৳0</div></div>
        <div class="stat-card"><div class="stat-label">Total Due</div><div class="stat-value sv-red" id="sup-due">৳0</div></div>
      </div>
      <div class="table-card">
        <div class="table-toolbar">
          <input class="search-box" placeholder="Search suppliers…" oninput="suppliersModule.search(this.value)">
        </div>
        <div id="sup-table"></div>
      </div>`;
  }

  function renderStats() {
    const total = suppliers.reduce((s,x) => s+(x.totalPurchase||x.totalPurchases||0), 0);
    const due   = suppliers.reduce((s,x) => s+(x.currentDue||x.totalDue||0), 0);
    const paid  = total - due;
    setEl('sup-count', suppliers.length);
    setEl('sup-total', fmt(total));
    setEl('sup-paid', fmt(paid));
    setEl('sup-due', fmt(due));
  }

  function renderTable() {
    const list = suppliers.filter(s => {
      const q = searchTerm.toLowerCase();
      return !q || s.name.toLowerCase().includes(q) || (s.phone||'').includes(q);
    });
    if (!list.length) { setEl('sup-table',`<div class="empty-state"><div class="empty-icon">🏭</div><p>No suppliers yet</p></div>`); return; }
    setEl('sup-table', `<table class="data-table"><thead><tr>
      <th>#</th><th>Supplier Name</th><th>Phone</th><th>Address</th>
      <th>Total Purchase</th><th>Current Due</th><th>Actions</th>
    </tr></thead><tbody>
    ${list.map((s,i) => `<tr>
      <td>${i+1}</td>
      <td><strong>${s.name}</strong></td>
      <td>${s.phone||'—'}</td>
      <td><small>${s.address||'—'}</small></td>
      <td style="color:#00838f;font-weight:700">${fmt(s.totalPurchase||s.totalPurchases||0)}</td>
      <td style="color:#e74c3c;font-weight:700">${fmt(s.currentDue||s.totalDue||0)}</td>
      <td>
        <button class="action-btn" onclick="suppliersModule.showEdit('${s.id}')"><i class="bi bi-pencil-square"></i></button>
        <button class="action-btn" onclick="suppliersModule.viewLedger('${s.id}')"><i class="bi bi-journal-text"></i></button>
        <button class="action-btn" onclick="suppliersModule.del('${s.id}','${s.name.replace(/'/g,"\\'")}')"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join('')}
    </tbody></table>`);
  }

  function supplierForm(s={}) {
    return `<div class="form-grid">
      <div class="form-group"><label class="form-label">Supplier/Company Name *</label>
        <input id="sf-name" class="form-control" value="${s.name||''}"></div>
      <div class="form-group"><label class="form-label">Phone</label>
        <input id="sf-phone" class="form-control" value="${s.phone||''}"></div>
      <div class="form-group full"><label class="form-label">Office Address</label>
        <textarea id="sf-addr" class="form-control">${s.address||''}</textarea></div>
    </div>`;
  }

  function showAdd() {
    openModal('New Supplier Entry', supplierForm(), `
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" style="background:#00838f" onclick="suppliersModule.save()">Save Supplier</button>`);
  }

  function showEdit(id) {
    const s = suppliers.find(x=>x.id===id);
    if (!s) return;
    openModal('Edit Supplier', supplierForm(s), `
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" style="background:#00838f" onclick="suppliersModule.update('${id}')">Update</button>`);
  }

  function collect() {
    return {
      name: document.getElementById('sf-name')?.value.trim(),
      phone: document.getElementById('sf-phone')?.value.trim(),
      address: document.getElementById('sf-addr')?.value.trim()
    };
  }

  async function save() {
    const data = collect();
    if (!data.name) { toast('Supplier name is required','error'); return; }
    try {
      await window.db.collection('suppliers').add({
        ...data, totalPurchase: 0, currentDue: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Sync to Google Sheets
      window.SheetsSync?.supplier(data);
      closeModal(); toast('Supplier added successfully!','success'); await fetchSuppliers();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function update(id) {
    const data = collect();
    if (!data.name) { toast('Supplier name is required','error'); return; }
    try {
      await window.db.collection('suppliers').doc(id).update({...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
      closeModal(); toast('Updated!','success'); await fetchSuppliers();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function viewLedger(id) {
    const s = suppliers.find(x=>x.id===id);
    if (!s) return;
    const snap = await window.db.collection('purchases').where('supplierId','==',id).orderBy('date','desc').get();
    const purchases = snap.docs.map(d=>({id:d.id,...d.data()}));
    openModal(`Supplier Ledger: ${s.name}`,`
      <div style="display:flex;gap:20px;margin-bottom:14px;background:#f9fafb;padding:12px;border-radius:8px">
        <div><span style="font-size:12px;color:#6b7280">Total Purchase</span><br><strong>${fmt(s.totalPurchase||0)}</strong></div>
        <div><span style="font-size:12px;color:#6b7280">Current Due</span><br><strong style="color:#e74c3c">${fmt(s.currentDue||0)}</strong></div>
      </div>
      <table class="data-table">
        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${purchases.map(p=>`<tr>
          <td>${fmtDate(p.date)}</td><td>${p.product}</td><td>${p.qty}</td>
          <td>${fmt(p.price)}</td><td style="color:#3949ab;font-weight:700">${fmt(p.total)}</td>
        </tr>`).join('')}
        ${!purchases.length?'<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px">No transactions</td></tr>':''}
        </tbody>
      </table>`,
      `<button class="btn btn-outline" onclick="closeModal()">Close</button>`,'modal-lg');
  }

  async function del(id, name) {
    if (!confirmDelete(name)) return;
    try { await window.db.collection('suppliers').doc(id).delete(); toast('Deleted','success'); await fetchSuppliers(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  }

  function setEl(id,v) { const el=document.getElementById(id); if(el) el.innerHTML=v; }
  function search(v) { searchTerm=v; renderTable(); }

  return { load, showAdd, showEdit, save, update, viewLedger, del, search };
})();
