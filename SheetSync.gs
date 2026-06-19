/**
 * SheetSync.gs - GentiX ERP Firebase → Google Sheets Sync
 * এই ফাইলটা আপনার existing GAS project-এ যোগ করুন।
 * তারপর: Deploy → New deployment → Web app → Execute as: Me → Access: Anyone → Deploy
 *
 * Sheet ID: 1uTKnf34DNTQMtlOWHypUzidh7O1gLjlxWZSCwLpDjmQ
 */

const SHEET_ID = "1uTKnf34DNTQMtlOWHypUzidh7O1gLjlxWZSCwLpDjmQ";

// ===================== MAIN doPost HANDLER =====================
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const raw = e.postData ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let result = { success: false, message: 'Unknown type' };

    switch (payload.type) {
      case 'sale':           result = appendSale(ss, payload.data);          break;
      case 'purchase':       result = appendPurchase(ss, payload.data);       break;
      case 'expense':        result = appendExpense(ss, payload.data);        break;
      case 'cashbook':       result = appendCashBook(ss, payload.data);       break;
      case 'inventory_add':  result = appendInventory(ss, payload.data);      break;
      case 'customer_add':   result = appendCustomer(ss, payload.data);       break;
      case 'supplier_add':   result = appendSupplier(ss, payload.data);       break;
      case 'personal_ledger':result = appendPersonalLedger(ss, payload.data); break;
      case 'fb_log':         result = appendFBAdLog(ss, payload.data);        break;
      case 'fb_ad_add':      result = appendFBAdSetting(ss, payload.data);    break;
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}

// ===================== SALES =====================
// Sheet columns: Date | Customer ID | Product Name | Quantity | Sale Price | Total Amount | Status | Invoice ID
function appendSale(ss, d) {
  const sheet = ss.getSheetByName('Sales');
  if (!sheet) return { success: false, message: 'Sales sheet not found' };
  sheet.appendRow([
    d.date ? new Date(d.date) : new Date(),
    d.customerId || '',
    d.product || '',
    d.qty || 0,
    d.price || 0,
    d.total || 0,
    d.status || 'Active',
    d.saleId || ''
  ]);
  return { success: true, message: 'Sale appended' };
}

// ===================== PURCHASES =====================
// Sheet columns: Date | Supplier ID | Product Name | Quantity | Price | Total
function appendPurchase(ss, d) {
  const sheet = ss.getSheetByName('Purchases');
  if (!sheet) return { success: false, message: 'Purchases sheet not found' };
  sheet.appendRow([
    d.date ? new Date(d.date) : new Date(),
    d.supplierId || '',
    d.product || '',
    d.qty || 0,
    d.price || 0,
    d.total || 0
  ]);
  return { success: true, message: 'Purchase appended' };
}

// ===================== EXPENSES =====================
// Sheet columns: Date | Expense ID | Category | Particulars | Amount | Status
function appendExpense(ss, d) {
  const sheet = ss.getSheetByName('Expenses');
  if (!sheet) return { success: false, message: 'Expenses sheet not found' };
  const expId = 'EXP-' + Math.floor(1000 + Math.random() * 9000);
  sheet.appendRow([
    d.date ? new Date(d.date) : new Date(),
    expId,
    d.category || '',
    d.particulars || '',
    d.amount || 0,
    d.status || 'Paid'
  ]);
  return { success: true, message: 'Expense appended' };
}

// ===================== CASH BOOK =====================
// Sheet columns: Date | Ref ID | Particulars | Cash In | Cash Out | Type | Balance
function appendCashBook(ss, d) {
  const sheet = ss.getSheetByName('Cash Book');
  if (!sheet) return { success: false, message: 'Cash Book sheet not found' };
  const lastRow = sheet.getLastRow();
  let prevBalance = 0;
  if (lastRow > 1) {
    prevBalance = parseFloat(sheet.getRange(lastRow, 7).getValue()) || 0;
  }
  const newBal = prevBalance + (d.cashIn || 0) - (d.cashOut || 0);
  sheet.appendRow([
    d.date ? new Date(d.date) : new Date(),
    d.refId || '',
    d.particulars || '',
    d.cashIn || 0,
    d.cashOut || 0,
    d.type || '',
    newBal
  ]);
  return { success: true, message: 'Cash Book entry appended' };
}

