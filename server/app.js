import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSession,
  destroySession,
  getUserBySession,
  getUserByEmail,
  createUser,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  listQuestionsByQuiz,
  listTeacherQuizzes,
  listStudentQuizzes,
  startAttempt,
  saveAnswer,
  addWarning,
  submitAttempt,
  getResultForAttempt,
  getTeacherQuizAnalytics,
  getStudentDashboard,
  getTeacherDashboard,
  getQuizById,
  getAttemptById,
  getQuizLeaderboard,
  createNote,
  updateNote,
  deleteNote
} from './db/database.js';
import { hashPassword, verifyPassword } from './utils/password.js';
import { badRequest, forbidden, getRequestUrl, notFound, parseCookies, readJsonBody, sendJson, serverError, serveStaticFile, unauthorized } from './utils/http.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `oqep_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'oqep_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

function getAuthUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return getUserBySession(cookies.oqep_session);
}

function requireAuth(req, res, role = null) {
  const user = getAuthUser(req);
  if (!user) {
    unauthorized(res);
    return null;
  }
  if (role && user.role !== role) {
    forbidden(res);
    return null;
  }
  return user;
}

function validateEmail(email) {
  return /.+@.+\..+/.test(email);
}

function parseId(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return Number(parts[parts.length - 1]);
}

