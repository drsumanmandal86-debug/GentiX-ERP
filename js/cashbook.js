/* ===================== CASH BOOK MODULE — with Delete ===================== */
const cashbookModule = (() => {
  let allEntries = [], curPage = 1;
  const PER_PAGE = 10;
  let formData = { customers:[], suppliers:[] };
  let filterFrom = '', filterTo = '';
  const BANK_OPTIONS = ['DBBL','BRAC','Cash','Other'];

  // Current time in Bangladesh local time, HH:MM
  const nowTimeStr = () => {
    const bd = window.bdNow();
    return String(bd.getHours()).padStart(2,'0')+':'+String(bd.getMinutes()).padStart(2,'0');
  };

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
    <div style="display:grid;grid-template-columns:1fr 1.8fr;gap:1.2rem">
      <div class="table-card" style="border-top:5px solid #00acc1">
        <div style="padding:20px">
          <h5 style="color:#00acc1;font-weight:700;margin-bottom:18px"><i class="bi bi-cash-stack"></i> Cash Transaction</h5>
          <div class="form-grid" style="margin-bottom:12px">
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" id="cbDate" class="form-control" value="${todayStr()}">
            </div>
            <div class="form-group">
              <label class="form-label">Time *</label>
              <input type="time" id="cbTime" class="form-control" value="${nowTimeStr()}">
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Transaction Type *</label>
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
          <div id="bankDiv" class="form-group" style="margin-bottom:12px;display:none">
            <label class="form-label">Bank / Payment Method *</label>
            <select id="bankMethod" class="form-control" onchange="cashbookModule.toggleBankOther()">
              ${BANK_OPTIONS.map(b=>`<option value="${b}">${b==='Other'?'Other Bank':b}</option>`).join('')}
            </select>
            <input type="text" id="bankOther" class="form-control" style="display:none;margin-top:8px" placeholder="Enter bank name">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Particulars / Note</label>
            <input type="text" id="particulars" class="form-control" placeholder="e.g. Monthly Rent or Initial Capital">
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label id="amtLabel" class="form-label">Amount (৳) *</label>
            <input type="number" id="cbAmount" class="form-control" min="1" step="0.01">
          </div>
          <button id="cashSubmitBtn" onclick="cashbookModule.save()" class="btn btn-primary" style="width:100%;padding:12px;font-size:15px;background:#00acc1;border-color:#00acc1;justify-content:center">
            <i class="bi bi-check-circle"></i> Save Transaction
          </button>
        </div>
      </div>
      <div class="table-card">
        <div style="padding:13px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <h5 style="font-weight:700;color:#6b7280;margin:0"><i class="bi bi-journal-text"></i> Cash Ledger</h5>
          <div style="display:flex;align-items:center;gap:10px">
            <div id="cb-balance-pill" style="font-size:13px;font-weight:700;background:#d1fae5;color:#065f46;padding:5px 14px;border-radius:20px">Balance: ৳0</div>
            <button class="btn btn-outline btn-sm" onclick="cashbookModule.refresh()"><i class="bi bi-arrow-clockwise"></i></button>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f6;flex-wrap:wrap">
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">From</label>
          <input type="date" id="cbFilterFrom" class="form-control" style="width:150px" onchange="cashbookModule.applyFilter()">
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">To</label>
          <input type="date" id="cbFilterTo" class="form-control" style="width:150px" onchange="cashbookModule.applyFilter()">
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">Pick Month</label>
          <input type="month" id="cbFilterMonth" class="form-control" style="width:150px" onchange="cashbookModule.pickMonth(this.value)">
          <button class="btn btn-outline btn-sm" onclick="cashbookModule.clearFilter()">Clear</button>
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
    const bankDiv = document.getElementById('bankDiv');
    if (!refSel||!type) return;
    const f2 = v => Number(v||0).toLocaleString();
    if (bankDiv) bankDiv.style.display = type==='Supplier' ? 'block' : 'none';
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

  function toggleBankOther() {
    const bm = document.getElementById('bankMethod')?.value;
    const other = document.getElementById('bankOther');
    if (other) other.style.display = bm==='Other' ? 'block' : 'none';
  }

  async function save() {
    const type      = document.getElementById('transType').value;
    const refId     = document.getElementById('refId').value;
    const note      = document.getElementById('particulars').value.trim();
    const amount    = n(document.getElementById('cbAmount').value);
    const date      = document.getElementById('cbDate')?.value || todayStr();
    const time      = document.getElementById('cbTime')?.value || nowTimeStr();
    const btn       = document.getElementById('cashSubmitBtn');
    if (!date) { toast('Date is required','error'); return; }
    if (!note||!amount) { toast('Note and amount are required','error'); return; }
    if ((type==='Customer'||type==='Supplier')&&!refId) { toast('Please select an account','error'); return; }
    let bankName = '';
    if (type==='Supplier') {
      const bm = document.getElementById('bankMethod')?.value;
      bankName = bm==='Other' ? document.getElementById('bankOther')?.value.trim() : bm;
      if (!bankName) { toast('Please select or enter the bank/payment method','error'); return; }
    }
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Saving…';
    const isIn  = type==='Customer'||type==='Investment';
    const cashIn = isIn?amount:0, cashOut=isIn?0:amount;
    try {
      const batch = window.db.batch();
      const ref = window.db.collection('cashBook').doc();
      batch.set(ref,{type,refId,particulars:note,cashIn,cashOut,amount,date,time,bankName,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      if (type==='Customer'&&refId) {
        batch.update(window.db.collection('customers').doc(refId),{totalCod:firebase.firestore.FieldValue.increment(-cashIn)});
      } else if (type==='Supplier'&&refId) {
        batch.update(window.db.collection('suppliers').doc(refId),{currentDue:firebase.firestore.FieldValue.increment(-cashOut)});
      }
      await batch.commit();
      // Sync to Google Sheets
      window.SheetsSync?.cashBook({ date:todayStr(), refId, particulars:note, cashIn, cashOut, type });
      toast('Transaction Recorded!','success');
      document.getElementById('particulars').value='';
      document.getElementById('cbAmount').value='';
      const dateEl=document.getElementById('cbDate');if(dateEl)dateEl.value=todayStr();
      const timeEl=document.getElementById('cbTime');if(timeEl)timeEl.value=nowTimeStr();
      const bankOtherEl=document.getElementById('bankOther');if(bankOtherEl){bankOtherEl.value='';bankOtherEl.style.display='none';}
      const bankMethodEl=document.getElementById('bankMethod');if(bankMethodEl)bankMethodEl.value=BANK_OPTIONS[0];
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

  function filteredEntries() {
    if (!filterFrom && !filterTo) return allEntries;
    return allEntries.filter(e => (!filterFrom||e.date>=filterFrom) && (!filterTo||e.date<=filterTo));
  }

  function renderTable() {
    const w = document.getElementById('cb-table-wrapper');
    if (!w) return;
    // Running balance computed over full history so filtered rows still show real balances
    const opening = window.appSettings?.openingCash||0;
    let run = opening;
    const withBal = [...allEntries].reverse().map(e=>{run+=(e.cashIn||0)-(e.cashOut||0);return{...e,bal:run};}).reverse();
    const balMap = {}; withBal.forEach(e=>{balMap[e.id]=e.bal;});
    const list = filteredEntries();
    const tp = Math.ceil(list.length/PER_PAGE);
    const page = list.slice((curPage-1)*PER_PAGE,curPage*PER_PAGE);
    if (!page.length){w.innerHTML='<div class="empty-state"><div class="empty-icon">📒</div><p>No cash entries found</p></div>';updatePagination(0,0);return;}
    w.innerHTML=`<table class="data-table"><thead><tr>
      <th>Date &amp; Time</th><th>Note</th><th style="text-align:right;color:#27ae60">Cash In</th>
      <th style="text-align:right;color:#e74c3c">Cash Out</th><th style="text-align:right">Balance</th><th>Actions</th>
    </tr></thead><tbody>
    ${page.map(r=>`<tr>
      <td><small style="color:#9ca3af">${fmtDateTime(r.date,r.time)}</small></td>
      <td style="font-weight:600">${r.particulars||'—'}<br><small style="color:#9ca3af">${r.type||''}${r.bankName?' · '+r.bankName:''}</small></td>
      <td style="text-align:right;color:#27ae60;font-weight:600">${(r.cashIn||0)>0?fmt(r.cashIn):'—'}</td>
      <td style="text-align:right;color:#e74c3c;font-weight:600">${(r.cashOut||0)>0?fmt(r.cashOut):'—'}</td>
      <td style="text-align:right;font-weight:700">${fmt(balMap[r.id]||0)}</td>
      <td>
        <button class="action-btn" onclick="cashbookModule.del('${r.id}')" title="Delete Entry"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join('')}
    </tbody></table>`;
    updatePagination(tp,list.length);
  }

  function updatePagination(tp,total){
    const i=document.getElementById('cashPageInfo'),p=document.getElementById('cashPrevBtn'),nx=document.getElementById('cashNextBtn');
    if(i)i.textContent=`Page ${curPage} of ${tp||1}${total!=null?' ('+total+' entries)':''}`;
    if(p)p.disabled=curPage===1;if(nx)nx.disabled=curPage===tp||tp===0;
  }
  function changePage(step){const tp=Math.ceil(filteredEntries().length/PER_PAGE),np=curPage+step;if(np>=1&&np<=tp){curPage=np;renderTable();}}
  async function refresh(){await fetchEntries();}

  function applyFilter(){
    filterFrom = document.getElementById('cbFilterFrom')?.value || '';
    filterTo   = document.getElementById('cbFilterTo')?.value || '';
    curPage=1; renderTable();
  }

  const localDate = d => {
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  function pickMonth(monthVal){
    if (!monthVal) return;
    const [y,m] = monthVal.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2,'0')}-01`;
    const to   = localDate(new Date(y,m,0));
    const fEl=document.getElementById('cbFilterFrom'),tEl=document.getElementById('cbFilterTo');
    if(fEl)fEl.value=from; if(tEl)tEl.value=to;
    applyFilter();
  }

  function clearFilter(){
    filterFrom=''; filterTo='';
    const fEl=document.getElementById('cbFilterFrom'),tEl=document.getElementById('cbFilterTo'),mEl=document.getElementById('cbFilterMonth');
    if(fEl)fEl.value=''; if(tEl)tEl.value=''; if(mEl)mEl.value='';
    curPage=1; renderTable();
  }

  return {load,toggleRefList,toggleBankOther,save,del,changePage,refresh,applyFilter,pickMonth,clearFilter};
})();
