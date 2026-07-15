/* ===================== CASH BOOK MODULE — with Delete ===================== */
const cashbookModule = (() => {
  let allEntries = [], curPage = 1;
  const PER_PAGE = 10;
  let formData = { customers:[], suppliers:[] };
  let filterFrom = '', filterTo = '', filterType = '', filterAccount = '';
  const BANK_OPTIONS = ['DBBL','BRAC','Cash','Other'];
  const TYPES = ['Customer','Investment','Supplier','Expense'];

  function resolveAccountName(e) {
    if (!e.refId) return '';
    const pool = e.type==='Customer' ? formData.customers : formData.suppliers;
    return pool.find(x=>x.id===e.refId)?.name || '';
  }

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
    curPage=1; renderBalance(); populateAccountFilter(); renderTable();
  }

  function populateAccountFilter() {
    const sel = document.getElementById('cbFilterAccount');
    if (!sel) return;
    const names = [...new Set(allEntries.map(resolveAccountName).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All Accounts</option>' + names.map(n=>`<option value="${n}"${n===filterAccount?' selected':''}>${n}</option>`).join('');
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
            <button class="btn btn-outline btn-sm" onclick="cashbookModule.printLedger()"><i class="bi bi-printer"></i> Print / Save</button>
            <button class="btn btn-outline btn-sm" onclick="cashbookModule.refresh()"><i class="bi bi-arrow-clockwise"></i></button>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f6;flex-wrap:wrap">
          <select id="cbFilterType" class="form-control" style="width:150px" onchange="cashbookModule.applyFilter()">
            <option value="">All Types</option>
            ${TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
          <select id="cbFilterAccount" class="form-control" style="width:180px" onchange="cashbookModule.applyFilter()">
            <option value="">All Accounts</option>
          </select>
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
      // Paying the Meta/Facebook Ads supplier → auto-mark oldest unpaid FB ad expenses as Paid (FIFO, whole-transaction only)
      let metaFifoPaid = [];
      if (type==='Supplier' && refId) {
        const supplierObj = formData.suppliers.find(s=>s.id===refId);
        if (supplierObj && supplierObj.name==='Meta/Facebook Ads') {
          const unpaidSnap = await window.db.collection('expenses')
            .where('category','==','Meta/Facebook Ads').where('status','==','Unpaid').get();
          const unpaidList = unpaidSnap.docs.map(d=>({id:d.id,...d.data()}))
            .sort((a,b)=>(a.date||'').localeCompare(b.date||''));
          let remaining = cashOut;
          for (const exp of unpaidList) {
            if ((exp.amount||0) > remaining) break;
            metaFifoPaid.push(exp);
            remaining -= (exp.amount||0);
          }
        }
      }

      const batch = window.db.batch();
      const ref = window.db.collection('cashBook').doc();
      batch.set(ref,{type,refId,particulars:note,cashIn,cashOut,amount,date,time,bankName,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      if (type==='Customer'&&refId) {
        batch.update(window.db.collection('customers').doc(refId),{totalCod:firebase.firestore.FieldValue.increment(-cashIn)});
      } else if (type==='Supplier'&&refId) {
        batch.update(window.db.collection('suppliers').doc(refId),{currentDue:firebase.firestore.FieldValue.increment(-cashOut)});
      }
      metaFifoPaid.forEach(exp => {
        batch.update(window.db.collection('expenses').doc(exp.id), { status:'Paid', paidAt:firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      // Sync to Google Sheets
      window.SheetsSync?.cashBook({ date:todayStr(), refId, particulars:note, cashIn, cashOut, type });
      if (metaFifoPaid.length) {
        const paidTotal = metaFifoPaid.reduce((s,e)=>s+(e.amount||0),0);
        toast(`Transaction Recorded! ${metaFifoPaid.length}টি FB Ad খরচ (${fmt(paidTotal)}) Paid হিসেবে mark হয়েছে।`,'success');
      } else {
        toast('Transaction Recorded!','success');
      }
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
    return allEntries.filter(e => {
      if (filterType && e.type!==filterType) return false;
      if (filterAccount && resolveAccountName(e)!==filterAccount) return false;
      if (filterFrom && e.date<filterFrom) return false;
      if (filterTo && e.date>filterTo) return false;
      return true;
    });
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
      <td style="font-weight:600">${r.particulars||'—'}<br><small style="color:#9ca3af">${r.type||''}${resolveAccountName(r)?' · '+resolveAccountName(r):''}${r.bankName?' · '+r.bankName:''}</small></td>
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
    filterType    = document.getElementById('cbFilterType')?.value || '';
    filterAccount = document.getElementById('cbFilterAccount')?.value || '';
    filterFrom    = document.getElementById('cbFilterFrom')?.value || '';
    filterTo      = document.getElementById('cbFilterTo')?.value || '';
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
    filterType=''; filterAccount=''; filterFrom=''; filterTo='';
    const tyEl=document.getElementById('cbFilterType'),acEl=document.getElementById('cbFilterAccount'),
          fEl=document.getElementById('cbFilterFrom'),tEl=document.getElementById('cbFilterTo'),mEl=document.getElementById('cbFilterMonth');
    if(tyEl)tyEl.value=''; if(acEl)acEl.value=''; if(fEl)fEl.value=''; if(tEl)tEl.value=''; if(mEl)mEl.value='';
    curPage=1; renderTable();
  }

  /* ── Print / Save Ledger (respects current type/account/date filter) ── */
  function printLedger() {
    const rows = [...filteredEntries()].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
    if (!rows.length) { toast('কোনো ডেটা নেই','error'); return; }

    const totalIn  = rows.reduce((s,e)=>s+(e.cashIn||0),0);
    const totalOut = rows.reduce((s,e)=>s+(e.cashOut||0),0);
    const typeLabel    = filterType || 'All Types';
    const accountLabel = filterAccount || 'All Accounts';
    const rangeLabel   = (filterFrom||filterTo) ? `${filterFrom?fmtDate(filterFrom):'Start'} – ${filterTo?fmtDate(filterTo):'Today'}` : 'Lifetime';
    const today = new Date().toLocaleDateString('en-BD',{day:'2-digit',month:'long',year:'numeric'});
    const title = accountLabel!=='All Accounts' ? accountLabel : typeLabel;

    const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Cash Book Ledger — ${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
  .tk{font-family:'Noto Sans Bengali','Inter',Arial,sans-serif}
  .page{max-width:960px;margin:0 auto;padding:30px 36px}
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
      <h1>Cash Book Ledger — ${title}</h1>
      <div class="sub">Type: ${typeLabel} &nbsp;·&nbsp; Account: ${accountLabel} &nbsp;·&nbsp; Period: ${rangeLabel}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b"><strong>Generated:</strong> ${today}</div>
  </div>

  <div class="summary">
    <div class="sum-card" style="border-left-color:#3949ab"><div class="sum-label">Transactions</div><div class="sum-val">${rows.length}</div></div>
    <div class="sum-card" style="border-left-color:#27ae60"><div class="sum-label">Total Cash In</div><div class="sum-val tk" style="color:#27ae60">${fmt(totalIn)}</div></div>
    <div class="sum-card" style="border-left-color:#e74c3c"><div class="sum-label">Total Cash Out</div><div class="sum-val tk" style="color:#e74c3c">${fmt(totalOut)}</div></div>
    <div class="sum-card" style="border-left-color:${(totalIn-totalOut)>=0?'#27ae60':'#e74c3c'}"><div class="sum-label">Net</div><div class="sum-val tk" style="color:${(totalIn-totalOut)>=0?'#27ae60':'#e74c3c'}">${fmt(totalIn-totalOut)}</div></div>
  </div>

  <table>
    <thead><tr><th>Date &amp; Time</th><th>Type</th><th>Account</th><th>Particulars</th><th>Bank</th><th class="r">Cash In</th><th class="r">Cash Out</th></tr></thead>
    <tbody>
      ${rows.map(e=>`<tr>
        <td style="white-space:nowrap;color:#6b7280">${fmtDateTime(e.date,e.time)}</td>
        <td>${e.type||'—'}</td>
        <td>${resolveAccountName(e)||'—'}</td>
        <td>${e.particulars||'—'}</td>
        <td>${e.bankName||'—'}</td>
        <td class="r tk" style="font-weight:700;color:#27ae60">${(e.cashIn||0)>0?fmt(e.cashIn):'—'}</td>
        <td class="r tk" style="font-weight:700;color:#e74c3c">${(e.cashOut||0)>0?fmt(e.cashOut):'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer"><div>GentiX Fashion ERP — Cash Book Ledger Report</div><div>${today}</div></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script>
async function dlImg(){
  const np=document.querySelectorAll('.no-print');
  np.forEach(e=>e.style.display='none');
  const c=await html2canvas(document.getElementById('rpt'),{scale:2,backgroundColor:'#fff',useCORS:true});
  np.forEach(e=>e.style.display='flex');
  const a=document.createElement('a');
  a.download='CashBook_Ledger_${title.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().substring(0,10)}.png';
  a.href=c.toDataURL('image/png');a.click();
}
</script>
</body></html>`;

    const win=window.open('','_blank','width=1000,height=750,scrollbars=yes');
    win.document.write(html); win.document.close();
  }

  return {load,toggleRefList,toggleBankOther,save,del,changePage,refresh,applyFilter,pickMonth,clearFilter,printLedger};
})();