// ===================== INVENTORY =====================
// Sheet columns: Date | ID | Name | Category | Subcategory | Price | Qty
function appendInventory(ss, d) {
  const sheet = ss.getSheetByName('Inventory');
  if (!sheet) return { success: false, message: 'Inventory sheet not found' };

  // Check if product exists — update qty & price (weighted avg)
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim().toLowerCase() === String(d.name).trim().toLowerCase()) {
      const oldQty = parseFloat(data[i][6]) || 0;
      const oldPrice = parseFloat(data[i][5]) || 0;
      const newQty = oldQty + (d.currentStock || 0);
      const avgPrice = newQty > 0 ? ((oldQty * oldPrice) + ((d.currentStock || 0) * (d.buyPrice || 0))) / newQty : d.buyPrice;
      sheet.getRange(i + 1, 1).setValue(new Date());
      sheet.getRange(i + 1, 6).setValue(parseFloat(avgPrice.toFixed(2)));
      sheet.getRange(i + 1, 7).setValue(newQty);
      return { success: true, message: 'Inventory updated (weighted avg)' };
    }
  }
  // New product
  const prodId = 'PRD-' + Math.floor(1000 + Math.random() * 9000);
  sheet.appendRow([
    new Date(), prodId, d.name || '', d.category || '', d.subcategory || '',
    d.buyPrice || 0, d.currentStock || 0
  ]);
  return { success: true, message: 'New product added to Inventory' };
}

// ===================== CUSTOMERS =====================
// Sheet columns: Date | ID | Name | Phone | Address | Total Order | Total COD
function appendCustomer(ss, d) {
  const sheet = ss.getSheetByName('Customers');
  if (!sheet) return { success: false, message: 'Customers sheet not found' };
  const custId = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
  sheet.appendRow([
    new Date(), custId, d.name || '', d.phone || '', d.address || '', 0, 0
  ]);
  return { success: true, message: 'Customer added' };
}

// ===================== SUPPLIERS =====================
// Sheet columns: Date | ID | Name | Phone | Address | Current Due
function appendSupplier(ss, d) {
  const sheet = ss.getSheetByName('Suppliers');
  if (!sheet) return { success: false, message: 'Suppliers sheet not found' };
  const supId = 'SUP-' + Math.floor(1000 + Math.random() * 9000);
  sheet.appendRow([
    new Date(), supId, d.name || '', d.phone || '', d.address || '', 0
  ]);
  return { success: true, message: 'Supplier added' };
}

// ===================== PERSONAL LEDGER =====================
// Sheet columns: Date | Person Name | Note | Cash In | Cash Out | Balance
function appendPersonalLedger(ss, d) {
  const sheet = ss.getSheetByName('Personal_Ledger');
  if (!sheet) {
    const newSheet = ss.insertSheet('Personal_Ledger');
    newSheet.appendRow(['Date','Person Name','Particulars / Note','Cash In (Paid)','Cash Out (Spent)','Balance']);
  }
  const targetSheet = ss.getSheetByName('Personal_Ledger');

  // Find last balance for this person
  const data = targetSheet.getDataRange().getValues();
  let lastBal = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]).trim() === String(d.personName).trim()) {
      lastBal = parseFloat(data[i][5]) || 0; break;
    }
  }
  const newBal = lastBal + (d.cashIn || 0) - (d.cashOut || 0);
  targetSheet.appendRow([
    d.date ? new Date(d.date) : new Date(),
    d.personName || '', d.note || '',
    d.cashIn || 0, d.cashOut || 0, newBal
  ]);
  return { success: true, message: 'Personal Ledger entry appended' };
}

// ===================== FB AD LOG =====================
// Sheet columns: Date | Ad Name | Lifetime USD | Daily USD | Rate | Total BDT
function appendFBAdLog(ss, d) {
  const sheet = ss.getSheetByName('FB_Ad_Logs') || ss.insertSheet('FB_Ad_Logs');
  sheet.appendRow([
    d.date ? new Date(d.date) : new Date(),
    d.adName || '', d.lifetimeSpent || 0,
    d.dailyUSD || 0, d.rate || 129, d.totalBDT || 0
  ]);
  return { success: true, message: 'FB Ad Log appended' };
}

// ===================== FB AD SETTINGS =====================
// Sheet columns: Ad Name | Status | Lifetime Spent
function appendFBAdSetting(ss, d) {
  let sheet = ss.getSheetByName('FB_Ad_Settings');
  if (!sheet) {
    sheet = ss.insertSheet('FB_Ad_Settings');
    sheet.appendRow(['Ad Name', 'Status', 'Lifetime Spent']);
  }
  sheet.appendRow([d.name || '', d.status || 'Active', d.lifetimeSpent || 0]);
  return { success: true, message: 'FB Ad Setting appended' };
}

// ===================== TEST FUNCTION =====================
function testSync() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log('Sheet opened: ' + ss.getName());
  Logger.log('Tabs: ' + ss.getSheets().map(s => s.getName()).join(', '));
}
