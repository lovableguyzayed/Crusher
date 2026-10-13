(function () {
  function formatINR(n, digits) {
    var v = Number(n) || 0;
    return '₹ ' + v.toLocaleString('en-IN', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
  }
  function formatINRShort(n) {
    var v = Number(n) || 0, a = Math.abs(v);
    if (a >= 1e7) return '₹ ' + (v / 1e7).toFixed(2) + 'Cr';
    if (a >= 1e5) return '₹ ' + (v / 1e5).toFixed(2) + 'L';
    if (a >= 1e3) return '₹ ' + (v / 1e3).toFixed(1) + 'K';
    return formatINR(v);
  }
  // Day 7:00 AM - 7:00 PM, Night 7:00 PM - 7:00 AM (same rule as the Excel input panel)
  function detectShift(d) {
    var h = (d || new Date()).getHours();
    return h >= 7 && h < 19 ? 'DAY' : 'NIGHT';
  }
  window.USC = {
    formatINR: formatINR,
    formatINRShort: formatINRShort,
    detectShift: detectShift,
    MATERIALS: ['SAND', '20MM', 'DUST', '10MM', 'GSB', '40MM', 'PANGI', '10+20', 'STONE DUST'],
    PLACES: ['LOCAL', 'OUTSTATION', 'EXPORT', 'GOVT'],
    PAYMENT_MODES: ['Cash', 'GPay', 'UPI', 'PhonePe', 'Paytm', 'Bank Transfer', 'Credit']
  };
})();
