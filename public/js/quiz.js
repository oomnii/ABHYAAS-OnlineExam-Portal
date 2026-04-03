import { api } from './api.js';
import { escapeHtml, formatDuration, mountUserBar, qs, qsa, requireRole, showMessage } from './common.js';

let attemptBundle = null;
let currentIndex = 0;
let remainingTime = 0;
let timerInterval = null;
let quizId = null;
let autosaveInterval = null;
const answerMap = {};
let started = false;

(async function init() {
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
  qs('#start-or-resume').addEventListener('click', startOrResumeQuiz);
  qs('#prev-question').addEventListener('click', () => changeQuestion(currentIndex - 1));
  qs('#next-question').addEventListener('click', () => changeQuestion(currentIndex + 1));
  qs('#save-progress').addEventListener('click', () => manualSave(true));
  qs('#submit-quiz').addEventListener('click', () => submitQuiz(true));
  document.addEventListener('visibilitychange', handleVisibilityWarning);
})();

async function loadInstructionData() {
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
    <span class="meta-chip">${quiz.allow_multiple ? 'Multiple attempts allowed' : 'One attempt only'}</span>
  `;
  qs('#start-or-resume').textContent = quiz.has_in_progress ? 'Resume Saved Attempt' : 'Start Quiz';
}

async function startOrResumeQuiz() {
  attemptBundle = await api('/api/attempts/start', {
    method: 'POST',
    body: JSON.stringify({ quizId })
  });
  started = true;
  currentIndex = attemptBundle.attempt.currentIndex || 0;
  remainingTime = Number(attemptBundle.attempt.remainingTime);
  attemptBundle.questions.forEach((question) => {
    if (question.selectedKey) answerMap[question.id] = question.selectedKey;
  });
  showExamShell();
  renderPalette();
  renderQuestion();
  beginTimer();
  beginAutosave();
}

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

function beginAutosave() {
  clearInterval(autosaveInterval);
  autosaveInterval = setInterval(() => manualSave(false), 10000);
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

  const options = Object.entries(question.options);
  const selected = answerMap[question.id] || '';
  qs('#option-list').innerHTML = options.map(([key, value]) => `
    <label class="option-item ${selected === key ? 'selected' : ''}">
      <input type="radio" name="option" value="${key}" ${selected === key ? 'checked' : ''} />
      <div><strong>${key}.</strong> ${escapeHtml(value)}</div>
    </label>
  `).join('');

  qsa('input[name="option"]').forEach((input) => {
    input.addEventListener('change', () => {
      answerMap[question.id] = input.value;
      renderPalette();
      renderQuestion();
    });
  });
}

async function manualSave(showToast = false) {
  if (!started || !attemptBundle) return;
  const answers = Object.fromEntries(Object.entries(answerMap));
  try {
    await api(`/api/attempts/${attemptBundle.attempt.id}/save`, {
      method: 'POST',
      body: JSON.stringify({
        remainingTime,
        currentIndex,
        answers
      })
    });
    if (showToast) showMessage(qs('#quiz-message'), 'Progress saved successfully.', 'success');
  } catch (error) {
    if (showToast) showMessage(qs('#quiz-message'), error.message, 'error');
  }
}

async function handleVisibilityWarning() {
  if (!started || document.visibilityState !== 'hidden') return;
  try {
    const { warningCount } = await api(`/api/attempts/${attemptBundle.attempt.id}/warning`, { method: 'POST' });
    qs('#warning-count').textContent = warningCount;
  } catch {
    // ignore background warning failure
  }
}

async function submitQuiz(confirmWithUser = true) {
  if (!attemptBundle) return;
  if (confirmWithUser && !window.confirm('Submit this quiz now?')) return;
  await manualSave(false);
  const { result } = await api(`/api/attempts/${attemptBundle.attempt.id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ remainingTime })
  });
  clearInterval(timerInterval);
  clearInterval(autosaveInterval);
  window.location.href = `/result.html?attemptId=${result.attempt.id}`;
}
