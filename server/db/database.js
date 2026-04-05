import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../utils/password.js';
import { buildShuffledQuestion, gradeFromPercentage, computeLeaderboardRows, shuffleArray } from '../utils/quiz.js';

import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = process.env.OQEP_DB_PATH;
const dataDir = envPath ? path.dirname(envPath) : path.join(__dirname, 'data');
const dbPath = envPath || path.join(dataDir, 'oqep.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    instructions TEXT DEFAULT '',
    timer_minutes INTEGER NOT NULL DEFAULT 15,
    total_marks INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
    is_preset INTEGER NOT NULL DEFAULT 0,
    allow_multiple INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'mcq',
    question_text TEXT NOT NULL,
    explanation TEXT DEFAULT '',
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_option TEXT NOT NULL,
    marks INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    roll_number TEXT,
    student_actual_name TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
    start_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submit_time TEXT,
    remaining_time INTEGER NOT NULL DEFAULT 0,
    current_index INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    percentage REAL NOT NULL DEFAULT 0,
    grade TEXT DEFAULT '',
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    time_taken_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attempt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'mcq',
    explanation TEXT DEFAULT '',
    options_json TEXT NOT NULL,
    correct_key TEXT NOT NULL,
    marks INTEGER NOT NULL,
    selected_key TEXT,
    is_correct INTEGER,
    FOREIGN KEY(attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    warning_number INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS student_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const countUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (countUsers === 0) {
  seedDatabase();
}

function seedDatabase() {
  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (teacher_id, title, subject, instructions, timer_minutes, total_marks, status, is_preset, allow_multiple)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO questions (quiz_id, question_type, explanation, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const teacher = insertUser.run('Demo Teacher', 'teacher@abhyaas.local', hashPassword('Teacher@123'), 'teacher');
  insertUser.run('Demo Student', 'student@abhyaas.local', hashPassword('Student@123'), 'student');

  const teacherId = Number(teacher.lastInsertRowid);

  /* ── DSA Quiz (10 questions, 10 min, mixed types) ── */
  const dsaQuiz = insertQuiz.run(teacherId, 'Data Structures & Algorithms', 'DSA', 'Answer all questions. No negative marking. Good luck!', 10, 10, 'published', 0, 0);
  const dsaId = Number(dsaQuiz.lastInsertRowid);
  // MCQ
  insertQuestion.run(dsaId, 'mcq', 'Binary search divides the search interval in half each time.', 'What is the time complexity of binary search?', 'O(n)', 'O(log n)', 'O(n log n)', 'O(1)', 'B', 1);
  insertQuestion.run(dsaId, 'mcq', 'Queue follows First In First Out ordering.', 'Which data structure uses FIFO order?', 'Stack', 'Queue', 'Tree', 'Graph', 'B', 1);
  insertQuestion.run(dsaId, 'mcq', 'Inorder traversal of BST yields sorted output.', 'Which traversal gives sorted order in a BST?', 'Preorder', 'Postorder', 'Inorder', 'Level order', 'C', 1);
  insertQuestion.run(dsaId, 'mcq', 'Worst case occurs when pivot is always the smallest or largest.', 'What is the worst-case complexity of quicksort?', 'O(n)', 'O(n^2)', 'O(log n)', 'O(n log n)', 'B', 1);
  insertQuestion.run(dsaId, 'mcq', 'Stack stores function calls and local variables for recursion.', 'Which structure is ideal for recursion call tracking?', 'Queue', 'Linked List', 'Stack', 'Heap', 'C', 1);
  // True/False
  insertQuestion.run(dsaId, 'true_false', 'Array elements are stored in contiguous memory locations.', 'Arrays use contiguous memory allocation.', 'True', 'False', null, null, 'True', 1);
  insertQuestion.run(dsaId, 'true_false', 'A stack follows Last In First Out (LIFO) principle.', 'A stack follows FIFO order.', 'True', 'False', null, null, 'False', 1);
  // Fill in the blank
  insertQuestion.run(dsaId, 'fill_blank', 'BFS uses a queue data structure.', 'BFS (Breadth-First Search) uses a _____ data structure.', null, null, null, null, 'queue', 1);
  // One-word
  insertQuestion.run(dsaId, 'one_word', 'A binary tree where every node has at most two children and all levels are fully filled except possibly the last.', 'What type of binary tree has all levels fully filled except possibly the last level?', null, null, null, null, 'complete', 1);
  // Numerical
  insertQuestion.run(dsaId, 'numerical', 'A complete binary tree of height 3 has at most 2^4 - 1 = 15 nodes.', 'What is the maximum number of nodes in a complete binary tree of height 3?', null, null, null, null, '15', 1);
  recalculateQuizMarks(dsaId);

  /* ── OS Quiz (10 questions, 10 min, mixed types) ── */
  const osQuiz = insertQuiz.run(teacherId, 'Operating Systems', 'OS', 'Answer all questions. No negative marking. Good luck!', 10, 10, 'published', 0, 0);
  const osId = Number(osQuiz.lastInsertRowid);
  // MCQ
  insertQuestion.run(osId, 'mcq', 'Priority scheduling can starve low-priority processes.', 'Which scheduling algorithm can cause starvation?', 'Round Robin', 'FCFS', 'Priority Scheduling', 'SJF', 'C', 1);
  insertQuestion.run(osId, 'mcq', 'Mutual exclusion is one of the four necessary conditions.', 'What is a necessary condition for deadlock?', 'Mutual exclusion', 'Caching', 'Paging', 'Spooling', 'A', 1);
  insertQuestion.run(osId, 'mcq', 'Paging divides memory into fixed-size frames eliminating external fragmentation.', 'Which memory technique avoids external fragmentation?', 'Segmentation', 'Paging', 'Swapping', 'Compaction', 'B', 1);
  insertQuestion.run(osId, 'mcq', 'A waiting process typically awaits I/O completion.', 'A process in waiting state is generally waiting for?', 'CPU time', 'I/O completion', 'Termination', 'Priority boost', 'B', 1);
  insertQuestion.run(osId, 'mcq', 'The kernel stores interrupt handlers and system calls.', 'Which area stores interrupt handlers?', 'Kernel', 'Cache', 'Stack', 'Heap', 'A', 1);
  // True/False
  insertQuestion.run(osId, 'true_false', 'A semaphore is a synchronization tool used to control access to shared resources.', 'Semaphore is used for process synchronization.', 'True', 'False', null, null, 'True', 1);
  insertQuestion.run(osId, 'true_false', 'Threads within the same process share code section and data section.', 'Threads of the same process do NOT share memory.', 'True', 'False', null, null, 'False', 1);
  // Fill in the blank
  insertQuestion.run(osId, 'fill_blank', 'Round Robin scheduling algorithm uses time quantum.', 'The _____ scheduling algorithm uses a fixed time quantum for each process.', null, null, null, null, 'Round Robin', 1);
  // One-word
  insertQuestion.run(osId, 'one_word', 'Thrashing occurs when a system spends more time swapping pages than executing.', 'What is the term for excessive page swapping that degrades performance?', null, null, null, null, 'thrashing', 1);
  // Numerical
  insertQuestion.run(osId, 'numerical', 'Page size = 4 KB, logical address space = 256 KB. Pages = 256/4 = 64.', 'If page size is 4 KB and logical address space is 256 KB, how many pages are there?', null, null, null, null, '64', 1);
  recalculateQuizMarks(osId);

  /* ── DBMS Quiz (10 questions, 10 min, mixed types) ── */
  const dbmsQuiz = insertQuiz.run(teacherId, 'Database Management Systems', 'DBMS', 'Answer all questions. No negative marking. Good luck!', 10, 10, 'published', 0, 0);
  const dbmsId = Number(dbmsQuiz.lastInsertRowid);
  // MCQ
  insertQuestion.run(dbmsId, 'mcq', '2NF removes partial dependency from a relation.', 'Which normal form removes partial dependency?', '1NF', '2NF', '3NF', 'BCNF', 'B', 1);
  insertQuestion.run(dbmsId, 'mcq', 'DROP removes the entire table structure and data.', 'Which SQL command removes a table entirely?', 'DELETE', 'REMOVE', 'DROP', 'CLEAR', 'C', 1);
  insertQuestion.run(dbmsId, 'mcq', 'Primary key uniquely identifies each tuple in a relation.', 'Which key uniquely identifies a tuple?', 'Foreign key', 'Composite key', 'Primary key', 'Super key', 'C', 1);
  insertQuestion.run(dbmsId, 'mcq', 'Cross join produces the Cartesian product of two tables.', 'A join without a condition is called?', 'Inner join', 'Cross join', 'Left join', 'Natural join', 'B', 1);
  insertQuestion.run(dbmsId, 'mcq', 'Durability ensures committed transactions survive system failures.', 'Which ACID property ensures completed transactions remain saved?', 'Atomicity', 'Consistency', 'Isolation', 'Durability', 'D', 1);
  // True/False
  insertQuestion.run(dbmsId, 'true_false', 'A foreign key references the primary key of another table.', 'A foreign key references the primary key of another table.', 'True', 'False', null, null, 'True', 1);
  insertQuestion.run(dbmsId, 'true_false', 'A view is a virtual table based on the result of a query. It stores data on disk.', 'A SQL View stores data physically on disk.', 'True', 'False', null, null, 'False', 1);
  // Fill in the blank
  insertQuestion.run(dbmsId, 'fill_blank', 'SELECT is used to retrieve data from a database.', 'The SQL command _____ is used to retrieve data from a database.', null, null, null, null, 'SELECT', 1);
  // One-word
  insertQuestion.run(dbmsId, 'one_word', 'Normalization is the process of organizing data to reduce redundancy.', 'What is the process of reducing data redundancy in a database called?', null, null, null, null, 'normalization', 1);
  // Numerical
  insertQuestion.run(dbmsId, 'numerical', 'A relation with 5 attributes and 10 tuples has 5 × 10 = 50 cells.', 'How many cells are in a relation with 5 attributes and 10 tuples?', null, null, null, null, '50', 1);
  recalculateQuizMarks(dbmsId);
}

/* ── Session Management ── */

function nowPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, nowPlusDays(7));
  return token;
}

export function getUserBySession(token) {
  if (!token) return null;
  cleanupExpiredSessions();
  return db.prepare(`
    SELECT s.token, u.id, u.name, u.email, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
      AND datetime(s.expires_at) > datetime('now')
  `).get(token) || null;
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function cleanupExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')").run();
}

/* ── User Management ── */

export function createUser({ name, email, passwordHash, role }) {
  const stmt = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  const result = stmt.run(name, email.toLowerCase(), passwordHash, role);
  return getUserById(Number(result.lastInsertRowid));
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase()) || null;
}

