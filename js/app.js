/* Uttaranchal Stone Crusher — sale, stock & collection register.
   Plain JavaScript, no build step. All data lives in this browser (localStorage);
   use Settings → Backup to move it between devices. */
(function () {
  'use strict';

  var STORE_KEY = 'usc-data-v1';
  var THEME_KEY = 'usc-theme';
  var U = window.USC;

  // ---------- data ----------
  function defaults() {
    return {
      settings: {
        company: 'Uttaranchal Stone Crusher',
        tagline: 'Quality Aggregates for a Stronger Tomorrow',
        address: 'Uttarakhand',
        gstin: '',
        phone: '',
        user: 'Admin'
      },
      materials: U.MATERIALS.map(function (m) { return { name: m, rate: 0, opening: 0 }; }),
      parties: ['ASHU', 'GANESH', 'MAHAVEER', 'ANAS TRADERS', '3311 SARDAR JI', 'ANKURCHAUHAN', 'PARDEEP', 'RAJPAL GOSAIN', 'RK BANSAL', 'TAHIR', 'CASH SALE']
        .map(function (n) { return { id: uid(), name: n, phone: '', address: '', opening: 0 }; }),
      drivers: [],
      entries: [],
      production: [],
      payments: [],
      expenses: [],
      nextToken: 1
    };
  }

  var db = load();
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw), base = defaults();
        Object.keys(base).forEach(function (k) { if (d[k] === undefined) d[k] = base[k]; });
        d.settings = Object.assign(base.settings, d.settings);
        return d;
      }
    } catch (e) { /* fall through to defaults */ }
    return defaults();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch (e) { toast('Could not save — browser storage is full or blocked'); }
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return isoDate(new Date()); }
  function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); }
  function fmtDate(s) { if (!s) return ''; var p = s.split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtLong(s) { var d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + DAYS[d.getDay()]; }
  function shortDay(s) { var d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function ton(n) { return round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function inr(n) { return U.formatINR(round2(n), Math.abs(n % 1) > 0.001 ? 2 : 0); }
  function shiftOf(time) { var h = parseInt((time || '12').split(':')[0], 10); return h >= 7 && h < 19 ? 'DAY' : 'NIGHT'; }
  function isCredit(e) { return e.mode === 'Credit'; }
  function rateOf(material) { var m = db.materials.find(function (x) { return x.name === material; }); return m ? num(m.rate) : 0; }
  function inRange(d, from, to) { return d >= from && d <= to; }
  function sum(list, f) { return list.reduce(function (a, x) { return a + num(f(x)); }, 0); }
  function by(list, key, val) { var o = {}; list.forEach(function (x) { var k = key(x); o[k] = (o[k] || 0) + num(val(x)); }); return o; }

  // ---------- ledger maths ----------
  function partyLedger(name) {
    var p = db.parties.find(function (x) { return x.name === name; }) || { opening: 0 };
    var sales = db.entries.filter(function (e) { return e.party === name; });
    var credit = sales.filter(isCredit);
    var billed = sum(credit, function (e) { return e.amount; }) + num(p.opening);
    var paid = sum(db.payments.filter(function (x) { return x.party === name; }), function (x) { return x.amount; });
    return { billed: billed, paid: paid, balance: billed - paid, cashSales: sum(sales.filter(function (e) { return !isCredit(e); }), function (e) { return e.amount; }), trips: sales.length, qty: sum(sales, function (e) { return e.weight; }) };
  }
  function totalOutstanding() { return db.parties.reduce(function (a, p) { return a + Math.max(0, partyLedger(p.name).balance); }, 0); }
  function stockOf(material) {
    var m = db.materials.find(function (x) { return x.name === material; }) || { opening: 0 };
    var inward = sum(db.production.filter(function (x) { return x.material === material; }), function (x) { return x.qty; });
    var outward = sum(db.entries.filter(function (x) { return x.material === material; }), function (x) { return x.weight; });
    return { opening: num(m.opening), inward: inward, outward: outward, stock: num(m.opening) + inward - outward };
  }

  // ---------- icons ----------
  function icon(name, size) {
    var s = size || 20;
    var p = {
      dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
      truck: '<path d="M1 6h13v10H1zM14 10h4l3 3v3h-7"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
      stack: '<path d="M2 20l6-9 4 5 3-4 7 8z"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/>',
      driver: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 14v7M10 12H3M14 12h7"/>',
      wallet: '<rect x="2" y="5" width="20" height="15" rx="2"/><path d="M16 12h3M2 9h20"/>',
      receipt: '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
      report: '<path d="M6 2h9l5 5v15H6z"/><path d="M9 17v-4M12 17v-7M15 17v-2"/>',
      price: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      rupee: '<path d="M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l8 7"/>',
      doc: '<path d="M6 2h9l5 5v15H6z"/><path d="M9 12h8M9 16h8"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
      more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
      excel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>',
      download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
      upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
      print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>'
    }[name] || '';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function logo(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 40 40" aria-hidden="true"><path d="M2 34 15 10l7 12 5-8 11 20z" fill="#f7931e"/><path d="M15 10l4 7-3 2-1-3-2 3-2-1z" fill="#f2f5f9"/><path d="M27 14l3 5-2 1-1-2-1 1z" fill="#f2f5f9"/></svg>';
  }

  // ---------- routing ----------
  var NAV = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['entry', 'Vehicle Entry', 'truck'],
    ['sales', 'Dispatch / Sales', 'doc'],
    ['stock', 'Stock Management', 'stack'],
    ['parties', 'Customers / Parties', 'users'],
    ['drivers', 'Drivers / Transporters', 'driver'],
    ['payments', 'Payments', 'wallet'],
    ['expenses', 'Expenses', 'receipt'],
    ['reports', 'Reports', 'report'],
    ['prices', 'Price List (Material)', 'price'],
    ['settings', 'Settings', 'settings']
  ];
  var TITLES = {}; NAV.forEach(function (n) { TITLES[n[0]] = n[1]; });
  TITLES.party = 'Customer Ledger'; TITLES.challan = 'Challan';

  var state = { salesDate: today(), salesShift: 'ALL', reportFrom: today(), reportTo: today(), editId: null, draft: null };

  function route() {
    var h = (location.hash || '#dashboard').slice(1).split('/');
    return { page: TITLES[h[0]] ? h[0] : 'dashboard', arg: h[1] ? decodeURIComponent(h.slice(1).join('/')) : '' };
  }

  function render() {
    var r = route();
    var views = { dashboard: viewDashboard, entry: viewEntry, sales: viewSales, stock: viewStock, parties: viewParties, party: viewParty, drivers: viewDrivers, payments: viewPayments, expenses: viewExpenses, reports: viewReports, prices: viewPrices, settings: viewSettings, challan: viewChallan };
    var active = r.page === 'party' ? 'parties' : r.page === 'challan' ? 'sales' : r.page;
    var shift = shiftOf(nowTime());
    var theme = document.documentElement.getAttribute('data-theme');
    var html =
      '<aside class="sidebar" aria-label="Main">' +
        '<div class="brand">' + logo(40) + '<div class="usc-wordmark" style="font-size:22px"><b>Uttaranchal</b><span>Stone Crusher</span></div></div>' +
        '<nav class="usc-nav">' + NAV.map(function (n) {
          return '<a class="usc-nav-item" href="#' + n[0] + '"' + (active === n[0] ? ' aria-current="page"' : '') + '>' + icon(n[2]) + n[1] + '</a>';
        }).join('') + '</nav>' +
        '<div class="sidebar-foot">' + icon('user', 28) + '<div><b>' + esc(db.settings.user) + '</b><span class="muted small">' + esc(db.settings.company) + '</span></div></div>' +
      '</aside>' +
      '<div class="scrim" data-action="close-nav"></div>' +
      '<div class="main">' +
        '<header class="topbar">' +
          '<button class="icon-btn menu-btn" data-action="open-nav" aria-label="Open menu">' + icon('menu') + '</button>' +
          '<div><h1>' + esc(TITLES[r.page]) + '</h1>' + (r.page === 'dashboard' ? '<div class="sub hide-sm">Welcome back. Here is today’s overview.</div>' : '') + '</div>' +
          '<div class="spacer"></div>' +
          '<span class="chip hide-sm">' + icon('calendar', 16) + fmtLong(today()) + '</span>' +
          '<span class="usc-badge usc-badge-' + (shift === 'DAY' ? 'day' : 'night') + '" style="height:32px;padding:0 12px">' + icon(shift === 'DAY' ? 'sun' : 'moon', 16) + (shift === 'DAY' ? 'Day Shift' : 'Night Shift') + '</span>' +
          '<button class="icon-btn" data-action="theme" aria-label="Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme">' + icon(theme === 'dark' ? 'sun' : 'moon') + '</button>' +
        '</header>' +
        '<main class="content" id="content">' + views[r.page](r.arg) + '</main>' +
      '</div>' +
      '<nav class="tabbar" aria-label="Quick">' +
        '<a href="#dashboard"' + (active === 'dashboard' ? ' aria-current="page"' : '') + '>' + icon('home') + 'Home</a>' +
        '<a href="#entry"' + (active === 'entry' ? ' aria-current="page"' : '') + '>' + icon('plus') + 'Entry</a>' +
        '<a href="#reports"' + (active === 'reports' ? ' aria-current="page"' : '') + '>' + icon('report') + 'Reports</a>' +
        '<button data-action="open-nav">' + icon('more') + 'More</button>' +
      '</nav>';
    document.getElementById('app').innerHTML = html;
    document.getElementById('app').classList.remove('nav-open');
    afterRender(r);
  }

  // ---------- shared bits ----------
  function money(n) { return '<span class="v-full">' + inr(n) + '</span><span class="v-short">' + U.formatINRShort(n) + '</span>'; }
  function stat(ic, label, value, caption, danger) {
    return '<div class="usc-stat"><div class="usc-stat-icon">' + icon(ic, 22) + '</div><div style="min-width:0"><div class="usc-stat-label">' + label + '</div><div class="usc-stat-value">' + value + '</div><div class="usc-stat-caption' + (danger ? ' is-danger' : '') + '">' + caption + '</div></div></div>';
  }
  function card(title, body, tools) {
    return '<section class="usc-card"><div class="usc-card-head"><h2 class="usc-card-title">' + title + '</h2>' + (tools ? '<div class="toolbar">' + tools + '</div>' : '') + '</div>' + body + '</section>';
  }
  function field(label, inner, cls) { return '<label class="usc-field ' + (cls || '') + '"><span class="usc-label">' + label + '</span>' + inner + '</label>'; }
  function input(name, value, attrs) { return '<input class="usc-input" name="' + name + '" value="' + esc(value) + '" ' + (attrs || '') + '>'; }
  function select(name, options, value, attrs) {
    return '<select class="usc-input" name="' + name + '" ' + (attrs || '') + '>' + options.map(function (o) {
      var v = typeof o === 'string' ? o : o[0], l = typeof o === 'string' ? o : o[1];
      return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('') + '</select>';
  }
  function table(head, rows, foot, emptyText) {
    if (!rows.length) return '<div class="empty">' + (emptyText || 'Nothing here yet.') + '</div>';
    return '<div class="usc-table-wrap"><table class="usc-table"><thead><tr>' + head.map(function (h) {
      return '<th' + (h.charAt(0) === '#' ? ' class="num"' : '') + '>' + h.replace(/^#/, '') + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';
  }
  function shiftBadge(s) { return '<span class="usc-badge usc-badge-' + (s === 'DAY' ? 'day' : 'night') + '">' + (s === 'DAY' ? 'Day' : 'Night') + '</span>'; }
  function modeBadge(m) { return '<span class="usc-badge' + (m === 'Credit' ? ' usc-badge-danger' : '') + '">' + esc(m === 'Credit' ? 'Credit (Bill)' : m) + '</span>'; }
  function partyNames() { return db.parties.map(function (p) { return p.name; }).sort(); }
  function materialNames() { return db.materials.map(function (m) { return m.name; }); }
  function datalist(id, list) { return '<datalist id="' + id + '">' + list.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>'; }

  // ---------- charts ----------
  function barChart(labels, a, b, opts) {
    var W = 560, H = 230, L = 44, B = 24, T = 10, max = Math.max.apply(null, a.concat(b).concat([1]));
    var step = niceStep(max), top = Math.ceil(max / step) * step, n = labels.length, gw = (W - L - 8) / n, bw = Math.min(18, gw / 3);
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var g = '';
    for (var v = 0; v <= top + 1e-9; v += step) g += '<line class="grid-line" x1="' + L + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + shortNum(v) + '</text>';
    labels.forEach(function (lab, i) {
      var cx = L + gw * i + gw / 2;
      g += '<rect class="bar-a" x="' + (cx - bw - 1) + '" y="' + y(a[i]) + '" width="' + bw + '" height="' + (H - B - y(a[i])) + '" rx="2"><title>' + opts.a + ' ' + lab + ': ' + ton(a[i]) + '</title></rect>';
      g += '<rect class="bar-b" x="' + (cx + 1) + '" y="' + y(b[i]) + '" width="' + bw + '" height="' + (H - B - y(b[i])) + '" rx="2"><title>' + opts.b + ' ' + lab + ': ' + ton(b[i]) + '</title></rect>';
      g += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + lab + '</text>';
    });
    return '<div class="legend" style="padding:12px 16px 0"><span><i style="background:var(--blue)"></i>' + opts.a + '</span><span><i style="background:var(--orange)"></i>' + opts.b + '</span></div><svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + opts.a + ' vs ' + opts.b + '">' + g + '</svg>';
  }
  function lineChart(labels, vals, label) {
    var W = 560, H = 200, L = 52, B = 24, T = 10, max = Math.max.apply(null, vals.concat([1]));
    var step = niceStep(max), top = Math.ceil(max / step) * step, n = labels.length;
    var x = function (i) { return L + (n === 1 ? (W - L) / 2 : (W - L - 12) * i / (n - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var g = '';
    for (var v = 0; v <= top + 1e-9; v += step) g += '<line class="grid-line" x1="' + L + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + shortNum(v) + '</text>';
    g += '<polyline class="line-b" points="' + vals.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ') + '"/>';
    var every = Math.ceil(n / 8);
    vals.forEach(function (v, i) {
      g += '<circle class="dot-b" cx="' + x(i) + '" cy="' + y(v) + '" r="3"><title>' + labels[i] + ': ' + inr(v) + '</title></circle>';
      if (i % every === 0) g += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + labels[i] + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '">' + g + '</svg>';
  }
  function niceStep(max) { var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function shortNum(v) { return v >= 1e7 ? (v / 1e7) + 'Cr' : v >= 1e5 ? (v / 1e5) + 'L' : v >= 1e3 ? (v / 1e3) + 'K' : String(Math.round(v * 100) / 100); }
  function meters(obj, unit) {
    var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }), max = Math.max.apply(null, keys.map(function (k) { return obj[k]; }).concat([1]));
    if (!keys.length) return '<div class="empty">No sales yet today.</div>';
    return '<div class="usc-stack">' + keys.map(function (k) {
      return '<div class="usc-meter"><span>' + esc(k) + '</span><div class="usc-meter-track"><div class="usc-meter-fill" style="width:' + Math.max(2, obj[k] / max * 100) + '%"></div></div><span class="usc-meter-value">' + ton(obj[k]) + ' ' + unit + '</span></div>';
    }).join('') + '</div>';
  }
  function hero() {
    return '<div class="hero"><svg viewBox="0 0 600 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="600" height="220" fill="#13263d"/><path d="M0 150 90 70l70 50 90-90 110 100 80-60 160 110v40H0z" fill="#1d3554"/>' +
      '<path d="M0 190 120 120l80 40 110-70 120 90 70-30 100 60v10H0z" fill="#26405f"/>' +
      '<path d="M360 220 450 120l100 100z" fill="#3d5a7d"/><path d="M450 120l22 24-12 6-10-11-9 11-12-6z" fill="#9fb0c4"/>' +
      '<g fill="#f7931e"><rect x="470" y="70" width="120" height="10" rx="3" transform="rotate(28 470 70)"/><rect x="440" y="52" width="44" height="36" rx="3"/><rect x="452" y="88" width="6" height="50"/><rect x="468" y="88" width="6" height="50"/></g>' +
      '<path d="M520 220 560 160l40 60z" fill="#4d5f75"/>' +
      '<rect width="600" height="220" fill="url(#hg)"/><defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1"><stop offset=".3" stop-color="#0a1522" stop-opacity="0"/><stop offset="1" stop-color="#0a1522" stop-opacity=".85"/></linearGradient></defs></svg>' +
      '<div class="hero-text"><b>' + esc(companyLine(0)) + '</b><span>' + esc(companyLine(1)) + '</span><em>' + esc(db.settings.tagline) + '</em></div></div>';
  }
  function companyLine(i) {
    var words = db.settings.company.toUpperCase().split(' ');
    return i === 0 ? words[0] : words.slice(1).join(' ');
  }

  // ---------- views ----------
  function viewDashboard() {
    var t = today(), es = db.entries.filter(function (e) { return e.date === t; });
    var qty = sum(es, function (e) { return e.weight; }), sales = sum(es, function (e) { return e.amount; });
    var mat = by(es, function (e) { return e.material; }, function (e) { return e.weight; });
    var days = [], prod = [], sold = [];
    for (var i = 5; i >= 0; i--) {
      var d = addDays(t, -i); days.push(shortDay(d));
      prod.push(sum(db.production.filter(function (x) { return x.date === d; }), function (x) { return x.qty; }));
      sold.push(sum(db.entries.filter(function (x) { return x.date === d; }), function (x) { return x.weight; }));
    }
    var recent = db.entries.slice().sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); }).slice(0, 6);
    return '<div class="kpis">' +
        stat('truck', 'Total Vehicles', es.length, 'Today') +
        stat('stack', 'Total Quantity', ton(qty) + ' <span class="small">TON</span>', 'Today') +
        stat('rupee', 'Total Sales', money(sales), 'Today') +
        stat('doc', 'Outstanding', money(totalOutstanding()), 'Pending', true) +
      '</div>' +
      '<a class="usc-btn usc-btn-primary tiles-cta" href="#entry" style="justify-content:center;text-decoration:none">' + icon('plus') + 'New Vehicle Entry</a>' +
      '<div class="tiles">' + [['entry', 'Vehicle Entry', 'truck'], ['stock', 'Stock', 'stack'], ['parties', 'Customers', 'users'], ['payments', 'Payments', 'wallet'], ['expenses', 'Expenses', 'receipt'], ['reports', 'Reports', 'report']].map(function (x) {
        return '<a class="tile" href="#' + x[0] + '">' + icon(x[2], 28) + x[1] + '</a>';
      }).join('') + '</div>' +
      '<div class="grid wide-left">' + hero() + card('Today’s Material Sales', '<div class="usc-card-body">' + meters(mat, 'TON') + '</div>') + '</div>' +
      '<div class="grid two">' +
        card('Daily Production vs Sales (TON)', barChart(days, prod, sold, { a: 'Production', b: 'Sales' })) +
        card('Recent Vehicle Entries', table(['Time', 'Vehicle No', 'Material', '#Qty (TON)', 'Party'], recent.map(function (e) {
          return '<tr><td>' + (e.date === t ? '' : shortDay(e.date) + ' ') + esc(e.time) + '</td><td class="usc-plate">' + esc(e.vehicle) + '</td><td>' + esc(e.material) + '</td><td class="num">' + ton(e.weight) + '</td><td>' + esc(e.party) + '</td></tr>';
        }), '', 'No entries yet. Add the first vehicle from <a href="#entry">Vehicle Entry</a>.'), '<a class="usc-btn usc-btn-sm usc-btn-ghost" href="#sales">View All</a>') +
      '</div>';
  }

  function blankEntry() {
    var t = nowTime();
    return { date: today(), time: t, shift: 'AUTO', token: db.nextToken, vehicle: '', place: 'LOCAL', party: '', material: db.materials[0] ? db.materials[0].name : '', weight: '', royalty: '', mode: 'Cash', rate: '', dala: '', amount: '', driver: '', remarks: '' };
  }

  function viewEntry(arg) {
    var e = state.draft;
    if (arg) {
      var found = db.entries.find(function (x) { return x.id === arg; });
      if (found && state.editId !== arg) { state.editId = arg; e = state.draft = Object.assign({}, found); }
    } else if (state.editId) { state.editId = null; e = state.draft = null; }
    if (!e) e = state.draft = blankEntry();
    var rate = e.rate !== '' && e.rate != null ? e.rate : rateOf(e.material);
    var autoShift = shiftOf(e.time);
    var todays = db.entries.filter(function (x) { return x.date === e.date; }).sort(function (a, b) { return b.time.localeCompare(a.time); }).slice(0, 8);
    var form =
      '<form id="entry-form" class="usc-card-body" novalidate>' +
        '<div class="form-grid">' +
          field('Date', input('date', e.date, 'type="date" required')) +
          field('Time', input('time', e.time, 'type="time" required')) +
          field('Shift', select('shift', [['AUTO', 'Auto — ' + (autoShift === 'DAY' ? 'Day Shift' : 'Night Shift')], ['DAY', 'Day Shift'], ['NIGHT', 'Night Shift']], e.shift || 'AUTO'), '') +
          field('Token No.', input('token', e.token, 'inputmode="numeric" class="usc-input usc-plate"')) +
          field('Vehicle Number *', input('vehicle', e.vehicle, 'class="usc-input usc-plate" list="dl-vehicles" autocomplete="off" required placeholder="UK07CA1234"'), 'req') +
          field('Place / Destination', select('place', U.PLACES, e.place)) +
          field('Party / Customer *', input('party', e.party, 'list="dl-parties" autocomplete="off" required'), 'req') +
          field('Material *', select('material', materialNames(), e.material), 'req') +
          field('Quantity / Weight (TON) *', input('weight', e.weight, 'inputmode="decimal" required'), 'req') +
          field('Royalty (TON)', input('royalty', e.royalty, 'inputmode="decimal" placeholder="Same as weight"')) +
          field('Rate (₹ per TON)', input('rate', rate, 'inputmode="decimal"')) +
          field('Payment Type *', select('mode', U.PAYMENT_MODES.map(function (m) { return [m, m === 'Credit' ? 'Credit (Bill Sale)' : m]; }), e.mode), 'req') +
          field('Dala (₹)', input('dala', e.dala, 'inputmode="decimal"')) +
          field('Amount (₹) *', input('amount', e.amount, 'inputmode="decimal" placeholder="TON × rate"') + '<span class="usc-hint" id="amount-hint"></span>', 'req') +
          field('Driver Name', input('driver', e.driver, 'list="dl-drivers" autocomplete="off"')) +
          field('Remarks', input('remarks', e.remarks)) +
        '</div>' +
        '<div class="usc-hint" id="entry-status" style="margin-top:12px"></div>' +
        '<div class="form-actions"><button class="usc-btn usc-btn-primary" type="submit">' + (state.editId ? 'Update Entry' : 'Save Entry') + '</button>' +
        '<button class="usc-btn" type="button" data-action="reset-entry">' + (state.editId ? 'Cancel' : 'Reset') + '</button></div>' +
        datalist('dl-parties', partyNames()) + datalist('dl-drivers', db.drivers.map(function (d) { return d.name; })) +
        datalist('dl-vehicles', unique(db.entries.map(function (x) { return x.vehicle; }).concat(db.drivers.map(function (d) { return d.vehicle; }))).filter(Boolean)) +
      '</form>';
    return '<div class="grid wide-left">' +
      '<section class="usc-card"><div class="usc-band">' + (state.editId ? 'Edit Vehicle Entry' : 'New Vehicle Entry') + '</div>' + form + '</section>' +
      card('Entries on ' + fmtDate(e.date), table(['Time', 'Vehicle', 'Material', '#TON', '#Amount', ''], todays.map(function (x) {
        return '<tr><td>' + esc(x.time) + ' ' + shiftBadge(x.shift) + '</td><td class="usc-plate"><a href="#entry/' + x.id + '" title="Edit this entry">' + esc(x.vehicle) + '</a></td><td>' + esc(x.material) + '</td><td class="num">' + ton(x.weight) + '</td><td class="num">' + inr(x.amount) + '</td><td><div class="row-actions"><a class="usc-btn" href="#challan/' + x.id + '">Challan</a></div></td></tr>';
      }), '', 'No entries for this date yet.'), '<a class="usc-btn usc-btn-sm usc-btn-ghost" href="#sales">All entries</a>') +
    '</div>';
  }
  function unique(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  function readEntryForm(f) {
    var g = function (n) { return f.elements[n].value.trim(); };
    return { date: g('date'), time: g('time'), shift: g('shift'), token: g('token'), vehicle: g('vehicle').toUpperCase().replace(/\s+/g, ''), place: g('place'), party: g('party').toUpperCase(), material: g('material'), weight: g('weight'), royalty: g('royalty'), rate: g('rate'), mode: g('mode'), dala: g('dala'), amount: g('amount'), driver: g('driver'), remarks: g('remarks') };
  }
  function entryComputed(d) {
    var w = num(d.weight), r = num(d.rate);
    return round2(w * r);
  }
  function updateEntryHints() {
    var f = document.getElementById('entry-form'); if (!f) return;
    var d = readEntryForm(f), calc = entryComputed(d), hint = document.getElementById('amount-hint');
    var autoOpt = f.elements.shift.options[0]; autoOpt.textContent = 'Auto — ' + (shiftOf(d.time) === 'DAY' ? 'Day Shift' : 'Night Shift');
    f.elements.amount.placeholder = calc ? calc.toFixed(2) : 'TON × rate';
    hint.textContent = d.mode === 'Credit' ? 'Bill sale: TON × rate = ' + inr(calc) + (d.amount ? '' : ' (used if left blank)') : (d.amount ? '' : calc ? 'Leave blank to use TON × rate = ' + inr(calc) : 'Type the amount received');
    state.draft = Object.assign(state.draft || {}, d);
  }
  function validateEntry(d) {
    var miss = [['vehicle', 'Vehicle Number'], ['party', 'Party Name'], ['material', 'Material'], ['weight', 'Weight'], ['mode', 'Payment Mode']].find(function (x) { return !d[x[0]]; });
    if (miss) return { field: miss[0], msg: 'MISSING: ' + miss[1] };
    if (!(num(d.weight) > 0)) return { field: 'weight', msg: 'Weight must be more than 0' };
    if (!d.amount && !entryComputed(d)) return { field: d.mode === 'Credit' ? 'rate' : 'amount', msg: d.mode === 'Credit' ? 'MISSING: rate for this material — set it here or in Price List' : 'MISSING: Amount' };
    return null;
  }
  function saveEntry(f) {
    var d = readEntryForm(f);
    f.querySelectorAll('.usc-field').forEach(function (x) { x.classList.remove('is-error'); });
    var err = validateEntry(d), status = document.getElementById('entry-status');
    if (err) {
      var el = f.elements[err.field]; el.closest('.usc-field').classList.add('is-error');
      status.className = 'usc-hint danger-text'; status.textContent = err.msg; el.focus(); return;
    }
    var rec = {
      id: state.editId || uid(), date: d.date, time: d.time, shift: d.shift === 'AUTO' ? shiftOf(d.time) : d.shift,
      token: d.token, vehicle: d.vehicle, place: d.place, party: d.party, material: d.material,
      weight: round2(num(d.weight)), royalty: round2(d.royalty === '' ? num(d.weight) : num(d.royalty)),
      mode: d.mode, rate: num(d.rate), dala: num(d.dala), amount: d.amount === '' ? entryComputed(d) : round2(num(d.amount)),
      driver: d.driver, remarks: d.remarks, createdAt: new Date().toISOString()
    };
    if (!db.parties.some(function (p) { return p.name === rec.party; })) db.parties.push({ id: uid(), name: rec.party, phone: '', address: '', opening: 0 });
    if (rec.driver && !db.drivers.some(function (x) { return x.name.toUpperCase() === rec.driver.toUpperCase(); })) db.drivers.push({ id: uid(), name: rec.driver, phone: '', vehicle: rec.vehicle, transporter: '' });
    if (state.editId) {
      var i = db.entries.findIndex(function (x) { return x.id === state.editId; });
      rec.createdAt = db.entries[i].createdAt; db.entries[i] = rec;
    } else {
      db.entries.push(rec);
      var t = parseInt(rec.token, 10); if (isFinite(t) && t >= db.nextToken) db.nextToken = t + 1;
    }
    save();
    var wasEdit = !!state.editId;
    state.editId = null; state.draft = null;
    toast((wasEdit ? 'Entry updated — ' : 'Entry saved — ') + rec.vehicle + ', ' + ton(rec.weight) + ' TON, ' + inr(rec.amount));
    if (wasEdit) location.hash = '#sales'; else render();
  }

  function viewSales() {
    var d = state.salesDate, es = db.entries.filter(function (e) { return e.date === d && (state.salesShift === 'ALL' || e.shift === state.salesShift); });
    var groups = [['DAY', 'Credit', '☀ Day Shift — Bill Sale (Credit)'], ['DAY', 'Cash', '☀ Day Shift — Cash / GPay / UPI'], ['NIGHT', 'Credit', '☾ Night Shift — Bill Sale (Credit)'], ['NIGHT', 'Cash', '☾ Night Shift — Cash / GPay / UPI']];
    var sections = groups.map(function (g) {
      var rows = es.filter(function (e) { return e.shift === g[0] && (g[1] === 'Credit' ? isCredit(e) : !isCredit(e)); }).sort(function (a, b) { return a.time.localeCompare(b.time); });
      if (!rows.length) return '';
      return '<section class="usc-card"><div class="section-title ' + g[0].toLowerCase() + '">' + g[2] + '<span class="usc-badge" style="margin-left:auto">' + rows.length + ' trips</span></div>' +
        table(['S.No', 'Time', 'Token', 'Vehicle No.', 'Place', 'Party', 'Material', '#Weight (TON)', '#Royalty', g[1] === 'Credit' ? '#Dala (₹)' : 'Mode', '#Amount (₹)', ''], rows.map(function (e, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(e.time) + '</td><td class="usc-plate">' + esc(e.token) + '</td><td class="usc-plate">' + esc(e.vehicle) + '</td><td>' + esc(e.place) + '</td><td>' + esc(e.party) + '</td><td>' + esc(e.material) + '</td><td class="num">' + ton(e.weight) + '</td><td class="num">' + ton(e.royalty) + '</td>' +
            (g[1] === 'Credit' ? '<td class="num">' + inr(e.dala) + '</td>' : '<td>' + modeBadge(e.mode) + '</td>') + '<td class="num">' + inr(e.amount) + '</td>' +
            '<td><div class="row-actions"><a class="usc-btn" href="#challan/' + e.id + '">Challan</a><a class="usc-btn" href="#entry/' + e.id + '">Edit</a><button class="usc-btn" data-action="del-entry" data-id="' + e.id + '">Delete</button></div></td></tr>';
        }), '<tr><td colspan="7">Total</td><td class="num">' + ton(sum(rows, function (e) { return e.weight; })) + '</td><td class="num">' + ton(sum(rows, function (e) { return e.royalty; })) + '</td><td class="num">' + (g[1] === 'Credit' ? inr(sum(rows, function (e) { return e.dala; })) : '') + '</td><td class="num">' + inr(sum(rows, function (e) { return e.amount; })) + '</td><td></td></tr>') + '</section>';
    }).join('');
    var pay = by(es, function (e) { return e.mode; }, function (e) { return e.amount; });
    var snap = [
      ['Total Entries', es.length], ['Day Entries', es.filter(function (e) { return e.shift === 'DAY'; }).length], ['Night Entries', es.filter(function (e) { return e.shift === 'NIGHT'; }).length],
      ['Total Weight (TON)', ton(sum(es, function (e) { return e.weight; }))], ['Total Dala', inr(sum(es, function (e) { return e.dala; }))],
      ['Bill Sale (Credit)', inr(sum(es.filter(isCredit), function (e) { return e.amount; }))], ['Cash / GPay / UPI', inr(sum(es.filter(function (e) { return !isCredit(e); }), function (e) { return e.amount; }))]
    ];
    return '<div class="toolbar no-print">' +
        field('Date', input('salesDate', d, 'type="date" data-bind="salesDate"')) +
        field('Shift', select('salesShift', [['ALL', 'Both shifts'], ['DAY', 'Day Shift'], ['NIGHT', 'Night Shift']], state.salesShift, 'data-bind="salesShift"')) +
        '<button class="usc-btn" data-action="day-prev">‹ Prev day</button><button class="usc-btn" data-action="day-next">Next day ›</button>' +
        '<a class="usc-btn usc-btn-primary" href="#entry">' + icon('plus') + 'New Entry</a>' +
        '<button class="usc-btn" data-action="export-day">' + icon('download') + 'Export Excel</button>' +
        '<button class="usc-btn" data-action="print">' + icon('print') + 'Print</button>' +
      '</div>' +
      '<div class="grid two" style="align-items:start">' + card('Daily Snapshot — ' + fmtLong(d), table(['Item', '#Value'], snap.map(function (s) { return '<tr><td>' + s[0] + '</td><td class="num">' + s[1] + '</td></tr>'; }))) +
      card('Payment Summary', table(['Mode', '#Amount'], Object.keys(pay).map(function (k) { return '<tr><td>' + modeBadge(k) + '</td><td class="num">' + inr(pay[k]) + '</td></tr>'; }), '', 'No payments.')) + '</div>' +
      (sections || card('Daily Sale Register — ' + fmtDate(d), '<div class="empty">No entries for ' + fmtLong(d) + '.</div>'));
  }

  function viewStock() {
    var rows = db.materials.map(function (m) {
      var s = stockOf(m.name);
      return '<tr><td><b>' + esc(m.name) + '</b></td><td class="num">' + ton(s.opening) + '</td><td class="num">' + ton(s.inward) + '</td><td class="num">' + ton(s.outward) + '</td><td class="num ' + (s.stock < 0 ? 'danger-text' : 'success-text') + '">' + ton(s.stock) + '</td></tr>';
    });
    var tot = db.materials.reduce(function (a, m) { var s = stockOf(m.name); a[0] += s.opening; a[1] += s.inward; a[2] += s.outward; a[3] += s.stock; return a; }, [0, 0, 0, 0]);
    var days = [], series = {};
    for (var i = 6; i >= 0; i--) days.push(addDays(today(), -i));
    var prodRows = db.production.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 30).map(function (p) {
      return '<tr><td>' + fmtDate(p.date) + '</td><td>' + esc(p.material) + '</td><td class="num">' + ton(p.qty) + '</td><td>' + esc(p.note) + '</td><td><div class="row-actions"><button class="usc-btn" data-action="del-production" data-id="' + p.id + '">Delete</button></div></td></tr>';
    });
    var prodSeries = days.map(function (d) { return sum(db.production.filter(function (x) { return x.date === d; }), function (x) { return x.qty; }); });
    var saleSeries = days.map(function (d) { return sum(db.entries.filter(function (x) { return x.date === d; }), function (x) { return x.weight; }); });
    return '<div class="grid wide-left" style="align-items:start">' +
      card('Material Stock (TON)', table(['Material', '#Opening', '#Inward (Production)', '#Outward (Sales)', '#Stock'], rows,
        '<tr><td>Total</td><td class="num">' + ton(tot[0]) + '</td><td class="num">' + ton(tot[1]) + '</td><td class="num">' + ton(tot[2]) + '</td><td class="num">' + ton(tot[3]) + '</td></tr>'),
        '<button class="usc-btn usc-btn-sm usc-btn-primary" data-action="add-production">' + icon('plus', 16) + 'Add Production</button>') +
      card('Stock Trend — last 7 days (TON)', barChart(days.map(shortDay), prodSeries, saleSeries, { a: 'Inward', b: 'Outward' })) +
      '</div>' +
      card('Production / Inward Log', table(['Date', 'Material', '#Qty (TON)', 'Note', ''], prodRows, '', 'No production recorded. Use “Add Production” to record crushed output; opening stock is set in Price List.'));
  }

  function viewParties() {
    var list = db.parties.map(function (p) { return { p: p, l: partyLedger(p.name) }; }).sort(function (a, b) { return b.l.balance - a.l.balance; });
    var tot = list.reduce(function (a, x) { a[0] += x.l.billed; a[1] += x.l.paid; a[2] += x.l.balance; return a; }, [0, 0, 0]);
    return card('Customer Ledger', table(['Customer', 'Phone', '#Trips', '#Qty (TON)', '#Billed (₹)', '#Paid (₹)', '#Balance (₹)', ''], list.map(function (x) {
      return '<tr><td><a href="#party/' + encodeURIComponent(x.p.name) + '"><b>' + esc(x.p.name) + '</b></a></td><td>' + esc(x.p.phone) + '</td><td class="num">' + x.l.trips + '</td><td class="num">' + ton(x.l.qty) + '</td><td class="num">' + inr(x.l.billed) + '</td><td class="num">' + inr(x.l.paid) + '</td><td class="num ' + (x.l.balance > 0.5 ? 'danger-text' : '') + '">' + inr(x.l.balance) + '</td>' +
        '<td><div class="row-actions"><button class="usc-btn" data-action="receive" data-party="' + esc(x.p.name) + '">Receive</button><button class="usc-btn" data-action="edit-party" data-id="' + x.p.id + '">Edit</button></div></td></tr>';
    }), '<tr><td colspan="4">Total</td><td class="num">' + inr(tot[0]) + '</td><td class="num">' + inr(tot[1]) + '</td><td class="num">' + inr(tot[2]) + '</td><td></td></tr>'),
      '<button class="usc-btn usc-btn-sm usc-btn-primary" data-action="edit-party">' + icon('plus', 16) + 'Add Customer</button>') +
      '<p class="muted small">Billed = opening balance + Credit (Bill Sale) entries. Cash, GPay and UPI sales are paid on the spot and do not add to the balance.</p>';
  }

  function viewParty(name) {
    var p = db.parties.find(function (x) { return x.name === name; });
    if (!p) return '<div class="empty">Customer not found. <a href="#parties">Back to customers</a></div>';
    var l = partyLedger(name);
    var rows = [];
    if (num(p.opening)) rows.push({ date: '', text: 'Opening balance', debit: num(p.opening), credit: 0 });
    db.entries.filter(function (e) { return e.party === name; }).forEach(function (e) {
      rows.push({ date: e.date, time: e.time, text: e.material + ' · ' + ton(e.weight) + ' TON · ' + e.vehicle + (isCredit(e) ? '' : ' · ' + e.mode + ' (paid)'), debit: isCredit(e) ? e.amount : 0, credit: 0, id: e.id });
    });
    db.payments.filter(function (x) { return x.party === name; }).forEach(function (x) {
      rows.push({ date: x.date, time: '', text: 'Payment — ' + x.mode + (x.remark ? ' · ' + x.remark : ''), debit: 0, credit: x.amount });
    });
    rows.sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
    var bal = 0;
    var body = rows.map(function (r) {
      bal += r.debit - r.credit;
      return '<tr><td>' + fmtDate(r.date) + '</td><td>' + esc(r.text) + '</td><td class="num">' + (r.debit ? inr(r.debit) : '') + '</td><td class="num">' + (r.credit ? inr(r.credit) : '') + '</td><td class="num">' + inr(bal) + '</td><td>' + (r.id ? '<div class="row-actions"><a class="usc-btn" href="#challan/' + r.id + '">Challan</a></div>' : '') + '</td></tr>';
    });
    return '<div class="toolbar no-print"><a class="usc-btn" href="#parties">‹ All customers</a><button class="usc-btn usc-btn-primary" data-action="receive" data-party="' + esc(name) + '">' + icon('plus') + 'Receive Payment</button><button class="usc-btn" data-action="export-party" data-party="' + esc(name) + '">' + icon('download') + 'Export Excel</button><button class="usc-btn" data-action="print">' + icon('print') + 'Print</button></div>' +
      '<div class="kpis">' + stat('users', 'Customer', esc(name), esc(p.phone || 'No phone')) + stat('rupee', 'Total Billed', money(l.billed), 'Credit sales') + stat('wallet', 'Paid', money(l.paid), 'Payments received') + stat('doc', 'Balance', money(l.balance), l.balance > 0.5 ? 'Pending' : 'Settled', l.balance > 0.5) + '</div>' +
      card('Ledger — ' + esc(name), table(['Date', 'Particulars', '#Debit (₹)', '#Credit (₹)', '#Balance (₹)', ''], body, '<tr><td colspan="2">Closing balance</td><td class="num">' + inr(l.billed) + '</td><td class="num">' + inr(l.paid) + '</td><td class="num">' + inr(l.balance) + '</td><td></td></tr>', 'No transactions yet.'));
  }

  function viewDrivers() {
    return card('Drivers / Transporters', table(['Name', 'Phone', 'Vehicle', 'Transporter', '#Trips', ''], db.drivers.map(function (d) {
      var trips = db.entries.filter(function (e) { return e.driver && e.driver.toUpperCase() === d.name.toUpperCase(); }).length;
      return '<tr><td><b>' + esc(d.name) + '</b></td><td>' + esc(d.phone) + '</td><td class="usc-plate">' + esc(d.vehicle) + '</td><td>' + esc(d.transporter) + '</td><td class="num">' + trips + '</td><td><div class="row-actions"><button class="usc-btn" data-action="edit-driver" data-id="' + d.id + '">Edit</button><button class="usc-btn" data-action="del-driver" data-id="' + d.id + '">Delete</button></div></td></tr>';
    }), '', 'No drivers yet. They are also added automatically when you type a new driver name in a vehicle entry.'),
      '<button class="usc-btn usc-btn-sm usc-btn-primary" data-action="edit-driver">' + icon('plus', 16) + 'Add Driver</button>');
  }

  function viewPayments() {
    var list = db.payments.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var month = today().slice(0, 7), mt = sum(list.filter(function (x) { return x.date.slice(0, 7) === month; }), function (x) { return x.amount; });
    return '<div class="kpis">' + stat('wallet', 'Received this month', money(mt), 'Payments') + stat('doc', 'Outstanding', money(totalOutstanding()), 'All customers', true) + '</div>' +
      card('Payments Received', table(['Date', 'Customer', 'Mode', '#Amount (₹)', 'Remark', ''], list.map(function (x) {
        return '<tr><td>' + fmtDate(x.date) + '</td><td><a href="#party/' + encodeURIComponent(x.party) + '">' + esc(x.party) + '</a></td><td>' + modeBadge(x.mode) + '</td><td class="num">' + inr(x.amount) + '</td><td>' + esc(x.remark) + '</td><td><div class="row-actions"><button class="usc-btn" data-action="del-payment" data-id="' + x.id + '">Delete</button></div></td></tr>';
      }), '', 'No payments recorded yet.'), '<button class="usc-btn usc-btn-sm usc-btn-primary" data-action="receive">' + icon('plus', 16) + 'Receive Payment</button>');
  }

  var EXPENSE_CATS = ['Diesel', 'Electricity', 'Wages / Labour', 'Machine Repair', 'Royalty / Govt Fees', 'Transport', 'Office', 'Other'];
  function viewExpenses() {
    var list = db.expenses.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var month = today().slice(0, 7), ml = list.filter(function (x) { return x.date.slice(0, 7) === month; });
    var cat = by(ml, function (x) { return x.category; }, function (x) { return x.amount; });
    return '<div class="kpis">' + stat('receipt', 'Expenses this month', inr(sum(ml, function (x) { return x.amount; })), 'Spent') + stat('receipt', 'Today', inr(sum(list.filter(function (x) { return x.date === today(); }), function (x) { return x.amount; })), 'Spent') + '</div>' +
      '<div class="grid wide-left" style="align-items:start">' +
      card('Expenses', table(['Date', 'Category', 'Mode', '#Amount (₹)', 'Note', ''], list.map(function (x) {
        return '<tr><td>' + fmtDate(x.date) + '</td><td>' + esc(x.category) + '</td><td>' + esc(x.mode) + '</td><td class="num">' + inr(x.amount) + '</td><td>' + esc(x.note) + '</td><td><div class="row-actions"><button class="usc-btn" data-action="del-expense" data-id="' + x.id + '">Delete</button></div></td></tr>';
      }), '', 'No expenses recorded yet.'), '<button class="usc-btn usc-btn-sm usc-btn-primary" data-action="add-expense">' + icon('plus', 16) + 'Add Expense</button>') +
      card('This month by category', table(['Category', '#Amount (₹)'], Object.keys(cat).sort(function (a, b) { return cat[b] - cat[a]; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="num">' + inr(cat[k]) + '</td></tr>'; }), '', 'Nothing this month.')) +
      '</div>';
  }

  function reportData(from, to) {
    var es = db.entries.filter(function (e) { return inRange(e.date, from, to); });
    var ex = db.expenses.filter(function (e) { return inRange(e.date, from, to); });
    var pay = db.payments.filter(function (e) { return inRange(e.date, from, to); });
    var daily = [], d = from, guard = 0;
    while (d <= to && guard++ < 400) {
      var dd = d;
      daily.push({ date: dd, qty: sum(es.filter(function (e) { return e.date === dd; }), function (e) { return e.weight; }), sales: sum(es.filter(function (e) { return e.date === dd; }), function (e) { return e.amount; }), trips: es.filter(function (e) { return e.date === dd; }).length });
      d = addDays(d, 1);
    }
    return {
      es: es, ex: ex, pay: pay, daily: daily,
      qty: sum(es, function (e) { return e.weight; }), sales: sum(es, function (e) { return e.amount; }),
      credit: sum(es.filter(isCredit), function (e) { return e.amount; }), cash: sum(es.filter(function (e) { return !isCredit(e); }), function (e) { return e.amount; }),
      dala: sum(es, function (e) { return e.dala; }), expenses: sum(ex, function (e) { return e.amount; }), received: sum(pay, function (e) { return e.amount; }),
      byMatQty: by(es, function (e) { return e.material; }, function (e) { return e.weight; }), byMatAmt: by(es, function (e) { return e.material; }, function (e) { return e.amount; }),
      byPartyQty: by(es, function (e) { return e.party; }, function (e) { return e.weight; }), byPartyAmt: by(es, function (e) { return e.party; }, function (e) { return e.amount; }),
      byMode: by(es, function (e) { return e.mode; }, function (e) { return e.amount; }),
      byShift: by(es, function (e) { return e.shift; }, function (e) { return e.weight; })
    };
  }
  function viewReports() {
    var f = state.reportFrom, t = state.reportTo, r = reportData(f, t);
    var mats = Object.keys(r.byMatQty).sort(function (a, b) { return r.byMatQty[b] - r.byMatQty[a]; });
    var parties = Object.keys(r.byPartyQty).sort(function (a, b) { return r.byPartyAmt[b] - r.byPartyAmt[a]; });
    return '<div class="toolbar no-print">' +
        field('From', input('reportFrom', f, 'type="date" data-bind="reportFrom"')) + field('To', input('reportTo', t, 'type="date" data-bind="reportTo"')) +
        '<button class="usc-btn" data-action="range" data-range="today">Today</button><button class="usc-btn" data-action="range" data-range="week">Last 7 days</button><button class="usc-btn" data-action="range" data-range="month">This month</button><button class="usc-btn" data-action="range" data-range="lastmonth">Last month</button>' +
        '<button class="usc-btn usc-btn-primary" data-action="export-report">' + icon('download') + 'Export Excel</button><button class="usc-btn" data-action="print">' + icon('print') + 'Print / PDF</button>' +
      '</div>' +
      '<h2 class="usc-card-title">Sales Report · ' + fmtDate(f) + (f !== t ? ' to ' + fmtDate(t) : '') + '</h2>' +
      '<div class="kpis">' + stat('truck', 'Total Vehicles', r.es.length, 'Trips') + stat('stack', 'Total Quantity', ton(r.qty) + ' <span class="small">TON</span>', 'Dispatched') + stat('rupee', 'Total Sales', money(r.sales), 'Bill ' + U.formatINRShort(r.credit) + ' · Cash ' + U.formatINRShort(r.cash)) + stat('receipt', 'Expenses', money(r.expenses), 'Net ' + inr(r.cash + r.received - r.expenses), r.expenses > r.cash + r.received) + '</div>' +
      '<div class="grid two">' +
        card('Material-wise Sales', table(['Material', '#Qty (TON)', '#Amount (₹)'], mats.map(function (m) { return '<tr><td>' + esc(m) + '</td><td class="num">' + ton(r.byMatQty[m]) + '</td><td class="num">' + inr(r.byMatAmt[m]) + '</td></tr>'; }), '', 'No sales in this period.')) +
        card(r.daily.length > 1 ? 'Daily Sales (₹)' : 'Shift-wise Quantity (TON)', r.daily.length > 1 ? '<div class="usc-card-body">' + lineChart(r.daily.map(function (x) { return shortDay(x.date); }), r.daily.map(function (x) { return x.sales; }), 'Daily sales') + '</div>' : '<div class="usc-card-body">' + meters(r.byShift.DAY || r.byShift.NIGHT ? { 'Day Shift': r.byShift.DAY || 0, 'Night Shift': r.byShift.NIGHT || 0 } : {}, 'TON') + '</div>') +
      '</div>' +
      '<div class="grid two">' +
        card('Party-wise Sales', table(['Party', '#Qty (TON)', '#Amount (₹)'], parties.map(function (p) { return '<tr><td>' + esc(p) + '</td><td class="num">' + ton(r.byPartyQty[p]) + '</td><td class="num">' + inr(r.byPartyAmt[p]) + '</td></tr>'; }), '', 'No sales in this period.')) +
        card('Collection Summary', table(['Item', '#Amount (₹)'], [
          ['Bill Sale (Credit)', r.credit], ['Cash / GPay / UPI sales', r.cash]].concat(Object.keys(r.byMode).filter(function (k) { return k !== 'Credit'; }).map(function (k) { return ['&nbsp;&nbsp;· ' + esc(k), r.byMode[k]]; }))
          .concat([['Payments received (old dues)', r.received], ['Dala', r.dala], ['Expenses', -r.expenses], ['Net cash in hand', r.cash + r.received - r.expenses]]).map(function (x) {
            return '<tr><td>' + x[0] + '</td><td class="num">' + inr(x[1]) + '</td></tr>';
          }))) +
      '</div>' +
      card('Day-by-day', table(['Date', '#Trips', '#Qty (TON)', '#Sales (₹)'], r.daily.map(function (x) { return '<tr><td>' + fmtDate(x.date) + '</td><td class="num">' + x.trips + '</td><td class="num">' + ton(x.qty) + '</td><td class="num">' + inr(x.sales) + '</td></tr>'; }),
        '<tr><td>Total</td><td class="num">' + r.es.length + '</td><td class="num">' + ton(r.qty) + '</td><td class="num">' + inr(r.sales) + '</td></tr>'));
  }

  function viewPrices() {
    return card('Price List (₹ per TON) & Opening Stock', '<form id="price-form">' + table(['Material', 'Sale Rate (₹ / TON)', 'Opening Stock (TON)', ''], db.materials.map(function (m, i) {
      return '<tr><td><b>' + esc(m.name) + '</b></td><td>' + input('rate-' + i, m.rate, 'inputmode="decimal" style="max-width:160px" aria-label="Rate for ' + esc(m.name) + '"') + '</td><td>' + input('open-' + i, m.opening, 'inputmode="decimal" style="max-width:160px" aria-label="Opening stock for ' + esc(m.name) + '"') + '</td><td><div class="row-actions"><button class="usc-btn" type="button" data-action="del-material" data-i="' + i + '">Remove</button></div></td></tr>';
    })) + '<div class="usc-card-body form-actions" style="margin:0"><button class="usc-btn usc-btn-primary" type="submit">Save Prices</button><button class="usc-btn" type="button" data-action="add-material">' + icon('plus') + 'Add Material</button></div></form>') +
      '<p class="muted small">Bill sale (Credit) amount = Weight (TON) × this rate, as in the Excel register. Cash entries can type their own amount.</p>';
  }

  function viewSettings() {
    var s = db.settings;
    return '<div class="grid two" style="align-items:start">' +
      card('Company Details', '<form id="settings-form" class="usc-card-body"><div class="form-grid">' +
        field('Company Name', input('company', s.company), 'full') + field('Tagline', input('tagline', s.tagline), 'full') +
        field('Address', input('address', s.address), 'full') + field('GSTIN', input('gstin', s.gstin)) + field('Phone', input('phone', s.phone)) +
        field('Signed-in name', input('user', s.user)) + field('Next Token No.', input('nextToken', db.nextToken, 'inputmode="numeric"')) +
        '</div><div class="form-actions"><button class="usc-btn usc-btn-primary" type="submit">Save Settings</button></div></form>') +
      card('Excel Import / Export', '<div class="usc-card-body usc-stack" style="padding:16px">' +
        '<p class="small" style="margin:0">Import your existing register: the daily-sheet workbook (sheets named <b>01-Aug</b>, <b>02-Aug</b>…) or a simple sheet with one row per vehicle. Use the template for the simple format.</p>' +
        '<button class="usc-btn usc-btn-primary" data-action="import">' + icon('upload') + 'Import Excel</button>' +
        '<button class="usc-btn" data-action="template">' + icon('download') + 'Download Excel Template</button>' +
        '<button class="usc-btn" data-action="export-all">' + icon('excel') + 'Export Current Data</button>' +
        '<hr style="border:0;border-top:1px solid var(--line);width:100%">' +
        '<p class="small muted" style="margin:0">Data is stored in this browser only. Download a backup to move it to another phone or laptop.</p>' +
        '<button class="usc-btn" data-action="backup">' + icon('download') + 'Download Backup (.json)</button>' +
        '<button class="usc-btn" data-action="restore">' + icon('upload') + 'Restore Backup</button>' +
        '<button class="usc-btn" data-action="demo">Load Demo Data</button>' +
        '<button class="usc-btn" data-action="wipe" style="color:var(--danger)">Delete All Data</button>' +
      '</div>') + '</div>';
  }

  function amountWords(n) {
    var a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    var b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function two(x) { return x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''); }
    function three(x) { return (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : ''); }
    var r = Math.floor(n), p = Math.round((n - r) * 100), out = [];
    if (r === 0) out.push('Zero');
    var cr = Math.floor(r / 1e7); r %= 1e7; var la = Math.floor(r / 1e5); r %= 1e5; var th = Math.floor(r / 1e3); r %= 1e3;
    if (cr) out.push(three(cr) + ' Crore'); if (la) out.push(two(la) + ' Lakh'); if (th) out.push(two(th) + ' Thousand'); if (r) out.push(three(r));
    return 'Rupees ' + out.join(' ') + (p ? ' and ' + two(p) + ' Paise' : '') + ' Only';
  }
  function viewChallan(id) {
    var e = db.entries.find(function (x) { return x.id === id; });
    if (!e) return '<div class="empty">Entry not found. <a href="#sales">Back to sales</a></div>';
    var s = db.settings, no = 'USC-' + e.date.replace(/-/g, '') + '-' + (e.token || db.entries.indexOf(e) + 1);
    return '<div class="toolbar no-print"><a class="usc-btn" href="#sales">‹ Back</a><button class="usc-btn usc-btn-primary" data-action="print">' + icon('print') + 'Print / Save PDF</button></div>' +
      '<article class="challan">' +
        '<h2>' + esc(s.company.toUpperCase()) + '</h2>' +
        '<div class="addr">' + esc(s.address) + (s.gstin ? ' · GSTIN: ' + esc(s.gstin) : '') + (s.phone ? ' · Ph: ' + esc(s.phone) : '') + '</div>' +
        '<span class="tag">' + (isCredit(e) ? 'CREDIT CHALLAN' : 'CASH CHALLAN') + '</span>' +
        '<dl><dt>Challan No.</dt><dd>' + esc(no) + '</dd><dt>Date / Time</dt><dd>' + fmtDate(e.date) + ' ' + esc(e.time) + '</dd>' +
        '<dt>Vehicle No.</dt><dd>' + esc(e.vehicle) + '</dd><dt>Token No.</dt><dd>' + esc(e.token) + '</dd>' +
        '<dt>Party Name</dt><dd>' + esc(e.party) + '</dd><dt>Destination</dt><dd>' + esc(e.place) + '</dd>' +
        '<dt>Driver</dt><dd>' + esc(e.driver || '—') + '</dd><dt>Shift / Mode</dt><dd>' + (e.shift === 'DAY' ? 'Day' : 'Night') + ' · ' + esc(e.mode) + '</dd>' +
        (e.dala ? '<dt>Dala</dt><dd>' + inr(e.dala) + '</dd>' : '') + '</dl>' +
        '<table><thead><tr><th>S.No</th><th>Material</th><th class="num">Qty (TON)</th><th class="num">Royalty (TON)</th><th class="num">Rate (₹)</th><th class="num">Amount (₹)</th></tr></thead><tbody>' +
        '<tr><td>1</td><td>' + esc(e.material) + '</td><td class="num">' + ton(e.weight) + '</td><td class="num">' + ton(e.royalty) + '</td><td class="num">' + (e.rate ? ton(e.rate) : '—') + '</td><td class="num">' + ton(e.amount) + '</td></tr>' +
        '<tr><td colspan="2"><b>Total</b></td><td class="num"><b>' + ton(e.weight) + '</b></td><td></td><td></td><td class="num"><b>' + inr(e.amount) + '</b></td></tr></tbody></table>' +
        '<div class="words"><b>Amount in words:</b> ' + amountWords(round2(e.amount)) + '</div>' +
        (e.remarks ? '<div class="words"><b>Remarks:</b> ' + esc(e.remarks) + '</div>' : '') +
        '<div class="signs"><div>Receiver’s Sign</div><div>For ' + esc(s.company) + '<br>Authorised Sign</div></div>' +
      '</article>';
  }

  // ---------- dialogs ----------
  var dlg = document.getElementById('dialog');
  function openDialog(title, bodyHtml, onSubmit) {
    dlg.innerHTML = '<div class="usc-card-head"><h2 class="usc-card-title">' + title + '</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div><form method="dialog" novalidate><div class="form-grid">' + bodyHtml + '</div><div class="usc-hint danger-text" data-err style="margin-top:8px"></div><div class="form-actions"><button class="usc-btn usc-btn-primary" type="submit">Save</button><button class="usc-btn" type="button" data-close>Cancel</button></div></form>';
    var form = dlg.querySelector('form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var data = {}; Array.prototype.forEach.call(form.elements, function (el) { if (el.name) data[el.name] = el.value.trim(); });
      var err = onSubmit(data);
      if (err) { dlg.querySelector('[data-err]').textContent = err; return; }
      dlg.close(); save(); render();
    });
    dlg.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    dlg.showModal();
    var first = form.querySelector('input:not([type=date]),select'); if (first) first.focus();
  }
  function receiveDialog(party) {
    openDialog('Receive Payment',
      field('Date', input('date', today(), 'type="date"')) + field('Customer', input('party', party || '', 'list="dl-p2" autocomplete="off"') + datalist('dl-p2', partyNames())) +
      field('Amount (₹)', input('amount', '', 'inputmode="decimal"')) + field('Mode', select('mode', U.PAYMENT_MODES.filter(function (m) { return m !== 'Credit'; }).concat(['Cheque']), 'Cash')) +
      field('Remark', input('remark', ''), 'full'),
      function (d) {
        d.party = d.party.toUpperCase();
        if (!d.party) return 'MISSING: Customer';
        if (!(num(d.amount) > 0)) return 'MISSING: Amount';
        if (!db.parties.some(function (p) { return p.name === d.party; })) db.parties.push({ id: uid(), name: d.party, phone: '', address: '', opening: 0 });
        db.payments.push({ id: uid(), date: d.date, party: d.party, amount: round2(num(d.amount)), mode: d.mode, remark: d.remark });
        toast('Payment of ' + inr(num(d.amount)) + ' received from ' + d.party);
      });
  }
  function partyDialog(id) {
    var p = db.parties.find(function (x) { return x.id === id; }) || { name: '', phone: '', address: '', opening: 0 };
    openDialog(id ? 'Edit Customer' : 'Add Customer',
      field('Name', input('name', p.name), 'full') + field('Phone', input('phone', p.phone, 'inputmode="tel"')) + field('Opening Balance (₹)', input('opening', p.opening, 'inputmode="decimal"')) + field('Address', input('address', p.address), 'full'),
      function (d) {
        var name = d.name.toUpperCase();
        if (!name) return 'MISSING: Name';
        if (db.parties.some(function (x) { return x.name === name && x.id !== id; })) return 'A customer with this name already exists';
        if (id) {
          if (p.name !== name) {
            db.entries.forEach(function (e) { if (e.party === p.name) e.party = name; });
            db.payments.forEach(function (e) { if (e.party === p.name) e.party = name; });
          }
          Object.assign(p, { name: name, phone: d.phone, address: d.address, opening: num(d.opening) });
        } else db.parties.push({ id: uid(), name: name, phone: d.phone, address: d.address, opening: num(d.opening) });
      });
  }
  function driverDialog(id) {
    var p = db.drivers.find(function (x) { return x.id === id; }) || { name: '', phone: '', vehicle: '', transporter: '' };
    openDialog(id ? 'Edit Driver' : 'Add Driver',
      field('Name', input('name', p.name)) + field('Phone', input('phone', p.phone, 'inputmode="tel"')) + field('Vehicle No.', input('vehicle', p.vehicle, 'class="usc-input usc-plate"')) + field('Transporter', input('transporter', p.transporter)),
      function (d) {
        if (!d.name) return 'MISSING: Name';
        d.vehicle = d.vehicle.toUpperCase().replace(/\s+/g, '');
        if (id) Object.assign(p, d); else db.drivers.push(Object.assign({ id: uid() }, d));
      });
  }
  function productionDialog() {
    openDialog('Add Production (Inward)',
      field('Date', input('date', today(), 'type="date"')) + field('Material', select('material', materialNames(), '')) + field('Quantity (TON)', input('qty', '', 'inputmode="decimal"')) + field('Note', input('note', '')),
      function (d) {
        if (!(num(d.qty) > 0)) return 'MISSING: Quantity';
        db.production.push({ id: uid(), date: d.date, material: d.material, qty: round2(num(d.qty)), note: d.note });
      });
  }
  function expenseDialog() {
    openDialog('Add Expense',
      field('Date', input('date', today(), 'type="date"')) + field('Category', select('category', EXPENSE_CATS, 'Diesel')) + field('Amount (₹)', input('amount', '', 'inputmode="decimal"')) + field('Paid by', select('mode', ['Cash', 'GPay', 'UPI', 'Bank Transfer', 'Cheque'], 'Cash')) + field('Note', input('note', ''), 'full'),
      function (d) {
        if (!(num(d.amount) > 0)) return 'MISSING: Amount';
        db.expenses.push({ id: uid(), date: d.date, category: d.category, amount: round2(num(d.amount)), mode: d.mode, note: d.note });
      });
  }
  function materialDialog() {
    openDialog('Add Material',
      field('Material Name', input('name', '', 'placeholder="e.g. 6MM"')) + field('Rate (₹ / TON)', input('rate', '', 'inputmode="decimal"')) + field('Opening Stock (TON)', input('opening', '', 'inputmode="decimal"')),
      function (d) {
        var n = d.name.toUpperCase().replace(/\s+/g, ' ');
        if (!n) return 'MISSING: Material Name';
        if (db.materials.some(function (m) { return m.name === n; })) return 'This material already exists';
        db.materials.push({ name: n, rate: num(d.rate), opening: num(d.opening) });
      });
  }

  // ---------- Excel ----------
  function needXLSX() { if (!window.XLSX) { toast('Excel library did not load — check the internet connection and reload'); return false; } return true; }
  var ENTRY_HEAD = ['Date', 'Time', 'Shift', 'Token No', 'Vehicle No', 'Place', 'Party', 'Material', 'Weight (TON)', 'Royalty (TON)', 'Payment Mode', 'Rate', 'Dala', 'Amount', 'Driver', 'Remarks'];
  function entryRow(e) { return [fmtDate(e.date), e.time, e.shift === 'DAY' ? 'Day' : 'Night', e.token, e.vehicle, e.place, e.party, e.material, e.weight, e.royalty, e.mode, e.rate, e.dala, e.amount, e.driver, e.remarks]; }
  function sheet(rows, widths) { var ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = (widths || rows[0].map(function () { return 14; })).map(function (w) { return { wch: w }; }); return ws; }
  function sortEntries(list) { return list.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }); }
  function exportFile(wb, name) { XLSX.writeFile(wb, name); toast('Downloaded ' + name); }

  function exportAll() {
    if (!needXLSX()) return;
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([ENTRY_HEAD].concat(sortEntries(db.entries).map(entryRow))), 'Vehicle Entries');
    XLSX.utils.book_append_sheet(wb, sheet([['Customer', 'Phone', 'Address', 'Opening', 'Billed', 'Paid', 'Balance']].concat(db.parties.map(function (p) { var l = partyLedger(p.name); return [p.name, p.phone, p.address, num(p.opening), l.billed, l.paid, l.balance]; }))), 'Customers');
    XLSX.utils.book_append_sheet(wb, sheet([['Date', 'Customer', 'Amount', 'Mode', 'Remark']].concat(db.payments.map(function (x) { return [fmtDate(x.date), x.party, x.amount, x.mode, x.remark]; }))), 'Payments');
    XLSX.utils.book_append_sheet(wb, sheet([['Date', 'Category', 'Amount', 'Mode', 'Note']].concat(db.expenses.map(function (x) { return [fmtDate(x.date), x.category, x.amount, x.mode, x.note]; }))), 'Expenses');
    XLSX.utils.book_append_sheet(wb, sheet([['Material', 'Rate', 'Opening', 'Inward', 'Outward', 'Stock']].concat(db.materials.map(function (m) { var s = stockOf(m.name); return [m.name, num(m.rate), s.opening, s.inward, s.outward, s.stock]; }))), 'Stock');
    XLSX.utils.book_append_sheet(wb, sheet([['Date', 'Material', 'Qty (TON)', 'Note']].concat(db.production.map(function (x) { return [fmtDate(x.date), x.material, x.qty, x.note]; }))), 'Production');
    XLSX.utils.book_append_sheet(wb, sheet([['Name', 'Phone', 'Vehicle', 'Transporter']].concat(db.drivers.map(function (x) { return [x.name, x.phone, x.vehicle, x.transporter]; }))), 'Drivers');
    exportFile(wb, 'StoneCrusher_AllData_' + today() + '.xlsx');
  }
  function exportDay() {
    if (!needXLSX()) return;
    var es = sortEntries(db.entries.filter(function (e) { return e.date === state.salesDate; }));
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([ENTRY_HEAD].concat(es.map(entryRow))), fmtDate(state.salesDate));
    exportFile(wb, 'DailySales_' + state.salesDate + '.xlsx');
  }
  function exportReport() {
    if (!needXLSX()) return;
    var r = reportData(state.reportFrom, state.reportTo), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([['Sales Report', fmtDate(state.reportFrom) + ' to ' + fmtDate(state.reportTo)], [], ['Total Vehicles', r.es.length], ['Total Quantity (TON)', round2(r.qty)], ['Total Sales', r.sales], ['Bill Sale (Credit)', r.credit], ['Cash / GPay / UPI', r.cash], ['Payments received', r.received], ['Dala', r.dala], ['Expenses', r.expenses], ['Net cash in hand', r.cash + r.received - r.expenses]], [26, 24]), 'Summary');
    XLSX.utils.book_append_sheet(wb, sheet([['Material', 'Qty (TON)', 'Amount']].concat(Object.keys(r.byMatQty).map(function (k) { return [k, round2(r.byMatQty[k]), r.byMatAmt[k]]; }))), 'Material-wise');
    XLSX.utils.book_append_sheet(wb, sheet([['Party', 'Qty (TON)', 'Amount']].concat(Object.keys(r.byPartyQty).map(function (k) { return [k, round2(r.byPartyQty[k]), r.byPartyAmt[k]]; }))), 'Party-wise');
    XLSX.utils.book_append_sheet(wb, sheet([['Date', 'Trips', 'Qty (TON)', 'Sales']].concat(r.daily.map(function (x) { return [fmtDate(x.date), x.trips, round2(x.qty), x.sales]; }))), 'Daily');
    XLSX.utils.book_append_sheet(wb, sheet([ENTRY_HEAD].concat(sortEntries(r.es).map(entryRow))), 'Entries');
    exportFile(wb, 'Report_' + state.reportFrom + '_to_' + state.reportTo + '.xlsx');
  }
  function exportParty(name) {
    if (!needXLSX()) return;
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([ENTRY_HEAD].concat(sortEntries(db.entries.filter(function (e) { return e.party === name; })).map(entryRow))), 'Sales');
    XLSX.utils.book_append_sheet(wb, sheet([['Date', 'Amount', 'Mode', 'Remark']].concat(db.payments.filter(function (x) { return x.party === name; }).map(function (x) { return [fmtDate(x.date), x.amount, x.mode, x.remark]; }))), 'Payments');
    exportFile(wb, 'Ledger_' + name.replace(/[^A-Za-z0-9]+/g, '_') + '.xlsx');
  }
  function downloadTemplate() {
    if (!needXLSX()) return;
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([ENTRY_HEAD, [fmtDate(today()), '10:32', 'Day', 1001, 'UK07CA1234', 'LOCAL', 'SHARMA CONSTRUCTION', '20MM', 28.5, 28.5, 'Cash', 420, 0, 11970, 'Rakesh Singh', '']]), 'Vehicle Entries');
    exportFile(wb, 'StoneCrusher_Import_Template.xlsx');
  }

  function excelDate(v, fallbackYear) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return isoDate(v);
    if (typeof v === 'number') { var d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})/))) { var mi = MONTHS.map(function (x) { return x.toLowerCase(); }).indexOf(m[2].toLowerCase()); if (mi >= 0) return (fallbackYear || new Date().getFullYear()) + '-' + pad(mi + 1) + '-' + pad(+m[1]); }
    return '';
  }
  function excelTime(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') { var mins = Math.round((v % 1) * 1440); return pad(Math.floor(mins / 60) % 24) + ':' + pad(mins % 60); }
    var m = String(v).match(/(\d{1,2}):(\d{2})/); return m ? pad(+m[1]) + ':' + m[2] : '';
  }
  function normMode(v) {
    var s = String(v || '').trim().toLowerCase();
    var hit = U.PAYMENT_MODES.find(function (m) { return m.toLowerCase() === s; });
    if (hit) return hit;
    if (/credit|bill/.test(s)) return 'Credit';
    if (/bank|neft|rtgs|imps/.test(s)) return 'Bank Transfer';
    if (/g ?pay|google/.test(s)) return 'GPay';
    if (/phone/.test(s)) return 'PhonePe';
    return 'Cash';
  }

  // rows indexed by absolute column (A = 0) even when the sheet's used range starts later
  function absRows(ws) {
    var start = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.c : 0, lead = [];
    for (var i = 0; i < start; i++) lead.push('');
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).map(function (r) { return lead.concat(r); });
  }
  function importWorkbook(wb) {
    var added = [], year = new Date().getFullYear();
    if (wb.Sheets.COVER) { var yc = wb.Sheets.COVER.D13; if (yc && +yc.v > 2000) year = +yc.v; }
    // Rates from MASTER DATA (I:J)
    if (wb.Sheets['MASTER DATA']) {
      var md = absRows(wb.Sheets['MASTER DATA']);
      md.forEach(function (row) {
        var name = String(row[8] || '').trim().toUpperCase(), rate = num(row[9]);
        if (!name || name === 'MATERIAL' || name.length > 20) return;
        var m = db.materials.find(function (x) { return x.name === name; });
        if (!m) db.materials.push(m = { name: name, rate: 0, opening: 0 });
        if (rate) m.rate = rate;
      });
    }
    var daily = wb.SheetNames.filter(function (n) { return /^\d{1,2}-[A-Za-z]{3}$/.test(n.trim()); });
    if (daily.length) {
      daily.forEach(function (n) {
        var date = excelDate(n.trim(), year);
        var rows = absRows(wb.Sheets[n]);
        var shift = 'DAY', credit = true;
        rows.forEach(function (row) {
          var b = String(row[1] || '').toUpperCase();
          if (/SHIFT/.test(b)) { shift = /NIGHT/.test(b) ? 'NIGHT' : 'DAY'; credit = /BILL|CREDIT/.test(b); return; }
          var veh = String(row[3] || '').trim().toUpperCase().replace(/\s+/g, '');
          if (!veh || /VEHICLE/.test(veh) || !(num(row[7]) > 0)) return;
          var weight = round2(num(row[7])), mat = String(row[6] || '').trim().toUpperCase();
          var mode = credit ? 'Credit' : normMode(row[9]), rate = rateOf(mat);
          var amount = num(row[10]) || (credit ? round2(weight * rate) : 0);
          added.push({ date: date, time: shift === 'DAY' ? '12:00' : '22:00', shift: shift, token: String(row[2] || '').replace(/\.0$/, ''), vehicle: veh, place: String(row[4] || 'LOCAL').trim().toUpperCase() || 'LOCAL', party: String(row[5] || '').trim().toUpperCase() || 'CASH SALE', material: mat, weight: weight, royalty: round2(num(row[8]) || weight), mode: mode, rate: rate, dala: credit ? num(row[9]) : 0, amount: amount, driver: '', remarks: 'Imported from ' + n });
        });
      });
    } else {
      wb.SheetNames.forEach(function (n) {
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { raw: true, defval: '' });
        rows.forEach(function (r) {
          var k = {}; Object.keys(r).forEach(function (key) { k[key.toLowerCase().replace(/[^a-z]/g, '')] = r[key]; });
          var g = function () { for (var i = 0; i < arguments.length; i++) if (k[arguments[i]] !== undefined && k[arguments[i]] !== '') return k[arguments[i]]; return ''; };
          var veh = String(g('vehicleno', 'vehiclenumber', 'vehicle')).toUpperCase().replace(/\s+/g, '');
          var weight = round2(num(g('weightton', 'qtymt', 'qtyton', 'quantity', 'quantityton', 'weight', 'qty')));
          if (!veh || !(weight > 0)) return;
          var time = excelTime(g('time')) || '12:00', mat = String(g('material')).trim().toUpperCase();
          var mode = normMode(g('paymentmode', 'paymenttype', 'mode')), rate = num(g('rate', 'rateperton', 'ratepermt')) || rateOf(mat);
          var sh = String(g('shift')).toUpperCase();
          added.push({ date: excelDate(g('date')) || today(), time: time, shift: /NIGHT/.test(sh) ? 'NIGHT' : /DAY/.test(sh) ? 'DAY' : shiftOf(time), token: String(g('tokenno', 'token')), vehicle: veh, place: String(g('place', 'destination') || 'LOCAL').toUpperCase(), party: String(g('party', 'partycustomer', 'customer', 'partyname') || 'CASH SALE').trim().toUpperCase(), material: mat, weight: weight, royalty: round2(num(g('royaltyton', 'royalty')) || weight), mode: mode, rate: rate, dala: num(g('dala')), amount: round2(num(g('amount')) || weight * rate), driver: String(g('driver', 'drivername')), remarks: String(g('remarks', 'remark')) });
        });
      });
    }
    // de-duplicate against existing entries (same date + vehicle + token + weight)
    var keyOf = function (e) { return [e.date, e.vehicle, e.token, e.weight].join('|'); };
    var seen = {}; db.entries.forEach(function (e) { seen[keyOf(e)] = 1; });
    var fresh = added.filter(function (e) { var k = keyOf(e); if (seen[k]) return false; seen[k] = 1; return true; });
    fresh.forEach(function (e) {
      e.id = uid(); e.createdAt = new Date().toISOString(); db.entries.push(e);
      if (e.material && !db.materials.some(function (m) { return m.name === e.material; })) db.materials.push({ name: e.material, rate: 0, opening: 0 });
      if (!db.parties.some(function (p) { return p.name === e.party; })) db.parties.push({ id: uid(), name: e.party, phone: '', address: '', opening: 0 });
      var t = parseInt(e.token, 10); if (isFinite(t) && t >= db.nextToken) db.nextToken = t + 1;
    });
    save();
    var noRate = fresh.filter(function (e) { return isCredit(e) && !e.amount; }).length;
    toast('Imported ' + fresh.length + ' entries' + (added.length - fresh.length ? ' (' + (added.length - fresh.length) + ' duplicates skipped)' : '') + (noRate ? ' — ' + noRate + ' bill sales have no rate yet; set rates in Price List' : ''), 6000);
    if (fresh.length) { var last = fresh[fresh.length - 1].date; state.salesDate = last; }
    render();
  }

  var fileInput = document.getElementById('file-input'), fileMode = 'import';
  fileInput.addEventListener('change', function () {
    var f = fileInput.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        if (fileMode === 'restore') {
          var d = JSON.parse(reader.result);
          if (!d || !Array.isArray(d.entries)) throw new Error('Not a backup file');
          if (!confirm('Replace all data in this browser with the backup (' + d.entries.length + ' entries)?')) return;
          localStorage.setItem(STORE_KEY, JSON.stringify(d)); db = load(); toast('Backup restored'); render();
        } else {
          if (!needXLSX()) return;
          importWorkbook(XLSX.read(new Uint8Array(reader.result), { type: 'array', cellDates: true }));
        }
      } catch (err) { toast('Could not read the file: ' + err.message, 6000); }
      fileInput.value = '';
    };
    if (fileMode === 'restore') reader.readAsText(f); else reader.readAsArrayBuffer(f);
  });

  // ---------- demo data ----------
  function loadDemo() {
    var parties = ['SHARMA CONSTRUCTION', 'MITTAL TRADERS', 'RANA BUILDCON', 'VERMA INFRA', 'SAINI TRADERS', 'ASHU', 'GANESH'];
    var rates = { '40MM': 380, '20MM': 420, '10MM': 450, 'DUST': 300, 'SAND': 520, 'GSB': 260, 'STONE DUST': 280, 'PANGI': 350, '10+20': 430 };
    db.materials.forEach(function (m) { if (!m.rate) m.rate = rates[m.name] || 400; if (!m.opening) m.opening = 800; });
    parties.forEach(function (n) { if (!db.parties.some(function (p) { return p.name === n; })) db.parties.push({ id: uid(), name: n, phone: '98' + Math.floor(10000000 + Math.random() * 89999999), address: 'Dehradun', opening: 0 }); });
    var drivers = ['Rakesh Singh', 'Mohan Lal', 'Suresh Kumar', 'Imran Khan', 'Gurpreet Singh'];
    drivers.forEach(function (n, i) { if (!db.drivers.some(function (d) { return d.name === n; })) db.drivers.push({ id: uid(), name: n, phone: '97' + (10000000 + i * 1234567), vehicle: 'UK07CA' + (1200 + i * 111), transporter: i % 2 ? 'Doon Transport' : 'Self' }); });
    var mats = ['40MM', '20MM', '10MM', 'DUST', 'SAND', 'GSB'], prefixes = ['UK07CA', 'UK17TA', 'UP15BT', 'UK08TA', 'HR38AD', 'UK16CA'];
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var day = 9; day >= 0; day--) {
      var d = addDays(today(), -day), n = 14 + Math.floor(rnd() * 10);
      for (var i = 0; i < n; i++) {
        var hr = 6 + Math.floor(rnd() * 18) % 24, time = pad(hr % 24) + ':' + pad(Math.floor(rnd() * 60));
        var mat = mats[Math.floor(rnd() * mats.length)], w = round2(20 + rnd() * 15), credit = rnd() < 0.55;
        var party = credit ? parties[Math.floor(rnd() * 5)] : (rnd() < 0.5 ? 'CASH SALE' : parties[5 + Math.floor(rnd() * 2)]);
        var rate = rateOf(mat);
        db.entries.push({ id: uid(), date: d, time: time, shift: shiftOf(time), token: String(db.nextToken++), vehicle: prefixes[Math.floor(rnd() * 6)] + (1000 + Math.floor(rnd() * 8999)), place: rnd() < 0.8 ? 'LOCAL' : 'OUTSTATION', party: party, material: mat, weight: w, royalty: w, mode: credit ? 'Credit' : ['Cash', 'GPay', 'UPI', 'PhonePe'][Math.floor(rnd() * 4)], rate: rate, dala: credit ? [0, 50, 100][Math.floor(rnd() * 3)] : 0, amount: round2(w * rate), driver: drivers[Math.floor(rnd() * drivers.length)], remarks: '', createdAt: new Date().toISOString() });
      }
      mats.forEach(function (m) { db.production.push({ id: uid(), date: d, material: m, qty: round2(60 + rnd() * 80), note: 'Plant output' }); });
      if (day % 3 === 0) parties.slice(0, 5).forEach(function (p) { if (rnd() < 0.6) db.payments.push({ id: uid(), date: d, party: p, amount: Math.round(20000 + rnd() * 60000), mode: rnd() < 0.5 ? 'Bank Transfer' : 'Cash', remark: rnd() < 0.3 ? 'Advance' : 'Payment' }); });
      db.expenses.push({ id: uid(), date: d, category: 'Diesel', amount: Math.round(8000 + rnd() * 6000), mode: 'Cash', note: 'Loader + crusher' });
      if (day % 4 === 1) db.expenses.push({ id: uid(), date: d, category: 'Wages / Labour', amount: 18000, mode: 'Cash', note: 'Weekly wages' });
    }
    save(); toast('Demo data loaded'); render();
  }

  // ---------- events ----------
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-action]'); if (!t) return;
    var a = t.getAttribute('data-action'), id = t.getAttribute('data-id');
    var appEl = document.getElementById('app');
    switch (a) {
      case 'open-nav': appEl.classList.add('nav-open'); break;
      case 'close-nav': appEl.classList.remove('nav-open'); break;
      case 'theme': setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); render(); break;
      case 'reset-entry': var wasEdit = !!state.editId; state.draft = null; state.editId = null; if (wasEdit) location.hash = '#entry'; else render(); break;
      case 'del-entry': if (confirm('Delete this entry?')) { db.entries = db.entries.filter(function (x) { return x.id !== id; }); save(); render(); } break;
      case 'del-production': db.production = db.production.filter(function (x) { return x.id !== id; }); save(); render(); break;
      case 'del-payment': if (confirm('Delete this payment?')) { db.payments = db.payments.filter(function (x) { return x.id !== id; }); save(); render(); } break;
      case 'del-expense': if (confirm('Delete this expense?')) { db.expenses = db.expenses.filter(function (x) { return x.id !== id; }); save(); render(); } break;
      case 'del-driver': if (confirm('Delete this driver?')) { db.drivers = db.drivers.filter(function (x) { return x.id !== id; }); save(); render(); } break;
      case 'del-material':
        var m = db.materials[+t.getAttribute('data-i')];
        if (db.entries.some(function (e) { return e.material === m.name; })) { toast(m.name + ' has sales entries and cannot be removed'); break; }
        if (confirm('Remove ' + m.name + '?')) { db.materials.splice(+t.getAttribute('data-i'), 1); save(); render(); } break;
      case 'add-material': materialDialog(); break;
      case 'add-production': productionDialog(); break;
      case 'add-expense': expenseDialog(); break;
      case 'receive': receiveDialog(t.getAttribute('data-party')); break;
      case 'edit-party': partyDialog(id); break;
      case 'edit-driver': driverDialog(id); break;
      case 'day-prev': state.salesDate = addDays(state.salesDate, -1); render(); break;
      case 'day-next': state.salesDate = addDays(state.salesDate, 1); render(); break;
      case 'range':
        var r = t.getAttribute('data-range'), td = today();
        if (r === 'today') { state.reportFrom = state.reportTo = td; }
        if (r === 'week') { state.reportFrom = addDays(td, -6); state.reportTo = td; }
        if (r === 'month') { state.reportFrom = td.slice(0, 8) + '01'; state.reportTo = td; }
        if (r === 'lastmonth') { var d0 = parseDate(td.slice(0, 8) + '01'); d0.setDate(0); state.reportTo = isoDate(d0); state.reportFrom = isoDate(d0).slice(0, 8) + '01'; }
        render(); break;
      case 'print': window.print(); break;
      case 'export-day': exportDay(); break;
      case 'export-report': exportReport(); break;
      case 'export-party': exportParty(t.getAttribute('data-party')); break;
      case 'export-all': exportAll(); break;
      case 'template': downloadTemplate(); break;
      case 'import': fileMode = 'import'; fileInput.accept = '.xlsx,.xls,.csv'; fileInput.click(); break;
      case 'restore': fileMode = 'restore'; fileInput.accept = '.json'; fileInput.click(); break;
      case 'backup':
        var blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = 'StoneCrusher_Backup_' + today() + '.json'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        toast('Backup downloaded'); break;
      case 'demo': if (db.entries.length && !confirm('Add demo entries on top of your existing data?')) break; loadDemo(); break;
      case 'wipe': if (confirm('Delete ALL entries, customers, payments and expenses from this browser? Download a backup first if unsure.') && confirm('This cannot be undone. Delete everything?')) { db = defaults(); save(); toast('All data deleted'); render(); } break;
    }
  });
  document.addEventListener('change', function (ev) {
    var b = ev.target.getAttribute && ev.target.getAttribute('data-bind');
    if (b) { state[b] = ev.target.value; if (b === 'reportFrom' && state.reportTo < state.reportFrom) state.reportTo = state.reportFrom; if (b === 'reportTo' && state.reportFrom > state.reportTo) state.reportFrom = state.reportTo; render(); return; }
    if (ev.target.form && ev.target.form.id === 'entry-form') {
      if (ev.target.name === 'material') { ev.target.form.elements.rate.value = rateOf(ev.target.value) || ''; }
      if (ev.target.name === 'date') { updateEntryHints(); render(); return; }
      updateEntryHints();
    }
  });
  document.addEventListener('input', function (ev) {
    if (ev.target.form && ev.target.form.id === 'entry-form') {
      if (ev.target.name === 'vehicle') { var known = db.drivers.find(function (d) { return d.vehicle === ev.target.value.toUpperCase().replace(/\s+/g, ''); }); if (known && !ev.target.form.elements.driver.value) ev.target.form.elements.driver.value = known.name; }
      var fld = ev.target.closest('.usc-field'); if (fld) fld.classList.remove('is-error');
      updateEntryHints();
    }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (f.id === 'entry-form') { ev.preventDefault(); saveEntry(f); }
    if (f.id === 'price-form') {
      ev.preventDefault();
      db.materials.forEach(function (m, i) { m.rate = num(f.elements['rate-' + i].value); m.opening = num(f.elements['open-' + i].value); });
      // bill sales saved (or imported) before a rate existed get priced now, like the Excel register's formula
      var priced = 0;
      db.entries.forEach(function (e) { var r = rateOf(e.material); if (isCredit(e) && !e.amount && r) { e.rate = r; e.amount = round2(e.weight * r); priced++; } });
      save(); toast('Prices saved' + (priced ? ' — ' + priced + ' unpriced bill sales updated' : '')); render();
    }
    if (f.id === 'settings-form') {
      ev.preventDefault();
      ['company', 'tagline', 'address', 'gstin', 'phone', 'user'].forEach(function (k) { db.settings[k] = f.elements[k].value.trim(); });
      db.nextToken = Math.max(1, parseInt(f.elements.nextToken.value, 10) || db.nextToken);
      save(); toast('Settings saved'); render();
    }
  });

  function afterRender(r) {
    if (r.page === 'entry') updateEntryHints();
    window.scrollTo(0, 0);
  }

  // ---------- theme, print, toast ----------
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ } }
  var printTheme = null;
  window.addEventListener('beforeprint', function () { printTheme = document.documentElement.getAttribute('data-theme'); document.documentElement.setAttribute('data-theme', 'light'); });
  window.addEventListener('afterprint', function () { if (printTheme) document.documentElement.setAttribute('data-theme', printTheme); });
  var toastTimer;
  function toast(msg, ms) {
    var el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 3000);
  }

  try { var saved = localStorage.getItem(THEME_KEY); if (saved) document.documentElement.setAttribute('data-theme', saved); } catch (e) { /* ignore */ }
  window.addEventListener('hashchange', render);
  render();
  // keep the shift badge honest across 7 AM / 7 PM
  setInterval(function () { var b = document.querySelector('.topbar .usc-badge'); if (b && !document.querySelector('dialog[open]') && route().page === 'dashboard') render(); }, 5 * 60 * 1000);
})();
