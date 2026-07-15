/* ===================== PERSONAL LEDGER (Lending Tracker + Profit/Expense Tracker) ===================== */
const ledgerModule = (() => {
  let allHistory = [], filteredHistory = [], curPage = 1;
  const PER_PAGE = 6;
  const DEFAULT_NAMES = ["Chandan Mandal", "Nitai Biswas", "Prollad Bose", "Dola Mandal"];
  let PERSON_NAMES = [...DEFAULT_NAMES];

  let activeTab = 'lending';
  let profitEntries = [], profitFiltered = [], profitPage = 1;
  const PROFIT_PER_PAGE = 8;
  const PROFIT_CATEGORIES = ['Salary / Personal Use','Rent','Food / Groceries','Bills / Utilities','Shopping','Medical','Transport','Education','Others'];
  const PROFIT_SOURCES = ['Business Profit / Salary','External / Other Income'];

  async function load() {
    // Load custom names from Firestore
    try {
      const snap = await window.db.collection('settings').doc('config').get();
      if (snap.exists && snap.data().ledgerNames?.length) {
        PERSON_NAMES = [...DEFAULT_NAMES, ...snap.data().ledgerNames.filter(n => !DEFAULT_NAMES.includes(n))];
      }
    } catch(e) {}
    renderShell();
    await fetchData();
  }

  /* ===================== SHELL + TAB SWITCHER ===================== */
  function renderShell() {
    document.getElementById('section-ledger').innerHTML = `
    <div class="table-card mb-3" style="padding:6px;display:flex;gap:6px">
      <button id="tabBtn-lending" class="btn btn-sm" onclick="ledgerModule.switchTab('lending')"
        style="flex:1;justify-content:center;padding:10px;font-weight:700;background:#3949ab;color:#fff;border:none">
        <i class="bi bi-people-fill me-1"></i> Lending Ledger
      </button>
      <button id="tabBtn-profit" class="btn btn-sm btn-outline" onclick="ledgerModule.switchTab('profit')"
        style="flex:1;justify-content:center;padding:10px;font-weight:700">
        <i class="bi bi-piggy-bank-fill me-1"></i> Profit &amp; Expense Tracker
      </button>
    </div>
    <div id="ledger-tab-content"></div>`;
  }

  function switchTab(tab) {
    activeTab = tab;
    const lBtn = document.getElementById('tabBtn-lending'), pBtn = document.getElementById('tabBtn-profit');
    if (tab === 'lending') {
      if(lBtn){lBtn.style.background='#3949ab';lBtn.style.color='#fff';lBtn.classList.remove('btn-outline');}
      if(pBtn){pBtn.style.background='';pBtn.style.color='';pBtn.classList.add('btn-outline');}
      renderLayout(); renderTopBalance(_lastNetBalance); renderSummaryTable(_lastSummaries); renderTable();
    } else {
      if(pBtn){pBtn.style.background='#16a34a';pBtn.style.color='#fff';pBtn.classList.remove('btn-outline');}
      if(lBtn){lBtn.style.background='';lBtn.style.color='';lBtn.classList.add('btn-outline');}
      renderProfitLayout();
      fetchProfitData();
    }
    if (typeof makeMobileReady === 'function' && typeof isMobile === 'function' && isMobile()) {
      setTimeout(makeMobileReady, 150);
    }
  }

  /* ===================== LENDING LEDGER (existing logic, unchanged) ===================== */
  let _lastNetBalance = 0, _lastSummaries = [];

  async function fetchData() {
    const snap = await window.db.collection('personalLedger').orderBy('date','asc').get();
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const personData = {};
    entries.forEach(e => {
      const name = e.personName;
      if (!personData[name]) personData[name] = { totalPaid: 0, totalSpent: 0, balance: 0, entries: [] };
      personData[name].totalPaid  += (e.cashIn  || 0);
      personData[name].totalSpent += (e.cashOut || 0);
      personData[name].balance     = personData[name].totalPaid - personData[name].totalSpent;
      personData[name].entries.push(e);
    });

    const histWithBal = [];
    const runBal = {};
    entries.forEach(e => {
      const name = e.personName;
      runBal[name] = (runBal[name] || 0) + (e.cashIn || 0) - (e.cashOut || 0);
      histWithBal.push({ ...e, runBalance: runBal[name] });
    });
    allHistory = histWithBal.reverse();
    filteredHistory = [...allHistory];

    const summaries = Object.entries(personData).map(([name, d]) => ({
      name, paid: d.totalPaid, spent: d.totalSpent, balance: d.balance
    }));
    const netBalance = summaries.reduce((s, x) => s + x.balance, 0);
    _lastNetBalance = netBalance; _lastSummaries = summaries;

    renderLayout();
    renderTopBalance(netBalance);
    renderSummaryTable(summaries);
    curPage = 1;
    renderTable();
  }

  function renderLayout() {
    if (activeTab !== 'lending') return;
    document.getElementById('ledger-tab-content').innerHTML = `

    <div id="ledger-top-row" style="display:grid;grid-template-columns:1fr 2fr;gap:1rem;margin-bottom:1rem">
      <div class="table-card" style="padding:16px;text-align:center">
        <small style="color:#6b7280;text-transform:uppercase;font-weight:700;font-size:11px">Overall Net Balance</small>
        <div id="topNetBalance" style="font-size:26px;font-weight:800;color:#3949ab;margin:6px 0">৳ 0</div>
        <small id="overallStatus" style="font-weight:700"></small>
      </div>
      <div class="table-card" style="padding:14px">
        <input type="text" id="searchPerson" class="form-control" style="width:100%"
          placeholder="🔍 Search Person Name or Note..." oninput="ledgerModule.filterHistory()">
        <span style="color:#6b7280;font-size:12px;display:block;margin-top:6px">Filtering: <strong id="filterLabel">All Entries</strong></span>
      </div>
    </div>

    <div id="ledger-main-grid" style="display:grid;grid-template-columns:1fr 2fr;gap:1.2rem">

      <div id="ledger-form-col" class="table-card" style="padding:18px">
        <h5 style="font-weight:700;color:#212529;margin-bottom:16px">
          <i class="bi bi-plus-circle-fill" style="color:#3949ab"></i> New Transaction
        </h5>
        <div style="position:relative;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label class="form-label" style="margin:0">Person Name</label>
            <button onclick="ledgerModule.showManageNames()" class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 8px">
              <i class="bi bi-person-plus"></i> Manage
            </button>
          </div>
          <input type="text" id="pName" class="form-control" placeholder="Tap to select or type..."
            autocomplete="off" onclick="ledgerModule.toggleDropdown()" oninput="ledgerModule.filterNames()">
          <div id="nameDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:1050;background:#fff;border:1px solid #ced4da;border-radius:0 0 10px 10px;max-height:200px;overflow-y:auto;box-shadow:0 4px 6px rgba(0,0,0,.1)">
            ${PERSON_NAMES.map(nm=>`<div onclick="ledgerModule.selectName('${nm}')" style="padding:12px 14px;cursor:pointer;border-bottom:1px solid #f3f4f6;font-size:14px">${nm}</div>`).join('')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="form-group">
            <label class="form-label" style="color:#27ae60">I Paid (Cash In)</label>
            <input type="number" id="pPaid" class="form-control" placeholder="0" style="border-color:#27ae60">
          </div>
          <div class="form-group">
            <label class="form-label" style="color:#e74c3c">He Spent (Cash Out)</label>
            <input type="number" id="pSpent" class="form-control" placeholder="0" style="border-color:#e74c3c">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Note / Reason</label>
          <input type="text" id="pNote" class="form-control" placeholder="What is this for?">
        </div>
        <button id="ledgerSaveBtn" onclick="ledgerModule.saveEntry()" class="btn btn-primary"
          style="width:100%;padding:12px;font-size:14px;justify-content:center">
          <i class="bi bi-save"></i> Save Entry
        </button>
      </div>

      <div id="ledger-table-col">
        <div class="table-card" style="margin-bottom:12px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:14px">Person-wise Net Balance</div>
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
            <table class="data-table" style="min-width:360px"><thead><tr>
              <th>Name</th><th>Total Paid</th><th>Total Spent</th><th>Net Balance</th>
            </tr></thead><tbody id="summaryTableBody"></tbody></table>
          </div>
        </div>
        <div class="table-card" style="overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700;font-size:14px">Full Transaction History</span>
            <div style="display:flex;gap:8px">
              <button class="btn btn-outline btn-sm" onclick="ledgerModule.printLedger()"><i class="bi bi-printer"></i> Print / Save</button>
              <button class="btn btn-outline btn-sm" onclick="ledgerModule.load()"><i class="bi bi-arrow-clockwise"></i></button>
            </div>
          </div>
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
            <table class="data-table" style="min-width:500px"><thead><tr>
              <th>Date</th><th>Person &amp; Note</th>
              <th style="color:#27ae60">Paid (+)</th><th style="color:#e74c3c">Spent (-)</th>
              <th>Balance</th><th>Status</th>
            </tr></thead><tbody id="pHistoryBody"></tbody></table>
          </div>
          <div style="padding:10px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:center;align-items:center;gap:10px">
            <button class="btn btn-outline btn-sm" id="lPrevBtn" onclick="ledgerModule.changePage(-1)">◀</button>
            <span id="lPageInfo" style="font-size:12px;color:#6b7280;font-weight:600">Page 1 of 1</span>
            <button class="btn btn-outline btn-sm" id="lNextBtn" onclick="ledgerModule.changePage(1)">▶</button>
          </div>
        </div>
      </div>
    </div>`;

    document.addEventListener('click', e => {
      if (!document.getElementById('pName')?.contains(e.target)) {
        const dd = document.getElementById('nameDropdown');
        if (dd) dd.style.display = 'none';
      }
    });
  }

  function toggleDropdown() {
    const dd = document.getElementById('nameDropdown');
    if (dd) dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
  }

  function selectName(name) {
    const el = document.getElementById('pName');
    if (el) el.value = name;
    const dd = document.getElementById('nameDropdown');
    if (dd) dd.style.display = 'none';
  }

  function filterNames() {
    const q = (document.getElementById('pName')?.value || '').toLowerCase();
    const dd = document.getElementById('nameDropdown');
    if (!dd) return;
    const filtered = PERSON_NAMES.filter(n => n.toLowerCase().includes(q));
    dd.innerHTML = filtered.map(n =>
      `<div onclick="ledgerModule.selectName('${n}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f3f4f6;font-size:13.5px" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''">${n}</div>`
    ).join('') || '<div style="padding:10px 14px;color:#9ca3af;font-size:13px">No match</div>';
    dd.style.display = 'block';
  }

  function renderTopBalance(netBalance) {
    const el = document.getElementById('topNetBalance');
    const st = document.getElementById('overallStatus');
    if (el) el.textContent = '৳ ' + Math.abs(netBalance).toLocaleString();
    if (st) {
      st.textContent = netBalance > 0 ? 'OVERALL RECEIVABLE (পাবেন)' : netBalance < 0 ? 'OVERALL PAYABLE (দেবেন)' : 'ALL SETTLED';
      st.style.color = netBalance > 0 ? '#27ae60' : netBalance < 0 ? '#e74c3c' : '#6b7280';
    }
  }

  function renderSummaryTable(summaries) {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    if (!summaries.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af">No data</td></tr>'; return; }
    tbody.innerHTML = summaries.map(r => {
      const cls = r.balance > 0 ? 'color:#27ae60' : r.balance < 0 ? 'color:#e74c3c' : 'color:#9ca3af';
      return `<tr><td style="font-weight:700">${r.name}</td>
        <td style="color:#27ae60">${fmt(r.paid)}</td>
        <td style="color:#e74c3c">${fmt(r.spent)}</td>
        <td style="font-weight:700;${cls}">${fmt(Math.abs(r.balance))} ${r.balance>0?'(পাবেন)':r.balance<0?'(দেবেন)':''}</td>
      </tr>`;
    }).join('');
  }

  function renderTable() {
    const tbody = document.getElementById('pHistoryBody');
    if (!tbody) return;
    const totalPages = Math.ceil(filteredHistory.length / PER_PAGE) || 1;
    const page = filteredHistory.slice((curPage-1)*PER_PAGE, curPage*PER_PAGE);
    if (!page.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#9ca3af">No records found</td></tr>'; updatePagination(totalPages); return; }
    tbody.innerHTML = page.map(r => {
      const bal = r.runBalance || 0;
      const statusTxt = bal > 0 ? 'Receivable' : bal < 0 ? 'Payable' : 'Settled';
      const statusCls = bal > 0 ? 'badge-success' : bal < 0 ? 'badge-danger' : 'badge-gray';
      return `<tr>
        <td><small style="color:#9ca3af">${fmtDate(r.date)}</small></td>
        <td><div style="font-weight:700">${r.personName}</div><small style="color:#9ca3af">${r.note||''}</small></td>
        <td style="color:#27ae60;font-weight:700">${(r.cashIn||0)>0?fmt(r.cashIn):'—'}</td>
        <td style="color:#e74c3c;font-weight:700">${(r.cashOut||0)>0?fmt(r.cashOut):'—'}</td>
        <td style="font-weight:700">${fmt(Math.abs(bal))}</td>
        <td><span class="badge ${statusCls}">${statusTxt}</span></td>
        <td>
          <button class="action-btn" onclick="ledgerModule.showEdit('${r.id}','${r.personName.replace(/'/g,"\\'")}',${r.cashIn||0},${r.cashOut||0},'${(r.note||'').replace(/'/g,"\\'")}','${r.date||''}')" title="Edit"><i class="bi bi-pencil-square"></i></button>
          <button class="action-btn" onclick="ledgerModule.delEntry('${r.id}')" title="Delete"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
    }).join('');
    updatePagination(totalPages);
  }

  function updatePagination(totalPages) {
    const info = document.getElementById('lPageInfo');
    const prev = document.getElementById('lPrevBtn');
    const next = document.getElementById('lNextBtn');
    if(info) info.textContent=`Page ${curPage} of ${totalPages}`;
    if(prev) prev.disabled=curPage===1;
    if(next) next.disabled=curPage===totalPages;
  }

  function changePage(step) {
    const tp = Math.ceil(filteredHistory.length/PER_PAGE)||1;
    const np = curPage+step;
    if(np>=1&&np<=tp){curPage=np;renderTable();}
  }

  function filterHistory() {
    const q = (document.getElementById('searchPerson')?.value||'').toLowerCase();
    const lbl = document.getElementById('filterLabel');
    if(!q){ filteredHistory=[...allHistory]; if(lbl) lbl.textContent='All Entries'; }
    else {
      filteredHistory = allHistory.filter(r => r.personName.toLowerCase().includes(q)||(r.note||'').toLowerCase().includes(q));
      if(lbl) lbl.textContent = q.toUpperCase();
    }
    curPage=1; renderTable();
  }

  async function saveEntry() {
    const name  = document.getElementById('pName')?.value.trim();
    const paid  = n(document.getElementById('pPaid')?.value);
    const spent = n(document.getElementById('pSpent')?.value);
    const note  = document.getElementById('pNote')?.value.trim() || 'General';
    const btn   = document.getElementById('ledgerSaveBtn');

    if (!name) { toast('Please enter or select a person name!','error'); return; }
    if (!paid && !spent) { toast('Please enter an amount!','error'); return; }

    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Saving…';

    try {
      // Use in-memory allHistory to avoid composite index requirement
      const personEntries = allHistory.filter(e => e.personName === name);
      const lastBal = personEntries.length > 0 ? (personEntries[0].runBalance || 0) : 0;
      const runBalance = lastBal + paid - spent;

      await window.db.collection('personalLedger').add({
        personName: name, note, cashIn: paid, cashOut: spent, runBalance,
        date: todayStr(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.SheetsSync?.personalLedger({ personName:name, note, cashIn:paid, cashOut:spent, date:todayStr() });
      toast('Entry Saved!','success');
      document.getElementById('pName').value='';
      document.getElementById('pPaid').value='';
      document.getElementById('pSpent').value='';
      document.getElementById('pNote').value='';
      btn.disabled=false; btn.innerHTML='<i class="bi bi-save"></i> Save Entry';
      await fetchData();
    } catch(e) { btn.disabled=false; btn.innerHTML='Save Entry'; toast('Error: '+e.message,'error'); }
  }

  function showManageNames() {
    const customNames = PERSON_NAMES.filter(n => !DEFAULT_NAMES.includes(n));
    openModal('Manage Person Names', `
      <div style="margin-bottom:14px">
        <p style="font-size:12px;color:#6b7280;margin-bottom:10px">Default names (পরিবর্তন হবে না):</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
          ${DEFAULT_NAMES.map(n=>`<span style="background:#f0f4ff;color:#3949ab;padding:4px 10px;border-radius:20px;font-size:12px">${n}</span>`).join('')}
        </div>
        <p style="font-size:12px;color:#6b7280;margin-bottom:8px">আপনার custom names:</p>
        <div id="customNamesList" style="display:flex;flex-wrap:wrap;gap:6px;min-height:30px;margin-bottom:12px">
          ${customNames.length ? customNames.map(n=>`
            <span style="background:#f9fafb;border:1px solid #e5e7eb;padding:4px 10px;border-radius:20px;font-size:12px;display:flex;align-items:center;gap:6px">
              ${n}
              <i class="bi bi-x-circle" style="color:#e74c3c;cursor:pointer" onclick="ledgerModule.removeName('${n}')"></i>
            </span>`).join('') : '<span style="color:#9ca3af;font-size:12px">কোনো custom name নেই</span>'}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="newPersonName" class="form-control" placeholder="নতুন নাম লিখুন..." style="flex:1">
          <button class="btn btn-primary" onclick="ledgerModule.addName()">Add</button>
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="closeModal()">Close</button>`);
  }

  async function addName() {
    const input = document.getElementById('newPersonName');
    const name = input?.value.trim();
    if (!name) { toast('নাম লিখুন','error'); return; }
    if (PERSON_NAMES.includes(name)) { toast('এই নাম আগেই আছে','warning'); return; }
    PERSON_NAMES.push(name);
    const customNames = PERSON_NAMES.filter(n => !DEFAULT_NAMES.includes(n));
    await window.db.collection('settings').doc('config').set({ ledgerNames: customNames }, { merge: true });
    toast('নাম যোগ হয়েছে!','success');
    closeModal();
    renderLayout();
    await fetchData();
  }

  async function removeName(name) {
    if (!confirm(`"${name}" মুছবেন?`)) return;
    PERSON_NAMES = PERSON_NAMES.filter(n => n !== name);
    const customNames = PERSON_NAMES.filter(n => !DEFAULT_NAMES.includes(n));
    await window.db.collection('settings').doc('config').set({ ledgerNames: customNames }, { merge: true });
    toast('নাম মুছা হয়েছে','success');
    closeModal();
    renderLayout();
    await fetchData();
  }

  function showEdit(id, personName, cashIn, cashOut, note, date) {
    openModal('Edit Ledger Entry', `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Date</label>
          <input type="date" id="le-date" class="form-control" value="${date||todayStr()}"></div>
        <div class="form-group"><label class="form-label">Person Name</label>
          <input id="le-name" class="form-control" value="${personName}" readonly style="background:#f9fafb"></div>
        <div class="form-group"><label class="form-label" style="color:#27ae60">I Paid (Cash In)</label>
          <input type="number" id="le-paid" class="form-control" value="${cashIn}"></div>
        <div class="form-group"><label class="form-label" style="color:#e74c3c">He Spent (Cash Out)</label>
          <input type="number" id="le-spent" class="form-control" value="${cashOut}"></div>
        <div class="form-group full"><label class="form-label">Note</label>
          <input id="le-note" class="form-control" value="${note}"></div>
      </div>`,
      `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="ledgerModule.updateEntry('${id}')">Update Entry</button>`);
  }

  async function updateEntry(id) {
    const date  = document.getElementById('le-date')?.value;
    const paid  = n(document.getElementById('le-paid')?.value);
    const spent = n(document.getElementById('le-spent')?.value);
    const note  = document.getElementById('le-note')?.value.trim();
    if (!paid && !spent) { toast('Enter at least one amount','error'); return; }
    try {
      await window.db.collection('personalLedger').doc(id).update({
        date, cashIn:paid, cashOut:spent, note:note||'',
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      closeModal(); toast('Entry updated!','success'); await fetchData();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function delEntry(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await window.db.collection('personalLedger').doc(id).delete();
      toast('Entry deleted','success'); await fetchData();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  /* ===================== PROFIT & EXPENSE TRACKER (new) — fully standalone, no business module links ===================== */

  async function fetchProfitData() {
    const snap = await window.db.collection('profitLedger').orderBy('date','asc').get();
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    let runBal = 0;
    const withBal = entries.map(e => {
      runBal += e.type === 'Withdrawal' ? (e.amount||0) : -(e.amount||0);
      return { ...e, runBalance: runBal };
    });
    profitEntries = withBal.reverse();
    profitFiltered = [...profitEntries];
    profitPage = 1;
    renderProfitSummary();
    renderProfitIncomeBreakdown();
    renderProfitCategoryBreakdown();
    renderProfitTable();
  }

  function renderProfitLayout() {
    if (activeTab !== 'profit') return;
    document.getElementById('ledger-tab-content').innerHTML = `

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px" id="profit-summary-row">
      <div class="stat-card"><div class="stat-label">Total Withdrawn</div><div class="stat-value sv-green" id="pf-withdrawn">৳0</div></div>
      <div class="stat-card"><div class="stat-label">Total Spent</div><div class="stat-value sv-red" id="pf-spent">৳0</div></div>
      <div class="stat-card"><div class="stat-label">Balance in Hand</div><div class="stat-value sv-orange" id="pf-balance">৳0</div></div>
    </div>

    <div id="pf-main-grid" style="display:grid;grid-template-columns:1fr 1.8fr;gap:1.2rem">
      <div class="table-card" style="border-top:5px solid #16a34a">
        <div style="padding:20px">
          <h5 style="color:#16a34a;font-weight:700;margin-bottom:16px"><i class="bi bi-wallet2"></i> New Entry</h5>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Type *</label>
            <select id="pf-type" class="form-control" onchange="ledgerModule.toggleProfitCategory()">
              <option value="Withdrawal">Money In (Cash In)</option>
              <option value="Expense">Personal Expense (Cash Out)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Date *</label>
            <input type="date" id="pf-date" class="form-control" value="${todayStr()}">
          </div>
          <div id="pf-source-div" style="margin-bottom:12px" class="form-group">
            <label class="form-label">Source *</label>
            <select id="pf-source" class="form-control">
              ${PROFIT_SOURCES.map(s=>`<option>${s}</option>`).join('')}
            </select>
          </div>
          <div id="pf-category-div" style="display:none;margin-bottom:12px" class="form-group">
            <label class="form-label">Category *</label>
            <select id="pf-category" class="form-control">
              ${PROFIT_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Note</label>
            <input type="text" id="pf-note" class="form-control" placeholder="e.g. June salary, Bank transfer, Bazar">
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label class="form-label">Amount (৳) *</label>
            <input type="number" id="pf-amount" class="form-control" min="1" step="0.01">
          </div>
          <button id="pfSaveBtn" onclick="ledgerModule.saveProfitEntry()" class="btn btn-primary" style="width:100%;padding:12px;font-size:14px;background:#16a34a;border-color:#16a34a;justify-content:center">
            <i class="bi bi-check-circle"></i> Save Entry
          </button>
        </div>
      </div>

      <div>
        <div class="pf-breakdown-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="table-card" style="overflow:hidden">
            <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:14px"><i class="bi bi-piggy-bank-fill me-2" style="color:#16a34a"></i>Income by Source (Lifetime)</div>
            <div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Source</th><th style="text-align:center">Txns</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody id="pf-source-body"></tbody></table></div>
          </div>
          <div class="table-card" style="overflow:hidden">
            <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:14px"><i class="bi bi-pie-chart-fill me-2" style="color:#e74c3c"></i>Spending by Category (Lifetime)</div>
            <div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Category</th><th style="text-align:center">Txns</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody id="pf-cat-body"></tbody></table></div>
          </div>
        </div>
        <div class="table-card" style="overflow:hidden;margin-bottom:12px">
          <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700;font-size:14px">Transaction History</span>
            <button class="btn btn-outline btn-sm" onclick="ledgerModule.fetchProfitData()"><i class="bi bi-arrow-clockwise"></i></button>
          </div>
          <div style="overflow-x:auto"><table class="data-table"><thead><tr>
            <th>Date</th><th>Source / Category</th><th>Note</th>
            <th style="text-align:right;color:#27ae60">Withdrawn</th><th style="text-align:right;color:#e74c3c">Spent</th>
            <th style="text-align:right">Balance</th><th>Actions</th>
          </tr></thead><tbody id="pf-history-body"></tbody></table></div>
          <div style="padding:10px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:center;align-items:center;gap:10px">
            <button class="btn btn-outline btn-sm" id="pfPrevBtn" onclick="ledgerModule.changeProfitPage(-1)">◀</button>
            <span id="pfPageInfo" style="font-size:12px;color:#6b7280;font-weight:600">Page 1 of 1</span>
            <button class="btn btn-outline btn-sm" id="pfNextBtn" onclick="ledgerModule.changeProfitPage(1)">▶</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function toggleProfitCategory() {
    const type = document.getElementById('pf-type')?.value;
    const catDiv = document.getElementById('pf-category-div');
    const srcDiv = document.getElementById('pf-source-div');
    if (catDiv) catDiv.style.display = type === 'Expense' ? 'block' : 'none';
    if (srcDiv) srcDiv.style.display = type === 'Withdrawal' ? 'block' : 'none';
  }

  function renderProfitSummary() {
    const totalWithdrawn = profitEntries.filter(e=>e.type==='Withdrawal').reduce((s,e)=>s+(e.amount||0),0);
    const totalSpent = profitEntries.filter(e=>e.type==='Expense').reduce((s,e)=>s+(e.amount||0),0);
    const balance = totalWithdrawn - totalSpent;
    setEl('pf-withdrawn', fmt(totalWithdrawn));
    setEl('pf-spent', fmt(totalSpent));
    setEl('pf-balance', fmt(balance));
  }

  function renderProfitCategoryBreakdown() {
    const tbody = document.getElementById('pf-cat-body');
    if (!tbody) return;
    const catMap = {};
    profitEntries.filter(e=>e.type==='Expense').forEach(e=>{
      const c = e.category||'Others';
      if(!catMap[c]) catMap[c]={count:0,total:0};
      catMap[c].count++; catMap[c].total+=e.amount||0;
    });
    const rows = Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total);
    tbody.innerHTML = rows.length ? rows.map(([cat,d])=>`<tr>
      <td style="padding-left:14px"><span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700">${cat}</span></td>
      <td style="text-align:center">${d.count}</td>
      <td style="text-align:right;font-weight:700;color:#e74c3c;padding-right:14px">${fmt(d.total)}</td>
    </tr>`).join('') : '<tr><td colspan="3" style="text-align:center;padding:14px;color:#9ca3af">কোনো খরচ এখনো যোগ হয়নি</td></tr>';
  }

  function renderProfitIncomeBreakdown() {
    const tbody = document.getElementById('pf-source-body');
    if (!tbody) return;
    const srcMap = {};
    profitEntries.filter(e=>e.type==='Withdrawal').forEach(e=>{
      const s = e.source||'Business Profit / Salary';
      if(!srcMap[s]) srcMap[s]={count:0,total:0};
      srcMap[s].count++; srcMap[s].total+=e.amount||0;
    });
    const rows = Object.entries(srcMap).sort((a,b)=>b[1].total-a[1].total);
    tbody.innerHTML = rows.length ? rows.map(([src,d])=>`<tr>
      <td style="padding-left:14px"><span style="background:#dcfce7;color:#166534;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700">${src}</span></td>
      <td style="text-align:center">${d.count}</td>
      <td style="text-align:right;font-weight:700;color:#16a34a;padding-right:14px">${fmt(d.total)}</td>
    </tr>`).join('') : '<tr><td colspan="3" style="text-align:center;padding:14px;color:#9ca3af">কোনো টাকা এখনো যোগ হয়নি</td></tr>';
  }

  function renderProfitTable() {
    const tbody = document.getElementById('pf-history-body');
    if (!tbody) return;
    const tp = Math.ceil(profitFiltered.length/PROFIT_PER_PAGE) || 1;
    const page = profitFiltered.slice((profitPage-1)*PROFIT_PER_PAGE, profitPage*PROFIT_PER_PAGE);
    if (!page.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af">কোনো এন্ট্রি নেই</td></tr>'; updateProfitPagination(0); return; }
    tbody.innerHTML = page.map(r => {
      const isW = r.type === 'Withdrawal';
      const tag = isW
        ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${r.source||'Business Profit / Salary'}</span>`
        : `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${r.category||'Others'}</span>`;
      return `<tr>
        <td><small style="color:#9ca3af">${fmtDate(r.date)}</small></td>
        <td>${tag}</td>
        <td style="font-size:13px">${r.note||'—'}</td>
        <td style="text-align:right;color:#27ae60;font-weight:700">${isW?fmt(r.amount):'—'}</td>
        <td style="text-align:right;color:#e74c3c;font-weight:700">${!isW?fmt(r.amount):'—'}</td>
        <td style="text-align:right;font-weight:700">${fmt(r.runBalance||0)}</td>
        <td>
          <button class="action-btn" onclick="ledgerModule.delProfitEntry('${r.id}')" title="Delete"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
    }).join('');
    updateProfitPagination(tp);
  }

  function updateProfitPagination(tp) {
    const i=document.getElementById('pfPageInfo'), p=document.getElementById('pfPrevBtn'), nx=document.getElementById('pfNextBtn');
    if(i) i.textContent = `Page ${profitPage} of ${tp||1}`;
    if(p) p.disabled = profitPage===1;
    if(nx) nx.disabled = profitPage===tp||tp===0;
  }

  function changeProfitPage(step) {
    const tp = Math.ceil(profitFiltered.length/PROFIT_PER_PAGE)||1;
    const np = profitPage+step;
    if(np>=1&&np<=tp){profitPage=np;renderProfitTable();}
  }

  async function saveProfitEntry() {
    const type = document.getElementById('pf-type')?.value;
    const date = document.getElementById('pf-date')?.value || todayStr();
    const category = type==='Expense' ? document.getElementById('pf-category')?.value : null;
    const source = type==='Withdrawal' ? document.getElementById('pf-source')?.value : null;
    const note = document.getElementById('pf-note')?.value.trim();
    const amount = n(document.getElementById('pf-amount')?.value);
    const btn = document.getElementById('pfSaveBtn');
    if (!date) { toast('Date is required','error'); return; }
    if (!amount) { toast('Amount is required','error'); return; }

    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Saving…';
    try {
      await window.db.collection('profitLedger').add({
        type, date, category, source, note: note||'', amount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('Entry saved!','success');
      document.getElementById('pf-note').value='';
      document.getElementById('pf-amount').value='';
      btn.disabled=false; btn.innerHTML='<i class="bi bi-check-circle"></i> Save Entry';
      await fetchProfitData();
    } catch(e) { btn.disabled=false; btn.innerHTML='Save Entry'; toast('Error: '+e.message,'error'); }
  }

  async function delProfitEntry(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await window.db.collection('profitLedger').doc(id).delete();
      toast('Entry deleted','success'); await fetchProfitData();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  function setEl(id,v){const el=document.getElementById(id);if(el)el.innerHTML=v;}

  /* ── Print / Save Personal Ledger (respects current search filter) ── */
  function printLedger() {
    const rows = [...filteredHistory].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    if (!rows.length) { toast('কোনো ডেটা নেই','error'); return; }

    const q = document.getElementById('searchPerson')?.value.trim();
    const scopeLabel = q ? `Filtered: "${q}"` : 'All Entries';
    const totalPaid = rows.reduce((s,e)=>s+(e.cashIn||0),0);
    const totalSpent = rows.reduce((s,e)=>s+(e.cashOut||0),0);
    const today = new Date().toLocaleDateString('en-BD',{day:'2-digit',month:'long',year:'numeric'});

    const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Personal Ledger — ${scopeLabel}</title>
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
  .sect-title{font-size:13px;font-weight:800;color:#1e3a5f;margin:20px 0 8px}
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
      <h1>Personal Ledger — ${scopeLabel}</h1>
      <div class="sub">Overall Net Balance: ${fmt(Math.abs(_lastNetBalance))} ${_lastNetBalance>0?'(Receivable)':_lastNetBalance<0?'(Payable)':'(Settled)'}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b"><strong>Generated:</strong> ${today}</div>
  </div>

  <div class="summary">
    <div class="sum-card" style="border-left-color:#3949ab"><div class="sum-label">Transactions</div><div class="sum-val">${rows.length}</div></div>
    <div class="sum-card" style="border-left-color:#27ae60"><div class="sum-label">Total Paid</div><div class="sum-val tk" style="color:#27ae60">${fmt(totalPaid)}</div></div>
    <div class="sum-card" style="border-left-color:#e74c3c"><div class="sum-label">Total Spent</div><div class="sum-val tk" style="color:#e74c3c">${fmt(totalSpent)}</div></div>
    <div class="sum-card" style="border-left-color:${(totalPaid-totalSpent)>=0?'#27ae60':'#e74c3c'}"><div class="sum-label">Net</div><div class="sum-val tk" style="color:${(totalPaid-totalSpent)>=0?'#27ae60':'#e74c3c'}">${fmt(totalPaid-totalSpent)}</div></div>
  </div>

  <div class="sect-title">Person-wise Net Balance</div>
  <table>
    <thead><tr><th>Name</th><th class="r">Total Paid</th><th class="r">Total Spent</th><th class="r">Net Balance</th></tr></thead>
    <tbody>
      ${_lastSummaries.map(r=>`<tr>
        <td>${r.name}</td>
        <td class="r tk" style="color:#27ae60">${fmt(r.paid)}</td>
        <td class="r tk" style="color:#e74c3c">${fmt(r.spent)}</td>
        <td class="r tk" style="font-weight:700;color:${r.balance>=0?'#27ae60':'#e74c3c'}">${fmt(Math.abs(r.balance))} ${r.balance>0?'(Receivable)':r.balance<0?'(Payable)':''}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="sect-title">Full Transaction History</div>
  <table>
    <thead><tr><th>Date</th><th>Person &amp; Note</th><th class="r">Paid (+)</th><th class="r">Spent (-)</th><th class="r">Balance</th></tr></thead>
    <tbody>
      ${rows.map(r=>`<tr>
        <td style="white-space:nowrap;color:#6b7280">${fmtDate(r.date)}</td>
        <td>${r.personName}${r.note?' — '+r.note:''}</td>
        <td class="r tk" style="color:#27ae60">${(r.cashIn||0)>0?fmt(r.cashIn):'—'}</td>
        <td class="r tk" style="color:#e74c3c">${(r.cashOut||0)>0?fmt(r.cashOut):'—'}</td>
        <td class="r tk" style="font-weight:700">${fmt(Math.abs(r.runBalance||0))}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer"><div>GentiX Fashion ERP — Personal Ledger Report</div><div>${today}</div></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script>
async function dlImg(){
  const np=document.querySelectorAll('.no-print');
  np.forEach(e=>e.style.display='none');
  const c=await html2canvas(document.getElementById('rpt'),{scale:2,backgroundColor:'#fff',useCORS:true});
  np.forEach(e=>e.style.display='flex');
  const a=document.createElement('a');
  a.download='Personal_Ledger_${new Date().toISOString().substring(0,10)}.png';
  a.href=c.toDataURL('image/png');a.click();
}
</script>
</body></html>`;

    const win=window.open('','_blank','width=1000,height=750,scrollbars=yes');
    win.document.write(html); win.document.close();
  }

  return {
    load, switchTab,
    // lending
    toggleDropdown, selectName, filterNames, filterHistory, saveEntry, showManageNames, addName, removeName, showEdit, updateEntry, delEntry, changePage, printLedger,
    // profit tracker
    toggleProfitCategory, saveProfitEntry, delProfitEntry, changeProfitPage, fetchProfitData
  };
})();
