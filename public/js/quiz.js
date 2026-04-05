import { api } from './api.js';
import { escapeHtml, formatDuration, mountUserBar, qs, qsa, requireRole, showMessage, hideMessage } from './common.js';

let attemptBundle = null;
let currentIndex = 0;
let remainingTime = 0;
let timerInterval = null;
let quizId = null;
const answerMap = {};
let started = false;

(async function init() {
  try {
    const user = await requireRole('student');
    if (!user) return;
    mountUserBar(user);
    const params = new URLSearchParams(window.location.search);
    quizId = Number(params.get('quizId'));
    if (!quizId) {
      window.location.href = '/student.html';
      return;
    }
    await loadInstructionData();
    qs('#start-quiz-btn').addEventListener('click', startQuiz);
    qs('#prev-question').addEventListener('click', () => changeQuestion(currentIndex - 1));
    qs('#next-question').addEventListener('click', () => changeQuestion(currentIndex + 1));
    qs('#submit-quiz').addEventListener('click', () => submitQuiz(true));
    document.addEventListener('visibilitychange', handleVisibilityWarning);
  } catch (error) {
    console.error('Quiz init error:', error);
  }
})();

async function loadInstructionData() {
  try {
    const { quizzes } = await api('/api/quizzes/student');
    const quiz = quizzes.find((item) => item.id === quizId);
    if (!quiz) {
      window.location.href = '/student.html';
      return;
    }
    qs('#instruction-title').textContent = quiz.title;
    qs('#instruction-text').textContent = quiz.instructions || 'No instructions provided.';
    qs('#instruction-meta').innerHTML = `
      <span class="meta-chip">${escapeHtml(quiz.subject)}</span>
      <span class="meta-chip">${quiz.timer_minutes} minutes</span>
      <span class="meta-chip">${quiz.question_count} questions</span>
    `;

    if (!quiz.can_attempt) {
      qs('#start-quiz-btn').disabled = true;
      qs('#start-quiz-btn').textContent = 'Already Attempted';
      qs('#pre-attempt-form').classList.add('hide');
    }
  } catch (error) {
    console.error('Failed to load quiz data:', error);
    showMessage(qs('#quiz-message'), 'Error loading quiz details. Please refresh.', 'error');
  }
}

async function startQuiz() {
  const btn = qs('#start-quiz-btn');
  const name = qs('#student-name-input')?.value.trim();
  const roll = qs('#roll-number-input')?.value.trim();

  if (!name || !roll) {
    showMessage(qs('#quiz-message'), 'Please enter both your full name and roll number.', 'error');
    return;
  }

  try {
    hideMessage(qs('#quiz-message'));
    btn.disabled = true;
    btn.textContent = 'Starting...';

    attemptBundle = await api('/api/attempts/start', {
      method: 'POST',
      body: JSON.stringify({ quizId, studentName: name, rollNumber: roll })
    });

    started = true;
    currentIndex = 0;
    remainingTime = Number(attemptBundle.attempt.remainingTime);
    showExamShell();
    renderPalette();
    renderQuestion();
    beginTimer();
    enableAntiCheat();
  } catch (error) {
    btn.disabled = false;
    btn.textContent = 'Start Quiz';
    showMessage(qs('#quiz-message'), error.message, 'error');
  }
}

/* ── Anti-Cheat Features ── */

function enableAntiCheat() {
  // Disable copy/paste/cut
  document.addEventListener('copy', preventAction);
  document.addEventListener('cut', preventAction);
  document.addEventListener('paste', preventAction);
  // Disable right-click
  document.addEventListener('contextmenu', preventAction);
  // Disable text selection in exam area
  const examShell = qs('#exam-shell');
  if (examShell) {
    examShell.style.userSelect = 'none';
    examShell.style.webkitUserSelect = 'none';
  }
  // Request fullscreen
  requestFullscreen();
  document.addEventListener('fullscreenchange', handleFullscreenChange);
}

function preventAction(e) {
  if (!started) return;
  e.preventDefault();
}

function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

function handleFullscreenChange() {
  if (!started) return;
  if (!document.fullscreenElement) {
    // User exited fullscreen — count as warning
    handleVisibilityWarning();
    // Try to re-enter fullscreen after a moment
    setTimeout(requestFullscreen, 500);
  }
}

/* ── Exam UI ── */

function showExamShell() {
  qs('#instruction-box').classList.add('hide');
  qs('#exam-shell').classList.remove('hide');
  qs('#quiz-title-heading').textContent = attemptBundle.attempt.quizTitle;
  qs('#question-subject').textContent = `${attemptBundle.attempt.subject} • ${attemptBundle.questions.length} questions`;
  qs('#warning-count').textContent = attemptBundle.attempt.warningCount;
}

