/* ===================== INVENTORY MODULE (Fixed: subcategory, sell price, edit) ===================== */
const inventoryModule = (() => {
  let products = [], searchTerm = '', catFilter = '';

  async function load() {
    renderLayout();
    await fetchProducts();
  }

  async function fetchProducts() {
    const snap = await window.db.collection('products').orderBy('name').get();
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats(); renderTable(); populateCatFilter();
  }

  /* ---- Get categories from Settings ---- */
  async function getSettingsCategories() {
    try {
      const snap = await window.db.collection('settings').doc('config').get();
      if (snap.exists) return { cats: snap.data().categories||[], subcats: snap.data().subcategories||[] };
    } catch(e){}
    return { cats:[], subcats:[] };
  }

  function renderLayout() {
    document.getElementById('section-inventory').innerHTML = `
      <div class="page-header">
        <h2 class="page-heading"><i class="bi bi-box-seam"></i> Product Inventory</h2>
        <button class="btn btn-primary" onclick="inventoryModule.showAdd()"><i class="bi bi-plus-lg"></i> Add Product</button>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Total Products</div><div class="stat-value sv-blue" id="inv-count">0</div></div>
        <div class="stat-card"><div class="stat-label">Stock Value (Cost)</div><div class="stat-value sv-green" id="inv-value">৳0</div></div>
        <div class="stat-card"><div class="stat-label">Low Stock (&lt;10)</div><div class="stat-value sv-orange" id="inv-low">0</div></div>
        <div class="stat-card"><div class="stat-label">Out of Stock</div><div class="stat-value sv-red" id="inv-out">0</div></div>
      </div>
      <div class="table-card">
        <div class="table-toolbar">
          <input class="search-box" placeholder="Search products…" oninput="inventoryModule.search(this.value)">
          <select class="filter-select" id="inv-cat-filter" onchange="inventoryModule.filterCat(this.value)">
            <option value="">All Categories</option>
          </select>
        </div>
        <div id="inv-table"></div>
      </div>`;
  }

  function renderStats() {
    const total = products.length;
    const value = products.reduce((s,p) => s+(p.currentStock||0)*(p.buyPrice||0), 0);
    const low   = products.filter(p => (p.currentStock||0)>0 && (p.currentStock||0)<10).length;
    const out   = products.filter(p => (p.currentStock||0)===0).length;
    setEl('inv-count', total); setEl('inv-value', fmt(value));
    setEl('inv-low', low); setEl('inv-out', out);
  }

  function renderTable() {
    const list = products.filter(p => {
      const q = searchTerm.toLowerCase();
      const ms = !q || p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q);
      const mf = !catFilter || p.category === catFilter;
      return ms && mf;
    });
    if (!list.length) { setEl('inv-table',`<div class="empty-state"><div class="empty-icon">📦</div><p>No products found</p></div>`); return; }
    setEl('inv-table', `<table class="data-table"><thead><tr>
      <th>Date</th><th>ID</th><th>Product Name</th><th>Category</th><th>Sub-Category</th>
      <th>Buy Price</th><th>Sell Price</th><th>Stock</th><th>Stock Value</th><th>Actions</th>
    </tr></thead><tbody>
    ${list.map((p,i) => {
      const sc = (p.currentStock||0)===0 ? 'badge-danger' : (p.currentStock||0)<10 ? 'badge-warning' : 'badge-success';
      const margin = (p.sellPrice||0)>0 ? (((p.sellPrice-p.buyPrice)/p.sellPrice)*100).toFixed(1) : '—';
      return `<tr>
        <td><small style="color:#9ca3af">${fmtDate(p.date||p.createdAt)||'—'}</small></td>
        <td><span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap">${p.id}</span></td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category||'—'}</td>
        <td>${p.subcategory||'—'}</td>
        <td>${fmt(p.buyPrice)}</td>
        <td><span style="color:#27ae60;font-weight:700">${fmt(p.sellPrice)}</span><small style="color:#9ca3af;display:block">Margin: ${margin}%</small></td>
        <td><span class="badge ${sc}">${p.currentStock||0} pcs</span></td>
        <td>${fmt((p.currentStock||0)*(p.buyPrice||0))}</td>
        <td>
          <button class="action-btn" onclick="inventoryModule.showEdit('${p.id}')"><i class="bi bi-pencil-square"></i></button>
          <button class="action-btn" onclick="inventoryModule.del('${p.id}','${p.name.replace(/'/g,"\\'")}')"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`);
  }

  function populateCatFilter() {
    const cats = [...new Set(products.map(p=>p.category).filter(Boolean))].sort();
    const el = document.getElementById('inv-cat-filter');
    if(el) el.innerHTML = `<option value="">All Categories</option>` + cats.map(c=>`<option ${c===catFilter?'selected':''}>${c}</option>`).join('');
  }

  async function productForm(p = {}) {
    const { cats, subcats } = await getSettingsCategories();
    const catOpts = cats.length
      ? cats.map(c=>`<option ${p.category===c?'selected':''}>${c}</option>`).join('')
      : `<option ${p.category?'selected':''} value="${p.category||''}">${p.category||'No categories in Settings'}</option>`;
    const subcatOpts = subcats.length
      ? subcats.map(c=>`<option ${p.subcategory===c?'selected':''}>${c}</option>`).join('')
      : `<option value="">—</option>`;
    return `<div class="form-grid">
      <div class="form-group full"><label class="form-label">Product Name *</label>
        <input id="pf-name" class="form-control" value="${p.name||''}"></div>
      <div class="form-group"><label class="form-label">Category</label>
        <select id="pf-cat" class="form-control">
          <option value="">Select Category</option>${catOpts}
        </select></div>
      <div class="form-group"><label class="form-label">Sub-Category</label>
        <select id="pf-subcat" class="form-control">
          <option value="">Select Sub-Category</option>${subcatOpts}
        </select></div>
      <div class="form-group"><label class="form-label">Buy Price (৳)</label>
        <input type="number" id="pf-buy" class="form-control" value="${p.buyPrice||''}"></div>
      <div class="form-group"><label class="form-label">Sell Price (৳)</label>
        <input type="number" id="pf-sell" class="form-control" value="${p.sellPrice||''}"></div>
      <div class="form-group"><label class="form-label">${p.id?'Current':'Opening'} Stock (pcs)</label>
        <input type="number" id="pf-stock" class="form-control" value="${p.currentStock||0}"></div>
      <div class="form-group"><label class="form-label">SKU / Code</label>
        <input id="pf-sku" class="form-control" value="${p.sku||''}"></div>
    </div>`;
  }

  async function showAdd() {
    const body = await productForm();
    openModal('New Product', body, `
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="inventoryModule.save()"><i class="bi bi-save"></i> Save Product</button>`);
  }

  async function showEdit(id) {
    const p = products.find(x=>x.id===id);
    if (!p) return;
    const body = await productForm(p);
    openModal('Edit Product', body, `
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="inventoryModule.update('${id}')">Update Product</button>`);
  }

  function collect() {
    return {
      name:       document.getElementById('pf-name')?.value.trim(),
      category:   document.getElementById('pf-cat')?.value,
      subcategory:document.getElementById('pf-subcat')?.value,
      sku:        document.getElementById('pf-sku')?.value.trim(),
      buyPrice:   n(document.getElementById('pf-buy')?.value),
      sellPrice:  n(document.getElementById('pf-sell')?.value),
      currentStock: ni(document.getElementById('pf-stock')?.value)
    };
  }

  async function save() {
    const data = collect();
    if (!data.name) { toast('Product name is required','error'); return; }
    try {
      await window.db.collection('products').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      // Sync to Google Sheets
      window.SheetsSync?.inventory(data);
      closeModal(); toast('Product added successfully!','success'); await fetchProducts();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function update(id) {
    const data = collect();
    if (!data.name) { toast('Product name is required','error'); return; }
    try {
      await window.db.collection('products').doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      closeModal(); toast('Product updated!','success'); await fetchProducts();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function del(id, name) {
    if (!confirmDelete(name)) return;
    try { await window.db.collection('products').doc(id).delete(); toast('Deleted','success'); await fetchProducts(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  }

  function setEl(id,v) { const el=document.getElementById(id); if(el) el.innerHTML=v; }
  function search(v) { searchTerm=v; renderTable(); }
  function filterCat(v) { catFilter=v; renderTable(); }

  return { load, showAdd, showEdit, save, update, del, search, filterCat };
})();
