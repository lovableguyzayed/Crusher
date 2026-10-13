# Uttaranchal Stone Crusher — Sale, Stock & Collection Register

A web app for the crusher's daily work. It replaces the monthly Excel register (`UTTARANCHAL_STONE_CRUSHER_<Month>_DataEntrySystem.xlsx`) and keeps the same words: Token No., Party, Material, Weight (TON), Royalty, Dala, Bill Sale (Credit) and Cash / GPay / UPI.

It works on a phone at the weighbridge and on a laptop in the office. There is no server and no build step: open `index.html` and you are ready to go.

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Shows today's vehicles, quantity, sales and total outstanding. Also shows material-wise sales bars, a 6-day production vs sales chart and the most recent entries. |
| **Vehicle Entry** | Records date, time, token number (counts up by itself), vehicle, place, party, material, weight, royalty, rate, payment type, dala, amount, driver and remarks. The shift is detected automatically (Day 7 AM–7 PM, Night 7 PM–7 AM) and can be changed by hand. A Bill Sale (Credit) amount is calculated as Weight × Rate from the price list. A missing field shows the same `MISSING: …` message as the Excel input panel. |
| **Dispatch / Sales** | The daily register, split into Day/Night × Bill Sale/Cash sections like the Excel sheets. Includes a daily snapshot and payment summary, plus edit, delete, challan, Excel export and print. |
| **Stock Management** | Shows opening + production (inward) − sales (outward) for each material, a 7-day trend and a production log. |
| **Customers / Parties** | A ledger for each party: opening balance + credit sales − payments = balance. Shows the running balance and payment history, and exports to Excel. |
| **Drivers / Transporters** | Keeps the driver list with each driver's trip count. Drivers are added automatically from entries, and a known vehicle number fills in its driver. |
| **Payments** | Records money received against a party's dues. |
| **Expenses** | Records diesel, wages, repairs and other costs, with a monthly total by category. |
| **Reports** | Covers today, the last 7 days, this month, last month or any date range. Shows material-wise, party-wise, collection summary (net cash in hand) and day-by-day figures. Exports a multi-sheet Excel file and prints to PDF. |
| **PDF Challan** | A print-ready cash or credit challan with the amount in words and signature lines. Use *Print → Save as PDF*. |
| **Excel Import / Export** | Imports your existing monthly register: daily sheets named `01-Aug`, `02-Aug`… plus rates from `MASTER DATA`. It can also import a simple one-row-per-vehicle sheet (download the template from Settings). Duplicates are skipped. Exports all data, a single day, a report or a party ledger. |
| **Price List** | Sets the sale rate (₹/TON) and opening stock for each material, and lets you add new materials. Saving rates also prices any bill sales that were saved or imported without a rate. |
| **Settings** | Company name, address and GSTIN (used on the challan), the next token number, JSON backup/restore, demo data and delete-all. |

## Running it

- **Laptop:** double-click `index.html`, or serve the folder (`python3 -m http.server`) and open `http://localhost:8000`.
- **Phone:** host the folder on any static host (GitHub Pages: *Settings → Pages → Deploy from branch*) and open the link. In the browser menu, use *Add to Home screen*.
- **Try it:** Settings → *Load Demo Data*.

## Your data

All records are saved in the browser you use (`localStorage`). Nothing is uploaded. Each phone or laptop keeps its own copy, so use **Settings → Download Backup** regularly and **Restore Backup** to move data between devices.

## Files

```
index.html              app shell
css/tokens.css          design tokens (dark navy + orange; light theme for print)
css/components.css      design-system components (usc-* classes)
css/app.css             layout, phone/laptop responsive rules, print/challan styles
js/usc.js               shared helpers: ₹ formatting, shift detection, master lists
js/app.js               the app (views, ledger maths, Excel import/export, challan)
js/vendor/xlsx.full.min.js  SheetJS 0.18.5 (Apache-2.0), bundled so Excel works offline
```

The colours, type and components come from the **Uttaranchal Stone Crusher** design system. `css/tokens.css`, `css/components.css` and `js/usc.js` are generated from it or copied from it.
