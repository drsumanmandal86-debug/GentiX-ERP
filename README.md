# GentiX Fashion ERP

A complete web-based ERP system for GentiX polo shirt business, built with Firebase.

## Live App
**https://mini-erp-gentix.web.app**

Login: `drsumanmandal86@gmail.com`

## Modules
- Dashboard (15 KPI cards with time filters)
- Inventory (with subcategory, weighted avg price)
- Sales (single-item, stock validation, bulk return)
- Purchases (single-item, supplier due tracking)
- Expenses (category-wise, Paid/Unpaid)
- Cash Book (running balance ledger)
- FB Ad Tracker (daily cost sync, USD→BDT)
- Personal Ledger (person-wise balance)
- Suppliers & Customers
- Reports (P&L, trend analysis, AI predictor)
- Settings (loan recovery, savings card, reset system)

## Tech Stack
- Frontend: Pure HTML/CSS/JavaScript (no framework)
- Database: Firebase Firestore
- Auth: Firebase Authentication
- Hosting: Firebase Hosting

## Deploy
```bash
firebase deploy --only hosting --project mini-erp-gentix
```

## Setup
1. Fill in `js/config.js` with your Firebase project credentials
2. Enable Firestore and Authentication in Firebase Console
3. Deploy with `firebase deploy`