export function getUserById(id) {
  return db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id) || null;
}

/* ── Quiz CRUD ── */

export function createQuiz({ teacherId, title, subject, instructions, timerMinutes, status = 'draft', isPreset = 0, allowMultiple = 0 }) {
  const stmt = db.prepare(`
    INSERT INTO quizzes (teacher_id, title, subject, instructions, timer_minutes, total_marks, status, is_preset, allow_multiple, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(teacherId || null, title, subject, instructions || '', timerMinutes, status, isPreset, allowMultiple);
  return getQuizById(Number(result.lastInsertRowid));
}

export function updateQuiz(quizId, teacherId, payload) {
  const quiz = getQuizById(quizId);
  if (!quiz) return null;
  if (quiz.teacher_id !== teacherId) return null;
  const next = {
    title: payload.title ?? quiz.title,
    subject: payload.subject ?? quiz.subject,
    instructions: payload.instructions ?? quiz.instructions,
    timer_minutes: payload.timerMinutes ?? quiz.timer_minutes,
    status: payload.status ?? quiz.status,
    allow_multiple: payload.allowMultiple ?? quiz.allow_multiple
  };
  db.prepare(`
    UPDATE quizzes
    SET title = ?, subject = ?, instructions = ?, timer_minutes = ?, status = ?, allow_multiple = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next.title, next.subject, next.instructions, next.timer_minutes, next.status, next.allow_multiple, quizId);
  recalculateQuizMarks(quizId);
  return getQuizById(quizId);
}

