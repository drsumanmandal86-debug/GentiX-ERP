/* ===================== PURCHASES MODULE — with Edit + Delete ===================== */
const purchasesModule = (() => {
  let products=[], suppliers=[], allPurchaseData=[], curPage=1;
  const PER_PAGE=10;

  async function load(){renderLayout();await Promise.all([fetchProducts(),fetchSuppliers(),fetchPurchases()]);populateDropdowns();renderTable();}
  async function fetchProducts(){const s=await window.db.collection('products').orderBy('name').get();products=s.docs.map(d=>({id:d.id,...d.data()}));}
  async function fetchSuppliers(){const s=await window.db.collection('suppliers').orderBy('name').get();suppliers=s.docs.map(d=>({id:d.id,...d.data()}));}
  async function fetchPurchases(){const s=await window.db.collection('purchases').orderBy('date','desc').get();allPurchaseData=s.docs.map(d=>({id:d.id,...d.data()}));curPage=1;renderTable();}

  function renderLayout(){
    document.getElementById('section-purchases').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:1.2rem">
      <div class="table-card" style="border-top:5px solid #3949ab">
        <div style="padding:20px">
          <h5 style="color:#3949ab;font-weight:700;margin-bottom:16px"><i class="bi bi-cart-plus"></i> New Purchase</h5>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Purchase Date *</label>
            <input type="date" id="purDate" class="form-control" value="${todayStr()}">
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Select Supplier *</label>
            <select id="purSupplier" class="form-control" onchange="purchasesModule.updateSupplierBalance()">
              <option value="">Select Supplier</option>
            </select>
            <div id="supBalanceDisplay" style="font-size:12px;font-weight:600;margin-top:3px"></div>
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Select Product *</label>
            <select id="purProduct" class="form-control"><option value="">Select Product</option></select>
          </div>
          <div class="form-grid" style="margin-bottom:10px">
            <div class="form-group"><label class="form-label">Quantity</label>
              <input type="number" id="purQty" class="form-control" min="1" oninput="purchasesModule.calcTotal()"></div>
            <div class="form-group"><label class="form-label">Unit Price (৳)</label>
              <input type="number" id="purPrice" class="form-control" oninput="purchasesModule.calcTotal()"></div>
          </div>
          <div style="background:#eff6ff;border:2px solid #3949ab;border-radius:10px;padding:12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <small style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;display:block">Total Payable</small>
              <div style="font-size:22px;font-weight:800;color:#3949ab">৳ <span id="totalPayableDisplay">0</span></div>
            </div>
            <div id="payableStatus"></div>
          </div>
          <button id="confirmPurchaseBtn" onclick="purchasesModule.executePurchase()" class="btn btn-primary" style="width:100%;padding:11px;font-size:14px;justify-content:center">
            <i class="bi bi-check-circle-fill"></i> Confirm Purchase
          </button>
        </div>
      </div>
      <div class="table-card">
        <div style="padding:13px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <h5 style="font-weight:700;color:#6b7280;margin:0">Purchase History</h5>
          <button class="btn btn-outline btn-sm" onclick="purchasesModule.load()"><i class="bi bi-arrow-clockwise"></i></button>
        </div>
        <div id="pur-table-wrapper" style="overflow-x:auto"><div class="loading-state">Loading…</div></div>
        <div style="padding:10px 16px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <small id="purPageInfo" style="color:#6b7280">Page 1</small>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" id="purPrevBtn" onclick="purchasesModule.changePage(-1)">◀</button>
            <button class="btn btn-outline btn-sm" id="purNextBtn" onclick="purchasesModule.changePage(1)">▶</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function populateDropdowns(){
    const sEl=document.getElementById('purSupplier');const pEl=document.getElementById('purProduct');
    if(sEl)sEl.innerHTML='<option value="">Select Supplier</option>'+suppliers.map(s=>`<option value="${s.id}" data-name="${s.name}" data-due="${s.currentDue||s.totalDue||0}">${s.name}</option>`).join('');
    if(pEl)pEl.innerHTML='<option value="">Select Product</option>'+products.map(p=>`<option value="${p.id}" data-name="${p.name}" data-price="${p.buyPrice||0}">${p.name}</option>`).join('');
  }

  function updateSupplierBalance(){
    const sel=document.getElementById('purSupplier');const opt=sel.options[sel.selectedIndex];
    const d=document.getElementById('supBalanceDisplay');const st=document.getElementById('payableStatus');
    if(!opt||!opt.value){if(d)d.innerHTML='';if(st)st.innerHTML='';return;}
    const due=n(opt.dataset.due);
    if(d)d.innerHTML=due>0?`<span style="color:#e74c3c"><i class="bi bi-exclamation-circle"></i> Current Due: ৳${due.toLocaleString()}</span>`:`<span style="color:#9ca3af">No outstanding balance</span>`;
    if(st)st.innerHTML=due>0?`<span class="badge badge-danger">DUE</span>`:'';
  }

  function calcTotal(){
    const qty=n(document.getElementById('purQty')?.value),price=n(document.getElementById('purPrice')?.value);
    const el=document.getElementById('totalPayableDisplay');if(el)el.textContent=(qty*price).toLocaleString();
  }

  async function executePurchase(){
    const suppSel=document.getElementById('purSupplier');const prodSel=document.getElementById('purProduct');
    const suppOpt=suppSel.options[suppSel.selectedIndex];const prodOpt=prodSel.options[prodSel.selectedIndex];
    const qty=ni(document.getElementById('purQty').value);const price=n(document.getElementById('purPrice').value);
    const purDate=document.getElementById('purDate')?.value||todayStr();const btn=document.getElementById('confirmPurchaseBtn');
    if(!suppOpt?.value||!prodOpt?.value||qty<1||!price){toast('সব তথ্য সঠিকভাবে পূরণ করুন!','error');return;}
    const total=qty*price,suppId=suppOpt.value,suppName=suppOpt.dataset.name,prodId=prodOpt.value,prodName=prodOpt.dataset.name;
    btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Processing…';
    try{
      const batch=window.db.batch();
      const purRef=window.db.collection('purchases').doc();
      // Weighted average price + stock snapshot
      const prodSnap=await window.db.collection('products').doc(prodId).get();
      let prevStock=0,newStock=qty;
      if(prodSnap.exists){
        const p=prodSnap.data();prevStock=p.currentStock||0;const oldPrice=p.buyPrice||0;
        newStock=prevStock+qty;const avgPrice=newStock>0?((prevStock*oldPrice)+(qty*price))/newStock:price;
        batch.update(window.db.collection('products').doc(prodId),{currentStock:newStock,buyPrice:parseFloat(avgPrice.toFixed(2))});
      }
      batch.set(purRef,{date:purDate,supplierId:suppId,supplierName:suppName,product:prodName,productId:prodId,qty,price,total,prevStock,newStock,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      batch.update(window.db.collection('suppliers').doc(suppId),{totalPurchase:firebase.firestore.FieldValue.increment(total),currentDue:firebase.firestore.FieldValue.increment(total)});
      await batch.commit();
      // Sync to Google Sheets
      window.SheetsSync?.purchase({ date:purDate, supplierId:suppId, product:prodName, qty, price, total });
      toast('Purchase saved successfully!','success');
      document.getElementById('purQty').value='';document.getElementById('purPrice').value='';
      document.getElementById('totalPayableDisplay').textContent='0';document.getElementById('supBalanceDisplay').innerHTML='';
      btn.disabled=false;btn.innerHTML='<i class="bi bi-check-circle-fill"></i> Confirm Purchase';
      await fetchPurchases();
    }catch(e){btn.disabled=false;btn.innerHTML='Confirm Purchase';toast('Error: '+e.message,'error');}
  }

  /* ── EDIT ── */
  function showEdit(id){
    const p=allPurchaseData.find(x=>x.id===id);if(!p)return;
    openModal('Edit Purchase',`
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Date</label>
          <input type="date" id="pe-date" class="form-control" value="${p.date||todayStr()}"></div>
        <div class="form-group"><label class="form-label">Supplier</label>
          <input class="form-control" value="${p.supplierName||'—'}" readonly style="background:#f9fafb"></div>
        <div class="form-group"><label class="form-label">Product</label>
          <input class="form-control" value="${p.product||'—'}" readonly style="background:#f9fafb"></div>
        <div class="form-group"><label class="form-label">Quantity</label>
          <input type="number" id="pe-qty" class="form-control" value="${p.qty||0}"></div>
        <div class="form-group"><label class="form-label">Unit Price (৳)</label>
          <input type="number" id="pe-price" class="form-control" value="${p.price||0}"></div>
        <div class="form-group"><label class="form-label">Total (৳)</label>
          <input type="number" id="pe-total" class="form-control" value="${p.total||0}" readonly style="background:#f0f4ff;font-weight:700;color:#3949ab"></div>
      </div>
      <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-top:10px;font-size:12px;color:#92400e">
        <i class="bi bi-info-circle me-1"></i>
        Edit করলে <strong>Supplier Due, Stock Qty এবং Buy Price</strong> — তিনটিই auto-update হবে।
      </div>`,
      `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="purchasesModule.updatePurchase('${id}',${p.total||0},'${p.supplierId||''}','${p.productId||''}',${p.qty||0},${p.price||0},'${(p.product||'').replace(/'/g,"\\'")}')">Update Purchase</button>`);
    setTimeout(()=>{
      const qEl=document.getElementById('pe-qty'),prEl=document.getElementById('pe-price'),tEl=document.getElementById('pe-total');
      const calc=()=>{if(qEl&&prEl&&tEl)tEl.value=n(qEl.value)*n(prEl.value);};
      if(qEl)qEl.oninput=calc;if(prEl)prEl.oninput=calc;
    },100);
  }

  async function updatePurchase(id,oldTotal,suppId,prodId,oldQty,oldPrice,prodName){
    const date=document.getElementById('pe-date')?.value;
    const qty=ni(document.getElementById('pe-qty')?.value);
    const price=n(document.getElementById('pe-price')?.value);
    if(!qty||!price){toast('Qty and price required','error');return;}
    const newTotal=qty*price;
    const totalDiff=newTotal-oldTotal;
    const qtyDiff=qty-oldQty;

    try{
      const batch=window.db.batch();

      // 1. Update purchase record
      batch.update(window.db.collection('purchases').doc(id),{
        date,qty,price,total:newTotal,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2. Supplier — recalculate totalPurchase from all purchases (not increment)
      if(suppId){
        const allPurSnap=await window.db.collection('purchases').where('supplierId','==',suppId).get();
        const sumOthers=allPurSnap.docs.filter(d=>d.id!==id).reduce((s,d)=>s+(d.data().total||0),0);
        batch.update(window.db.collection('suppliers').doc(suppId),{
          totalPurchase:sumOthers+newTotal,
          currentDue:firebase.firestore.FieldValue.increment(totalDiff)
        });
      }

      // 3. Product: stock + weighted avg buy price
      //    If prodId missing (imported data), look up product by name
      let resolvedProdId=prodId;
      if(!resolvedProdId && prodName){
        const pSnap=await window.db.collection('products')
          .where('name','==',prodName).limit(1).get();
        if(!pSnap.empty){ resolvedProdId=pSnap.docs[0].id; }
      }

      if(resolvedProdId){
        const prodSnap=await window.db.collection('products').doc(resolvedProdId).get();
        if(prodSnap.exists){
          const pd=prodSnap.data();
          const curStock=pd.currentStock||0;
          const curBuyPrice=pd.buyPrice||0;
          const newStock=curStock+qtyDiff;

          // Weighted avg: remove old purchase contribution, add new
          const curTotalValue=curStock*curBuyPrice;
          const newTotalValue=curTotalValue-(oldQty*(oldPrice||0))+(qty*price);
          const newAvgPrice=newStock>0?parseFloat((newTotalValue/newStock).toFixed(2)):price;

          batch.update(window.db.collection('products').doc(resolvedProdId),{
            currentStock:Math.max(0,newStock),
            buyPrice:newAvgPrice>0?newAvgPrice:price
          });

          // Also update productId on the purchase doc for future edits
          if(!prodId){
            batch.update(window.db.collection('purchases').doc(id),{productId:resolvedProdId});
          }
        }
      }

      await batch.commit();
      closeModal();
      toast(`✅ Updated! Stock ${qtyDiff>=0?'+':''}${qtyDiff} pcs, Due ${totalDiff>=0?'+':''}${fmt(Math.abs(totalDiff))} adjusted.`,'success');
      await fetchPurchases();
    }catch(e){toast('Error: '+e.message,'error');}
  }

  /* ── DELETE ── */
  async function cancelPurchase(docId,prodName,qty,total,suppId){
    const pass=prompt('এই এন্ট্রিটি বাতিল করতে Admin Password দিন:');
    if(!pass)return;if(pass!=='1234'){toast('ভুল পাসওয়ার্ড!','error');return;}
    if(!confirm('Purchase বাতিল করবেন? Stock এবং Supplier Due স্বয়ংক্রিয়ভাবে সমন্বয় হবে।'))return;
    try{
      const purDoc=await window.db.collection('purchases').doc(docId).get();
      const batch=window.db.batch();batch.delete(window.db.collection('purchases').doc(docId));
      if(purDoc.exists){const pd=purDoc.data();if(pd.productId)batch.update(window.db.collection('products').doc(pd.productId),{currentStock:firebase.firestore.FieldValue.increment(-(pd.qty||0))});}
      if(suppId)batch.update(window.db.collection('suppliers').doc(suppId),{totalPurchase:firebase.firestore.FieldValue.increment(-total),currentDue:firebase.firestore.FieldValue.increment(-total)});
      await batch.commit();toast('পারচেজটি বাতিল করা হয়েছে।','success');await fetchPurchases();
    }catch(e){toast('Error: '+e.message,'error');}
  }

  function renderTable(){
    const w=document.getElementById('pur-table-wrapper');if(!w)return;
    const tp=Math.ceil(allPurchaseData.length/PER_PAGE);
    const page=allPurchaseData.slice((curPage-1)*PER_PAGE,curPage*PER_PAGE);
    if(!page.length){w.innerHTML='<div class="empty-state"><div class="empty-icon">🛍️</div><p>No purchases yet</p></div>';updatePagination(0);return;}
    w.innerHTML=`<table class="data-table"><thead><tr>
      <th>Date</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th>Stock Movement</th><th>Actions</th>
    </tr></thead><tbody>
    ${page.map(r=>{
      const prev=r.prevStock!=null?r.prevStock:'—';
      const nw=r.newStock!=null?r.newStock:'—';
      const stockInfo=prev!=='—'?`<span style="color:#9ca3af;font-size:11px">${prev}</span><span style="color:#3949ab;font-weight:700;margin:0 3px">+${r.qty||0}</span><span style="color:#27ae60;font-weight:700">${nw}</span>`:`<span style="color:#ccc;font-size:11px">—</span>`;
      return `<tr>
      <td><small style="color:#9ca3af">${fmtDate(r.date)}</small></td>
      <td>${r.supplierName||'—'}</td>
      <td><strong>${r.product||'—'}</strong></td>
      <td style="font-weight:700">${r.qty||0}</td><td>${fmt(r.price)}</td>
      <td style="font-weight:700;color:#3949ab">${fmt(r.total)}</td>
      <td style="font-size:12px;white-space:nowrap">${stockInfo}</td>
      <td style="white-space:nowrap">
        <button class="action-btn" onclick="purchasesModule.showEdit('${r.id}')" title="Edit"><i class="bi bi-pencil-square"></i></button>
        <button class="action-btn" onclick="purchasesModule.cancelPurchase('${r.id}','${(r.product||'').replace(/'/g,"\\'")}',${r.qty||0},${r.total||0},'${r.supplierId||''}')" title="Cancel/Delete"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`;}).join('')}
    </tbody></table>`;
    updatePagination(tp);
  }

  function updatePagination(tp){
    const i=document.getElementById('purPageInfo'),p=document.getElementById('purPrevBtn'),nx=document.getElementById('purNextBtn');
    if(i)i.textContent=`Page ${curPage} of ${tp||1}`;if(p)p.disabled=curPage===1;if(nx)nx.disabled=curPage===tp||tp===0;
  }
  function changePage(step){const tp=Math.ceil(allPurchaseData.length/PER_PAGE),np=curPage+step;if(np>=1&&np<=tp){curPage=np;renderTable();}}

  return{load,updateSupplierBalance,calcTotal,executePurchase,showEdit,updatePurchase,cancelPurchase,changePage};
})();
