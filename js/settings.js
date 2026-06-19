/* ===================== SETTINGS MODULE (matching SETTINGS_HTML) ===================== */
const settingsModule = (() => {
  let categories = [], subcategories = [];
  const BASE_INVEST = 602500;

  async function load() {
    renderLayout();
    await loadAll();
  }

  async function loadAll() {
    const [settSnap, expSnap] = await Promise.all([
      window.db.collection('settings').doc('config').get(),
      window.db.collection('expenses').get()
    ]);
    const s = settSnap.exists ? settSnap.data() : {};
    setVal('shopName', s.businessName||'GentiX ERP');
    setVal('shopPhone', s.businessPhone||'');
    setVal('shopAddress', s.businessAddress||'');
    setVal('sheetsUrl', s.sheetsWebAppUrl||'');

    // Categories
    categories   = s.categories   || [];
    subcategories = s.subcategories || [];
    renderCategoryList();
    renderSubcategoryList();

    // Financial stats (Loan Recovery + Savings)
    const expDocs = expSnap.docs.map(d=>d.data());
    let totalPaid=0, totalSavings=0;
    expDocs.forEach(e=>{
      if(e.category==='Loan Adjustment') totalPaid+=e.amount||0;
      if(e.category==='Savings') totalSavings+=e.amount||0;
    });
    const remaining = Math.max(0, BASE_INVEST - totalPaid);
    const pct = BASE_INVEST > 0 ? Math.min(100,(totalPaid/BASE_INVEST)*100) : 0;
    setEl('targetLoanDisplay', BASE_INVEST.toLocaleString());
    setEl('loanPaidDisplay', '৳'+totalPaid.toLocaleString());
    setEl('loanRemainingDisplay', '৳'+remaining.toLocaleString());
    setEl('loanPctBadge', Math.round(pct)+'%');
    const bar = document.getElementById('loanProgressBar');
    if(bar) bar.style.width=pct+'%';
    setEl('totalSavedDisplay', '৳'+totalSavings.toLocaleString());
    updateSavingsGoalUI(totalSavings);

    // Load goal from localStorage
    const savedGoal = localStorage.getItem('gx_savings_goal')||'';
    const savedDate = localStorage.getItem('gx_target_date')||'';
    setVal('savingsGoalInput', savedGoal); setVal('targetDateInput', savedDate);
    updateExpiryUI(savedDate);
  }

  function renderLayout() {
    document.getElementById('section-settings').innerHTML = `
    <!-- CSV Import Tool -->
    <div id="csv-import-container" style="margin-bottom:14px"></div>

    <!-- Business Identity -->
    <div class="table-card mb-3" style="padding:18px">
      <h6 style="font-weight:700;margin-bottom:14px;font-size:14px"><i class="bi bi-person-badge" style="color:#27ae60"></i> Business Identity</h6>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:flex-end">
        <div class="form-group"><label class="form-label" style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Shop Name</label>
          <input type="text" id="shopName" class="form-control" placeholder="Name"></div>
        <div class="form-group"><label class="form-label" style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Phone</label>
          <input type="text" id="shopPhone" class="form-control" placeholder="017.."></div>
        <div class="form-group"><label class="form-label" style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Address</label>
          <input type="text" id="shopAddress" class="form-control" placeholder="Location"></div>
        <button class="btn btn-success" onclick="settingsModule.saveProfile()" style="padding:9px 20px;font-size:13px;font-weight:700">SAVE</button>
      </div>
      <!-- Google Sheets Sync URL -->
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6">
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:flex-end">
          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:6px">
              <span style="background:#34a853;border-radius:4px;padding:2px 6px;color:#fff;font-size:11px;font-weight:700">SHEETS</span>
              Google Sheets Sync URL (GAS Web App URL)
              <span id="syncStatus" style="font-size:11px;color:#9ca3af"></span>
            </label>
            <input type="url" id="sheetsUrl" class="form-control"
              placeholder="https://script.google.com/macros/s/AKf.../exec"
              style="font-size:12px;font-family:monospace">
            <small style="color:#9ca3af;font-size:11px">
              GAS project-এ SheetSync.gs যোগ করে Deploy করুন → URL paste করুন
            </small>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-success btn-sm" onclick="settingsModule.saveSheetsUrl()" style="font-size:12px;font-weight:700">SAVE URL</button>
            <button class="btn btn-outline btn-sm" onclick="settingsModule.testSheetsSync()" style="font-size:12px">TEST</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Loan Recovery | Savings Card | Goal Planner -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
      <!-- Loan Recovery -->
      <div class="table-card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700">ACTIVE</span>
          <button class="btn btn-outline btn-sm" onclick="settingsModule.refresh()" style="font-size:10px;padding:3px 8px"><i class="bi bi-arrow-repeat"></i> SYNC</button>
        </div>
        <div style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Loan Recovery</div>
        <h3 id="loanPctBadge" style="font-size:24px;font-weight:800;margin:0">0%</h3>
        <small style="color:#9ca3af;font-size:11px">Total: <strong>৳<span id="targetLoanDisplay">0</span></strong></small>
        <div style="height:6px;background:#f1f5f9;border-radius:50px;margin:10px 0;overflow:hidden">
          <div id="loanProgressBar" style="height:100%;background:#3949ab;border-radius:50px;transition:width 1s;width:0%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #f3f4f6;padding-top:10px;margin-top:4px">
          <div style="text-align:center"><small style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;display:block">Paid</small><span style="font-weight:700;color:#27ae60;font-size:13px" id="loanPaidDisplay">৳0</span></div>
          <div style="text-align:center"><small style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;display:block">Remaining</small><span style="font-weight:700;color:#e74c3c;font-size:13px" id="loanRemainingDisplay">৳0</span></div>
        </div>
      </div>

      <!-- Savings Card (Credit Card Design) -->
      <div style="background:linear-gradient(135deg,#0f172a,#334155);border-radius:14px;padding:20px;color:#fff;position:relative;overflow:hidden;aspect-ratio:1.58/1;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 15px 30px rgba(15,23,42,.3)">
        <div style="position:absolute;top:-20%;right:-10%;width:120px;height:120px;background:rgba(255,255,255,.05);border-radius:50%"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="width:40px;height:30px;background:linear-gradient(135deg,#fbbf24,#d97706);border-radius:5px"></div>
          <i class="bi bi-wifi" style="font-size:18px;opacity:.5;transform:rotate(90deg)"></i>
        </div>
        <div>
          <div style="font-size:16px;letter-spacing:2px;font-weight:600;margin-bottom:8px;text-shadow:0 2px 4px rgba(0,0,0,.3)">4582 9612 **** 7034</div>
          <small style="font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:2px">Savings Balance</small>
          <h3 style="margin:0;font-weight:800" id="totalSavedDisplay">৳0</h3>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div><div style="font-size:8px;text-transform:uppercase;opacity:.6;letter-spacing:1px;margin-bottom:2px">Card Holder</div><div style="font-size:11px;font-weight:700;text-transform:uppercase">SUMAN MANDAL</div></div>
          <div style="text-align:right"><div style="font-size:8px;text-transform:uppercase;opacity:.6;letter-spacing:1px;margin-bottom:2px">Expires</div><div style="font-size:11px;font-weight:700" id="cardExpiryDisplay">00/00</div></div>
        </div>
      </div>

      <!-- Goal Planner -->
      <div class="table-card" style="padding:16px">
        <div style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Goal Planner</div>
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:8px;margin-bottom:8px">
          <input type="number" id="savingsGoalInput" class="form-control" placeholder="Amount ৳">
          <input type="month" id="targetDateInput" class="form-control">
        </div>
        <button class="btn btn-primary" onclick="settingsModule.setGoal()" style="width:100%;font-size:12px;padding:7px;margin-bottom:12px;justify-content:center">SET GOAL</button>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <small style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Goal Progress</small>
          <small id="savingsGoalPct" style="font-weight:700;color:#27ae60;font-size:11px">0%</small>
        </div>
        <div style="height:6px;background:#f1f5f9;border-radius:50px;margin-bottom:6px;overflow:hidden">
          <div id="savingsGoalBar" style="height:100%;background:#27ae60;border-radius:50px;width:0%;transition:width 1s"></div>
        </div>
        <small id="remainingGoalText" style="color:#9ca3af;font-size:10px;display:block;text-align:center">Target Goal: ৳0</small>
      </div>
    </div>

    <!-- Row 3: Categories + Sub-categories -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="table-card" style="padding:16px">
        <h6 style="font-weight:700;margin-bottom:12px;font-size:14px">Categories</h6>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <input type="text" id="newCategory" class="form-control" placeholder="New category" style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="settingsModule.addCategory()" style="padding:6px 16px">ADD</button>
        </div>
        <ul id="categoryList" style="list-style:none;padding:0;max-height:160px;overflow-y:auto;margin:0"></ul>
      </div>
      <div class="table-card" style="padding:16px">
        <h6 style="font-weight:700;margin-bottom:12px;font-size:14px">Sub-Categories</h6>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <input type="text" id="newSubCategory" class="form-control" placeholder="New sub-category" style="flex:1">
          <button class="btn btn-primary btn-sm" style="background:#00acc1;padding:6px 16px" onclick="settingsModule.addSubcategory()">ADD</button>
        </div>
        <ul id="subCategoryList" style="list-style:none;padding:0;max-height:160px;overflow-y:auto;margin:0"></ul>
      </div>
    </div>

    <!-- Row 4: Account + Danger Zone -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="table-card" style="padding:16px">
        <h6 style="font-weight:700;margin-bottom:14px;font-size:14px"><i class="bi bi-person-circle" style="color:#3949ab"></i> Account</h6>
        <div class="form-group" style="margin-bottom:10px"><label class="form-label">Email</label>
          <input class="form-control" id="setEmail" readonly style="background:#f9fafb"></div>
        <div class="form-group" style="margin-bottom:10px"><label class="form-label">New Login Password</label>
          <input type="password" id="setNewPass" class="form-control" placeholder="Leave blank to keep"></div>
        <div class="form-group" style="margin-bottom:10px"><label class="form-label">Confirm Password</label>
          <input type="password" id="setConfPass" class="form-control"></div>
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Admin Reset Password <small style="color:#9ca3af">(data reset-এর জন্য)</small></label>
          <div style="display:flex;gap:8px">
            <input type="password" id="setResetPass" class="form-control" placeholder="New reset password">
            <button class="btn btn-primary btn-sm" onclick="settingsModule.saveResetPassword()" style="white-space:nowrap">Save</button>
          </div>
          <small style="color:#9ca3af;font-size:11px">Default password: <code>GentiX@Reset</code></small>
        </div>
        <button class="btn btn-primary" onclick="settingsModule.updateAccount()" style="font-size:13px">Update Account</button>
        <button class="btn btn-outline btn-sm" onclick="settingsModule.logout()" style="margin-left:8px">Logout</button>
      </div>

      <!-- DANGER ZONE -->
      <div style="border:2px solid #fecaca;border-radius:12px;overflow:hidden">
        <div style="background:#fef2f2;padding:14px 16px;border-bottom:1px solid #fecaca;display:flex;align-items:center;gap:8px">
          <i class="bi bi-shield-exclamation" style="color:#dc2626;font-size:18px"></i>
          <h6 style="font-weight:700;font-size:14px;color:#dc2626;margin:0">Danger Zone</h6>
        </div>
        <div style="padding:16px">
          <!-- Export Backup -->
          <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #fecaca">
            <p style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px">
              <i class="bi bi-download" style="color:#3949ab"></i> Export Backup (Reset করার আগে backup নিন!)
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:5px">
              ${['products','sales','purchases','expenses','customers','suppliers'].map(c=>`
              <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 9px" onclick="settingsModule.exportData('${c}')">
                <i class="bi bi-download"></i> ${c}
              </button>`).join('')}
            </div>
          </div>

          <!-- Reset Section -->
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px">
              <div style="background:#dc2626;border-radius:8px;padding:7px;flex-shrink:0">
                <i class="bi bi-exclamation-triangle-fill" style="color:#fff;font-size:14px"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:13px;color:#dc2626">Full System Reset</div>
                <div style="font-size:11.5px;color:#6b7280;margin-top:2px">Password দিলে সব data permanently delete হবে। এটি undo করা যাবে না।</div>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:10px">
              <label class="form-label" style="font-size:12px;color:#dc2626;font-weight:700">
                <i class="bi bi-lock-fill"></i> Reset Password
              </label>
              <input type="password" id="resetPasswordInput" class="form-control" placeholder="Admin reset password দিন"
                style="border-color:#fca5a5">
            </div>
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label" style="font-size:12px;font-weight:600">Reset Scope</label>
              <select id="resetScope" class="form-control" style="font-size:13px">
                <option value="data">📊 Data Only — Sales, Purchases, Expenses etc. (Settings রাখবে)</option>
                <option value="full">🔴 Complete Reset — সব কিছু মুছবে (Settings সহ)</option>
              </select>
            </div>
            <button onclick="settingsModule.resetSystem()" class="btn btn-danger" style="width:100%;font-size:14px;font-weight:700;padding:10px;justify-content:center">
              <i class="bi bi-trash3-fill"></i> Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>`;

    // Set account email
    const user = firebase.auth().currentUser;
    if(user) setVal('setEmail', user.email||'');

    // Render CSV import tool
    if (window.ImportTool) window.ImportTool.renderImportUI('csv-import-container');
  }

  function renderCategoryList() {
    const ul = document.getElementById('categoryList');
    if(!ul) return;
    ul.innerHTML = categories.length
      ? categories.map((c,i)=>`<li style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f3f4f6;font-size:13px"><span>${c}</span><i class="bi bi-trash3" style="color:#e74c3c;cursor:pointer" onclick="settingsModule.removeCat(${i})"></i></li>`).join('')
      : '<li style="color:#9ca3af;font-size:13px;padding:8px 0">Empty</li>';
  }

  function renderSubcategoryList() {
    const ul = document.getElementById('subCategoryList');
    if(!ul) return;
    ul.innerHTML = subcategories.length
      ? subcategories.map((c,i)=>`<li style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f3f4f6;font-size:13px"><span>${c}</span><i class="bi bi-trash3" style="color:#e74c3c;cursor:pointer" onclick="settingsModule.removeSubcat(${i})"></i></li>`).join('')
      : '<li style="color:#9ca3af;font-size:13px;padding:8px 0">Empty</li>';
  }

  async function saveProfile() {
    const data = { businessName:getVal('shopName'), businessPhone:getVal('shopPhone'), businessAddress:getVal('shopAddress') };
    await window.db.collection('settings').doc('config').set(data, {merge:true});
    window.appSettings = {...window.appSettings, ...data};
    toast('Profile Saved!','success');
  }

  async function saveSheetsUrl() {
    const url = getVal('sheetsUrl').trim();
    if (!url) { toast('URL দিন','error'); return; }
    if (!url.includes('script.google.com')) { toast('Valid GAS URL দিন (script.google.com)','error'); return; }
    await window.db.collection('settings').doc('config').set({ sheetsWebAppUrl: url }, { merge: true });
    window.appSettings.sheetsWebAppUrl = url;
    const st = document.getElementById('syncStatus');
    if (st) { st.textContent = '✓ Saved'; st.style.color = '#27ae60'; }
    toast('Sheets Sync URL saved!','success');
  }

  async function testSheetsSync() {
    const url = getVal('sheetsUrl').trim() || window.appSettings?.sheetsWebAppUrl;
    if (!url) { toast('আগে URL save করুন','error'); return; }
    const st = document.getElementById('syncStatus');
    if (st) { st.textContent = 'Testing…'; st.style.color = '#f59e0b'; }
    try {
      await fetch(url, {
        method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'},
        body: JSON.stringify({ type:'test', data:{ message:'GentiX ERP test ping', time: new Date().toISOString() } })
      });
      if (st) { st.textContent = '✓ Connection OK'; st.style.color = '#27ae60'; }
      toast('Test ping sent! Google Sheet check করুন।','success');
    } catch(e) {
      if (st) { st.textContent = '✗ Failed'; st.style.color = '#e74c3c'; }
      toast('Test failed: '+e.message,'error');
    }
  }

  async function addCategory() {
    const v = document.getElementById('newCategory')?.value.trim();
    if(!v){toast('Enter category name','error');return;}
    if(!categories.includes(v)) { categories.push(v); await saveCategories(); document.getElementById('newCategory').value=''; }
  }

  async function addSubcategory() {
    const v = document.getElementById('newSubCategory')?.value.trim();
    if(!v){toast('Enter sub-category name','error');return;}
    if(!subcategories.includes(v)){ subcategories.push(v); await saveCategories(); document.getElementById('newSubCategory').value=''; }
  }

  async function removeCat(i) { categories.splice(i,1); await saveCategories(); }
  async function removeSubcat(i) { subcategories.splice(i,1); await saveCategories(); }

  async function saveCategories() {
    await window.db.collection('settings').doc('config').set({categories, subcategories},{merge:true});
    renderCategoryList(); renderSubcategoryList();
  }

  function setGoal() {
    const goal = document.getElementById('savingsGoalInput')?.value;
    const date = document.getElementById('targetDateInput')?.value;
    localStorage.setItem('gx_savings_goal', goal||'');
    localStorage.setItem('gx_target_date', date||'');
    updateExpiryUI(date);
    const totalSaved = parseInt(document.getElementById('totalSavedDisplay')?.textContent?.replace(/[৳,]/g,'')) || 0;
    updateSavingsGoalUI(totalSaved);
    toast('Goal & Target Date Updated!','success');
  }

  function updateExpiryUI(dateStr) {
    const el = document.getElementById('cardExpiryDisplay');
    if(!el) return;
    if(!dateStr){ el.textContent='00/00'; return; }
    const [year, month] = dateStr.split('-');
    el.textContent = month+'/'+year.substring(2);
  }

  function updateSavingsGoalUI(currentSavings) {
    const goal = parseFloat(localStorage.getItem('gx_savings_goal'))||0;
    const el = document.getElementById('remainingGoalText');
    if(el) el.textContent='Target Goal: ৳'+goal.toLocaleString();
    if(goal>0){
      const pct = Math.min(100,(currentSavings/goal)*100);
      const bar = document.getElementById('savingsGoalBar');
      const pctEl = document.getElementById('savingsGoalPct');
      if(bar) bar.style.width=pct+'%';
      if(pctEl) pctEl.textContent=Math.round(pct)+'%';
    }
  }

  async function updateAccount() {
    const pass = getVal('setNewPass'), conf = getVal('setConfPass');
    const user = firebase.auth().currentUser;
    if(!user) return;
    if(pass && pass !== conf){ toast('Passwords do not match','error'); return; }
    try {
      if(pass) await user.updatePassword(pass);
      toast('Account updated!','success');
    } catch(e) { toast('Error: '+e.message,'error'); }
  }

  async function exportData(col) {
    const snap = await window.db.collection(col).get();
    const data = snap.docs.map(d=>({id:d.id,...d.data()}));
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`gentix-${col}-${todayStr()}.json`; a.click();
    toast(`${col} exported!`,'success');
  }

  /* ── Save Reset Password ── */
  async function saveResetPassword() {
    const pass = document.getElementById('setResetPass')?.value.trim();
    if (!pass || pass.length < 6) { toast('Password must be at least 6 characters','error'); return; }
    await window.db.collection('settings').doc('config').set({ resetPassword: pass }, { merge: true });
    document.getElementById('setResetPass').value = '';
    toast('Reset password saved!','success');
  }

  /* ── Full System Reset ── */
  async function resetSystem() {
    const inputPass = document.getElementById('resetPasswordInput')?.value;
    const scope     = document.getElementById('resetScope')?.value || 'data';

    if (!inputPass) { toast('Password দিন','error'); return; }

    // Get stored reset password (default: GentiX@Reset)
    let storedPass = 'GentiX@Reset';
    try {
      const snap = await window.db.collection('settings').doc('config').get();
      if (snap.exists && snap.data().resetPassword) storedPass = snap.data().resetPassword;
    } catch(e) {}

    if (inputPass !== storedPass) {
      toast('ভুল password! Reset বাতিল হয়েছে।','error');
      document.getElementById('resetPasswordInput').value = '';
      document.getElementById('resetPasswordInput').style.borderColor = '#dc2626';
      setTimeout(() => { const el = document.getElementById('resetPasswordInput'); if(el) el.style.borderColor = ''; }, 2000);
      return;
    }

    const scopeLabel = scope === 'full' ? 'সব data (Settings সহ)' : 'সব business data (Settings বাদে)';
    if (!confirm(`⚠️ FINAL WARNING!\n\n"${scopeLabel}" permanently delete হবে।\n\nএই action undo করা সম্ভব নয়।\n\nনিশ্চিত করতে OK চাপুন।`)) {
      document.getElementById('resetPasswordInput').value = ''; return;
    }

    // Show loading
    const btn = document.querySelector('[onclick="settingsModule.resetSystem()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Resetting…'; }

    const dataCols = ['products','sales','purchases','expenses','cashBook','customers','suppliers','fbAdSettings','fbAdLogs','personalLedger'];
    const fullCols = [...dataCols, 'settings'];
    const cols = scope === 'full' ? fullCols : dataCols;

    try {
      for (const col of cols) {
        const snap = await window.db.collection(col).get();
        if (snap.empty) continue;
        const batch = window.db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Keep reset password in settings if data-only reset
      if (scope === 'data') {
        await window.db.collection('settings').doc('config').set(
          { resetPassword: storedPass }, { merge: true }
        );
      }

      // Clear app state
      window.appSettings = {};
      document.getElementById('resetPasswordInput').value = '';

      toast('✅ সব data সফলভাবে reset হয়েছে!', 'success');

      // Show success overlay then reload dashboard
      setTimeout(() => {
        openModal('✅ Reset Complete',
          `<div style="text-align:center;padding:20px">
            <div style="font-size:48px;margin-bottom:12px">🎉</div>
            <h4 style="font-weight:700;color:#212529">System Reset Successful!</h4>
            <p style="color:#6b7280;margin-top:8px">সব data মুছে গেছে। App এখন fresh শুরু করার জন্য ready।</p>
          </div>`,
          `<button class="btn btn-primary" style="width:100%;justify-content:center;font-size:15px"
            onclick="closeModal();navigateTo('dashboard')">
            <i class="bi bi-house-fill"></i> Fresh Dashboard এ যান
          </button>`
        );
      }, 500);

    } catch(e) {
      toast('Reset error: '+e.message,'error');
      if(btn){btn.disabled=false;btn.innerHTML='<i class="bi bi-trash3-fill"></i> Reset All Data';}
    }
  }

  async function clearAllData() {
    await resetSystem();
  }

  function logout(){if(confirm('Sign out?'))firebase.auth().signOut().then(()=>location.href='index.html');}
  async function refresh(){await loadAll();}

  function setEl(id,v){const el=document.getElementById(id);if(el)el.innerHTML=v;}
  function setVal(id,v){const el=document.getElementById(id);if(el)el.value=v;}
  function getVal(id){return document.getElementById(id)?.value||'';}

  return { load, saveProfile, saveSheetsUrl, testSheetsSync, addCategory, addSubcategory, removeCat, removeSubcat, setGoal, updateAccount, saveResetPassword, resetSystem, exportData, clearAllData, logout, refresh };
})();