async function handleApi(req, res) {
  const url = getRequestUrl(req);
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = getAuthUser(req);
    return sendJson(res, 200, { user: user || null });
  }

  if (req.method === 'POST' && pathname === '/api/auth/signup') {
    const body = await readJsonBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = body.role === 'teacher' ? 'teacher' : 'student';

    if (!name || !email || !password) return badRequest(res, 'Name, email, and password are required.');
    if (!validateEmail(email)) return badRequest(res, 'Enter a valid email address.');
    if (password.length < 6) return badRequest(res, 'Password should be at least 6 characters.');
    if (getUserByEmail(email)) return badRequest(res, 'Email already registered.');

    const user = createUser({ name, email, passwordHash: hashPassword(password), role });
    const token = createSession(user.id);
    setSessionCookie(res, token);
    return sendJson(res, 201, { user });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return badRequest(res, 'Invalid credentials.');
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = createSession(user.id);
    setSessionCookie(res, token);
    return sendJson(res, 200, { user: safeUser });
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = parseCookies(req.headers.cookie || '');
    if (cookies.oqep_session) destroySession(cookies.oqep_session);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  /* ── Student Dashboard ── */

  if (req.method === 'GET' && pathname === '/api/student/dashboard') {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    return sendJson(res, 200, getStudentDashboard(user.id));
  }

  if (req.method === 'POST' && pathname === '/api/student/notes') {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    const body = await readJsonBody(req);
    const content = String(body.content || '').trim();
    if (!content) return badRequest(res, 'Note content is required.');
    const note = createNote({ studentId: user.id, content });
    return sendJson(res, 201, { note });
  }

  if (req.method === 'PUT' && /^\/api\/student\/notes\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    const noteId = parseId(pathname);
    const body = await readJsonBody(req);
    const content = String(body.content || '').trim();
    if (!content) return badRequest(res, 'Note content is required.');
    const note = updateNote(noteId, user.id, content);
    if (!note) return forbidden(res);
    return sendJson(res, 200, { note });
  }

  if (req.method === 'DELETE' && /^\/api\/student\/notes\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    const noteId = parseId(pathname);
    const ok = deleteNote(noteId, user.id);
    if (!ok) return forbidden(res);
    return sendJson(res, 200, { ok: true });
  }

  /* ── Teacher Dashboard ── */

  if (req.method === 'GET' && pathname === '/api/teacher/dashboard') {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    return sendJson(res, 200, getTeacherDashboard(user.id));
  }

  if (req.method === 'GET' && pathname === '/api/quizzes/teacher') {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    return sendJson(res, 200, { quizzes: listTeacherQuizzes(user.id) });
  }

  if (req.method === 'GET' && pathname === '/api/quizzes/student') {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    return sendJson(res, 200, { quizzes: listStudentQuizzes(user.id) });
  }

  /* ── Quiz CRUD ── */

  if (req.method === 'POST' && pathname === '/api/quizzes') {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    const body = await readJsonBody(req);
    if (!body.title || !body.subject || !body.timerMinutes) return badRequest(res, 'Title, subject, and timer are required.');
    const timerMinutes = Number(body.timerMinutes);
    if (!Number.isFinite(timerMinutes) || timerMinutes < 1) return badRequest(res, 'Timer should be at least 1 minute.');
    const quiz = createQuiz({
      teacherId: user.id,
      title: String(body.title).trim(),
      subject: String(body.subject).trim(),
      instructions: String(body.instructions || '').trim(),
      timerMinutes,
      status: body.status || 'draft',
      allowMultiple: body.allowMultiple ? 1 : 0
    });
    return sendJson(res, 201, { quiz });
  }

  if (req.method === 'PUT' && /^\/api\/quizzes\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    const quizId = parseId(pathname);
    const body = await readJsonBody(req);
    const quiz = updateQuiz(quizId, user.id, body);
    if (!quiz) return forbidden(res);
    return sendJson(res, 200, { quiz });
  }

  if (req.method === 'DELETE' && /^\/api\/quizzes\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    const quizId = parseId(pathname);
    const ok = deleteQuiz(quizId, user.id);
    if (!ok) return forbidden(res);
    return sendJson(res, 200, { ok: true });
  }

  /* ── Question CRUD ── */

  if (req.method === 'GET' && /^\/api\/quizzes\/\d+\/questions$/.test(pathname)) {
    const user = requireAuth(req, res);
    if (!user) return;
    const quizId = Number(pathname.split('/')[3]);
    const quiz = getQuizById(quizId);
    if (!quiz) return notFound(res);
    if (user.role === 'teacher' && quiz.teacher_id !== user.id) return forbidden(res);
    if (user.role === 'student' && quiz.status !== 'published') return forbidden(res);
    const questions = listQuestionsByQuiz(quizId);
    const safeQuestions = user.role === 'teacher'
      ? questions
      : questions.map(({ correct_option, ...rest }) => rest);
    return sendJson(res, 200, { quiz, questions: safeQuestions });
  }

  if (req.method === 'POST' && /^\/api\/quizzes\/\d+\/questions$/.test(pathname)) {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    const quizId = Number(pathname.split('/')[3]);
    const body = await readJsonBody(req);

    const questionType = String(body.questionType || 'mcq').trim();
    const payload = {
      questionType,
      explanation: String(body.explanation || '').trim(),
      questionText: String(body.questionText || '').trim(),
      marks: Number(body.marks || 1),
      correctOption: String(body.correctOption || '').trim(),
      optionA: null,
      optionB: null,
      optionC: null,
      optionD: null
    };

    if (!payload.questionText) return badRequest(res, 'Question text is required.');
    if (payload.marks < 1) return badRequest(res, 'Marks must be at least 1.');
    if (!payload.correctOption) return badRequest(res, 'Correct answer is required.');

    if (questionType === 'mcq') {
      payload.optionA = String(body.optionA || '').trim();
      payload.optionB = String(body.optionB || '').trim();
      payload.optionC = String(body.optionC || '').trim();
      payload.optionD = String(body.optionD || '').trim();
      if (!payload.optionA || !payload.optionB) return badRequest(res, 'At least options A and B are required for MCQ.');
      if (!['A', 'B', 'C', 'D'].includes(payload.correctOption)) return badRequest(res, 'Correct option must be A, B, C, or D.');
    } else if (questionType === 'true_false') {
      payload.optionA = 'True';
      payload.optionB = 'False';
      if (!['True', 'False'].includes(payload.correctOption)) return badRequest(res, 'Correct option must be True or False.');
    }

    const question = addQuestion({ quizId, teacherId: user.id, ...payload });
    if (!question) return forbidden(res);
    return sendJson(res, 201, { question });
  }

  if (req.method === 'PUT' && /^\/api\/questions\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    const body = await readJsonBody(req);
    const question = updateQuestion(parseId(pathname), user.id, body);
    if (!question) return forbidden(res);
    return sendJson(res, 200, { question });
  }

  if (req.method === 'DELETE' && /^\/api\/questions\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    const ok = deleteQuestion(parseId(pathname), user.id);
    if (!ok) return forbidden(res);
    return sendJson(res, 200, { ok: true });
  }

  /* ── Attempt Flow ── */

  if (req.method === 'POST' && pathname === '/api/attempts/start') {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    const body = await readJsonBody(req);
    if (!body.quizId) return badRequest(res, 'quizId is required.');
    const bundle = startAttempt({
      quizId: Number(body.quizId),
      studentId: user.id,
      rollNumber: String(body.rollNumber || '').trim(),
      studentName: String(body.studentName || '').trim()
    });
    return sendJson(res, 200, bundle);
  }

  if (req.method === 'POST' && /^\/api\/attempts\/\d+\/answer$/.test(pathname)) {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    const attemptId = Number(pathname.split('/')[3]);
    const body = await readJsonBody(req);
    const result = saveAnswer({
      attemptId,
      studentId: user.id,
      itemId: body.itemId,
      selectedKey: body.selectedKey
    });
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && /^\/api\/attempts\/\d+\/warning$/.test(pathname)) {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    const attemptId = Number(pathname.split('/')[3]);
    const warningCount = addWarning({ attemptId, studentId: user.id });
    return sendJson(res, 200, { warningCount });
  }

  if (req.method === 'POST' && /^\/api\/attempts\/\d+\/submit$/.test(pathname)) {
    const user = requireAuth(req, res, 'student');
    if (!user) return;
    const attemptId = Number(pathname.split('/')[3]);
    const body = await readJsonBody(req);
    const result = submitAttempt({ attemptId, studentId: user.id, remainingTime: Number(body.remainingTime ?? 0) });
    return sendJson(res, 200, { result });
  }

  /* ── Results & Leaderboard ── */

  if (req.method === 'GET' && /^\/api\/results\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res);
    if (!user) return;
    const attemptId = parseId(pathname);
    const result = getResultForAttempt(attemptId, user.id);
    if (!result) return forbidden(res);
    return sendJson(res, 200, { result });
  }

  if (req.method === 'GET' && /^\/api\/leaderboard\/\d+$/.test(pathname)) {
    const user = requireAuth(req, res);
    if (!user) return;
    const quizId = parseId(pathname);
    return sendJson(res, 200, { leaderboard: getQuizLeaderboard(quizId), quiz: getQuizById(quizId) });
  }

  if (req.method === 'GET' && /^\/api\/teacher\/quizzes\/\d+\/analytics$/.test(pathname)) {
    const user = requireAuth(req, res, 'teacher');
    if (!user) return;
    const quizId = Number(pathname.split('/')[4]);
    const analytics = getTeacherQuizAnalytics(quizId, user.id);
    if (!analytics) return forbidden(res);
    return sendJson(res, 200, analytics);
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) return notFound(res);
    const url = getRequestUrl(req);

    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res);
      if (handled === false) {
        return notFound(res);
      }
      return;
    }

    const pageAliases = new Set(['/', '/index.html', '/login.html', '/signup.html', '/student.html', '/teacher.html', '/quiz.html', '/result.html', '/export.html']);
    if (pageAliases.has(url.pathname) || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/assets/')) {
      return serveStaticFile(res, publicDir, url.pathname);
    }

    return notFound(res);
  } catch (error) {
    if (error.message === 'Invalid JSON body') return badRequest(res, error.message);
    if (error.message && /Quiz is not available|attempted only once|has no questions|Attempt not found/.test(error.message)) {
      return badRequest(res, error.message);
    }
    return serverError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`Abhyaas server running at http://localhost:${PORT}`);
});
