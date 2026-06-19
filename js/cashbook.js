/* ===================== CASH BOOK MODULE — with Delete ===================== */
const cashbookModule = (() => {
  let allEntries = [], curPage = 1;
  const PER_PAGE = 10;
  let formData = { customers:[], suppliers:[] };

  async function load() { renderLayout(); await fetchFormData(); await fetchEntries(); }

  async function fetchFormData() {
    const [cSnap,sSnap] = await Promise.all([
      window.db.collection('customers').orderBy('name').get(),
      window.db.collection('suppliers').orderBy('name').get()
    ]);
    formData.customers = cSnap.docs.map(d=>({id:d.id,...d.data()}));
    formData.suppliers = sSnap.docs.map(d=>({id:d.id,...d.data()}));
    toggleRefList();
  }

  async function fetchEntries() {
    const snap = await window.db.collection('cashBook').orderBy('date','desc').get();
    allEntries = snap.docs.map(d=>({id:d.id,...d.data()}));
    curPage=1; renderBalance(); renderTable();
  }

  function renderLayout() {
    document.getElementById('section-cashbook').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:1.2rem">
      <div class="table-card" style="border-top:5px solid #00acc1">
        <div style="padding:20px">
          <h5 style="color:#00acc1;font-weight:700;margin-bottom:18px"><i class="bi bi-cash-stack"></i> Cash Transaction</h5>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Transaction Type</label>
            <select id="transType" class="form-control" onchange="cashbookModule.toggleRefList()">
              <option value="Customer">Customer Collection (Cash In)</option>
              <option value="Investment">Owner Investment (Cash In)</option>
              <option value="Supplier">Supplier Payment (Cash Out)</option>
              <option value="Expense">Other Expense (Cash Out)</option>
            </select>
          </div>
          <div id="refDiv" class="form-group" style="margin-bottom:12px">
            <label id="refLabel" class="form-label">Select Customer</label>
            <select id="refId" class="form-control"><option value="">-- Select --</option></select>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Particulars / Note</label>
            <input type="text" id="particulars" class="form-control" placeholder="e.g. Monthly Rent or Initial Capital">
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label id="amtLabel" class="form-label">Collection Amount (Cash In)</label>
            <input type="number" id="cbAmount" class="form-control" min="1" step="0.01">
          </div>
          <button id="cashSubmitBtn" onclick="cashbookModule.save()" class="btn btn-primary" style="width:100%;padding:12px;font-size:15px;background:#00acc1;justify-content:center">
            <i class="bi bi-save"></i> Save Transaction
          </button>
        </div>
      </div>
      <div class="table-card">
        <div style="padding:13px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <h5 style="font-weight:700;color:#6b7280;margin:0"><i class="bi bi-journal-text"></i> Cash Ledger</h5>
          <div id="cb-balance-pill" style="font-size:13px;font-weight:700;background:#d1fae5;color:#065f46;padding:5px 14px;border-radius:20px">Balance: ৳0</div>
        </div>
        <div id="cb-table-wrapper" style="overflow-x:auto"><div class="loading-state">Loading…</div></div>
        <div style="padding:10px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <small id="cashPageInfo" style="color:#6b7280">Page 1</small>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" id="cashPrevBtn" onclick="cashbookModule.changePage(-1)">◀</button>
            <button class="btn btn-outline btn-sm" id="cashNextBtn" onclick="cashbookModule.changePage(1)">▶</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function toggleRefList() {
    const type = document.getElementById('transType')?.value;
    const refDiv = document.getElementById('refDiv');
    const refSel = document.getElementById('refId');
    const refLabel = document.getElementById('refLabel');
    const amtLabel = document.getElementById('amtLabel');
    if (!refSel||!type) return;
    const f2 = v => Number(v||0).toLocaleString();
    if (type==='Investment'||type==='Expense') {
      refDiv.style.display='none'; refSel.value='';
      amtLabel.textContent = type==='Investment' ? 'Investment Amount (Cash In)' : 'Expense Amount (Cash Out)';
    } else {
      refDiv.style.display='block';
      refSel.innerHTML='<option value="">-- Select --</option>';
      if (type==='Customer') {
        refLabel.textContent='Select Customer';
        amtLabel.textContent='Collection Amount (Cash In)';
        formData.customers.forEach(c=>{
          refSel.innerHTML+=`<option value="${c.id}">${c.name} [Due: ৳${f2(c.totalCod||c.totalDue||0)}]</option>`;
        });
      } else {
        refLabel.textContent='Select Supplier';
        amtLabel.textContent='Payment Amount (Cash Out)';
        formData.suppliers.forEach(s=>{
          refSel.innerHTML+=`<option value="${s.id}">${s.name} [Due: ৳${f2(s.currentDue||s.totalDue||0)}]</option>`;
        });
      }
    }
  }

  async function save() {
    const type      = document.getElementById('transType').value;
    const refId     = document.getElementById('refId').value;
    const note      = document.getElementById('particulars').value.trim();
    const amount    = n(document.getElementById('cbAmount').value);
    const btn       = document.getElementById('cashSubmitBtn');
    if (!note||!amount) { toast('Note and amount are required','error'); return; }
    if ((type==='Customer'||type==='Supplier')&&!refId) { toast('Please select an account','error'); return; }
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Saving…';
    const isIn  = type==='Customer'||type==='Investment';
    const cashIn = isIn?amount:0, cashOut=isIn?0:amount;
    try {
      const batch = window.db.batch();
      const ref = window.db.collection('cashBook').doc();
      batch.set(ref,{type,refId,particulars:note,cashIn,cashOut,amount,date:todayStr(),createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      if (type==='Customer'&&refId) {
        batch.update(window.db.collection('customers').doc(refId),{totalCod:firebase.firestore.FieldValue.increment(-cashIn)});
      } else if (type==='Supplier'&&refId) {
        batch.update(window.db.collection('suppliers').doc(refId),{currentDue:firebase.firestore.FieldValue.increment(-cashOut)});
      }
      await batch.commit();
      // Sync to Google Sheets
      window.SheetsSync?.cashBook({ date:todayStr(), refId, particulars:note, cashIn, cashOut, type });
      toast('Transaction Recorded!','success');
      document.getElementById('particulars').value=''; document.getElementById('cbAmount').value='';
      btn.disabled=false; btn.innerHTML='<i class="bi bi-save"></i> Save Transaction';
      await fetchFormData(); await fetchEntries();
    } catch(e) { btn.disabled=false; btn.innerHTML='Save Transaction'; toast('Error: '+e.message,'error'); }
  }

  /* ── DELETE ── */
  async function del(id) {
    if (!confirm('Delete this cash entry?\n\nNote: This will NOT reverse any customer/supplier due changes. Delete only if entered by mistake.')) return;
    try {
      await window.db.collection('cashBook').doc(id).delete();
      toast('Entry deleted','success'); await fetchEntries();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  function renderBalance() {
    const opening = window.appSettings?.openingCash||0;
    const totalIn  = allEntries.filter(e=>(e.cashIn||0)>0).reduce((s,e)=>s+(e.cashIn||0),0);
    const totalOut = allEntries.filter(e=>(e.cashOut||0)>0).reduce((s,e)=>s+(e.cashOut||0),0);
    const balance  = opening+totalIn-totalOut;
    const pill = document.getElementById('cb-balance-pill');
    if(pill){pill.textContent='Balance: '+fmt(balance);pill.style.background=balance>=0?'#d1fae5':'#fee2e2';pill.style.color=balance>=0?'#065f46':'#991b1b';}
  }

  function renderTable() {
    const w = document.getElementById('cb-table-wrapper');
    if (!w) return;
    const tp = Math.ceil(allEntries.length/PER_PAGE);
    const page = allEntries.slice((curPage-1)*PER_PAGE,curPage*PER_PAGE);
    if (!page.length){w.innerHTML='<div class="empty-state"><div class="empty-icon">📒</div><p>No cash entries yet</p></div>';updatePagination(0);return;}
    // Calculate running balance
    const opening = window.appSettings?.openingCash||0;
    let run = opening;
    const withBal = [...allEntries].reverse().map(e=>{run+=(e.cashIn||0)-(e.cashOut||0);return{...e,bal:run};}).reverse();
    const pageWB = withBal.slice((curPage-1)*PER_PAGE,curPage*PER_PAGE);
    w.innerHTML=`<table class="data-table"><thead><tr>
      <th>Date</th><th>Note</th><th style="text-align:right;color:#27ae60">Cash In</th>
      <th style="text-align:right;color:#e74c3c">Cash Out</th><th style="text-align:right">Balance</th><th>Actions</th>
    </tr></thead><tbody>
    ${pageWB.map(r=>`<tr>
      <td><small style="color:#9ca3af">${fmtDate(r.date)}</small></td>
      <td style="font-weight:600">${r.particulars||'—'}<br><small style="color:#9ca3af">${r.type||''}</small></td>
      <td style="text-align:right;color:#27ae60;font-weight:600">${(r.cashIn||0)>0?fmt(r.cashIn):'—'}</td>
      <td style="text-align:right;color:#e74c3c;font-weight:600">${(r.cashOut||0)>0?fmt(r.cashOut):'—'}</td>
      <td style="text-align:right;font-weight:700">${fmt(r.bal)}</td>
      <td>
        <button class="action-btn" onclick="cashbookModule.del('${r.id}')" title="Delete Entry"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join('')}
    </tbody></table>`;
    updatePagination(tp);
  }

  function updatePagination(tp){
    const i=document.getElementById('cashPageInfo'),p=document.getElementById('cashPrevBtn'),nx=document.getElementById('cashNextBtn');
    if(i)i.textContent=`Page ${curPage} of ${tp||1}`;
    if(p)p.disabled=curPage===1;if(nx)nx.disabled=curPage===tp||tp===0;
  }
  function changePage(step){const tp=Math.ceil(allEntries.length/PER_PAGE),np=curPage+step;if(np>=1&&np<=tp){curPage=np;renderTable();}}

  return {load,toggleRefList,save,del,changePage};
})();
