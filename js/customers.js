/* ===================== CUSTOMERS MODULE (totalOrder + totalCod, matching original) ===================== */
const customersModule = (() => {
  let customers = [], searchTerm = '';

  async function load() {
    renderLayout();
    await fetchCustomers();
  }

  async function fetchCustomers() {
    const snap = await window.db.collection('customers').orderBy('name').get();
    customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats(); renderTable();
  }

  function renderLayout() {
    document.getElementById('section-customers').innerHTML = `
      <div class="page-header">
        <h2 class="page-heading"><i class="bi bi-people-fill"></i> Customer Database</h2>
        <button class="btn btn-success" onclick="customersModule.showAdd()"><i class="bi bi-person-plus-fill"></i> Add Customer</button>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Total Customers</div><div class="stat-value sv-blue" id="cu-count">0</div></div>
        <div class="stat-card"><div class="stat-label">Total Orders (Qty)</div><div class="stat-value sv-green" id="cu-orders">0</div></div>
        <div class="stat-card"><div class="stat-label">Total COD</div><div class="stat-value sv-blue" id="cu-total">৳0</div></div>
        <div class="stat-card"><div class="stat-label">Total Outstanding</div><div class="stat-value sv-red" id="cu-due">৳0</div></div>
      </div>
      <div class="table-card">
        <div class="table-toolbar">
          <input class="search-box" placeholder="Search customers…" oninput="customersModule.search(this.value)">
        </div>
        <div id="cu-table"></div>
      </div>`;
  }

  function renderStats() {
    const totalOrders = customers.reduce((s,c) => s+(c.totalOrder||0), 0);
    const totalCod    = customers.reduce((s,c) => s+(c.totalCod||0), 0);
    const totalDue    = customers.reduce((s,c) => s+(c.totalDue||c.totalCod||0), 0);
    setEl('cu-count', customers.length);
    setEl('cu-orders', totalOrders.toLocaleString() + ' pcs');
    setEl('cu-total', fmt(totalCod));
    setEl('cu-due', fmt(totalDue));
  }

  function renderTable() {
    const list = customers.filter(c => {
      const q = searchTerm.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || (c.phone||'').includes(q);
    });
    if (!list.length) { setEl('cu-table',`<div class="empty-state"><div class="empty-icon">👥</div><p>No customers yet</p></div>`); return; }
    setEl('cu-table', `<table class="data-table"><thead><tr>
      <th>#</th><th>Customer Name</th><th>Phone</th><th>Address</th>
      <th>Total Order</th><th>Total COD</th><th>Actions</th>
    </tr></thead><tbody>
    ${list.map((c,i) => `<tr>
      <td>${i+1}</td>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone||'—'}</td>
      <td><small>${c.address||'—'}</small></td>
      <td><span class="badge badge-gray">${c.totalOrder||0}</span></td>
      <td style="color:#27ae60;font-weight:700">${fmt(c.totalCod)}</td>
      <td>
        <button class="action-btn" onclick="customersModule.showEdit('${c.id}')"><i class="bi bi-pencil-square"></i></button>
        <button class="action-btn" onclick="customersModule.viewLedger('${c.id}')"><i class="bi bi-journal-text"></i></button>
        <button class="action-btn" onclick="customersModule.del('${c.id}','${c.name.replace(/'/g,"\\'")}')"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join('')}
    </tbody></table>`);
  }

  function custForm(c={}) {
    return `<div class="form-grid">
      <div class="form-group"><label class="form-label">Customer Name *</label>
        <input id="cf-name" class="form-control" value="${c.name||''}"></div>
      <div class="form-group"><label class="form-label">Phone</label>
        <input id="cf-phone" class="form-control" value="${c.phone||''}"></div>
      <div class="form-group full"><label class="form-label">Address</label>
        <textarea id="cf-addr" class="form-control">${c.address||''}</textarea></div>
    </div>`;
  }

  function showAdd() {
    openModal('New Customer Registration', custForm(), `
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="customersModule.save()"><i class="bi bi-person-plus-fill"></i> Save Customer</button>`);
  }

  function showEdit(id) {
    const c = customers.find(x=>x.id===id);
    if (!c) return;
    openModal('Edit Customer', custForm(c), `
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="customersModule.update('${id}')">Update</button>`);
  }

  function collect() {
    return {
      name: document.getElementById('cf-name')?.value.trim(),
      phone: document.getElementById('cf-phone')?.value.trim(),
      address: document.getElementById('cf-addr')?.value.trim()
    };
  }

  async function save() {
    const data = collect();
    if (!data.name) { toast('Customer name is required','error'); return; }
    try {
      await window.db.collection('customers').add({
        ...data, totalOrder: 0, totalCod: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Sync to Google Sheets
      window.SheetsSync?.customer(data);
      closeModal(); toast('Customer Saved Successfully!','success'); await fetchCustomers();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function update(id) {
    const data = collect();
    if (!data.name) { toast('Customer name is required','error'); return; }
    try {
      await window.db.collection('customers').doc(id).update({...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
      closeModal(); toast('Updated!','success'); await fetchCustomers();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function viewLedger(id) {
    const c = customers.find(x=>x.id===id);
    if (!c) return;
    const snap = await window.db.collection('sales').where('customerId','==',id).orderBy('createdAt','desc').get();
    const sales = snap.docs.map(d=>({id:d.id,...d.data()}));
    openModal(`Customer Ledger: ${c.name}`,`
      <div style="display:flex;gap:20px;margin-bottom:14px;background:#f9fafb;padding:12px;border-radius:8px">
        <div><span style="font-size:12px;color:#6b7280">Total Orders</span><br><strong>${c.totalOrder||0} pcs</strong></div>
        <div><span style="font-size:12px;color:#6b7280">Total COD</span><br><strong style="color:#27ae60">${fmt(c.totalCod)}</strong></div>
      </div>
      <table class="data-table">
        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${sales.map(s=>`<tr>
          <td>${fmtDate(s.date)}</td><td>${s.product}</td><td>${s.qty}</td>
          <td style="color:#27ae60;font-weight:700">${fmt(s.total)}</td>
          <td><span class="badge ${s.status==='Active'?'badge-success':'badge-warning'}">${s.status}</span></td>
        </tr>`).join('')}
        ${!sales.length?'<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px">No transactions</td></tr>':''}
        </tbody>
      </table>`,
      `<button class="btn btn-outline" onclick="closeModal()">Close</button>`,'modal-lg');
  }

  async function del(id, name) {
    if (!confirmDelete(name)) return;
    try { await window.db.collection('customers').doc(id).delete(); toast('Deleted','success'); await fetchCustomers(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  }

  function setEl(id,v) { const el=document.getElementById(id); if(el) el.innerHTML=v; }
  function search(v) { searchTerm=v; renderTable(); }

  return { load, showAdd, showEdit, save, update, viewLedger, del, search };
})();