export function deleteQuiz(quizId, teacherId) {
  const quiz = getQuizById(quizId);
  if (!quiz || quiz.teacher_id !== teacherId) return false;
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
  return true;
}

export function getQuizById(id) {
  return db.prepare(`
    SELECT q.*, u.name AS teacher_name
    FROM quizzes q
    LEFT JOIN users u ON u.id = q.teacher_id
    WHERE q.id = ?
  `).get(id) || null;
}

export function listTeacherQuizzes(teacherId) {
  return db.prepare(`
    SELECT q.*, COUNT(qu.id) AS question_count,
      (SELECT COUNT(*) FROM attempts a WHERE a.quiz_id = q.id AND a.status = 'submitted') AS attempt_count
    FROM quizzes q
    LEFT JOIN questions qu ON qu.quiz_id = q.id
    WHERE q.teacher_id = ?
    GROUP BY q.id
    ORDER BY q.updated_at DESC, q.id DESC
  `).all(teacherId);
}

export function listStudentQuizzes(studentId) {
  const quizzes = db.prepare(`
    SELECT q.*, u.name AS teacher_name,
      EXISTS (
        SELECT 1 FROM attempts a
        WHERE a.quiz_id = q.id AND a.student_id = ? AND a.status = 'submitted'
      ) AS already_attempted,
      (SELECT COUNT(*) FROM questions qs WHERE qs.quiz_id = q.id) AS question_count
    FROM quizzes q
    LEFT JOIN users u ON u.id = q.teacher_id
    WHERE q.status = 'published'
    ORDER BY q.created_at DESC
  `).all(studentId);
  return quizzes.map((quiz) => ({
    ...quiz,
    can_attempt: quiz.allow_multiple || !quiz.already_attempted
  }));
}

