/* ===================== FB AD TRACKER (matching FBTrackerUI.html logic) ===================== */
const fbModule = (() => {
  let masterAdData = [], adLogs = [], activeFilter = null;

  async function load() {
    renderLayout();
    await fetchAllData();
  }

  async function fetchAllData() {
    const [adsSnap, logsSnap] = await Promise.all([
      window.db.collection('fbAdSettings').orderBy('name','asc').get(),
      window.db.collection('fbAdLogs').orderBy('date','desc').get()
    ]);
    masterAdData = adsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    adLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    activeFilter = null;
    renderAdTable();
  }

  function renderLayout() {
    // CSS handles layout: desktop=grid(1fr 0.55fr), mobile=flex-column Daily Sync first
    // See #fb-main-grid rules in style.css — NO JS branching needed
    document.getElementById('section-fbtracker').innerHTML = `
    <div id="fb-main-grid">

      <!-- LEFT: Ad Table + Expense History (CSS: order 2 on mobile) -->
      <div id="fb-left-col">
        <div class="table-card mb-3" style="overflow:hidden">
          <div style="padding:10px 16px;background:#212529;color:#fff;display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700">
              Individual Ad Performance
              <div id="adCounterSummary" style="display:flex;gap:6px"></div>
            </div>
            <button class="btn btn-outline btn-sm" style="border-color:#fff;color:#fff" onclick="fbModule.refresh()">
              <i class="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-height:380px;overflow-y:auto">
            <table class="data-table" id="adTableEl" style="min-width:460px"><thead><tr>
              <th style="padding-left:14px">Ad Name Details</th>
              <th style="width:90px;text-align:center">Status</th>
              <th style="width:130px;text-align:right">Today ($ / ৳)</th>
              <th style="width:110px;text-align:right">Lifetime ($)</th>
              <th style="width:40px"></th>
            </tr></thead><tbody id="adPerformanceBody"></tbody></table>
          </div>
          <div style="padding:10px 14px;border-top:1px solid #e9ecef;background:#f8fafc;display:flex;gap:8px;flex-wrap:wrap">
            <input type="text" id="newAdName" class="form-control" style="flex:1;min-width:120px;padding:7px 10px;font-size:13px" placeholder="New Ad Name">
            <input type="number" id="initialSpent" class="form-control" style="width:120px;padding:7px 10px;font-size:13px" placeholder="Initial $ (opt)">
            <button class="btn btn-primary btn-sm" onclick="fbModule.createAd()" style="white-space:nowrap">+ Add Ad</button>
          </div>
        </div>
        <div class="table-card" style="overflow:hidden">
          <div style="padding:10px 14px;background:#6c757d;color:#fff">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:14px;font-weight:700"><i class="bi bi-filter-circle"></i> Expense History</span>
              <div style="background:#212529;padding:4px 12px;border-radius:6px;font-size:13px">
                <span id="periodTotal" style="color:#67e8f9;font-weight:700">$0.00</span> |
                <span id="periodTotalBDT" style="color:#fcd34d;font-weight:700">৳0</span>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${['today','yesterday','last7','thisMonth','lifetime'].map(t=>`<button class="btn btn-sm" style="background:${t==='lifetime'?'#fcd34d':'rgba(255,255,255,.15)'};color:${t==='lifetime'?'#212529':'#fff'};font-size:10px;padding:2px 8px;border:none" onclick="fbModule.filterByRange('${t}')">${{today:'Today',yesterday:'Yesterday',last7:'7 Days',thisMonth:'This Month',lifetime:'Lifetime'}[t]}</button>`).join('')}
            </div>
          </div>
          <div style="padding:10px 14px;border-bottom:1px solid #e9ecef;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div style="flex:1;min-width:120px"><label class="form-label" style="font-size:11px">From</label><input type="date" id="fbStartDate" class="form-control" style="padding:6px 10px;font-size:13px"></div>
            <div style="flex:1;min-width:120px"><label class="form-label" style="font-size:11px">To</label><input type="date" id="fbEndDate" class="form-control" style="padding:6px 10px;font-size:13px"></div>
            <button class="btn btn-primary btn-sm" onclick="fbModule.getFilteredReport()" style="padding:8px 14px">GENERATE</button>
          </div>
          <div style="overflow-x:auto;max-height:280px;overflow-y:auto">
            <table class="data-table"><thead><tr><th>Date</th><th>Ad Name</th><th style="text-align:right">USD</th><th style="text-align:right">BDT</th></tr></thead>
            <tbody id="reportTableBody"><tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af">Select date range and click GENERATE</td></tr></tbody></table>
          </div>
        </div>
      </div>

      <!-- RIGHT: Daily Cost Sync (CSS: order -1 on mobile = shows first) -->
      <div id="fb-right-col" class="table-card" style="overflow:hidden">
        <div style="padding:12px 16px;background:#3949ab;color:#fff;font-size:15px;font-weight:700">
          <i class="bi bi-cloud-upload me-2"></i>Daily Cost Sync
        </div>
        <div style="padding:16px">
          <div style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px">
            <small style="font-size:10px;opacity:.8;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">Spent Today (Total)</small>
            <div id="grandTotalDisplay" style="font-size:26px;font-weight:800">$0.00</div>
            <div id="grandTotalBDTDisplay" style="font-size:16px;opacity:.9;margin-top:2px">৳0</div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label" style="font-weight:700;font-size:13px">Select Active Ad</label>
            <select id="adSelector" class="form-control" onchange="fbModule.updatePrevSpent()" style="height:42px"></select>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label" style="color:#3949ab;font-weight:700">Meta Lifetime Spent ($)</label>
            <input type="number" id="lifetimeSpent" class="form-control" step="0.01" oninput="fbModule.calcInstant()" style="height:48px;font-size:20px;font-weight:700" placeholder="0.00">
            <div id="prevSpentInfo" style="font-size:11px;color:#9ca3af;margin-top:3px">System Life: $0.00</div>
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label class="form-label" style="font-weight:700;font-size:13px">USD Rate (1$ = ? ৳)</label>
            <input type="number" id="usdRate" class="form-control" value="129" oninput="fbModule.calcInstant()" style="height:40px">
          </div>
          <div style="border-top:1px solid #e9ecef;padding-top:12px">
            <div id="calcDisplay" style="font-size:15px;font-weight:700;color:#6b7280;margin-bottom:10px;text-align:center">Today: $0.00 / ৳0</div>
            <button id="fbSaveBtn" onclick="fbModule.syncDailySpent()" class="btn btn-success" style="width:100%;padding:13px;font-size:14px;justify-content:center">
              <i class="bi bi-cloud-upload"></i> SAVE &amp; SYNC
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderAdTable() {
    const body = document.getElementById('adPerformanceBody');
    const selector = document.getElementById('adSelector');
    const counter = document.getElementById('adCounterSummary');
    if (!body) return;

    const today = todayStr();
    let totalTodayUSD = 0, totalTodayBDT = 0, activeCount = 0, pausedCount = 0;
    const prevSelected = selector?.value;
    if (selector) selector.innerHTML = '<option value="">-- Choose Ad --</option>';

    const rows = masterAdData.map(ad => {
      // Calculate today's spend for this ad
      const todayLogs = adLogs.filter(l => l.adName === ad.name && l.date === today);
      const todayUSD = todayLogs.reduce((s,l) => s+(l.dailyUSD||0), 0);
      const todayBDT = todayLogs.reduce((s,l) => s+(l.totalBDT||0), 0);
      totalTodayUSD += todayUSD; totalTodayBDT += todayBDT;

      if (ad.status === 'Active') {
        activeCount++;
        if (selector) selector.innerHTML += `<option value="${ad.id}" ${ad.id===prevSelected?'selected':''}>${ad.name}</option>`;
      } else { pausedCount++; }

      const badgeCls = ad.status === 'Active' ? 'badge-success' : 'badge-danger';
      const show = !activeFilter || ad.status === activeFilter;
      return `<tr data-status="${ad.status}" style="display:${show?'':'none'}">
        <td style="padding-left:14px;font-weight:700">${ad.name}</td>
        <td style="text-align:center"><span class="badge ${badgeCls}" style="cursor:pointer;padding:4px 10px" onclick="fbModule.toggleStatus('${ad.id}')">${ad.status}</span></td>
        <td style="text-align:right">
          <div style="font-weight:700;color:#2563eb;font-size:15px">$${todayUSD.toFixed(2)}</div>
          <div style="color:#10b981;font-size:12px;font-weight:600">৳${Math.round(todayBDT).toLocaleString()}</div>
        </td>
        <td style="text-align:right;font-weight:700">$${(ad.lifetimeSpent||0).toFixed(2)}</td>
        <td style="padding-right:8px"><button class="action-btn" onclick="fbModule.deleteAd('${ad.id}','${ad.name.replace(/'/g,"\\'")}')"><i class="bi bi-trash3"></i></button></td>
      </tr>`;
    });

    body.innerHTML = rows.join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af">No ads found. Add one below.</td></tr>';

    if (counter) counter.innerHTML = `
      <span class="badge badge-success" style="cursor:pointer;padding:4px 10px;font-size:11px" onclick="fbModule.filterByStatus('Active')">Active: ${activeCount}</span>
      <span class="badge badge-danger" style="cursor:pointer;padding:4px 10px;font-size:11px" onclick="fbModule.filterByStatus('Paused')">Paused: ${pausedCount}</span>`;

    const grandTotal = document.getElementById('grandTotalDisplay');
    const grandBDT = document.getElementById('grandTotalBDTDisplay');
    if (grandTotal) grandTotal.textContent = `$${totalTodayUSD.toFixed(2)}`;
    if (grandBDT) grandBDT.textContent = `৳${Math.round(totalTodayBDT).toLocaleString()}`;

    updatePrevSpent();
  }

  function filterByStatus(status) {
    activeFilter = activeFilter === status ? null : status;
    document.querySelectorAll('#adPerformanceBody tr').forEach(tr => {
      tr.style.display = (!activeFilter || tr.dataset.status === activeFilter) ? '' : 'none';
    });
  }

  function updatePrevSpent() {
    const selId = document.getElementById('adSelector')?.value;
    const ad = masterAdData.find(a => a.id === selId);
    const info = document.getElementById('prevSpentInfo');
    if (info) info.innerHTML = ad ? `System Lifetime: <b>$${(ad.lifetimeSpent||0).toFixed(2)}</b>` : 'System Life: $0.00';
    calcInstant();
  }

  function calcInstant() {
    const current = n(document.getElementById('lifetimeSpent')?.value);
    const rate    = n(document.getElementById('usdRate')?.value) || 129;
    const selId   = document.getElementById('adSelector')?.value;
    const ad      = masterAdData.find(a => a.id === selId);
    const prev    = ad?.lifetimeSpent || 0;
    const diff    = current - prev;
    const display = document.getElementById('calcDisplay');
    const btn     = document.getElementById('fbSaveBtn');
    if (current > 0 && diff < 0) {
      if (display) display.innerHTML = '<span style="color:#e74c3c">Error: Less than System!</span>';
      if (btn) btn.disabled = true;
    } else {
      const today = Math.max(0, diff);
      if (display) display.textContent = `Today: $${today.toFixed(2)} / ৳${Math.round(today*rate).toLocaleString()}`;
      if (btn) btn.disabled = false;
    }
  }

  async function syncDailySpent() {
    const selId     = document.getElementById('adSelector')?.value;
    const lifetime  = n(document.getElementById('lifetimeSpent')?.value);
    const rate      = n(document.getElementById('usdRate')?.value) || 129;
    const btn       = document.getElementById('fbSaveBtn');
    if (!selId || !lifetime) { toast('Select an Ad and enter Lifetime Spent','error'); return; }
    const ad = masterAdData.find(a => a.id === selId);
    if (!ad) return;
    const prev = ad.lifetimeSpent || 0;
    const dailyUSD = Math.max(0, lifetime - prev);
    const totalBDT = dailyUSD * rate;

    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> SYNCING…';
    try {
      const batch = window.db.batch();
      // Update ad lifetime
      batch.update(window.db.collection('fbAdSettings').doc(selId), { lifetimeSpent: lifetime });
      // Save log
      const logRef = window.db.collection('fbAdLogs').doc();
      batch.set(logRef, { adName:ad.name, lifetimeSpent:lifetime, dailyUSD, rate, totalBDT, date:todayStr(), createdAt:firebase.firestore.FieldValue.serverTimestamp() });
      // Create expense as Unpaid Meta/Facebook Ads
      if (dailyUSD > 0) {
        const expRef = window.db.collection('expenses').doc();
        batch.set(expRef, { category:'Meta/Facebook Ads', particulars:`FB Ad Spent: ${ad.name} ($${dailyUSD.toFixed(2)})`, amount:totalBDT, status:'Unpaid', date:todayStr(), createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        // Update Meta/Facebook Ads supplier due
        const suppSnap = await window.db.collection('suppliers').where('name','==','Meta/Facebook Ads').get();
        if (!suppSnap.empty) {
          batch.update(suppSnap.docs[0].ref, { currentDue: firebase.firestore.FieldValue.increment(totalBDT) });
        }
      }
      await batch.commit();
      // Sync to Google Sheets
      window.SheetsSync?.fbLog({ date:todayStr(), adName:ad.name, lifetimeSpent:lifetime, dailyUSD, rate, totalBDT });
      toast(`সফলভাবে Meta/Facebook Ads-এর বকেয়া হিসেবে ৳${Math.round(totalBDT).toLocaleString()} সেভ হয়েছে।`,'success');
      document.getElementById('lifetimeSpent').value = '';
      btn.disabled=false; btn.innerHTML='<i class="bi bi-cloud-upload"></i> SAVE & SYNC';
      await fetchAllData();
    } catch(e) { btn.disabled=false; btn.innerHTML='SAVE & SYNC'; toast('Error: '+e.message,'error'); }
  }

  async function toggleStatus(id) {
    const ad = masterAdData.find(a => a.id === id);
    if (!ad) return;
    const newStatus = ad.status === 'Active' ? 'Paused' : 'Active';
    await window.db.collection('fbAdSettings').doc(id).update({ status: newStatus });
    toast(`${ad.name} → ${newStatus}`,'info');
    await fetchAllData();
  }

  async function createAd() {
    const name    = document.getElementById('newAdName')?.value.trim();
    const initial = n(document.getElementById('initialSpent')?.value);
    if (!name) { toast('Enter Ad Name','error'); return; }
    await window.db.collection('fbAdSettings').add({ name, status:'Active', lifetimeSpent:initial, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('newAdName').value=''; document.getElementById('initialSpent').value='';
    toast('Ad added!','success'); await fetchAllData();
  }

  async function deleteAd(id, name) {
    if (!confirm(`Delete ad "${name}"? All logs for this ad will also be deleted.`)) return;
    try {
      const batch = window.db.batch();
      batch.delete(window.db.collection('fbAdSettings').doc(id));
      // Delete logs for this ad
      const logs = adLogs.filter(l => l.adName === name);
      logs.forEach(l => batch.delete(window.db.collection('fbAdLogs').doc(l.id)));
      await batch.commit();
      toast('Ad deleted','success'); await fetchAllData();
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function getFilteredReport() {
    const start = document.getElementById('fbStartDate')?.value;
    const end   = document.getElementById('fbEndDate')?.value;
    if (!start||!end) { toast('Select date range','error'); return; }
    const body = document.getElementById('reportTableBody');
    if (body) body.innerHTML='<tr><td colspan="4" style="text-align:center;padding:12px;color:#9ca3af">Loading…</td></tr>';
    // Re-fetch from Firestore to ensure fresh data
    const snap = await window.db.collection('fbAdLogs').get();
    const allLogs = snap.docs.map(d=>({id:d.id,...d.data()}));
    const filtered = allLogs.filter(l => (l.date||'').substring(0,10) >= start && (l.date||'').substring(0,10) <= end);
    let tUSD = 0, tBDT = 0;
    if (!filtered.length) { if(body) body.innerHTML='<tr><td colspan="4" style="text-align:center;padding:12px;color:#9ca3af">No data found</td></tr>'; return; }
    if (body) body.innerHTML = filtered.map(r => { tUSD+=r.dailyUSD||0; tBDT+=r.totalBDT||0;
      return `<tr><td>${r.date}</td><td style="font-weight:700">${r.adName}</td><td style="text-align:right">$${(r.dailyUSD||0).toFixed(2)}</td><td style="text-align:right;font-weight:700">৳${Math.round(r.totalBDT||0).toLocaleString()}</td></tr>`;
    }).join('');
    setEl('periodTotal', `$${tUSD.toFixed(2)}`); setEl('periodTotalBDT', `৳${Math.round(tBDT).toLocaleString()}`);
  }

  function filterByRange(type) {
    const now = new Date(), s = new Date(), e = new Date();
    if (type==='yesterday'){s.setDate(now.getDate()-1);e.setDate(now.getDate()-1);}
    else if (type==='last7'){s.setDate(now.getDate()-7);}
    else if (type==='thisMonth'){s.setDate(1);}
    else if (type==='lifetime'){s.setFullYear(2020,0,1);}
    const fmt2 = d => d.toISOString().split('T')[0];
    const sEl = document.getElementById('fbStartDate'), eEl = document.getElementById('fbEndDate');
    if(sEl) sEl.value=fmt2(s); if(eEl) eEl.value=fmt2(e);
    getFilteredReport();
  }

  function setEl(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
  async function refresh(){await fetchAllData();}

  return { load, filterByStatus, updatePrevSpent, calcInstant, syncDailySpent, toggleStatus, createAd, deleteAd, getFilteredReport, filterByRange, refresh };
})();
