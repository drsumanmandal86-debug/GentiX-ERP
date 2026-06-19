/* ===================== SALES MODULE — with Edit + Delete ===================== */
const salesModule = (() => {
  let products=[], customers=[], allSalesData=[], curPage=1;
  const PER_PAGE=8;
  let IS_PROCESSING=false;

  async function load() {
    renderLayout();
    await Promise.all([fetchProducts(),fetchCustomers(),fetchSales()]);
    populateDropdowns(); renderTable();
  }

  async function fetchProducts(){const s=await window.db.collection('products').orderBy('name').get();products=s.docs.map(d=>({id:d.id,...d.data()}));}
  async function fetchCustomers(){const s=await window.db.collection('customers').orderBy('name').get();customers=s.docs.map(d=>({id:d.id,...d.data()}));}
  async function fetchSales(){const s=await window.db.collection('sales').orderBy('createdAt','desc').get();allSalesData=s.docs.map(d=>({id:d.id,...d.data()}));curPage=1;renderTable();}

  function renderLayout() {
    document.getElementById('section-sales').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:1.2rem">
      <div>
        <!-- New Sale Card -->
        <div class="table-card mb-3" style="border-top:5px solid #27ae60">
          <div style="padding:20px">
            <h5 style="color:#27ae60;font-weight:700;margin-bottom:16px"><i class="bi bi-cart-check-fill"></i> New Sale Entry</h5>
            <div class="form-group" style="margin-bottom:10px">
              <label class="form-label">Sale Date *</label>
              <input type="date" id="saleDate" class="form-control" value="${todayStr()}">
            </div>
            <div class="form-group" style="margin-bottom:10px">
              <label class="form-label">Select Customer</label>
              <select id="saleCustomer" class="form-control" onchange="salesModule.updateCustomerBalance()">
                <option value="">Select Customer</option>
              </select>
              <div id="custBalanceDisplay" style="font-size:12px;font-weight:600;margin-top:3px"></div>
            </div>
            <div class="form-group" style="margin-bottom:10px">
              <label class="form-label">Select Product</label>
              <select id="saleProduct" class="form-control" onchange="salesModule.updatePriceHint()">
                <option value="">Select Product</option>
              </select>
              <div id="stockHint" style="font-size:12px;font-weight:600;margin-top:3px"></div>
            </div>
            <div class="form-grid" style="margin-bottom:10px">
              <div class="form-group">
                <label class="form-label">Quantity</label>
                <input type="number" id="saleQty" class="form-control" min="1" oninput="salesModule.validateStockUI()">
              </div>
              <div class="form-group">
                <label class="form-label">Unit Price (৳)</label>
                <input type="number" id="salePrice" class="form-control" step="0.01" oninput="salesModule.updateTotal()">
              </div>
            </div>
            <div style="background:#f0fdf4;border:2px solid #27ae60;border-radius:10px;padding:12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
              <div>
                <small style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;display:block">Net Payable</small>
                <div style="font-size:22px;font-weight:800;color:#27ae60">৳ <span id="saleTotalShow">0.00</span></div>
              </div>
              <div id="saleStatusBadge"></div>
            </div>
            <button id="saleSubmitBtn" onclick="salesModule.executeSale()" class="btn btn-success" style="width:100%;padding:11px;font-size:14px;justify-content:center">
              <i class="bi bi-check-circle-fill"></i> Complete Sale
            </button>
          </div>
        </div>
        <!-- Bulk Return -->
        <div class="table-card" style="border-top:5px solid #e74c3c">
          <div style="padding:18px">
            <h5 style="color:#e74c3c;font-weight:700;margin-bottom:8px"><i class="bi bi-arrow-counterclockwise"></i> Direct Return Adjustment</h5>
            <p style="color:#6b7280;font-size:12px;margin-bottom:12px">সেল আইডি ছাড়াই সরাসরি বড় পণ্য রিটার্ন দিন। স্টক বাড়বে, কুরিয়ার ডিউ কমবে।</p>
            <div class="form-group" style="margin-bottom:8px">
              <label class="form-label" style="font-size:12px">Courier/Customer</label>
              <select id="adjCustomer" class="form-control" style="font-size:13px"><option value="">Select Courier</option></select>
            </div>
            <div class="form-group" style="margin-bottom:8px">
              <label class="form-label" style="font-size:12px">Product</label>
              <select id="adjProduct" class="form-control" style="font-size:13px"><option value="">Select Product</option></select>
            </div>
            <div class="form-grid" style="margin-bottom:10px">
              <div class="form-group"><label class="form-label" style="font-size:12px">Return Qty</label>
                <input type="number" id="adjQty" class="form-control" placeholder="e.g. 455"></div>
              <div class="form-group"><label class="form-label" style="font-size:12px">Unit Price</label>
                <input type="number" id="adjPrice" class="form-control" placeholder="Price"></div>
            </div>
            <button id="adjSubmitBtn" onclick="salesModule.executeBulkReturn()" class="btn btn-danger" style="width:100%;justify-content:center;font-size:13px">
              Confirm Bulk Return
            </button>
          </div>
        </div>
      </div>
      <!-- Transactions Table -->
      <div class="table-card">
        <div style="padding:14px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <h5 style="font-weight:700;color:#6b7280;margin:0">Latest Transactions</h5>
          <button class="btn btn-outline btn-sm" onclick="salesModule.load()"><i class="bi bi-arrow-clockwise"></i></button>
        </div>
        <div id="sales-table-wrapper" style="overflow-x:auto"><div class="loading-state">Loading…</div></div>
        <div style="padding:10px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <small id="salePageInfo" style="color:#6b7280">Page 1</small>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" id="salePrevBtn" onclick="salesModule.changePage(-1)">◀</button>
            <button class="btn btn-outline btn-sm" id="saleNextBtn" onclick="salesModule.changePage(1)">▶</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function populateDropdowns() {
    const co='<option value="">Select Customer</option>'+customers.map(c=>`<option value="${c.id}" data-cod="${c.totalCod||0}" data-name="${c.name}">${c.name}</option>`).join('');
    const po='<option value="">Select Product</option>'+products.map(p=>`<option value="${p.id}" data-name="${p.name}" data-price="${p.sellPrice||p.buyPrice||0}" data-buy="${p.buyPrice||0}" data-stock="${p.currentStock||0}">${p.name} (Stock: ${p.currentStock||0})</option>`).join('');
    ['saleCustomer','adjCustomer'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=id==='adjCustomer'?co.replace('Select Customer','Select Courier'):co;});
    ['saleProduct','adjProduct'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=po;});
  }

  function updateCustomerBalance(){
    const sel=document.getElementById('saleCustomer');const opt=sel.options[sel.selectedIndex];
    const d=document.getElementById('custBalanceDisplay');const b=document.getElementById('saleStatusBadge');
    if(!opt||!opt.value){if(d)d.innerHTML='';if(b)b.innerHTML='';return;}
    const cod=n(opt.dataset.cod);
    if(d)d.innerHTML=cod>0?`<span style="color:#e74c3c"><i class="bi bi-exclamation-circle"></i> Previous COD/Due: ৳${cod.toLocaleString()}</span>`:`<span style="color:#27ae60"><i class="bi bi-check-circle"></i> Clear Account</span>`;
    if(b)b.innerHTML=cod>0?`<span class="badge badge-danger">DUE CUSTOMER</span>`:'';
  }

  function updatePriceHint(){
    const sel=document.getElementById('saleProduct');const opt=sel.options[sel.selectedIndex];
    if(!opt||!opt.value){document.getElementById('stockHint').innerHTML='';return;}
    document.getElementById('salePrice').value=opt.dataset.price;validateStockUI();
  }

  function validateStockUI(){
    const pSel=document.getElementById('saleProduct');const opt=pSel.options[pSel.selectedIndex];
    const qEl=document.getElementById('saleQty');const hint=document.getElementById('stockHint');const btn=document.getElementById('saleSubmitBtn');
    if(!opt||!opt.value)return;
    const stock=ni(opt.dataset.stock),qty=ni(qEl.value);
    if(qty>stock){qEl.style.border='2px solid #e74c3c';hint.innerHTML=`<span style="color:#e74c3c"><i class="bi bi-x-circle-fill"></i> Insufficient Stock! Max: ${stock}</span>`;btn.disabled=true;btn.innerHTML='Stock Limit Exceeded';btn.style.background='#e74c3c';}
    else{qEl.style.border='';hint.innerHTML=`<span style="color:#27ae60"><i class="bi bi-check-circle"></i> Available: ${stock}</span>`;if(!IS_PROCESSING){btn.disabled=false;btn.innerHTML='<i class="bi bi-check-circle-fill"></i> Complete Sale';btn.style.background='';}updateTotal();}
  }

  function updateTotal(){
    const q=n(document.getElementById('saleQty')?.value),p=n(document.getElementById('salePrice')?.value);
    const el=document.getElementById('saleTotalShow');if(el)el.textContent=(q*p).toLocaleString(undefined,{minimumFractionDigits:2});
  }

  async function executeSale(){
    if(IS_PROCESSING)return;
    const custSel=document.getElementById('saleCustomer');const prodSel=document.getElementById('saleProduct');
    const custId=custSel.value;const prodOpt=prodSel.options[prodSel.selectedIndex];
    const qty=ni(document.getElementById('saleQty').value);const price=n(document.getElementById('salePrice').value);
    const saleDate=document.getElementById('saleDate')?.value||todayStr();
    if(!custId||!prodOpt?.value||qty<1||!price){toast('সব তথ্য সঠিকভাবে পূরণ করুন!','error');return;}
    const total=qty*price,prodId=prodOpt.value,prodName=prodOpt.dataset.name;
    const buyPrice=n(prodOpt.dataset.buy)||n(prodOpt.dataset.price)*0.6;
    const custName=custSel.options[custSel.selectedIndex].dataset.name;const saleId='SL-'+Date.now();
    IS_PROCESSING=true;
    const btn=document.getElementById('saleSubmitBtn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Processing…';
    try{
      const batch=window.db.batch();
      const saleRef=window.db.collection('sales').doc();
      batch.set(saleRef,{saleId,date:saleDate,customerId:custId,customerName:custName,product:prodName,productId:prodId,qty,price,buyPrice,total,cogs:qty*buyPrice,status:'Active',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      batch.update(window.db.collection('products').doc(prodId),{currentStock:firebase.firestore.FieldValue.increment(-qty)});
      batch.update(window.db.collection('customers').doc(custId),{totalOrder:firebase.firestore.FieldValue.increment(qty),totalCod:firebase.firestore.FieldValue.increment(total)});
      await batch.commit();
      toast('Sale Recorded Successfully!','success');
      document.getElementById('saleTotalShow').textContent='0.00';
      document.getElementById('custBalanceDisplay').innerHTML='';document.getElementById('stockHint').innerHTML='';
      document.getElementById('saleDate').value=todayStr();document.getElementById('saleCustomer').selectedIndex=0;
      document.getElementById('saleProduct').selectedIndex=0;document.getElementById('saleQty').value='';document.getElementById('salePrice').value='';
      IS_PROCESSING=false;btn.disabled=false;btn.innerHTML='<i class="bi bi-check-circle-fill"></i> Complete Sale';btn.style.background='';
      await load();
    }catch(e){IS_PROCESSING=false;btn.disabled=false;btn.innerHTML='Complete Sale';toast('Error: '+e.message,'error');}
  }

  /* ── EDIT SALE ── */
  function showEdit(id){
    const s=allSalesData.find(x=>x.id===id);if(!s)return;
    openModal('Edit Sale',`
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Date</label>
          <input type="date" id="se-date" class="form-control" value="${s.date||todayStr()}"></div>
        <div class="form-group"><label class="form-label">Customer</label>
          <input class="form-control" value="${s.customerName||'—'}" readonly style="background:#f9fafb"></div>
        <div class="form-group"><label class="form-label">Product</label>
          <input class="form-control" value="${s.product||'—'}" readonly style="background:#f9fafb"></div>
        <div class="form-group"><label class="form-label">Quantity</label>
          <input type="number" id="se-qty" class="form-control" value="${s.qty||0}"></div>
        <div class="form-group"><label class="form-label">Unit Price (৳)</label>
          <input type="number" id="se-price" class="form-control" value="${s.price||0}" oninput="salesModule.calcEditTotal(${s.qty||0})"></div>
        <div class="form-group"><label class="form-label">New Total (৳)</label>
          <input type="number" id="se-total" class="form-control" value="${s.total||0}" readonly style="background:#f0fdf4;font-weight:700;color:#27ae60"></div>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:8px"><i class="bi bi-info-circle"></i> Customer COD balance will be adjusted automatically.</p>`,
      `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
       <button class="btn btn-success" onclick="salesModule.updateSale('${id}',${s.total||0},'${s.customerId||''}')">Update Sale</button>`);
  }

  function calcEditTotal(origQty){
    const qty=ni(document.getElementById('se-qty')?.value)||origQty;
    const price=n(document.getElementById('se-price')?.value);
    const el=document.getElementById('se-total');if(el)el.value=qty*price;
  }

  async function updateSale(id,oldTotal,custId){
    const date=document.getElementById('se-date')?.value;
    const qty=ni(document.getElementById('se-qty')?.value);
    const price=n(document.getElementById('se-price')?.value);
    if(!qty||!price){toast('Qty and price required','error');return;}
    const newTotal=qty*price;const diff=newTotal-oldTotal;
    try{
      const batch=window.db.batch();
      batch.update(window.db.collection('sales').doc(id),{date,qty,price,total:newTotal,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      if(custId&&diff!==0){batch.update(window.db.collection('customers').doc(custId),{totalCod:firebase.firestore.FieldValue.increment(diff)});}
      await batch.commit();closeModal();toast('Sale updated!','success');await fetchSales();
    }catch(e){toast('Error: '+e.message,'error');}
  }

  /* ── DELETE SALE ── */
  async function del(id){
    if(!confirm('Delete this sale? Stock and customer COD will be reversed.'))return;
    const s=allSalesData.find(x=>x.id===id);if(!s)return;
    try{
      const batch=window.db.batch();
      batch.delete(window.db.collection('sales').doc(id));
      if(s.productId)batch.update(window.db.collection('products').doc(s.productId),{currentStock:firebase.firestore.FieldValue.increment(s.qty||0)});
      if(s.customerId){batch.update(window.db.collection('customers').doc(s.customerId),{totalOrder:firebase.firestore.FieldValue.increment(-(s.qty||0)),totalCod:firebase.firestore.FieldValue.increment(-(s.total||0))});}
      await batch.commit();toast('Sale deleted','success');await fetchSales();
    }catch(e){toast('Error: '+e.message,'error');}
  }

  async function executeBulkReturn(){
    const custSel=document.getElementById('adjCustomer');const prodSel=document.getElementById('adjProduct');
    const custId=custSel.value;const prodOpt=prodSel.options[prodSel.selectedIndex];
    const qty=ni(document.getElementById('adjQty').value);const price=n(document.getElementById('adjPrice').value);const btn=document.getElementById('adjSubmitBtn');
    if(!custId||!prodOpt?.value||qty<=0||!price){toast('সবগুলো ঘর পূরণ করুন!','error');return;}
    if(!confirm(`${qty} পিস পণ্য রিটার্ন করতে চান?`))return;
    btn.disabled=true;btn.textContent='Processing…';
    const total=qty*price,prodId=prodOpt.value,prodName=prodOpt.dataset.name;
    const custName=custSel.options[custSel.selectedIndex].dataset.name;
    try{
      const batch=window.db.batch();
      const ref=window.db.collection('sales').doc();
      batch.set(ref,{saleId:'RTN-ADJ-'+Date.now(),date:todayStr(),customerId:custId,customerName:custName,product:prodName,productId:prodId,qty:-qty,price,total:-total,cogs:0,status:'Adjustment',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      batch.update(window.db.collection('products').doc(prodId),{currentStock:firebase.firestore.FieldValue.increment(qty)});
      batch.update(window.db.collection('customers').doc(custId),{totalOrder:firebase.firestore.FieldValue.increment(-qty),totalCod:firebase.firestore.FieldValue.increment(-total)});
      await batch.commit();toast(`${qty} টি পণ্য সফলভাবে অ্যাডজাস্ট হয়েছে।`,'success');
      document.getElementById('adjQty').value='';document.getElementById('adjPrice').value='';
      btn.disabled=false;btn.textContent='Confirm Bulk Return';await load();
    }catch(e){btn.disabled=false;btn.textContent='Confirm Bulk Return';toast('Error: '+e.message,'error');}
  }

  async function handleReturn(saleId,product,currentQty,totalAmount){
    const rQty=parseInt(prompt(`How many units of "${product}" were returned? (Max: ${currentQty})`,currentQty));
    if(!rQty||isNaN(rQty))return;
    if(rQty>currentQty||!confirm(`Confirm returning ${rQty} items?`))return;
    const snap=await window.db.collection('sales').where('saleId','==',saleId).get();
    if(snap.empty){toast('Sale not found','error');return;}
    const docRef=snap.docs[0].ref;const sd=snap.docs[0].data();
    const retAmt=(totalAmount/currentQty)*rQty;const newSts=rQty>=currentQty?'Returned':'Partial-Return';
    const batch=window.db.batch();
    if(rQty>=currentQty)batch.update(docRef,{status:'Returned'});
    else batch.update(docRef,{qty:currentQty-rQty,total:totalAmount-retAmt,status:'Partial-Return'});
    if(sd.productId)batch.update(window.db.collection('products').doc(sd.productId),{currentStock:firebase.firestore.FieldValue.increment(rQty)});
    if(sd.customerId)batch.update(window.db.collection('customers').doc(sd.customerId),{totalOrder:firebase.firestore.FieldValue.increment(-rQty),totalCod:firebase.firestore.FieldValue.increment(-retAmt)});
    await batch.commit();toast('Return Processed!','success');await fetchSales();
  }

  function renderTable(){
    const w=document.getElementById('sales-table-wrapper');if(!w)return;
    const visible=allSalesData;
    const tp=Math.ceil(visible.length/PER_PAGE);
    const page=visible.slice((curPage-1)*PER_PAGE,curPage*PER_PAGE);
    if(!page.length){w.innerHTML='<div class="empty-state"><div class="empty-icon">🛒</div><p>No transactions yet</p></div>';updatePagination(0);return;}
    w.innerHTML=`<table class="data-table"><thead><tr>
      <th>Product &amp; Date</th><th>Customer</th><th>Qty</th><th>Price</th><th>Total</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>
    ${page.map(r=>{
      const sc={Active:'badge-success',Returned:'badge-danger','Partial-Return':'badge-warning',Adjustment:'badge-info'}[r.status]||'badge-gray';
      return `<tr>
        <td><div style="font-weight:700">${r.product||'—'}</div><small style="color:#9ca3af;font-size:11px">${fmtDate(r.date)}</small></td>
        <td>${r.customerName||'—'}</td>
        <td>${Math.abs(r.qty||0)}</td>
        <td>${fmt(r.price||0)}</td>
        <td style="color:#27ae60;font-weight:700">${fmt(Math.abs(r.total||0))}</td>
        <td><span class="badge ${sc}">${r.status}</span></td>
        <td style="white-space:nowrap">
          ${r.status==='Active'?`<button class="action-btn" onclick="salesModule.showEdit('${r.id}')" title="Edit"><i class="bi bi-pencil-square"></i></button>`:''}
          ${r.status==='Active'?`<button class="action-btn" onclick="salesModule.handleReturn('${r.saleId}','${r.product}',${r.qty||0},${r.total||0})" title="Return"><i class="bi bi-arrow-counterclockwise"></i></button>`:''}
          <button class="action-btn" onclick="salesModule.del('${r.id}')" title="Delete"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
    updatePagination(tp);
  }

  function updatePagination(tp){
    const i=document.getElementById('salePageInfo'),p=document.getElementById('salePrevBtn'),nx=document.getElementById('saleNextBtn');
    if(i)i.textContent=`Page ${curPage} of ${tp||1}`;if(p)p.disabled=curPage===1;if(nx)nx.disabled=curPage===tp||tp===0;
  }
  function changePage(step){const tp=Math.ceil(allSalesData.length/PER_PAGE),np=curPage+step;if(np>=1&&np<=tp){curPage=np;renderTable();}}

  return{load,updateCustomerBalance,updatePriceHint,validateStockUI,updateTotal,executeSale,showEdit,calcEditTotal,updateSale,del,executeBulkReturn,handleReturn,changePage};
})();
