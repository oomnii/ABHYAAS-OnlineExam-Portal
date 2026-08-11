import { api } from './api.js';
import { formatDuration, escapeHtml } from './common.js';

(async function init() {
  const params = new URLSearchParams(window.location.search);
  const quizId = Number(params.get('quizId'));
  if (!quizId) {
    document.getElementById('export-content').innerHTML = `<h2>No quiz ID provided.</h2>`;
    return;
  }

  try {
    const [{ questions, quiz }, analytics] = await Promise.all([
      api(`/api/quizzes/${quizId}/questions`),
      api(`/api/teacher/quizzes/${quizId}/analytics`)
    ]);

    renderReport(quiz, questions, analytics);
    setTimeout(() => {
      window.print();
    }, 500);
  } catch (err) {
    document.getElementById('export-content').innerHTML = `<h2>Error loading report: ${err.message}</h2>`;
  }
})();

function renderReport(quiz, questions, analytics) {
  let html = `
    <h1 style="text-align:center">${escapeHtml(quiz.title)} - Export Report</h1>
    <h3 style="text-align:center">Subject: ${escapeHtml(quiz.subject)}</h3>
    <hr>
    <h2>1. Results (Roll-number wise)</h2>
  `;

  if (!analytics.attempts.length) {
    html += `<p>No attempts recorded yet.</p>`;
  } else {
    // Sort by roll number if available, else actual name
    const sortedAttempts = [...analytics.attempts].sort((a, b) => {
       const rA = String(a.rollNumber || '').toLowerCase();
       const rB = String(b.rollNumber || '').toLowerCase();
       return rA.localeCompare(rB) || String(a.studentActualName || a.studentName).localeCompare(String(b.studentActualName || b.studentName));
    });

    html += `
      <table>
        <thead>
          <tr>
            <th>Roll No.</th>
            <th>Name (as entered)</th>
            <th>Branch</th>
            <th>Semester</th>
            <th>Reg. No.</th>
            <th>Score</th>
            <th>Timing</th>
            <th>Warnings (Anti-cheat)</th>
          </tr>
        </thead>
        <tbody>
          ${sortedAttempts.map(a => `
            <tr>
              <td>${escapeHtml(a.rollNumber || '-')}</td>
              <td>${escapeHtml(a.studentActualName || a.studentName)}</td>
              <td>${escapeHtml(a.studentBranch || '-')}</td>
              <td>${escapeHtml(a.studentSemester != null && String(a.studentSemester) !== '' ? String(a.studentSemester) : '-')}</td>
              <td>${escapeHtml(a.studentRegistrationNo || '-')}</td>
              <td>${a.score}</td>
              <td>${formatDuration(a.timeTakenSeconds)}</td>
              <td>${a.warningCount}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  html += `<hr style="margin: 30px 0;"><h2>2. Questions, Answers & Explanations</h2>`;

  if (!questions.length) {
    html += `<p>No questions in this quiz.</p>`;
  }

  html += questions.map((q, idx) => {
    let typeName = q.question_type ? q.question_type.replace('_', ' ').toUpperCase() : 'MCQ';
    let qHtml = `<div class="question-block">`;
    qHtml += `<strong>Q${idx + 1} (${typeName}) - ${q.marks} mark(s):</strong> ${escapeHtml(q.question_text)}<br/>`;
    
    if (['mcq', 'true_false'].includes(q.question_type || 'mcq')) {
      qHtml += `<ul style="margin: 5px 0; padding-left: 20px; list-style-type: none;">`;
      if (q.option_a) qHtml += `<li>A. ${escapeHtml(q.option_a)}</li>`;
      if (q.option_b) qHtml += `<li>B. ${escapeHtml(q.option_b)}</li>`;
      if (q.option_c) qHtml += `<li>C. ${escapeHtml(q.option_c)}</li>`;
      if (q.option_d) qHtml += `<li>D. ${escapeHtml(q.option_d)}</li>`;
      qHtml += `</ul>`;
    }
    
    qHtml += `<strong>Correct Answer:</strong> ${escapeHtml(q.correct_option)}<br/>`;
    if (q.explanation) {
      qHtml += `<strong style="color: #444;">Explanation:</strong> ${escapeHtml(q.explanation)}<br/>`;
    }
    qHtml += `</div>`;
    return qHtml;
  }).join('');

  document.getElementById('export-content').innerHTML = html;
}