/* ── Question CRUD ── */

export function addQuestion({ quizId, teacherId, questionType, explanation, questionText, optionA, optionB, optionC, optionD, correctOption, marks }) {
  const quiz = getQuizById(quizId);
  if (!quiz || quiz.teacher_id !== teacherId) return null;
  const stmt = db.prepare(`
    INSERT INTO questions (quiz_id, question_type, explanation, question_text, option_a, option_b, option_c, option_d, correct_option, marks, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(quizId, questionType || 'mcq', explanation || '', questionText, optionA || null, optionB || null, optionC || null, optionD || null, correctOption, marks);
  recalculateQuizMarks(quizId);
  return getQuestionById(Number(result.lastInsertRowid));
}

export function updateQuestion(questionId, teacherId, payload) {
  const question = getQuestionById(questionId);
  if (!question) return null;
  const quiz = getQuizById(question.quiz_id);
  if (!quiz || quiz.teacher_id !== teacherId) return null;
  const next = {
    question_type: payload.questionType ?? question.question_type,
    explanation: payload.explanation ?? question.explanation,
    question_text: payload.questionText ?? question.question_text,
    option_a: payload.optionA ?? question.option_a,
    option_b: payload.optionB ?? question.option_b,
    option_c: payload.optionC ?? question.option_c,
    option_d: payload.optionD ?? question.option_d,
    correct_option: payload.correctOption ?? question.correct_option,
    marks: payload.marks ?? question.marks
  };
  db.prepare(`
    UPDATE questions
    SET question_type = ?, explanation = ?, question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next.question_type, next.explanation, next.question_text, next.option_a, next.option_b, next.option_c, next.option_d, next.correct_option, next.marks, questionId);
  recalculateQuizMarks(question.quiz_id);
  return getQuestionById(questionId);
}

