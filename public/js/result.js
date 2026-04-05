import { api } from './api.js';
import { escapeHtml, formatDate, formatDuration, mountUserBar, qs, requireRole } from './common.js';

(async function init() {
  const user = await api('/api/auth/me').then((data) => data.user);
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  mountUserBar(user);
  const params = new URLSearchParams(window.location.search);
  const attemptId = Number(params.get('attemptId'));
  if (!attemptId) {
    window.location.href = user.role === 'teacher' ? '/teacher.html' : '/student.html';
    return;
  }
  const { result } = await api(`/api/results/${attemptId}`);
  renderResult(result, user);
})();

function renderResult(result, user) {
  const attemptStudentIdentifier = `${result.attempt.rollNumber ? escapeHtml(result.attempt.rollNumber) + ' &mdash; ' : ''}${escapeHtml(result.attempt.studentActualName || result.attempt.studentName)}`;
  qs('#result-title').innerHTML = `${escapeHtml(result.quiz.title)} &bull; ${attemptStudentIdentifier}`;
  qs('#result-subtitle').textContent = `${result.attempt.subject} • Submitted ${formatDate(result.attempt.submittedAt)}`;
  qs('#back-dashboard').href = user.role === 'teacher' ? '/teacher.html' : '/student.html';

  qs('#result-stats').innerHTML = [
    ['Score', `${result.attempt.score}/${result.attempt.totalMarks}`],
    ['Percentage', `${result.attempt.percentage}%`],
    ['Grade', result.attempt.grade],
    ['Correct / Wrong', `${result.attempt.correctCount} / ${result.attempt.wrongCount}`],
    ['Time taken', formatDuration(result.attempt.timeTakenSeconds)],
    ['Warnings', result.attempt.warningCount],
    ['Rank', result.rank || '-'],
    ['Teacher', result.quiz.teacherName || 'Preset quiz']
  ].map(([label, value]) => `
    <div class="result-stat">
      <div class="subtle">${label}</div>
      <div class="value">${escapeHtml(String(value))}</div>
    </div>
  `).join('');

  qs('#review-list').innerHTML = result.review.map((item, index) => {
    const isTextBased = !['mcq', 'true_false'].includes(item.questionType);
    const hasAnswered = item.selectedKey != null && item.selectedKey !== '';
    const stateClass = hasAnswered ? (item.isCorrect ? 'correct' : 'wrong') : 'unanswered';
    const explanationStr = item.explanation ? `<div style="margin-top:12px; padding:10px; border-left: 4px solid var(--accent-light); background: rgba(0,0,0,0.1);"><strong>Explanation:</strong> <br/>${escapeHtml(item.explanation)}</div>` : '';
    
    let optionsStr = '';
    if (!isTextBased) {
      optionsStr = `<div class="quiz-meta" style="margin-top:8px;">${Object.entries(item.options).map(([key, value]) => `<span class="meta-chip">${key}. ${escapeHtml(value)}</span>`).join('')}</div>`;
    }

    return `
      <article class="review-card ${stateClass}">
        <strong>Q${index + 1}. ${escapeHtml(item.questionText)}</strong>
        <p class="subtle">Selected Answer: ${item.selectedKey || 'Not answered'} • Correct Answer: ${item.correctKey}</p>
        ${optionsStr}
        ${explanationStr}
      </article>
    `;
  }).join('');

  if (!result.leaderboard.length) {
    qs('#leaderboard-list').innerHTML = '<div class="empty-state">No leaderboard entries yet.</div>';
  } else {
    qs('#leaderboard-list').innerHTML = result.leaderboard.map((row) => {
      const rowIdentifier = `${row.rollNumber ? escapeHtml(row.rollNumber) + ' &mdash; ' : ''}${escapeHtml(row.studentActualName || row.studentName)}`;
      return `
      <article class="review-card ${row.studentId === result.attempt.studentId ? 'correct' : ''}">
        <div class="quiz-top">
          <strong>#${row.rank} &bull; ${rowIdentifier}</strong>
          <span class="meta-chip">${row.score} marks</span>
        </div>
        <p class="subtle">${row.percentage}% • ${formatDuration(row.timeTakenSeconds)} • ${row.warningCount} warning(s)</p>
      </article>
      `;
    }).join('');
  }
}
