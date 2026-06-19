/* ===================== PERSONAL LEDGER (matching PersonalUI.html + PersonalLogic.gs) ===================== */
const ledgerModule = (() => {
  let allHistory = [], filteredHistory = [], curPage = 1;
  const PER_PAGE = 6;
  const DEFAULT_NAMES = ["Chandan Mandal", "Nitai Biswas", "Prollad Bose", "Dola Mandal"];
  let PERSON_NAMES = [...DEFAULT_NAMES];

  async function load() {
    // Load custom names from Firestore
    try {
      const snap = await window.db.collection('settings').doc('config').get();
      if (snap.exists && snap.data().ledgerNames?.length) {
        PERSON_NAMES = [...DEFAULT_NAMES, ...snap.data().ledgerNames.filter(n => !DEFAULT_NAMES.includes(n))];
      }
    } catch(e) {}
    renderLayout();
    await fetchData();
  }

  async function fetchData() {
    const snap = await window.db.collection('personalLedger').orderBy('createdAt','asc').get();
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build per-person running balance (matching PersonalLogic.gs behavior)
    const personData = {};
    entries.forEach(e => {
      const name = e.personName;
      if (!personData[name]) personData[name] = { totalPaid: 0, totalSpent: 0, balance: 0, entries: [] };
      personData[name].totalPaid  += (e.cashIn  || 0);
      personData[name].totalSpent += (e.cashOut || 0);
      personData[name].balance     = personData[name].totalPaid - personData[name].totalSpent;
      personData[name].entries.push(e);
    });

    // Build history with running per-person balance
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

    renderTopBalance(netBalance);
    renderSummaryTable(summaries);
    curPage = 1;
    renderTable();
  }

  function renderLayout() {
    document.getElementById('section-ledger').innerHTML = `
    <!-- TOP ROW -->
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:1rem;margin-bottom:1rem">
      <div class="table-card" style="padding:20px;text-align:center;background:white">
        <small style="color:#6b7280;text-transform:uppercase;font-weight:700;font-size:11px">Overall Net Balance</small>
        <div id="topNetBalance" style="font-size:28px;font-weight:800;color:#3949ab;margin:6px 0">৳ 0</div>
        <small id="overallStatus" style="font-weight:700"></small>
      </div>
      <div class="table-card" style="padding:16px;display:flex;align-items:center;gap:16px">
        <input type="text" id="searchPerson" class="search-box" style="width:280px"
          placeholder="🔍 Search Person Name or Note..." oninput="ledgerModule.filterHistory()">
        <span style="color:#6b7280;font-size:13px">Filtering: <strong id="filterLabel">All Entries</strong></span>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:1rem">

      <!-- LEFT: Form -->
      <div class="table-card" style="padding:20px;position:sticky;top:20px">
        <h5 style="font-weight:700;color:#212529;margin-bottom:18px"><i class="bi bi-plus-circle-fill" style="color:#3949ab"></i> New Transaction</h5>

        <!-- Person Name with dropdown -->
        <div style="position:relative;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label class="form-label" style="margin:0">Person Name</label>
            <button onclick="ledgerModule.showManageNames()" class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 8px">
              <i class="bi bi-person-plus"></i> Manage Names
            </button>
          </div>
          <input type="text" id="pName" class="form-control" placeholder="Click to select or type name..."
            autocomplete="off" onclick="ledgerModule.toggleDropdown()" oninput="ledgerModule.filterNames()">
          <div id="nameDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:1050;background:#fff;border:1px solid #ced4da;border-radius:0 0 10px 10px;max-height:200px;overflow-y:auto;box-shadow:0 4px 6px rgba(0,0,0,.1)">
            ${PERSON_NAMES.map(nm=>`<div onclick="ledgerModule.selectName('${nm}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f3f4f6;font-size:13.5px" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''">${nm}</div>`).join('')}
          </div>
        </div>

        <div class="form-grid" style="margin-bottom:12px">
          <div class="form-group">
            <label class="form-label" style="color:#27ae60">I Paid (Cash In)</label>
            <input type="number" id="pPaid" class="form-control" placeholder="0" style="border-color:#27ae60">
          </div>
          <div class="form-group">
            <label class="form-label" style="color:#e74c3c">He Spent (Cash Out)</label>
            <input type="number" id="pSpent" class="form-control" placeholder="0" style="border-color:#e74c3c">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label">Note / Reason</label>
          <input type="text" id="pNote" class="form-control" placeholder="What is this for?">
        </div>
        <button id="ledgerSaveBtn" onclick="ledgerModule.saveEntry()" class="btn btn-primary" style="width:100%;padding:11px;font-size:14px;justify-content:center">
          <i class="bi bi-save"></i> Save Entry
        </button>
      </div>

      <!-- RIGHT: Tables -->
      <div>
        <!-- Summary Table -->
        <div class="table-card" style="margin-bottom:1rem;overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:14px">Person-wise Net Balance</div>
          <div style="max-height:220px;overflow-y:auto">
            <table class="data-table"><thead><tr>
              <th>Name</th><th>Total Paid</th><th>Total Spent</th><th>Net Balance</th>
            </tr></thead><tbody id="summaryTableBody"></tbody></table>
          </div>
        </div>

        <!-- History Table -->
        <div class="table-card" style="overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700;font-size:14px">Full Transaction History</span>
            <button class="btn btn-outline btn-sm" onclick="ledgerModule.load()"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
          </div>
          <div style="max-height:350px;overflow-y:auto">
            <table class="data-table"><thead><tr>
              <th>Date</th><th>Person &amp; Note</th>
              <th style="color:#27ae60">Paid (+)</th><th style="color:#e74c3c">Spent (-)</th>
              <th>Balance</th><th>Status</th>
            </tr></thead><tbody id="pHistoryBody"></tbody></table>
          </div>
          <div style="padding:12px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:center;align-items:center;gap:12px">
            <button class="btn btn-outline btn-sm" id="lPrevBtn" onclick="ledgerModule.changePage(-1)">◀ Previous</button>
            <span id="lPageInfo" style="font-size:12px;color:#6b7280;font-weight:600">Page 1 of 1</span>
            <button class="btn btn-outline btn-sm" id="lNextBtn" onclick="ledgerModule.changePage(1)">Next ▶</button>
          </div>
        </div>
      </div>
    </div>`;

    // Close dropdown on outside click
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
      // Calculate running balance for this person
      const snap = await window.db.collection('personalLedger').where('personName','==',name).orderBy('createdAt','desc').limit(1).get();
      const lastBal = snap.empty ? 0 : (snap.docs[0].data().runBalance || 0);
      const runBalance = lastBal + paid - spent;

      await window.db.collection('personalLedger').add({
        personName: name, note, cashIn: paid, cashOut: spent, runBalance,
        date: todayStr(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Sync to Google Sheets
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

  /* ── Manage Person Names ── */
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
    // Re-render layout to update dropdown
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

  /* ── EDIT Entry ── */
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

  /* ── DELETE Entry ── */
  async function delEntry(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await window.db.collection('personalLedger').doc(id).delete();
      toast('Entry deleted','success'); await fetchData();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  return { load, toggleDropdown, selectName, filterNames, filterHistory, saveEntry, showManageNames, addName, removeName, showEdit, updateEntry, delEntry, changePage };
})();
