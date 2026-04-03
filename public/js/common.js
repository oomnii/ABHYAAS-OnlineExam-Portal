import { api } from './api.js';

export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

export function qsa(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function formatDuration(totalSeconds = 0) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds]
    .map((value, index) => (index === 0 ? value : String(value).padStart(2, '0')))
    .filter((value, index) => value !== 0 || index > 0)
    .join(':') || '0:00';
}

export function formatDate(value) {
  if (!value) return '-';
  const isoStr = typeof value === 'string' && !value.includes('T') ? value.replace(' ', 'T') + 'Z' : value;
  return new Date(isoStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
}

export function showMessage(target, message, type = 'default') {
  if (!target) return;
  target.className = `notice${type !== 'default' ? ` ${type}` : ''}`;
  target.textContent = message;
  target.classList.remove('hide');
}

export function hideMessage(target) {
  if (!target) return;
  target.classList.add('hide');
}

export async function getCurrentUser() {
  const { user } = await api('/api/auth/me', { method: 'GET' });
  return user;
}

export async function requireRole(role) {
  const user = await getCurrentUser();
  if (!user || user.role !== role) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

export function mountUserBar(user) {
  const slot = qs('[data-user-bar]');
  if (!slot || !user) return;
  slot.innerHTML = `
    <div class="nav-links">
      <span class="role-pill">${user.role === 'teacher' ? 'Teacher' : 'Student'} • ${escapeHtml(user.name)}</span>
      <button class="btn btn-ghost" id="logout-btn">Logout</button>
    </div>
  `;
  qs('#logout-btn')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function quizStatusClass(status) {
  return status === 'published' ? 'status-published' : status === 'closed' ? 'status-closed' : 'status-draft';
}
