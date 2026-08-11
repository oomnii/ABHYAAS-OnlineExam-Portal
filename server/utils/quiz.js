export function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function gradeFromPercentage(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

export function buildShuffledQuestion(question) {
  // True/False: only show True and False options, no shuffling
  if (question.question_type === 'true_false') {
    return {
      questionType: question.question_type,
      explanation: question.explanation,
      questionText: question.question_text,
      options: { A: 'True', B: 'False' },
      marks: question.marks,
      correctKey: question.correct_option === 'True' ? 'A' : 'B',
      originalQuestionId: question.id,
      correctOriginalKey: question.correct_option,
      reverseMap: { A: 'A', B: 'B' },
      originalCorrectText: question.correct_option
    };
  }

  // Non-MCQ types (fill_blank, one_word, numerical): no options to shuffle
  if (question.question_type !== 'mcq') {
    return {
      questionType: question.question_type,
      explanation: question.explanation,
      questionText: question.question_text,
      options: {},
      marks: question.marks,
      correctKey: question.correct_option,
      originalQuestionId: question.id,
      correctOriginalKey: question.correct_option,
      reverseMap: {},
      originalCorrectText: question.correct_option
    };
  }

  // MCQ: shuffle the 4 options
  const options = [
    { key: 'A', text: question.option_a },
    { key: 'B', text: question.option_b },
    { key: 'C', text: question.option_c },
    { key: 'D', text: question.option_d }
  ];
  const shuffled = shuffleArray(options);
  const mapped = {};
  const labelOrder = ['A', 'B', 'C', 'D'];
  const reverseMap = {};

  shuffled.forEach((item, index) => {
    mapped[labelOrder[index]] = item.text;
    reverseMap[labelOrder[index]] = item.key;
  });

  const correctKey = labelOrder[shuffled.findIndex((item) => item.key === question.correct_option)];

  return {
    questionText: question.question_text,
    questionType: question.question_type,
    explanation: question.explanation,
    options: mapped,
    marks: question.marks,
    correctKey,
    originalQuestionId: question.id,
    correctOriginalKey: question.correct_option,
    reverseMap,
    originalCorrectText: shuffled.find((item) => item.key === question.correct_option)?.text || ''
  };
}

export function computeLeaderboardRows(attempts) {
  const bestByStudent = new Map();
  for (const attempt of attempts) {
    const current = bestByStudent.get(attempt.student_id);
    if (!current) {
      bestByStudent.set(attempt.student_id, attempt);
      continue;
    }
    const better = compareAttempts(attempt, current) < 0 ? attempt : current;
    bestByStudent.set(attempt.student_id, better);
  }

  const ranked = [...bestByStudent.values()].sort(compareAttempts);
  return ranked.map((attempt, index) => ({
    rank: index + 1,
    studentId: attempt.student_id,
    studentName: attempt.student_name,
    rollNumber: attempt.roll_number,
    studentActualName: attempt.student_actual_name,
    studentBranch: attempt.student_branch ?? null,
    studentSemester: attempt.student_semester ?? null,
    studentRegistrationNo: attempt.student_registration_no ?? null,
    attemptId: attempt.id,
    score: attempt.score,
    percentage: attempt.percentage,
    grade: attempt.grade,
    timeTakenSeconds: attempt.time_taken_seconds,
    submittedAt: attempt.submit_time,
    warningCount: attempt.warning_count
  }));
}

export function compareAttempts(a, b) {
  if (Number(a.score) !== Number(b.score)) return Number(b.score) - Number(a.score);
  if (Number(a.percentage) !== Number(b.percentage)) return Number(b.percentage) - Number(a.percentage);
  if (Number(a.time_taken_seconds) !== Number(b.time_taken_seconds)) return Number(a.time_taken_seconds) - Number(b.time_taken_seconds);
  const aTime = new Date(a.submit_time || 0).getTime();
  const bTime = new Date(b.submit_time || 0).getTime();
  return aTime - bTime;
}
