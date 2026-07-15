/* ===================== SUPPLIERS MODULE (matching original: totalPurchase + currentDue) ===================== */
const suppliersModule = (() => {
  let suppliers = [], searchTerm = '';

  async function load() {
    renderLayout();
    await fetchSuppliers();
  }

  async function fetchSuppliers() {
    // Fetch suppliers + all purchases in parallel
    const [supSnap, purSnap] = await Promise.all([
      window.db.collection('suppliers').orderBy('name').get(),
      window.db.collection('purchases').get()
    ]);
    suppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Recalculate totalPurchase from purchases collection (source of truth)
    // This avoids showing corrupted values from the totalPurchase field
    const purBySupplier = {};
    purSnap.docs.forEach(d => {
      const sid = d.data().supplierId;
      if (sid) purBySupplier[sid] = (purBySupplier[sid]||0) + (d.data().total||0);
    });
    // Silently update any corrupted totalPurchase in background
    const batch = window.db.batch();
    let needsUpdate = false;
    suppliers.forEach(s => {
      const correctTotal = purBySupplier[s.id] || 0;
      if (s.totalPurchase !== correctTotal) {
        batch.update(window.db.collection('suppliers').doc(s.id), { totalPurchase: correctTotal });
        s.totalPurchase = correctTotal; // update local too
        needsUpdate = true;
      }
    });
    if (needsUpdate) batch.commit().catch(()=>{}); // fire and forget

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
    // Use recalculated totalPurchase (fixed in fetchSuppliers via purchases collection)
    const total = suppliers.reduce((s,x) => s+(x.totalPurchase||0), 0);
    const due   = suppliers.reduce((s,x) => s+(x.currentDue||x.totalDue||0), 0);
    const paid  = Math.max(0, total - due); // never show negative paid
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
      <th>Date</th><th>Supplier ID</th><th>Company/Name</th><th>Phone</th><th>Address</th>
      <th>Total Purchase</th><th>Current Due</th><th>Actions</th>
    </tr></thead><tbody>
    ${list.map((s,i) => `<tr>
      <td><small style="color:#9ca3af">${fmtDate(s.date||s.createdAt)||'—'}</small></td>
      <td><span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap">${s.id}</span></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.phone||'—'}</td>
      <td><small>${s.address||'—'}</small></td>
      <td style="color:#00838f;font-weight:700">${fmt(s.totalPurchase||s.totalPurchases||0)}</td>
      <td style="color:#e74c3c;font-weight:700">${fmt(s.currentDue||s.totalDue||0)}</td>
      <td>
        <button class="action-btn" onclick="suppliersModule.showEdit('${s.id}')" title="Edit"><i class="bi bi-pencil-square"></i></button>
        <button class="action-btn" onclick="suppliersModule.viewLedger('${s.id}')" title="Ledger History" style="color:#3949ab;border-color:#3949ab"><i class="bi bi-journal-bookmark-fill"></i> Ledger</button>
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

  // Supplier Ledger — Purchases + Payments + Running Balance + Pagination
  let _slData=[], _slPage=1, _slMeta={};
  const SL_PER = 15;

  async function viewLedger(id) {
    const s = suppliers.find(x=>x.id===id);
    if (!s) return;

    openModal(`📒 Supplier Ledger — ${s.name}`,
      `<div style="text-align:center;padding:20px;color:#9ca3af">Loading…</div>`,
      `<button class="btn btn-outline" onclick="closeModal()">Close</button>
       <button class="btn btn-primary" onclick="suppliersModule.printSupplierLedger()"><i class="bi bi-printer"></i> Print / Save</button>`,
      'modal-xl');

    try {
      // Fetch without orderBy to avoid composite index requirement — sort in JS
      const [purSnap, cbSnap] = await Promise.all([
        window.db.collection('purchases').where('supplierId','==',id).get(),
        window.db.collection('cashBook').where('refId','==',id).get()
      ]);

      // Build combined ledger entries
      const entries = [];
      purSnap.docs.forEach(d => {
        const p = d.data();
        entries.push({ date: p.date||'', desc: `Purchase: ${p.product||''} (${p.qty||0} × ${fmt(p.price||0)})`, debit: p.total||0, credit: 0, type:'purchase' });
      });
      cbSnap.docs.forEach(d => {
        const c = d.data();
        if (c.type !== 'Supplier') return; // only supplier payments
        const amt = c.cashOut||c.amount||0;
        if (amt > 0) entries.push({ date: c.date||'', time: c.time||'', desc: `Payment: ${c.particulars||'Supplier Payment'}${c.bankName?' via '+c.bankName:''}`, debit: 0, credit: amt, type:'payment' });
      });

      // Sort by date (then time) ascending, calculate running balance
      entries.sort((a,b) => (a.date||'').localeCompare(b.date||'') || (a.time||'').localeCompare(b.time||''));
      let bal = 0;
      entries.forEach(e => { bal += e.debit - e.credit; e.balance = bal; });

      // Summary — use supplier document's currentDue as ground truth
      const totDebit  = entries.reduce((sm,e)=>sm+e.debit,0);
      const realDue   = s.currentDue || s.totalDue || 0;   // from supplier doc (most accurate)
      const totCredit = Math.max(0, totDebit - realDue);    // implied total paid
      const finalDue  = realDue;

      // If Cash Book has no payment entries but we know payments happened,
      // show a synthetic "Prior Payments" row to balance the ledger
      const cbCreditTotal = cbSnap.docs.reduce((sm,d)=>sm+(d.data().cashOut||d.data().amount||0),0);
      if (cbCreditTotal === 0 && totCredit > 0) {
        entries.push({
          date: '', desc: '📋 Prior Payments (imported balance adjustment)',
          debit: 0, credit: totCredit, type: 'prior', balance: realDue
        });
      }

      _slData = [...entries].reverse(); // newest first for display
      _slPage = 1;
      _slMeta = { name: s.name, phone: s.phone||'', address: s.address||'', totDebit, totCredit, finalDue };

      const renderSlPage = (pg) => {
        const start=(pg-1)*SL_PER, end=Math.min(start+SL_PER,_slData.length);
        const page=_slData.slice(start,end);
        const totalPg=Math.ceil(_slData.length/SL_PER);

        return `
          <!-- Summary bar -->
          <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
            ${[[`Total Purchases`, fmt(totDebit),'#3949ab'],[`Total Paid`,fmt(totCredit),'#27ae60'],[`Current Due`,fmt(finalDue),finalDue>0?'#e74c3c':'#27ae60']].map(([l,v,c])=>`
            <div style="flex:1;min-width:120px;background:#f8fafc;border-radius:8px;padding:10px 14px;border-left:3px solid ${c}">
              <small style="color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;display:block">${l}</small>
              <strong style="font-size:16px;color:${c}">${v}</strong>
            </div>`).join('')}
          </div>

          <!-- Table -->
          <div style="overflow-x:auto">
            <table class="data-table" style="min-width:600px">
              <thead><tr>
                <th>Date</th>
                <th>Description</th>
                <th style="text-align:right;color:#e74c3c">Purchase (Dr)</th>
                <th style="text-align:right;color:#27ae60">Payment (Cr)</th>
                <th style="text-align:right">Balance Due</th>
              </tr></thead>
              <tbody>
              ${page.map(e=>{
                const bc = e.balance>0?'#e74c3c':e.balance<0?'#27ae60':'#9ca3af';
                const rowBg = e.type==='payment'?'background:#f0fdf4':e.type==='prior'?'background:#fefce8':'';
                return`<tr style="${rowBg}">
                  <td style="white-space:nowrap;color:#6b7280">${e.date?fmtDateTime(e.date,e.time):'—'}</td>
                  <td style="font-size:13px;color:${e.type==='prior'?'#92400e':'inherit'}">${e.desc}</td>
                  <td style="text-align:right;color:#e74c3c;font-weight:600">${e.debit>0?fmt(e.debit):'—'}</td>
                  <td style="text-align:right;color:#27ae60;font-weight:600">${e.credit>0?fmt(e.credit):'—'}</td>
                  <td style="text-align:right;font-weight:700;color:${bc}">${fmt(Math.abs(e.balance))}${e.balance<0?' Cr':e.balance>0?' Dr':''}</td>
                </tr>`;
              }).join('')}
              ${!page.length?'<tr><td colspan="5" style="text-align:center;padding:20px;color:#9ca3af">কোনো transaction নেই</td></tr>':''}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px">
            <small style="color:#9ca3af">Showing ${start+1}–${end} of ${_slData.length} entries</small>
            <div style="display:flex;gap:6px">
              <button class="btn btn-outline btn-sm" ${pg<=1?'disabled':''} onclick="suppliersModule.slPage(${pg-1})">◀ Prev</button>
              <span style="padding:5px 12px;background:#f3f4f6;border-radius:6px;font-size:12px;font-weight:600">Page ${pg} / ${totalPg||1}</span>
              <button class="btn btn-outline btn-sm" ${pg>=totalPg?'disabled':''} onclick="suppliersModule.slPage(${pg+1})">Next ▶</button>
            </div>
          </div>`;
      };

      const body = document.getElementById('modalBody');
      if (body) body.innerHTML = renderSlPage(1);

      // Store render fn for pagination
      suppliersModule._renderSlPage = renderSlPage;

    } catch(e) {
      const body=document.getElementById('modalBody');
      if(body) body.innerHTML=`<div style="color:#e74c3c;padding:20px">Error: ${e.message}</div>`;
    }
  }

  function slPage(pg) {
    _slPage = pg;
    const body=document.getElementById('modalBody');
    if(body && suppliersModule._renderSlPage) body.innerHTML = suppliersModule._renderSlPage(pg);
  }

  function printSupplierLedger() {
    if (!_slData.length && !_slMeta.name) { toast('কোনো ডেটা নেই','error'); return; }
    const { name, phone, address, totDebit, totCredit, finalDue } = _slMeta;
    const today = new Date().toLocaleDateString('en-BD',{day:'2-digit',month:'long',year:'numeric'});
    const rows = [...(_slData||[])].reverse(); // chronological order for the printed report

    const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Supplier Ledger — ${name}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
  .tk{font-family:'Noto Sans Bengali','Inter',Arial,sans-serif}
  .page{max-width:920px;margin:0 auto;padding:30px 36px}
  .hdr{border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end}
  h1{font-size:19px;font-weight:800;color:#1e3a5f}
  .sub{font-size:11px;color:#64748b;margin-top:3px}
  .summary{display:flex;gap:10px;margin-bottom:18px}
  .sum-card{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;border-left:4px solid}
  .sum-label{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .sum-val{font-size:18px;font-weight:800;margin-top:3px;font-family:'Noto Sans Bengali','Inter',Arial,sans-serif}
  table{width:100%;border-collapse:collapse}
  th{background:#1e3a5f;color:#fff;padding:8px 12px;font-size:11px;font-weight:700;text-align:left}
  th.r{text-align:right}
  td{padding:7px 12px;border-bottom:1px solid #e9ecef;font-size:12px}
  tr.payment td{background:#f0fdf4}
  tr.prior td{background:#fefce8}
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
      <h1>Supplier Ledger — ${name}</h1>
      <div class="sub">${phone?'📞 '+phone+' &nbsp;·&nbsp; ':''}${address||''}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b"><strong>Generated:</strong> ${today}</div>
  </div>

  <div class="summary">
    <div class="sum-card" style="border-left-color:#3949ab"><div class="sum-label">Total Purchases</div><div class="sum-val tk" style="color:#3949ab">${fmt(totDebit)}</div></div>
    <div class="sum-card" style="border-left-color:#27ae60"><div class="sum-label">Total Paid</div><div class="sum-val tk" style="color:#27ae60">${fmt(totCredit)}</div></div>
    <div class="sum-card" style="border-left-color:${finalDue>0?'#e74c3c':'#27ae60'}"><div class="sum-label">Current Due</div><div class="sum-val tk" style="color:${finalDue>0?'#e74c3c':'#27ae60'}">${fmt(finalDue)}</div></div>
  </div>

  <table>
    <thead><tr><th>Date</th><th>Description</th><th class="r">Purchase (Dr)</th><th class="r">Payment (Cr)</th><th class="r">Balance Due</th></tr></thead>
    <tbody>
      ${rows.map(e=>`<tr class="${e.type==='payment'?'payment':e.type==='prior'?'prior':''}">
        <td style="white-space:nowrap;color:#6b7280">${e.date?fmtDateTime(e.date,e.time):'—'}</td>
        <td>${e.desc}</td>
        <td class="r tk" style="color:#e74c3c">${e.debit>0?fmt(e.debit):'—'}</td>
        <td class="r tk" style="color:#27ae60">${e.credit>0?fmt(e.credit):'—'}</td>
        <td class="r tk" style="font-weight:700">${fmt(Math.abs(e.balance))}${e.balance<0?' Cr':e.balance>0?' Dr':''}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer"><div>GentiX Fashion ERP — Supplier Ledger Report</div><div>${today}</div></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script>
async function dlImg(){
  const np=document.querySelectorAll('.no-print');
  np.forEach(e=>e.style.display='none');
  const c=await html2canvas(document.getElementById('rpt'),{scale:2,backgroundColor:'#fff',useCORS:true});
  np.forEach(e=>e.style.display='flex');
  const a=document.createElement('a');
  a.download='Supplier_Ledger_${name.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().substring(0,10)}.png';
  a.href=c.toDataURL('image/png');a.click();
}
</script>
</body></html>`;

    const win=window.open('','_blank','width=1000,height=750,scrollbars=yes');
    win.document.write(html); win.document.close();
  }

  async function del(id, name) {
    if (!confirmDelete(name)) return;
    try { await window.db.collection('suppliers').doc(id).delete(); toast('Deleted','success'); await fetchSuppliers(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  }

  function setEl(id,v) { const el=document.getElementById(id); if(el) el.innerHTML=v; }
  function search(v) { searchTerm=v; renderTable(); }

  return { load, showAdd, showEdit, save, update, viewLedger, slPage, printSupplierLedger, del, search };
})();
