/* ============================================================
   RentMS — script.js
   Complete frontend logic for Admin + Tenant dashboards
   ============================================================ */

// ==================== CONFIGURATION ====================
const CONFIG = {
  // CHANGE THIS to your backend URL when deploying
  // For local development: http://localhost:5000/api
  // For production: https://your-backend.onrender.com/api
  API_BASE: (function () {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    // When deployed to Netlify, change this to your Render backend URL
    return 'https://your-rentms-backend.onrender.com/api';
  })()
};

// ==================== API HELPER ====================
const API = {
  getHeaders() {
    const token = localStorage.getItem('rms_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  async request(method, path, body) {
    try {
      const opts = { method, headers: this.getHeaders() };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${CONFIG.API_BASE}${path}`, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check backend URL.');
      }
      throw err;
    }
  },

  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body),
  put: (path, body) => API.request('PUT', path, body),
  patch: (path, body) => API.request('PATCH', path, body),
  delete: (path) => API.request('DELETE', path)
};

// ==================== AUTH HELPERS ====================
function getUser() {
  return JSON.parse(localStorage.getItem('rms_user') || 'null');
}

function getToken() {
  return localStorage.getItem('rms_token');
}

function requireAuth(role) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = 'index.html';
    return false;
  }
  if (role && user.role !== role) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function handleLogout() {
  localStorage.removeItem('rms_token');
  localStorage.removeItem('rms_user');
  showToast('Logged out successfully', 'info');
  setTimeout(() => { window.location.href = 'index.html'; }, 500);
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==================== MODAL HELPERS ====================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}

// Close modal on overlay click
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

// ==================== SIDEBAR / NAV ====================
function showSection(name) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  // Show target
  const target = document.getElementById(`section-${name}`);
  if (target) target.classList.add('active');

  // Update sidebar links
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => {
    if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(`'${name}'`)) {
      l.classList.add('active');
    }
  });

  // Load data for section
  if (name === 'tenants') loadTenants();
  if (name === 'rents') loadAllRents();
  if (name === 'generate') loadTenantsForSelect();
  if (name === 'complaints') {
    const user = getUser();
    if (user && user.role === 'admin') loadComplaints();
    else loadMyComplaints();
  }
  if (name === 'rent') loadRentHistory();

  // Close sidebar on mobile
  if (window.innerWidth <= 900) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// ==================== FORMATTING HELPERS ====================
function fmt(amount) {
  if (amount === undefined || amount === null) return '₹—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function fmtMonth(month) {
  if (!month) return '—';
  const [y, m] = month.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  const map = {
    'Paid': 'badge-paid',
    'Unpaid': 'badge-unpaid',
    'Pending': 'badge-pending',
    'In Progress': 'badge-progress',
    'Resolved': 'badge-resolved'
  };
  return `<span class="badge ${map[status] || 'badge-tenant'}">${status}</span>`;
}

function priorityBadge(p) {
  const map = { 'High': 'badge-unpaid', 'Medium': 'badge-progress', 'Low': 'badge-resolved' };
  return `<span class="badge ${map[p] || ''}">${p}</span>`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ==================== LOADING SCREEN ====================
function hideLoading() {
  const el = document.getElementById('loadingScreen');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 400);
  }
}

// ================================================================
//                     ADMIN DASHBOARD
// ================================================================

async function initAdminDashboard() {
  if (!requireAuth('admin')) return;

  const user = getUser();
  document.getElementById('adminName').textContent = user.name;
  document.getElementById('adminAvatar').textContent = initials(user.name);

  // Set current month filter default
  const monthInput = document.getElementById('rentMonthFilter');
  if (monthInput) monthInput.value = new Date().toISOString().slice(0, 7);

  try {
    await Promise.all([loadDashboardStats(), loadDashboardRents()]);
  } catch (err) {
    showToast('Error loading dashboard: ' + err.message, 'error');
  }

  hideLoading();
}

// ---------- STATS ----------
async function loadDashboardStats() {
  try {
    const { stats } = await API.get('/admin/stats');

    document.getElementById('stat-totalTenants').textContent = stats.totalTenants;
    document.getElementById('stat-activeTenants').textContent = `${stats.activeTenants} active`;
    document.getElementById('stat-monthCollection').textContent = fmt(stats.currentMonthCollection);
    document.getElementById('stat-paidCount').textContent = `${stats.currentMonthPaidCount} paid`;
    document.getElementById('stat-monthPending').textContent = fmt(stats.currentMonthPending);
    document.getElementById('stat-unpaidCount').textContent = `${stats.currentMonthUnpaidCount} unpaid`;
    document.getElementById('stat-totalCollection').textContent = fmt(stats.totalCollection);
    document.getElementById('stat-complaints').textContent = stats.pendingComplaints;

    const label = document.getElementById('currentMonthLabel');
    if (label) label.textContent = fmtMonth(stats.currentMonth);

    // Update complaint badge
    const badge = document.getElementById('complaintBadge');
    if (badge) {
      if (stats.pendingComplaints > 0) {
        badge.textContent = stats.pendingComplaints;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ---------- DASHBOARD RENT TABLE ----------
async function loadDashboardRents() {
  const tbody = document.getElementById('dashboardRentBody');
  if (!tbody) return;

  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { rents } = await API.get(`/admin/rents?month=${currentMonth}`);

    if (!rents.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No rent records for this month</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = rents.map(r => `
      <tr>
        <td class="td-name">${r.tenant ? r.tenant.name : '—'}</td>
        <td><span class="tag">${r.tenant && r.tenant.unit ? r.tenant.unit : '—'}</span></td>
        <td>${fmt(r.baseRent)}</td>
        <td>${fmt(r.electricityAmount)} <small style="color:var(--text-muted)">(${r.unitsConsumed}u)</small></td>
        <td class="td-amount td-gold">${fmt(r.totalAmount)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>
          <button class="btn btn-sm ${r.status === 'Unpaid' ? 'btn-success' : 'btn-danger'}"
            onclick="quickToggleStatus('${r._id}', '${r.status === 'Unpaid' ? 'Paid' : 'Unpaid'}', loadDashboardRents)">
            ${r.status === 'Unpaid' ? '✓ Mark Paid' : '✕ Mark Unpaid'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading data</td></tr>`;
  }
}

// ---------- TENANTS ----------
let allTenants = [];

async function loadTenants() {
  const tbody = document.getElementById('tenantsBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:30px"><div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div></td></tr>`;

  try {
    const { tenants } = await API.get('/admin/tenants');
    allTenants = tenants;
    renderTenants(tenants);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--red)">Error: ${err.message}</td></tr>`;
  }
}

function renderTenants(tenants) {
  const tbody = document.getElementById('tenantsBody');
  if (!tenants.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👤</div><div class="empty-text">No tenants yet</div><div class="empty-sub">Click "Add Tenant" to get started</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = tenants.map(t => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="navbar-avatar" style="background:linear-gradient(135deg,#3498db,#2980b9);font-size:0.75rem">${initials(t.name)}</div>
          <div class="td-name">${t.name}</div>
        </div>
      </td>
      <td style="color:var(--text-secondary)">${t.email}</td>
      <td>${t.phone}</td>
      <td><span class="tag">${t.unit || '—'}</span></td>
      <td class="td-amount">${fmt(t.baseRent)}</td>
      <td>${t.isActive ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-unpaid">Inactive</span>'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEditTenant('${t._id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteTenant('${t._id}', '${t.name}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterTenants() {
  const q = document.getElementById('tenantSearch').value.toLowerCase();
  const filtered = allTenants.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.email.toLowerCase().includes(q) ||
    t.phone.includes(q) ||
    (t.unit && t.unit.toLowerCase().includes(q))
  );
  renderTenants(filtered);
}

function openAddTenantModal() {
  document.getElementById('t-name').value = '';
  document.getElementById('t-email').value = '';
  document.getElementById('t-phone').value = '';
  document.getElementById('t-password').value = '';
  document.getElementById('t-unit').value = '';
  document.getElementById('t-baseRent').value = '';
  openModal('addTenantModal');
}

async function handleAddTenant(e) {
  e.preventDefault();
  const btn = document.getElementById('addTenantBtn');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    await API.post('/admin/tenants', {
      name: document.getElementById('t-name').value.trim(),
      email: document.getElementById('t-email').value.trim(),
      phone: document.getElementById('t-phone').value.trim(),
      password: document.getElementById('t-password').value,
      unit: document.getElementById('t-unit').value.trim(),
      baseRent: parseFloat(document.getElementById('t-baseRent').value) || 0
    });

    showToast('Tenant added successfully!', 'success');
    closeModal('addTenantModal');
    loadTenants();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Tenant';
  }
}

function openEditTenant(id) {
  const t = allTenants.find(x => x._id === id);
  if (!t) return;

  document.getElementById('edit-tenantId').value = t._id;
  document.getElementById('edit-name').value = t.name;
  document.getElementById('edit-phone').value = t.phone;
  document.getElementById('edit-unit').value = t.unit || '';
  document.getElementById('edit-baseRent').value = t.baseRent || 0;
  document.getElementById('edit-isActive').value = t.isActive ? 'true' : 'false';
  openModal('editTenantModal');
}

async function handleEditTenant(e) {
  e.preventDefault();
  const id = document.getElementById('edit-tenantId').value;

  try {
    await API.put(`/admin/tenants/${id}`, {
      name: document.getElementById('edit-name').value.trim(),
      phone: document.getElementById('edit-phone').value.trim(),
      unit: document.getElementById('edit-unit').value.trim(),
      baseRent: parseFloat(document.getElementById('edit-baseRent').value) || 0,
      isActive: document.getElementById('edit-isActive').value === 'true'
    });

    showToast('Tenant updated!', 'success');
    closeModal('editTenantModal');
    loadTenants();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

let _deleteCb = null;

function confirmDeleteTenant(id, name) {
  document.getElementById('deleteModalMsg').innerHTML = `Are you sure you want to delete <strong>${name}</strong>? This will also delete all their rent and complaint records.`;
  _deleteCb = async () => {
    try {
      await API.delete(`/admin/tenants/${id}`);
      showToast('Tenant deleted', 'success');
      closeModal('deleteModal');
      loadTenants();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  document.getElementById('confirmDeleteBtn').onclick = _deleteCb;
  openModal('deleteModal');
}

// ---------- RENT MANAGEMENT ----------
let allRents = [];

async function loadAllRents() {
  const tbody = document.getElementById('rentsBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:30px"><div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div></td></tr>`;

  try {
    const month = document.getElementById('rentMonthFilter').value;
    const status = document.getElementById('rentStatusFilter').value;

    let query = '';
    if (month) query += `&month=${month}`;
    if (status) query += `&status=${status}`;

    const { rents, totalCollection, totalPending } = await API.get(`/admin/rents?${query.slice(1)}`);
    allRents = rents;

    document.getElementById('filterCollection').textContent = fmt(totalCollection);
    document.getElementById('filterPending').textContent = fmt(totalPending);

    if (!rents.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">No rent records found</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = rents.map(r => `
      <tr>
        <td class="td-name">${r.tenant ? r.tenant.name : '—'} ${r.tenant && r.tenant.unit ? `<span class="tag">${r.tenant.unit}</span>` : ''}</td>
        <td>${fmtMonth(r.month)}</td>
        <td>${fmt(r.baseRent)}</td>
        <td style="color:var(--text-secondary)">${r.previousUnit} → ${r.currentUnit} <small>(${r.unitsConsumed}u)</small></td>
        <td>${fmt(r.electricityAmount)}</td>
        <td class="td-amount td-gold">${fmt(r.totalAmount)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-sm btn-secondary" onclick="openEditRent('${r._id}')">✏️</button>
            <button class="btn btn-sm ${r.status === 'Unpaid' ? 'btn-success' : 'btn-danger'}"
              onclick="quickToggleStatus('${r._id}', '${r.status === 'Unpaid' ? 'Paid' : 'Unpaid'}', loadAllRents)">
              ${r.status === 'Unpaid' ? '✓ Paid' : '✕ Unpaid'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="confirmDeleteRent('${r._id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red);text-align:center">Error: ${err.message}</td></tr>`;
  }
}

function openEditRent(id) {
  const r = allRents.find(x => x._id === id);
  if (!r) return;

  document.getElementById('edit-rentId').value = r._id;
  document.getElementById('edit-rentStatus').value = r.status;
  document.getElementById('edit-prevUnit').value = r.previousUnit;
  document.getElementById('edit-currUnit').value = r.currentUnit;
  document.getElementById('edit-rentNotes').value = r.notes || '';
  calcEditElec();
  openModal('editRentModal');
}

function calcEditElec() {
  const prev = parseFloat(document.getElementById('edit-prevUnit').value) || 0;
  const curr = parseFloat(document.getElementById('edit-currUnit').value) || 0;
  const units = Math.max(0, curr - prev);
  const amount = units * 10;
  const el = document.getElementById('edit-elecPreview');
  if (el) el.textContent = `${fmt(amount)} (${units} units)`;
}

async function handleEditRent(e) {
  e.preventDefault();
  const id = document.getElementById('edit-rentId').value;

  try {
    await API.put(`/admin/rents/${id}`, {
      previousUnit: parseFloat(document.getElementById('edit-prevUnit').value) || 0,
      currentUnit: parseFloat(document.getElementById('edit-currUnit').value) || 0,
      status: document.getElementById('edit-rentStatus').value,
      notes: document.getElementById('edit-rentNotes').value
    });

    showToast('Rent updated!', 'success');
    closeModal('editRentModal');
    loadAllRents();
    loadDashboardStats();
    loadDashboardRents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmDeleteRent(id) {
  document.getElementById('deleteModalMsg').textContent = 'Are you sure you want to delete this rent record? This action cannot be undone.';
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      await API.delete(`/admin/rents/${id}`);
      showToast('Rent record deleted', 'success');
      closeModal('deleteModal');
      loadAllRents();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  openModal('deleteModal');
}

async function quickToggleStatus(rentId, newStatus, refreshFn) {
  try {
    await API.patch(`/admin/rents/${rentId}/status`, { status: newStatus });
    showToast(`Marked as ${newStatus}`, newStatus === 'Paid' ? 'success' : 'info');
    if (refreshFn) refreshFn();
    loadDashboardStats();
    loadDashboardRents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- GENERATE RENT ----------
let tenantsForSelect = [];

async function loadTenantsForSelect() {
  const select = document.getElementById('gen-tenant');
  if (!select) return;

  try {
    const { tenants } = await API.get('/admin/tenants');
    tenantsForSelect = tenants;
    select.innerHTML = '<option value="">— Choose Tenant —</option>' +
      tenants.map(t => `<option value="${t._id}" data-base="${t.baseRent}">${t.name} ${t.unit ? `(${t.unit})` : ''}</option>`).join('');
  } catch (err) {
    showToast('Error loading tenants: ' + err.message, 'error');
  }

  // Set current month default
  const monthInput = document.getElementById('gen-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toISOString().slice(0, 7);
  }
}

function prefillBaseRent() {
  const select = document.getElementById('gen-tenant');
  const selected = select.options[select.selectedIndex];
  const baseRentInput = document.getElementById('gen-baseRent');
  if (selected && selected.dataset.base) {
    baseRentInput.value = selected.dataset.base;
  }
  calcElecPreview();
}

function calcElecPreview() {
  const base = parseFloat(document.getElementById('gen-baseRent').value) || 0;
  const prev = parseFloat(document.getElementById('gen-prevUnit').value) || 0;
  const curr = parseFloat(document.getElementById('gen-currUnit').value) || 0;
  const units = Math.max(0, curr - prev);
  const elec = units * 10;
  const total = base + elec;

  document.getElementById('prev-base').textContent = fmt(base);
  document.getElementById('prev-units').textContent = `${units} units`;
  document.getElementById('prev-elec').textContent = fmt(elec);
  document.getElementById('prev-total').textContent = fmt(total);
}

async function handleGenerateRent(e) {
  e.preventDefault();
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    await API.post('/admin/rents/generate', {
      tenantId: document.getElementById('gen-tenant').value,
      month: document.getElementById('gen-month').value,
      baseRent: parseFloat(document.getElementById('gen-baseRent').value) || 0,
      previousUnit: parseFloat(document.getElementById('gen-prevUnit').value) || 0,
      currentUnit: parseFloat(document.getElementById('gen-currUnit').value) || 0
    });

    showToast('Rent bill generated successfully!', 'success');
    document.getElementById('generateRentForm').reset();
    document.getElementById('gen-month').value = new Date().toISOString().slice(0, 7);
    calcElecPreview();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Bill';
  }
}

// ---------- COMPLAINTS (ADMIN) ----------
let allAdminComplaints = [];

async function loadComplaints() {
  const grid = document.getElementById('complaintsGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`;

  try {
    const status = document.getElementById('complaintStatusFilter').value;
    const { complaints } = await API.get(`/admin/complaints${status ? `?status=${status}` : ''}`);
    allAdminComplaints = complaints;

    if (!complaints.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📋</div><div class="empty-text">No complaints found</div></div>`;
      return;
    }

    grid.innerHTML = complaints.map(c => `
      <div class="complaint-card">
        <div class="complaint-card-header">
          <div>
            <div class="complaint-subject">${c.subject}</div>
            <div class="complaint-meta">
              <span class="complaint-category">${c.category}</span>
              <span>·</span>
              ${priorityBadge(c.priority)}
            </div>
          </div>
          ${statusBadge(c.status)}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div class="navbar-avatar" style="width:26px;height:26px;font-size:0.7rem;background:linear-gradient(135deg,#3498db,#2980b9)">${initials(c.tenant ? c.tenant.name : '?')}</div>
          <span style="font-size:0.85rem;color:var(--text-secondary)">${c.tenant ? c.tenant.name : '—'} ${c.tenant && c.tenant.unit ? `· ${c.tenant.unit}` : ''}</span>
        </div>
        <p class="complaint-desc">${c.description}</p>
        <div class="complaint-date" style="margin-top:8px">${fmtDate(c.createdAt)}</div>
        ${c.adminNote ? `<div class="complaint-admin-note">💬 ${c.adminNote}</div>` : ''}
        <div style="margin-top:14px">
          <button class="btn btn-primary btn-sm" onclick="openResolveModal('${c._id}', '${c.status}', this)" data-note="${(c.adminNote || '').replace(/"/g, '&quot;')}">
            ${c.status === 'Resolved' ? '✏️ Edit' : '✅ Update Status'}
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--red)">Error: ${err.message}</div>`;
  }
}

function openResolveModal(id, status, note) {
  document.getElementById('resolve-complaintId').value = id;
  document.getElementById('resolve-status').value = status;
  document.getElementById('resolve-note').value = note;
  openModal('resolveComplaintModal');
}

async function handleResolveComplaint(e) {
  e.preventDefault();
  const id = document.getElementById('resolve-complaintId').value;

  try {
    await API.put(`/admin/complaints/${id}`, {
      status: document.getElementById('resolve-status').value,
      adminNote: document.getElementById('resolve-note').value
    });

    showToast('Complaint updated!', 'success');
    closeModal('resolveComplaintModal');
    loadComplaints();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================================================================
//                    TENANT DASHBOARD
// ================================================================

async function initTenantDashboard() {
  if (!requireAuth('tenant')) return;

  const user = getUser();
  document.getElementById('tenantName').textContent = user.name;
  document.getElementById('tenantAvatar').textContent = initials(user.name);
  document.getElementById('welcomeName').textContent = user.name.split(' ')[0];
  const unitEl = document.getElementById('tenantUnit');
  if (unitEl) unitEl.textContent = user.unit ? `Unit: ${user.unit}` : 'Your rental dashboard';

  try {
    await Promise.all([loadTenantDashboard(), loadDashboardComplaints()]);
  } catch (err) {
    showToast('Error loading dashboard: ' + err.message, 'error');
  }

  hideLoading();
}

async function loadTenantDashboard() {
  try {
    const { dashboard } = await API.get('/tenant/dashboard');
    const d = dashboard;

    // Stats
    const monthEl = document.getElementById('dashMonth');
    if (monthEl) monthEl.textContent = fmtMonth(d.currentMonth);

    document.getElementById('td-totalPaid').textContent = fmt(d.totalPaid);
    document.getElementById('td-paidCount').textContent = `${d.paidCount} payments`;
    document.getElementById('td-unpaidCount').textContent = d.unpaidCount;
    document.getElementById('td-complaints').textContent = d.pendingComplaints;
    document.getElementById('td-resolvedCount').textContent = `${d.resolvedComplaints} resolved`;

    // Bill card
    const billCard = document.getElementById('currentBillCard');
    const noMsg = document.getElementById('noBillMsg');

    if (d.currentRent) {
      if (billCard) billCard.style.display = '';
      if (noMsg) noMsg.style.display = 'none';

      document.getElementById('billMonth').textContent = fmtMonth(d.currentRent.month);
      document.getElementById('billTenantName').textContent = d.tenant.name;
      document.getElementById('billStatus').innerHTML = statusBadge(d.currentRent.status);
      document.getElementById('billBaseRent').textContent = fmt(d.currentRent.baseRent);
      document.getElementById('billElectricity').textContent = fmt(d.currentRent.electricityAmount);
      document.getElementById('billUnits').textContent = `${d.currentRent.unitsConsumed} units`;
      document.getElementById('billTotal').textContent = fmt(d.currentRent.totalAmount);
    } else {
      if (billCard) billCard.style.display = 'none';
      if (noMsg) noMsg.style.display = 'block';
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

async function loadDashboardComplaints() {
  const grid = document.getElementById('dashComplaintsGrid');
  if (!grid) return;

  try {
    const { complaints } = await API.get('/tenant/complaints');
    const recent = complaints.slice(0, 3);

    if (!recent.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📋</div><div class="empty-text">No complaints yet</div><div class="empty-sub"><a href="#" onclick="showSection('new-complaint')">Raise your first complaint</a></div></div>`;
      return;
    }

    grid.innerHTML = recent.map(c => renderComplaintCard(c)).join('');
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--red)">Error loading complaints</div>`;
  }
}

async function loadMyComplaints() {
  const grid = document.getElementById('myComplaintsGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="spinner" style="margin:0 auto"></div></div>`;

  try {
    const { complaints } = await API.get('/tenant/complaints');

    if (!complaints.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📋</div><div class="empty-text">No complaints submitted yet</div><div class="empty-sub">Click "New Complaint" to raise an issue</div></div>`;
      return;
    }

    grid.innerHTML = complaints.map(c => renderComplaintCard(c)).join('');
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--red)">Error: ${err.message}</div>`;
  }
}

function renderComplaintCard(c) {
  return `
    <div class="complaint-card">
      <div class="complaint-card-header">
        <div>
          <div class="complaint-subject">${c.subject}</div>
          <div class="complaint-meta">
            <span class="complaint-category">${c.category}</span>
            <span>·</span>
            ${priorityBadge(c.priority)}
            <span>·</span>
            <span class="complaint-date">${fmtDate(c.createdAt)}</span>
          </div>
        </div>
        ${statusBadge(c.status)}
      </div>
      <p class="complaint-desc">${c.description}</p>
      ${c.adminNote ? `<div class="complaint-admin-note">💬 Admin: ${c.adminNote}</div>` : ''}
      ${c.resolvedAt ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">Resolved: ${fmtDate(c.resolvedAt)}</div>` : ''}
    </div>
  `;
}

async function loadRentHistory() {
  const list = document.getElementById('rentHistoryList');
  if (!list) return;
  list.innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>`;

  try {
    const { rents } = await API.get('/tenant/rents');

    if (!rents.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">No rent records yet</div><div class="empty-sub">Your bills will appear here once generated by admin</div></div>`;
      return;
    }

    list.innerHTML = rents.map(r => `
      <div class="rent-history-item">
        <div>
          <div style="font-weight:600;font-family:var(--font-display)">${fmtMonth(r.month)}</div>
          <div style="font-size:0.82rem;color:var(--text-muted)">Base: ${fmt(r.baseRent)} + Electricity: ${fmt(r.electricityAmount)} (${r.unitsConsumed} units)</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <div style="text-align:right">
            <div class="td-amount td-gold">${fmt(r.totalAmount)}</div>
            ${r.paidDate ? `<div style="font-size:0.75rem;color:var(--text-muted)">Paid: ${fmtDate(r.paidDate)}</div>` : ''}
          </div>
          ${statusBadge(r.status)}
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div style="color:var(--red)">Error: ${err.message}</div>`;
  }
}

async function handleComplaintSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submitComplaintBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    await API.post('/tenant/complaints', {
      category: document.getElementById('c-category').value,
      priority: document.getElementById('c-priority').value,
      subject: document.getElementById('c-subject').value.trim(),
      description: document.getElementById('c-description').value.trim()
    });

    showToast('Complaint submitted successfully!', 'success');
    document.getElementById('complaintForm').reset();
    showSection('complaints');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Complaint';
  }
}
