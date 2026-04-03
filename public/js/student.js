import { api } from './api.js';
import { escapeHtml, formatDate, formatDuration, hideMessage, mountUserBar, qs, qsa, requireRole, showMessage } from './common.js';

(async function init() {
  const user = await requireRole('student');
  if (!user) return;
  mountUserBar(user);
  bindTabs();
  bindNotes();
  await loadDashboard();
})();

function bindTabs() {
  const navItems = qsa('.nav-item');
  const panes = qsa('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const targetId = item.getAttribute('data-tab-target');
      qs(`#${targetId}`).classList.add('active');
    });
  });
}

async function loadDashboard() {
  const data = await api('/api/student/dashboard');
  renderStats(data.stats);
  renderNotes(data.notes || []);
  renderQuizzes(data.availableQuizzes || []);
  renderHistory(data.attempts || []);
  renderSubjectPerformance(data.subjectPerformance || []);
}

function bindNotes() {
  qs('#note-form')?.addEventListener('submit', saveNote);
  qs('#reset-note-form')?.addEventListener('click', () => {
    qs('#note-form').reset();
    qs('#note-form [name="noteId"]').value = '';
    hideMessage(qs('#note-message'));
  });
}

function renderNotes(notes) {
  const target = qs('#student-notes-list');
  if (!notes.length) {
    target.innerHTML = '<div class="empty-state">No notes added yet.</div>';
    return;
  }
  
  target.innerHTML = notes.map((note) => `
    <article class="review-card">
      <div class="quiz-top">
        <span class="subtle">${formatDate(note.updated_at)}</span>
        <div class="toolbar-actions">
          <button class="btn btn-secondary" data-note-edit="${note.id}">Edit</button>
          <button class="btn btn-danger" data-note-delete="${note.id}">Delete</button>
        </div>
      </div>
      <p style="white-space: pre-wrap; margin-top: 10px; font-size: 0.95rem;">${escapeHtml(note.content)}</p>
    </article>
  `).join('');
  
  qsa('[data-note-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = notes.find(n => n.id === Number(button.dataset.noteEdit));
      if (note) {
        const form = qs('#note-form');
        form.noteId.value = note.id;
        form.content.value = note.content;
        hideMessage(qs('#note-message'));
      }
    });
  });
  
  qsa('[data-note-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteNote(Number(button.dataset.noteDelete)));
  });
}

async function saveNote(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const isUpdate = Boolean(payload.noteId);
  const message = qs('#note-message');
  hideMessage(message);

  try {
    if (isUpdate) {
      await api(`/api/student/notes/${payload.noteId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showMessage(message, 'Note updated successfully.', 'success');
    } else {
      await api('/api/student/notes', { method: 'POST', body: JSON.stringify(payload) });
      showMessage(message, 'Note added successfully.', 'success');
    }
    form.reset();
    form.noteId.value = '';
    await loadDashboard();
  } catch (error) {
    showMessage(message, error.message, 'error');
  }
}

async function deleteNote(noteId) {
  if (!window.confirm('Delete this note?')) return;
  try {
    await api(`/api/student/notes/${noteId}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
}

function renderStats(stats) {
  const target = qs('#student-stats');
  target.innerHTML = [
    ['Total attempts', stats.totalAttempted],
    ['Average score', stats.averageScore],
    ['Best score', stats.bestScore],
    ['Focus note', 'Auto-save active']
  ].map(([label, value]) => `
    <article class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${escapeHtml(String(value))}</div>
    </article>
  `).join('');
}

function renderQuizzes(quizzes) {
  const target = qs('#available-quizzes');
  if (!quizzes.length) {
    target.innerHTML = '<div class="empty-state">No quizzes are available right now.</div>';
    return;
  }

  target.innerHTML = quizzes.map((quiz) => `
    <article class="quiz-card">
      <div class="quiz-top">
        <div>
          <h3>${escapeHtml(quiz.title)}</h3>
          <p class="subtle">${escapeHtml(quiz.subject)} • ${quiz.question_count} questions • ${quiz.timer_minutes} min</p>
        </div>
        <span class="status-pill ${quiz.status === 'published' ? 'status-published' : 'status-draft'}">${escapeHtml(quiz.status)}</span>
      </div>
      <div class="quiz-meta">
        <span class="meta-chip">${quiz.is_preset ? 'Practice quiz' : 'Teacher quiz'}</span>
        <span class="meta-chip">${quiz.allow_multiple ? 'Multiple attempts' : 'One attempt'}</span>
        <span class="meta-chip">${quiz.teacher_name ? `By ${escapeHtml(quiz.teacher_name)}` : 'Preset subject'}</span>
      </div>
      <p class="subtle">${escapeHtml(quiz.instructions || 'No instructions added yet.')}</p>
      <div class="toolbar-actions">
        ${quiz.can_attempt || quiz.has_in_progress
          ? `<a class="btn btn-primary" href="/quiz.html?quizId=${quiz.id}">${quiz.has_in_progress ? 'Resume Attempt' : 'Start Quiz'}</a>`
          : `<button class="btn btn-primary" disabled>Attempt Locked</button>`}
        <button class="btn btn-secondary" ${quiz.can_attempt ? '' : 'disabled'}>${quiz.can_attempt ? 'Attempt allowed' : 'Already attempted'}</button>
      </div>
    </article>
  `).join('');
}

function renderHistory(attempts) {
  const body = qs('#student-history-body');
  if (!attempts.length) {
    body.innerHTML = '<tr><td colspan="7"><div class="empty-state">No attempts yet. Start with one of the published quizzes.</div></td></tr>';
    return;
  }

  body.innerHTML = attempts.map((attempt) => `
    <tr>
      <td>${escapeHtml(attempt.quizTitle)}</td>
      <td>${escapeHtml(attempt.subject)}</td>
      <td>${attempt.score} (${attempt.percentage}%)</td>
      <td>${escapeHtml(attempt.grade)}</td>
      <td>${formatDuration(attempt.timeTakenSeconds)}</td>
      <td>${attempt.warningCount}</td>
      <td><a class="btn btn-secondary" href="/result.html?attemptId=${attempt.id}">View</a></td>
    </tr>
  `).join('');
}

function renderSubjectPerformance(items) {
  const target = qs('#subject-performance');
  if (!items.length) {
    target.innerHTML = '<div class="empty-state">Subject-wise insights will appear after your first submission.</div>';
    return;
  }
  target.innerHTML = items.map((item) => `
    <article class="review-card">
      <div class="quiz-top">
        <strong>${escapeHtml(item.subject)}</strong>
        <span class="meta-chip">${item.attempts} attempt(s)</span>
      </div>
      <p class="subtle">Average score: ${item.averageScore} • Average percentage: ${item.averagePercentage}%</p>
    </article>
  `).join('');
}
