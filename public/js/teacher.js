import { api } from './api.js';
import { escapeHtml, formatDate, formatDuration, hideMessage, mountUserBar, qs, qsa, quizStatusClass, requireRole, showMessage } from './common.js';

let selectedQuizId = null;
let quizzes = [];

(async function init() {
  try {
    const user = await requireRole('teacher');
    if (!user) return;
    mountUserBar(user);
    bindTabs();
    bindForms();
    await loadDashboard();
  } catch (error) {
    console.error('Teacher Dashboard Init Error:', error);
  }
})();

/* ── Tab Navigation ── */

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

/* ── Form Bindings ── */

function bindForms() {
  qs('#quiz-form')?.addEventListener('submit', saveQuiz);
  qs('#question-form')?.addEventListener('submit', saveQuestion);
  qs('#reset-quiz-form')?.addEventListener('click', resetQuizForm);
  qs('#reset-question-form')?.addEventListener('click', resetQuestionForm);
  qs('#question-type-select')?.addEventListener('change', handleQuestionTypeChange);
  qs('#jump-analysis-btn')?.addEventListener('click', () => {
    if (selectedQuizId) switchToTab('tab-analysis');
  });
  qs('#back-to-manage-btn')?.addEventListener('click', () => {
    if (selectedQuizId) switchToTab('tab-manage');
  });
}

function handleQuestionTypeChange() {
  const type = qs('#question-type-select').value;
  const dynamicOptions = qs('#dynamic-options-container');
  const dynamicAnswer = qs('#dynamic-answer-container');
  const dynamicTf = qs('#dynamic-tf-container');
  const dynamicNumeric = qs('#dynamic-numeric-container');

  dynamicOptions.classList.add('hide');
  dynamicAnswer.classList.add('hide');
  dynamicTf.classList.add('hide');
  if (dynamicNumeric) dynamicNumeric.classList.add('hide');

  if (type === 'mcq') {
    dynamicOptions.classList.remove('hide');
  } else if (type === 'true_false') {
    dynamicTf.classList.remove('hide');
  } else if (type === 'numerical') {
    if (dynamicNumeric) dynamicNumeric.classList.remove('hide');
  } else {
    dynamicAnswer.classList.remove('hide');
  }
}

/* ── Dashboard Loading ── */

async function loadDashboard() {
  const data = await api('/api/teacher/dashboard');
  quizzes = data.quizzes || [];
  renderStats(data.stats);
  renderOverviewQuizList(quizzes);
}

function renderStats(stats) {
  const target = qs('#teacher-stats');
  target.innerHTML = [
    ['Total quizzes', stats.totalQuizzes],
    ['Published', stats.publishedCount],
    ['Total attempts', stats.totalAttempts]
  ].map(([label, value]) => `
    <article class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${escapeHtml(String(value))}</div>
    </article>
  `).join('');
}

/* ── Overview: Quiz Cards with View + Delete ── */

function renderOverviewQuizList(items) {
  const target = qs('#overview-quiz-list');
  if (!items.length) {
    target.innerHTML = '<div class="empty-state">No quizzes created yet. Go to "Create" to add one.</div>';
    return;
  }

  target.innerHTML = items.map((quiz) => `
    <article class="review-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:16px;">
      <div>
        <strong>${escapeHtml(quiz.title)}</strong>
        <span class="status-pill ${quizStatusClass(quiz.status)}" style="margin-left:10px;">${escapeHtml(quiz.status)}</span>
        <p class="subtle" style="margin:4px 0 0;">${escapeHtml(quiz.subject)} • ${quiz.question_count} questions • ${quiz.attempt_count} attempts</p>
      </div>
      <div class="toolbar-actions">
        <button class="btn btn-secondary" data-action="view" data-id="${quiz.id}">View</button>
        <button class="btn btn-ghost" data-action="edit" data-id="${quiz.id}">Edit</button>
        <button class="btn btn-danger" data-action="delete" data-id="${quiz.id}">Delete</button>
      </div>
    </article>
  `).join('');

  qsa('[data-action="view"]').forEach((btn) => btn.addEventListener('click', () => selectQuiz(Number(btn.dataset.id), 'tab-manage')));
  qsa('[data-action="edit"]').forEach((btn) => btn.addEventListener('click', () => {
    populateQuizForm(Number(btn.dataset.id));
    switchToTab('tab-create');
  }));
  qsa('[data-action="delete"]').forEach((btn) => btn.addEventListener('click', () => removeQuiz(Number(btn.dataset.id))));
}

