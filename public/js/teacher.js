import { api } from './api.js';
import { escapeHtml, formatDate, formatDuration, hideMessage, mountUserBar, qs, qsa, quizStatusClass, requireRole, showMessage } from './common.js';

let selectedQuizId = null;
let quizzes = [];

(async function init() {
  const user = await requireRole('teacher');
  if (!user) return;
  mountUserBar(user);
  bindTabs();
  bindForms();
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

function switchToTab(targetId) {
  const navItems = qsa('.nav-item');
  const panes = qsa('.tab-pane');
  navItems.forEach(n => n.classList.remove('active'));
  panes.forEach(p => p.classList.remove('active'));
  
  const targetNav = qs(`.nav-item[data-tab-target="${targetId}"]`);
  const targetPane = qs(`#${targetId}`);
  if (targetNav) targetNav.classList.add('active');
  if (targetPane) targetPane.classList.add('active');
}

function bindForms() {
  qs('#quiz-form')?.addEventListener('submit', saveQuiz);
  qs('#question-form')?.addEventListener('submit', saveQuestion);
  qs('#reset-quiz-form')?.addEventListener('click', resetQuizForm);
  qs('#reset-question-form')?.addEventListener('click', resetQuestionForm);
}

async function loadDashboard() {
  const data = await api('/api/teacher/dashboard');
  quizzes = data.quizzes || [];
  renderStats(data.stats);
  renderQuizTable(quizzes);
}

function renderStats(stats) {
  const target = qs('#teacher-stats');
  target.innerHTML = [
    ['Total quizzes', stats.totalQuizzes],
    ['Published', stats.publishedCount],
    ['Total attempts', stats.totalAttempts],
    ['Workflow', 'Connected']
  ].map(([label, value]) => `
    <article class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${escapeHtml(String(value))}</div>
    </article>
  `).join('');
}

function renderQuizTable(items) {
  const body = qs('#teacher-quiz-body');
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="5"><div class="empty-state">No teacher quiz created yet.</div></td></tr>';
    return;
  }

  body.innerHTML = items.map((quiz) => `
    <tr>
      <td>
        <strong>${escapeHtml(quiz.title)}</strong><br/>
        <span class="subtle">${escapeHtml(quiz.subject)}</span>
      </td>
      <td><span class="status-pill ${quizStatusClass(quiz.status)}">${escapeHtml(quiz.status)}</span></td>
      <td>${quiz.question_count}</td>
      <td>${quiz.attempt_count}</td>
      <td>
        <div class="toolbar-actions">
          <button class="btn btn-secondary" data-action="select" data-id="${quiz.id}">Manage</button>
          <button class="btn btn-ghost" data-action="analytics" data-id="${quiz.id}">Analytics</button>
          <button class="btn btn-ghost" data-action="edit" data-id="${quiz.id}">Edit</button>
          <button class="btn btn-danger" data-action="delete" data-id="${quiz.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  qsa('[data-action="select"]').forEach((button) => button.addEventListener('click', () => selectQuiz(Number(button.dataset.id))));
  qsa('[data-action="analytics"]').forEach((button) => button.addEventListener('click', () => selectQuiz(Number(button.dataset.id), 'tab-analytics')));
  qsa('[data-action="edit"]').forEach((button) => button.addEventListener('click', () => populateQuizForm(Number(button.dataset.id))));
  qsa('[data-action="delete"]').forEach((button) => button.addEventListener('click', () => removeQuiz(Number(button.dataset.id))));
}

async function saveQuiz(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.timerMinutes = Number(payload.timerMinutes);
  const isUpdate = Boolean(payload.quizId);
  const message = qs('#quiz-message');
  hideMessage(message);

  try {
    if (isUpdate) {
      await api(`/api/quizzes/${payload.quizId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showMessage(message, 'Quiz updated successfully.', 'success');
    } else {
      await api('/api/quizzes', { method: 'POST', body: JSON.stringify(payload) });
      showMessage(message, 'Quiz created successfully.', 'success');
    }
    form.reset();
    form.quizId.value = '';
    await loadDashboard();
  } catch (error) {
    showMessage(message, error.message, 'error');
  }
}

function populateQuizForm(quizId) {
  const quiz = quizzes.find((item) => item.id === quizId);
  if (!quiz) return;
  const form = qs('#quiz-form');
  form.quizId.value = quiz.id;
  form.title.value = quiz.title;
  form.subject.value = quiz.subject;
  form.timerMinutes.value = quiz.timer_minutes;
  form.status.value = quiz.status;
  form.instructions.value = quiz.instructions || '';
}

function resetQuizForm() {
  qs('#quiz-form').reset();
  qs('#quiz-form [name="quizId"]').value = '';
}

async function removeQuiz(quizId) {
  if (!window.confirm('Delete this quiz and all linked questions/attempts?')) return;
  await api(`/api/quizzes/${quizId}`, { method: 'DELETE' });
  if (selectedQuizId === quizId) {
    selectedQuizId = null;
    resetQuestionForm();
    qs('#question-list').innerHTML = '';
    qs('#selected-quiz-note').innerHTML = 'Select a quiz from the table first.';
    const jumpBtn = qs('#jump-analytics-btn');
    if (jumpBtn) jumpBtn.classList.add('hide');
    qs('#selected-quiz-note-analytics').innerHTML = 'Select a quiz from the table first.';
    qs('#analytics-summary').innerHTML = 'Analytics will appear when you choose one of your quizzes.';
    qs('#analytics-attempts').innerHTML = '';
  }
  await loadDashboard();
}

async function selectQuiz(quizId, tab = 'tab-management') {
  selectedQuizId = quizId;
  const quiz = quizzes.find((item) => item.id === quizId);
  qs('#selected-quiz-note').innerHTML = `Selected quiz: <strong>${escapeHtml(quiz.title)}</strong> • ${escapeHtml(quiz.subject)}`;
  qs('#selected-quiz-note-analytics').innerHTML = `Selected quiz: <strong>${escapeHtml(quiz.title)}</strong> • ${escapeHtml(quiz.subject)}`;
  const jumpBtn = qs('#jump-analytics-btn');
  if (jumpBtn) jumpBtn.classList.remove('hide');
  switchToTab(tab);
  await Promise.all([loadQuestions(quizId), loadAnalytics(quizId)]);
}

async function loadQuestions(quizId) {
  const { questions } = await api(`/api/quizzes/${quizId}/questions`);
  const target = qs('#question-list');
  if (!questions.length) {
    target.innerHTML = '<div class="empty-state">No questions yet. Add the first one using the form.</div>';
    return;
  }
  target.innerHTML = questions.map((question) => `
    <article class="review-card">
      <div class="quiz-top">
        <strong>${escapeHtml(question.question_text)}</strong>
        <span class="meta-chip">${question.marks} mark(s)</span>
      </div>
      <p class="subtle">A. ${escapeHtml(question.option_a)}<br/>B. ${escapeHtml(question.option_b)}<br/>C. ${escapeHtml(question.option_c)}<br/>D. ${escapeHtml(question.option_d)}</p>
      <div class="toolbar-actions">
        <button class="btn btn-secondary" data-question-edit="${question.id}">Edit</button>
        <button class="btn btn-danger" data-question-delete="${question.id}">Delete</button>
      </div>
    </article>
  `).join('');
  qsa('[data-question-edit]').forEach((button) => button.addEventListener('click', () => editQuestion(questions.find((item) => item.id === Number(button.dataset.questionEdit)))));
  qsa('[data-question-delete]').forEach((button) => button.addEventListener('click', () => removeQuestion(Number(button.dataset.questionDelete))));
}

function editQuestion(question) {
  const form = qs('#question-form');
  form.questionId.value = question.id;
  form.questionText.value = question.question_text;
  form.optionA.value = question.option_a;
  form.optionB.value = question.option_b;
  form.optionC.value = question.option_c;
  form.optionD.value = question.option_d;
  form.correctOption.value = question.correct_option;
  form.marks.value = question.marks;
}

async function saveQuestion(event) {
  event.preventDefault();
  if (!selectedQuizId) {
    showMessage(qs('#question-message'), 'Select a quiz first.', 'error');
    return;
  }
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  payload.marks = Number(payload.marks || 1);
  const message = qs('#question-message');
  hideMessage(message);

  try {
    if (payload.questionId) {
      await api(`/api/questions/${payload.questionId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showMessage(message, 'Question updated successfully.', 'success');
    } else {
      await api(`/api/quizzes/${selectedQuizId}/questions`, { method: 'POST', body: JSON.stringify(payload) });
      showMessage(message, 'Question added successfully.', 'success');
    }
    resetQuestionForm();
    await Promise.all([loadQuestions(selectedQuizId), loadDashboard(), loadAnalytics(selectedQuizId)]);
  } catch (error) {
    showMessage(message, error.message, 'error');
  }
}

function resetQuestionForm() {
  const form = qs('#question-form');
  form.reset();
  form.questionId.value = '';
  form.marks.value = 1;
}

async function removeQuestion(questionId) {
  if (!window.confirm('Delete this question?')) return;
  await api(`/api/questions/${questionId}`, { method: 'DELETE' });
  await Promise.all([loadQuestions(selectedQuizId), loadDashboard(), loadAnalytics(selectedQuizId)]);
}

async function loadAnalytics(quizId) {
  const target = qs('#analytics-summary');
  const attemptsTarget = qs('#analytics-attempts');
  const analytics = await api(`/api/teacher/quizzes/${quizId}/analytics`);
  target.innerHTML = `
    <div class="grid-two">
      <div class="review-card"><strong>Attempts</strong><p class="subtle">${analytics.summary.attemptCount}</p></div>
      <div class="review-card"><strong>Average score</strong><p class="subtle">${analytics.summary.averageScore}</p></div>
      <div class="review-card"><strong>Average %</strong><p class="subtle">${analytics.summary.averagePercentage}%</p></div>
      <div class="review-card"><strong>Total warnings</strong><p class="subtle">${analytics.summary.totalWarnings}</p></div>
    </div>
  `;

  if (!analytics.attempts.length) {
    attemptsTarget.innerHTML = '<div class="empty-state">No student has submitted this quiz yet.</div>';
    return;
  }

  attemptsTarget.innerHTML = analytics.leaderboard.map((row) => `
    <article class="review-card">
      <div class="quiz-top">
        <strong>#${row.rank} • ${escapeHtml(row.studentName)}</strong>
        <span class="meta-chip">${row.score} marks</span>
      </div>
      <p class="subtle">${row.percentage}% • ${formatDuration(row.timeTakenSeconds)} • ${row.warningCount} warning(s)</p>
      <a class="btn btn-secondary" href="/result.html?attemptId=${row.attemptId}">Open result view</a>
    </article>
  `).join('');
}
