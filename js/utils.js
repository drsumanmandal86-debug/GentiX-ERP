/* ===================== GLOBAL UTILITIES ===================== */

window.fmt = amount => {
  if (isNaN(amount) || amount === null) return '৳0';
  return '৳' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

window.fmtDate = (date) => {
  if (!date) return '—';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

window.todayStr = () => new Date().toISOString().split('T')[0];

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

/* -------- Date Range -------- */
window.getDateRange = (period) => {
  const now = new Date();
  const startOf = d => { d.setHours(0,0,0,0); return d; };
  switch (period) {
    case 'today':
      return { from: startOf(new Date(now)), to: new Date() };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const ye = new Date(y); ye.setHours(23,59,59,999);
      return { from: startOf(y), to: ye };
    }
    case 'last7': {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      return { from: startOf(s), to: new Date() };
    }
    case 'thisMonth': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOf(s), to: new Date() };
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      e.setHours(23,59,59,999);
      return { from: s, to: e };
    }
    default: return null; // lifetime — no filter
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