function beginTimer() {
  clearInterval(timerInterval);
  const total = attemptBundle.attempt.timerMinutes * 60;
  updateTimerUI(total);
  timerInterval = setInterval(() => {
    remainingTime = Math.max(0, remainingTime - 1);
    updateTimerUI(total);
    if (remainingTime <= 0) {
      clearInterval(timerInterval);
      submitQuiz(false);
    }
  }, 1000);
}

function updateTimerUI(total) {
  qs('#timer-number').textContent = formatDuration(remainingTime);
  const width = total ? (remainingTime / total) * 100 : 0;
  qs('#time-progress').style.width = `${width}%`;
}

function renderPalette() {
  const palette = qs('#question-palette');
  palette.innerHTML = attemptBundle.questions.map((question, index) => `
    <button type="button" data-index="${index}" class="${index === currentIndex ? 'active' : ''} ${answerMap[question.id] ? 'answered' : ''}">${index + 1}</button>
  `).join('');
  qsa('#question-palette button').forEach((button) => {
    button.addEventListener('click', () => changeQuestion(Number(button.dataset.index)));
  });
}

function changeQuestion(nextIndex) {
  if (nextIndex < 0 || nextIndex >= attemptBundle.questions.length) return;
  currentIndex = nextIndex;
  renderPalette();
  renderQuestion();
}

function renderQuestion() {
  const question = attemptBundle.questions[currentIndex];
  qs('#question-position').textContent = `Question ${currentIndex + 1} of ${attemptBundle.questions.length}`;
  qs('#question-text').textContent = question.questionText;
  qs('#question-marks').textContent = `${question.marks} mark(s)`;

  const selected = answerMap[question.id] || '';

  if (question.questionType === 'mcq' || question.questionType === 'true_false') {
    const options = Object.entries(question.options);
    qs('#option-list').innerHTML = options.map(([key, value]) => `
      <label class="option-item ${selected === key ? 'selected' : ''}">
        <input type="radio" name="option" value="${key}" ${selected === key ? 'checked' : ''} />
        <div><strong>${key}.</strong> ${escapeHtml(value)}</div>
      </label>
    `).join('');

    qsa('input[name="option"]').forEach((input) => {
      input.addEventListener('change', () => {
        answerMap[question.id] = input.value;
        saveAnswerToServer(question.id, input.value);
        renderPalette();
        renderQuestion();
      });
    });
  } else if (question.questionType === 'numerical') {
    qs('#option-list').innerHTML = `
      <div style="margin-top: 12px;">
        <label style="display:block; margin-bottom:8px; color: var(--text-muted); font-weight: 700;">Enter your numeric answer:</label>
        <input type="number" step="any" id="custom-answer-input" style="width:100%; max-width: 400px;" value="${escapeHtml(selected)}" />
      </div>
    `;
    const input = qs('#custom-answer-input');
    input.addEventListener('change', () => {
      answerMap[question.id] = input.value;
      saveAnswerToServer(question.id, input.value);
      renderPalette();
    });
  } else {
    qs('#option-list').innerHTML = `
      <div style="margin-top: 12px;">
        <label style="display:block; margin-bottom:8px; color: var(--text-muted); font-weight: 700;">Enter your answer:</label>
        <input type="text" id="custom-answer-input" style="width:100%; max-width: 400px;" value="${escapeHtml(selected)}" />
      </div>
    `;
    const input = qs('#custom-answer-input');
    input.addEventListener('change', () => {
      answerMap[question.id] = input.value;
      saveAnswerToServer(question.id, input.value);
      renderPalette();
    });
  }
}

/* ── Save Answer Per Question ── */

async function saveAnswerToServer(questionItemId, selectedKey) {
  if (!attemptBundle) return;
  try {
    await api(`/api/attempts/${attemptBundle.attempt.id}/answer`, {
      method: 'POST',
      body: JSON.stringify({ itemId: questionItemId, selectedKey })
    });
  } catch (error) {
    console.error('Failed to save answer:', error);
  }
}

/* ── Warnings ── */

async function handleVisibilityWarning() {
  if (!started || document.visibilityState !== 'hidden') return;
  try {
    const { warningCount } = await api(`/api/attempts/${attemptBundle.attempt.id}/warning`, { method: 'POST' });
    qs('#warning-count').textContent = warningCount;
  } catch {
    // ignore background warning failure
  }
}

/* ── Submit ── */

async function submitQuiz(confirmWithUser = true) {
  if (!attemptBundle) return;
  if (confirmWithUser && !window.confirm('Submit this quiz now? You cannot change your answers after submission.')) return;
  try {
    const { result } = await api(`/api/attempts/${attemptBundle.attempt.id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ remainingTime })
    });
    clearInterval(timerInterval);
    // Exit fullscreen on submit
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    window.location.href = `/result.html?attemptId=${result.attempt.id}`;
  } catch (error) {
    showMessage(qs('#quiz-message'), error.message, 'error');
  }
}