export function deleteQuestion(questionId, teacherId) {
  const question = getQuestionById(questionId);
  if (!question) return false;
  const quiz = getQuizById(question.quiz_id);
  if (!quiz || quiz.teacher_id !== teacherId) return false;
  db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
  recalculateQuizMarks(question.quiz_id);
  return true;
}

export function getQuestionById(questionId) {
  return db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) || null;
}

export function listQuestionsByQuiz(quizId) {
  return db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY id ASC').all(quizId);
}

export function recalculateQuizMarks(quizId) {
  const row = db.prepare('SELECT COALESCE(SUM(marks), 0) AS totalMarks FROM questions WHERE quiz_id = ?').get(quizId);
  db.prepare('UPDATE quizzes SET total_marks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.totalMarks, quizId);
}

/* ── Attempt Logic (No Resume — Single Session Only) ── */

export function getSubmittedAttempt(quizId, studentId) {
  return db.prepare(`
    SELECT * FROM attempts
    WHERE quiz_id = ? AND student_id = ? AND status = 'submitted'
    ORDER BY id DESC
    LIMIT 1
  `).get(quizId, studentId) || null;
}

export function startAttempt({ quizId, studentId, rollNumber, studentName }) {
  const quiz = getQuizById(quizId);
  if (!quiz || quiz.status !== 'published') {
    throw new Error('Quiz is not available for attempt.');
  }
  if (!quiz.allow_multiple && getSubmittedAttempt(quizId, studentId)) {
    throw new Error('This quiz can be attempted only once.');
  }
  const sourceQuestions = listQuestionsByQuiz(quizId);
  if (!sourceQuestions.length) {
    throw new Error('Quiz has no questions yet.');
  }
  const shuffledQuestions = shuffleArray(sourceQuestions);
  const insertAttempt = db.prepare(`
    INSERT INTO attempts (quiz_id, student_id, roll_number, student_actual_name, remaining_time, current_index, status)
    VALUES (?, ?, ?, ?, ?, 0, 'in_progress')
  `);
  const attemptResult = insertAttempt.run(quizId, studentId, rollNumber || '', studentName || '', quiz.timer_minutes * 60);
  const attemptId = Number(attemptResult.lastInsertRowid);
  const insertItem = db.prepare(`
    INSERT INTO attempt_items (attempt_id, question_id, position, question_text, question_type, explanation, options_json, correct_key, marks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  shuffledQuestions.forEach((question, index) => {
    const snapshot = buildShuffledQuestion(question);
    insertItem.run(
      attemptId,
      snapshot.originalQuestionId,
      index,
      snapshot.questionText,
      snapshot.questionType,
      snapshot.explanation,
      JSON.stringify(snapshot.options),
      snapshot.correctKey,
      snapshot.marks
    );
  });

  return getAttemptBundle(attemptId, studentId, true);
}

export function getAttemptById(attemptId) {
  return db.prepare(`
    SELECT a.*, q.title AS quiz_title, q.subject, q.instructions, q.timer_minutes, q.total_marks, q.allow_multiple,
           u.name AS student_name
    FROM attempts a
    JOIN quizzes q ON q.id = a.quiz_id
    JOIN users u ON u.id = a.student_id
    WHERE a.id = ?
  `).get(attemptId) || null;
}

export function getAttemptItems(attemptId) {
  return db.prepare(`
    SELECT * FROM attempt_items
    WHERE attempt_id = ?
    ORDER BY position ASC
  `).all(attemptId).map((item) => ({
    ...item,
    options: JSON.parse(item.options_json)
  }));
}

export function getAttemptBundle(attemptId, studentId, isNew = false) {
  const attempt = getAttemptById(attemptId);
  if (!attempt || attempt.student_id !== studentId) return null;
  const items = getAttemptItems(attemptId);
  return {
    isNew,
    attempt: {
      id: attempt.id,
      quizId: attempt.quiz_id,
      quizTitle: attempt.quiz_title,
      subject: attempt.subject,
      instructions: attempt.instructions,
      timerMinutes: attempt.timer_minutes,
      totalMarks: attempt.total_marks,
      rollNumber: attempt.roll_number,
      studentActualName: attempt.student_actual_name,
      status: attempt.status,
      startTime: attempt.start_time,
      remainingTime: attempt.remaining_time,
      currentIndex: attempt.current_index,
      warningCount: attempt.warning_count
    },
    questions: items.map((item) => ({
      id: item.id,
      questionId: item.question_id,
      position: item.position,
      questionText: item.question_text,
      questionType: item.question_type,
      options: item.options,
      marks: item.marks,
      selectedKey: item.selected_key
    }))
  };
}

/* ── Answer Saving (per-question, used during exam) ── */

export function saveAnswer({ attemptId, studentId, itemId, selectedKey }) {
  const attempt = getAttemptById(attemptId);
  if (!attempt || attempt.student_id !== studentId || attempt.status !== 'in_progress') {
    throw new Error('Attempt not found or already submitted.');
  }
  db.prepare('UPDATE attempt_items SET selected_key = ? WHERE attempt_id = ? AND id = ?')
    .run(selectedKey || null, attemptId, Number(itemId));
  return { ok: true };
}

/* ── Warnings ── */

export function addWarning({ attemptId, studentId }) {
  const attempt = getAttemptById(attemptId);
  if (!attempt || attempt.student_id !== studentId || attempt.status !== 'in_progress') {
    throw new Error('Attempt not found or already submitted.');
  }
  const nextWarning = attempt.warning_count + 1;
  db.prepare('UPDATE attempts SET warning_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextWarning, attemptId);
  db.prepare(`
    INSERT INTO warnings (attempt_id, quiz_id, student_id, warning_number)
    VALUES (?, ?, ?, ?)
  `).run(attemptId, attempt.quiz_id, studentId, nextWarning);
  return nextWarning;
}

/* ── Submit & Grade ── */

export function submitAttempt({ attemptId, studentId, remainingTime }) {
  const attempt = getAttemptById(attemptId);
  if (!attempt || attempt.student_id !== studentId || attempt.status !== 'in_progress') {
    throw new Error('Attempt not found or already submitted.');
  }
  const items = getAttemptItems(attemptId);
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  const updateItem = db.prepare('UPDATE attempt_items SET is_correct = ? WHERE id = ?');
  items.forEach((item) => {
    const selected = (item.selected_key !== null && item.selected_key !== undefined) ? String(item.selected_key).trim() : '';

    if (selected === '') {
      unanswered += 1;
      updateItem.run(null, item.id);
      return;
    }

    let isCorrect = false;
    const correctVal = String(item.correct_key).trim();

    if (item.question_type === 'numerical') {
      const givenNum = parseFloat(selected);
      const correctNum = parseFloat(correctVal);
      if (!isNaN(givenNum) && !isNaN(correctNum) && givenNum === correctNum) {
        isCorrect = true;
      }
    } else if (item.question_type === 'mcq' || item.question_type === 'true_false') {
      if (selected === correctVal) {
        isCorrect = true;
      }
    } else {
      // Case-insensitive for fill_blank and one_word
      if (selected.toLowerCase() === correctVal.toLowerCase()) {
        isCorrect = true;
      }
    }

    if (isCorrect) {
      correct += 1;
      score += item.marks;
      updateItem.run(1, item.id);
    } else {
      wrong += 1;
      updateItem.run(0, item.id);
    }
  });

  const percentage = attempt.total_marks ? Number(((score / attempt.total_marks) * 100).toFixed(2)) : 0;
  const timeTaken = Math.max(0, attempt.timer_minutes * 60 - Number(remainingTime ?? attempt.remaining_time));
  const grade = gradeFromPercentage(percentage);

  db.prepare(`
    UPDATE attempts
    SET status = 'submitted',
        submit_time = CURRENT_TIMESTAMP,
        remaining_time = ?,
        score = ?,
        percentage = ?,
        grade = ?,
        correct_count = ?,
        wrong_count = ?,
        unanswered_count = ?,
        time_taken_seconds = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Math.max(0, Number(remainingTime ?? attempt.remaining_time)), score, percentage, grade, correct, wrong, unanswered, timeTaken, attemptId);

  return getResultForAttempt(attemptId, studentId);
}

/* ── Results & Leaderboard ── */

export function getResultForAttempt(attemptId, userId) {
  const attempt = getAttemptById(attemptId);
  if (!attempt) return null;
  const quiz = getQuizById(attempt.quiz_id);
  const items = getAttemptItems(attemptId);
  const canView = userId === attempt.student_id || userId === quiz.teacher_id;
  if (!canView) return null;

  const leaderboard = getQuizLeaderboard(quiz.id);
  const row = leaderboard.find((item) => item.attemptId === attemptId || item.studentId === attempt.student_id);

  return {
    attempt: {
      id: attempt.id,
      quizId: attempt.quiz_id,
      quizTitle: attempt.quiz_title,
      subject: attempt.subject,
      studentId: attempt.student_id,
      studentName: attempt.student_name,
      rollNumber: attempt.roll_number,
      studentActualName: attempt.student_actual_name,
      score: attempt.score,
      percentage: attempt.percentage,
      grade: attempt.grade,
      correctCount: attempt.correct_count,
      wrongCount: attempt.wrong_count,
      unansweredCount: attempt.unanswered_count,
      timeTakenSeconds: attempt.time_taken_seconds,
      warningCount: attempt.warning_count,
      submittedAt: attempt.submit_time,
      totalMarks: attempt.total_marks
    },
    quiz: {
      id: quiz.id,
      title: quiz.title,
      subject: quiz.subject,
      instructions: quiz.instructions,
      teacherName: quiz.teacher_name
    },
    rank: row?.rank || null,
    leaderboard,
    review: items.map((item) => ({
      position: item.position,
      questionText: item.question_text,
      questionType: item.question_type,
      explanation: item.explanation,
      options: item.options,
      selectedKey: item.selected_key,
      correctKey: item.correct_key,
      marks: item.marks,
      isCorrect: item.is_correct
    }))
  };
}

export function getQuizLeaderboard(quizId) {
  const attempts = db.prepare(`
    SELECT a.*, u.name AS student_name
    FROM attempts a
    JOIN users u ON u.id = a.student_id
    WHERE a.quiz_id = ? AND a.status = 'submitted'
  `).all(quizId);
  return computeLeaderboardRows(attempts);
}

export function getTeacherQuizAnalytics(quizId, teacherId) {
  const quiz = getQuizById(quizId);
  if (!quiz || quiz.teacher_id !== teacherId) return null;
  const attempts = db.prepare(`
    SELECT a.*, u.name AS student_name, u.email AS student_email
    FROM attempts a
    JOIN users u ON u.id = a.student_id
    WHERE a.quiz_id = ? AND a.status = 'submitted'
    ORDER BY a.score DESC, a.percentage DESC, a.time_taken_seconds ASC, a.submit_time ASC
  `).all(quizId);
  const leaderboard = getQuizLeaderboard(quizId);
  const averageScore = attempts.length
    ? Number((attempts.reduce((sum, item) => sum + Number(item.score), 0) / attempts.length).toFixed(2))
    : 0;
  return {
    quiz,
    summary: {
      attemptCount: attempts.length,
      averageScore,
      averagePercentage: attempts.length ? Number((attempts.reduce((sum, item) => sum + Number(item.percentage), 0) / attempts.length).toFixed(2)) : 0,
      totalWarnings: attempts.reduce((sum, item) => sum + Number(item.warning_count), 0)
    },
    leaderboard,
    attempts: attempts.map((item) => ({
      id: item.id,
      studentId: item.student_id,
      studentName: item.student_name,
      rollNumber: item.roll_number,
      studentActualName: item.student_actual_name,
      studentEmail: item.student_email,
      score: item.score,
      percentage: item.percentage,
      grade: item.grade,
      correctCount: item.correct_count,
      wrongCount: item.wrong_count,
      unansweredCount: item.unanswered_count,
      warningCount: item.warning_count,
      timeTakenSeconds: item.time_taken_seconds,
      submittedAt: item.submit_time
    }))
  };
}

/* ── Student Notes ── */

export function createNote({ studentId, content }) {
  const stmt = db.prepare('INSERT INTO student_notes (student_id, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  const result = stmt.run(studentId, content);
  return getNoteById(Number(result.lastInsertRowid), studentId);
}

export function updateNote(noteId, studentId, content) {
  const note = getNoteById(noteId, studentId);
  if (!note) return null;
  db.prepare('UPDATE student_notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, noteId);
  return getNoteById(noteId, studentId);
}

export function deleteNote(noteId, studentId) {
  const note = getNoteById(noteId, studentId);
  if (!note) return false;
  db.prepare('DELETE FROM student_notes WHERE id = ?').run(noteId);
  return true;
}

export function getNoteById(noteId, studentId) {
  return db.prepare('SELECT * FROM student_notes WHERE id = ? AND student_id = ?').get(noteId, studentId) || null;
}

export function listNotesByStudent(studentId) {
  return db.prepare('SELECT * FROM student_notes WHERE student_id = ? ORDER BY updated_at DESC').all(studentId);
}

/* ── Dashboard Aggregation ── */

export function getStudentDashboard(studentId) {
  const attempts = db.prepare(`
    SELECT a.*, q.title AS quiz_title, q.subject, q.is_preset
    FROM attempts a
    JOIN quizzes q ON q.id = a.quiz_id
    WHERE a.student_id = ? AND a.status = 'submitted'
    ORDER BY a.submit_time DESC
  `).all(studentId);
  const totalAttempted = attempts.length;
  const averageScore = totalAttempted ? Number((attempts.reduce((sum, item) => sum + Number(item.score), 0) / totalAttempted).toFixed(2)) : 0;
  const bestScore = totalAttempted ? Math.max(...attempts.map((item) => Number(item.score))) : 0;
  const subjectMap = new Map();
  attempts.forEach((attempt) => {
    const entry = subjectMap.get(attempt.subject) || { subject: attempt.subject, attempts: 0, totalScore: 0, totalPercentage: 0 };
    entry.attempts += 1;
    entry.totalScore += Number(attempt.score);
    entry.totalPercentage += Number(attempt.percentage);
    subjectMap.set(attempt.subject, entry);
  });
  const subjectPerformance = [...subjectMap.values()].map((entry) => ({
    subject: entry.subject,
    attempts: entry.attempts,
    averageScore: Number((entry.totalScore / entry.attempts).toFixed(2)),
    averagePercentage: Number((entry.totalPercentage / entry.attempts).toFixed(2))
  }));

  return {
    stats: {
      totalAttempted,
      averageScore,
      bestScore
    },
    attempts: attempts.map((item) => ({
      id: item.id,
      quizId: item.quiz_id,
      quizTitle: item.quiz_title,
      subject: item.subject,
      score: item.score,
      percentage: item.percentage,
      grade: item.grade,
      timeTakenSeconds: item.time_taken_seconds,
      warningCount: item.warning_count,
      submittedAt: item.submit_time
    })),
    subjectPerformance,
    availableQuizzes: listStudentQuizzes(studentId),
    notes: listNotesByStudent(studentId)
  };
}

export function getTeacherDashboard(teacherId) {
  const quizzes = listTeacherQuizzes(teacherId);
  const totalQuizzes = quizzes.length;
  const totalAttempts = quizzes.reduce((sum, quiz) => sum + Number(quiz.attempt_count), 0);
  const publishedCount = quizzes.filter((quiz) => quiz.status === 'published').length;
  return {
    stats: {
      totalQuizzes,
      totalAttempts,
      publishedCount
    },
    quizzes
  };
}