/* ── Quiz CRUD ── */

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
  hideMessage(qs('#quiz-message'));
}

async function removeQuiz(quizId) {
  if (!window.confirm('Delete this quiz and all its questions/attempts? This cannot be undone.')) return;
  try {
    await api(`/api/quizzes/${quizId}`, { method: 'DELETE' });
    if (selectedQuizId === quizId) {
      selectedQuizId = null;
      resetQuestionForm();
      qs('#question-list').innerHTML = '';
      qs('#manage-quiz-note').innerHTML = '<span>Select a quiz from the Overview tab first.</span>';
      qs('#jump-analysis-btn')?.classList.add('hide');
      qs('#export-pdf-btn')?.classList.add('hide');
      qs('#analysis-quiz-note').innerHTML = 'Select a quiz from the Overview tab first.';
      qs('#analytics-summary').innerHTML = 'Analytics will appear when you choose one of your quizzes.';
      qs('#analytics-attempts').innerHTML = '';
    }
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
}

/* ── Quiz Selection → Manage/Analysis ── */

async function selectQuiz(quizId, tab = 'tab-manage') {
  selectedQuizId = quizId;
  const quiz = quizzes.find((item) => item.id === quizId);
  if (!quiz) return;
  qs('#manage-quiz-note').innerHTML = `<span>Selected: <strong>${escapeHtml(quiz.title)}</strong> • ${escapeHtml(quiz.subject)} • ${quiz.question_count} questions</span>`;
  qs('#analysis-quiz-note').innerHTML = `Selected: <strong>${escapeHtml(quiz.title)}</strong> • ${escapeHtml(quiz.subject)}`;
  qs('#jump-analysis-btn')?.classList.remove('hide');
  const exportBtn = qs('#export-pdf-btn');
  if (exportBtn) {
    exportBtn.classList.remove('hide');
    exportBtn.href = `/export.html?quizId=${quizId}`;
  }
  switchToTab(tab);
  await Promise.all([loadQuestions(quizId), loadAnalytics(quizId)]);
}

/* ── Question CRUD ── */

async function loadQuestions(quizId) {
  const { questions } = await api(`/api/quizzes/${quizId}/questions`);
  const target = qs('#question-list');

  if (!questions.length) {
    target.innerHTML = '<div class="empty-state">No questions yet. Add the first one using the form above.</div>';
    return;
  }

  target.innerHTML = questions.map((question, idx) => {
    let typeName = question.question_type ? question.question_type.replace('_', ' ').toUpperCase() : 'MCQ';
    let optionsHtml = '';
    if (question.question_type === 'mcq') {
      optionsHtml = `<p class="subtle">A. ${escapeHtml(question.option_a || '')} <br/>B. ${escapeHtml(question.option_b || '')} <br/>C. ${escapeHtml(question.option_c || '')} <br/>D. ${escapeHtml(question.option_d || '')}</p>`;
    } else if (question.question_type === 'true_false') {
      optionsHtml = `<p class="subtle">A. True <br/>B. False</p>`;
    } else {
      optionsHtml = `<p class="subtle">Correct Answer: <strong>${escapeHtml(question.correct_option)}</strong></p>`;
    }

    return `
    <article class="review-card" style="padding: 14px; margin-bottom: 12px;">
      <div style="display:flex; justify-content:space-between; align-items:start;">
        <div>
          <strong>Q${idx + 1} &mdash; ${escapeHtml(typeName)} &mdash; ${question.marks} mark(s)</strong>
          <div style="margin-top: 8px;">${escapeHtml(question.question_text)}</div>
          ${optionsHtml}
        </div>
        <div class="toolbar-actions" style="margin-left: 16px; flex-shrink: 0;">
          <button class="btn btn-secondary btn-sm" data-question-edit="${question.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-question-delete="${question.id}">Delete</button>
        </div>
      </div>
    </article>
  `}).join('');

  qsa('[data-question-edit]').forEach((button) => button.addEventListener('click', () => editQuestion(questions.find((item) => item.id === Number(button.dataset.questionEdit)))));
  qsa('[data-question-delete]').forEach((button) => button.addEventListener('click', () => removeQuestion(Number(button.dataset.questionDelete))));
}

function editQuestion(question) {
  if (!question) return;
  const form = qs('#question-form');
  form.questionId.value = question.id;
  form.questionType.value = question.question_type || 'mcq';
  handleQuestionTypeChange();
  form.questionText.value = question.question_text || '';
  form.explanation.value = question.explanation || '';
  form.marks.value = question.marks || 1;
  if (form.questionType.value === 'mcq') {
    form.optionA.value = question.option_a || '';
    form.optionB.value = question.option_b || '';
    form.optionC.value = question.option_c || '';
    form.optionD.value = question.option_d || '';
    form.correctOption.value = question.correct_option || 'A';
  } else if (form.questionType.value === 'true_false') {
    form.correctTfOption.value = question.correct_option || 'True';
  } else if (form.questionType.value === 'numerical') {
    form.correctAnswerNumeric.value = question.correct_option || '';
  } else {
    form.correctAnswerText.value = question.correct_option || '';
  }
  // Scroll to form
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveQuestion(event) {
  event.preventDefault();
  if (!selectedQuizId) {
    showMessage(qs('#question-message'), 'Select a quiz first from the Overview tab.', 'error');
    return;
  }
  const message = qs('#question-message');
  hideMessage(message);

  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  payload.marks = Number(payload.marks || 1);

  if (payload.questionType === 'mcq') {
    if (!payload.optionA || !payload.optionB) {
      showMessage(message, 'Options A and B are required for MCQ.', 'error');
      return;
    }
  } else if (payload.questionType === 'true_false') {
    payload.correctOption = payload.correctTfOption;
  } else if (payload.questionType === 'numerical') {
    payload.correctOption = payload.correctAnswerNumeric;
  } else {
    payload.correctOption = payload.correctAnswerText;
  }

  if (!payload.correctOption) {
    showMessage(message, 'A correct answer is required.', 'error');
    return;
  }

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
  const savedType = form.questionType.value;
  form.reset();
  form.questionId.value = '';
  form.questionType.value = savedType;
  form.marks.value = 1;
  handleQuestionTypeChange();
  hideMessage(qs('#question-message'));
}

async function removeQuestion(questionId) {
  if (!window.confirm('Delete this question?')) return;
  try {
    await api(`/api/questions/${questionId}`, { method: 'DELETE' });
    await Promise.all([loadQuestions(selectedQuizId), loadDashboard(), loadAnalytics(selectedQuizId)]);
  } catch (error) {
    alert(error.message);
  }
}

/* ── Analytics ── */

async function loadAnalytics(quizId) {
  const target = qs('#analytics-summary');
  const attemptsTarget = qs('#analytics-attempts');
  try {
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

    attemptsTarget.innerHTML = analytics.leaderboard.map((row) => {
      const studentIdentifier = `${row.rollNumber ? escapeHtml(row.rollNumber) + ' &mdash; ' : ''}${escapeHtml(row.studentActualName || row.studentName)}`;
      return `
      <article class="review-card">
        <div class="quiz-top">
          <strong>#${row.rank} • ${studentIdentifier}</strong>
          <span class="meta-chip">${row.score} marks</span>
        </div>
        <p class="subtle">${row.percentage}% • ${formatDuration(row.timeTakenSeconds)} • ${row.warningCount} warning(s)</p>
        <a class="btn btn-secondary" href="/result.html?attemptId=${row.attemptId}">Open result view</a>
      </article>
      `;
    }).join('');
  } catch (error) {
    target.innerHTML = `<div class="empty-state">Could not load analytics.</div>`;
    attemptsTarget.innerHTML = '';
  }
}
