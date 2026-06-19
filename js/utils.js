/* ===================== GLOBAL UTILITIES ===================== */

// ── Bangladesh Timezone (Asia/Dhaka, UTC+6) helpers ──
const BD_TZ = 'Asia/Dhaka';

// YYYY-MM-DD in Bangladesh local time
window.todayStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: BD_TZ });
  // en-CA locale gives YYYY-MM-DD format natively

// Get current Bangladesh local Date object
window.bdNow = () => {
  const now = new Date();
  // Shift by BD offset so getFullYear/Month/Date return BD values
  const bdOffset = 6 * 60; // UTC+6 in minutes
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + bdOffset * 60000);
};

window.fmt = amount => {
  if (isNaN(amount) || amount === null) return '৳0';
  return '৳' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

window.fmtDate = (date) => {
  if (!date) return '—';
  // Handle Firestore Timestamp, Date object, or YYYY-MM-DD string
  let d;
  if (date && date.toDate) {
    d = date.toDate();
  } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Parse YYYY-MM-DD as Bangladesh date (avoid UTC shift)
    const [y, m, dy] = date.split('-').map(Number);
    d = new Date(y, m - 1, dy); // local date constructor (no timezone shift)
  } else {
    d = new Date(date);
  }
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: BD_TZ
  });
};

window.genId = (prefix = 'ID') => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}-${ts}${rand}`;
};

/* -------- Toast -------- */
window.toast = (msg, type = 'info') => {
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

/* -------- Modal -------- */
window.openModal = (title, body, footer, size = '') => {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = footer;
  const mc = document.getElementById('modalContainer');
  mc.className = 'modal ' + size;
  document.getElementById('modalOverlay').classList.add('open');
};

window.closeModal = () => {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('modalBody').innerHTML = '';
  document.getElementById('modalFooter').innerHTML = '';
};

/* -------- Date Range (Bangladesh UTC+6) -------- */
window.getDateRange = (period) => {
  // Use Bangladesh local date as reference — avoids midnight UTC drift
  const bd = window.bdNow();
  const y = bd.getFullYear(), m = bd.getMonth(), dy = bd.getDate();

  const makeDate = (yr, mo, d) => new Date(yr, mo, d, 0, 0, 0, 0);
  const endOfDay = (yr, mo, d) => new Date(yr, mo, d, 23, 59, 59, 999);

  switch (period) {
    case 'today':
      return { from: makeDate(y,m,dy), to: endOfDay(y,m,dy) };
    case 'yesterday':
      return { from: makeDate(y,m,dy-1), to: endOfDay(y,m,dy-1) };
    case 'last7':
      return { from: makeDate(y,m,dy-7), to: endOfDay(y,m,dy) };
    case 'thisMonth':
      return { from: makeDate(y,m,1), to: endOfDay(y,m,dy) };
    case 'lastMonth':
      return { from: makeDate(y,m-1,1), to: endOfDay(y,m,0) };
    default: return null; // lifetime
  }
};

/* -------- Confirm delete -------- */
window.confirmDelete = (name) => confirm(`Delete "${name}"?\nThis action cannot be undone.`);

/* -------- Number safe parse -------- */
window.n = v => parseFloat(v) || 0;
window.ni = v => parseInt(v) || 0;

/* -------- Close modal on overlay click -------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modalOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
});
