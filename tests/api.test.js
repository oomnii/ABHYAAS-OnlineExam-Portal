import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 3211;
const dbPath = path.join(projectRoot, 'tests', 'tmp-api.sqlite');
const base = `http://localhost:${port}`;

let serverProcess;

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await delay(200);
  }
  throw new Error('Server did not start in time');
}

async function request(pathname, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {}
  return {
    status: response.status,
    payload,
    cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie || ''
  };
}

function cleanupDb() {
  const bases = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  for (const f of bases) {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

test.before(async () => {
  cleanupDb();
  serverProcess = spawn(process.execPath, ['server/app.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), OQEP_DB_PATH: dbPath },
    stdio: 'ignore'
  });
  await waitForServer();
});

test.after(async () => {
  if (serverProcess) {
    serverProcess.kill();
    await delay(500); // Give process time to release file locks on Windows
  }
  cleanupDb();
});

test('API tests (Auth, Quiz CRUD, Attempts, Leaderboard, Negative cases)', async (t) => {
  let teacherCookie = '';
  let studentCookie = '';
  let quizId = null;
  let questionId = null;
  let attemptId = null;
  let itemId = null;
  let correctKey = null;
  
  await t.test('Auth: Reject invalid signup', async () => {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Test', email: 'invalid', password: '123' }
    });
    assert.equal(res.status, 400);
  });

  await t.test('Auth: Success teacher & student sign in/login', async () => {
    // Already seeded from database.js: teacher@abhyaas.local / Teacher@123
    const tLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'teacher@abhyaas.local', password: 'Teacher@123' }
    });
    assert.equal(tLogin.status, 200);
    assert.equal(tLogin.payload.user.role, 'teacher');
    teacherCookie = tLogin.cookie;

    const sLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'student@abhyaas.local', password: 'Student@123' }
    });
    assert.equal(sLogin.status, 200);
    assert.equal(sLogin.payload.user.role, 'student');
    studentCookie = sLogin.cookie;
  });

  await t.test('Auth: Unauthorized access checks', async () => {
    // unauthenticated to teacher dashboard
    const noAuth = await request('/api/teacher/dashboard');
    assert.equal(noAuth.status, 401);
    
    // student trying to access teacher dashboard
    const badRole = await request('/api/teacher/dashboard', { cookie: studentCookie });
    assert.equal(badRole.status, 403);
  });

  await t.test('Quiz CRUD: Teacher creates a quiz', async () => {
    const res = await request('/api/quizzes', {
      method: 'POST',
      cookie: teacherCookie,
      body: { title: 'Test Quiz', subject: 'Integration', timerMinutes: 10, status: 'draft', allowMultiple: false }
    });
    assert.equal(res.status, 201);
    quizId = res.payload.quiz.id;
  });

  await t.test('Quiz CRUD: Unauthorized edit attempts', async () => {
    // student tries to edit quiz
    const res = await request(`/api/quizzes/${quizId}`, {
      method: 'PUT',
      cookie: studentCookie,
      body: { title: 'Hacked Quiz' }
    });
    assert.equal(res.status, 403); // because requires 'teacher' role
  });

  await t.test('Question CRUD: Teacher adds and updates a question', async () => {
    const addRes = await request(`/api/quizzes/${quizId}/questions`, {
      method: 'POST',
      cookie: teacherCookie,
      body: { questionText: 'Q1', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctOption: 'A', marks: 5 }
    });
    assert.equal(addRes.status, 201);
    questionId = addRes.payload.question.id;
    
    const updateRes = await request(`/api/questions/${questionId}`, {
      method: 'PUT',
      cookie: teacherCookie,
      body: { marks: 10 }
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.payload.question.marks, 10);
  });

  await t.test('Quiz flow: Publish quiz', async () => {
    const res = await request(`/api/quizzes/${quizId}`, {
      method: 'PUT',
      cookie: teacherCookie,
      body: { status: 'published' }
    });
    assert.equal(res.status, 200);
  });

  await t.test('Student: Can see published quiz', async () => {
    const res = await request('/api/student/dashboard', { cookie: studentCookie });
    assert.equal(res.status, 200);
    const quiz = res.payload.availableQuizzes.find(q => q.id === quizId);
    assert.ok(quiz);
  });

  await t.test('Attempt flow: Start attempt', async () => {
    const res = await request('/api/attempts/start', {
      method: 'POST',
      cookie: studentCookie,
      body: { quizId }
    });
    assert.equal(res.status, 200);
    attemptId = res.payload.attempt.id;
    itemId = res.payload.questions[0].id;
    correctKey = res.payload.questions[0].options.find(o => o.text === 'A').key;
    assert.equal(res.payload.questions.length, 1);
  });

  await t.test('Attempt flow: Autosave with warning tracking', async () => {
    const saveRes = await request(`/api/attempts/${attemptId}/save`, {
      method: 'POST',
      cookie: studentCookie,
      body: {
        remainingTime: 500,
        currentIndex: 0,
        answers: { [itemId]: correctKey }
      }
    });
    assert.equal(saveRes.status, 200);

    const warnRes = await request(`/api/attempts/${attemptId}/warning`, {
      method: 'POST',
      cookie: studentCookie
    });
    assert.equal(warnRes.status, 200);
    assert.equal(warnRes.payload.warningCount, 1);
  });

  await t.test('Attempt flow: Fetch active attempt / resume', async () => {
    const res = await request(`/api/attempts/${attemptId}`, { cookie: studentCookie });
    assert.equal(res.status, 200);
    assert.equal(res.payload.attempt.warningCount, 1);
  });

  await t.test('Attempt flow: Submit attempt', async () => {
    const res = await request(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      cookie: studentCookie,
      body: { remainingTime: 490 }
    });
    assert.equal(res.status, 200);
    assert.equal(typeof res.payload.result.attempt.score, 'number');
  });

  await t.test('Attempt flow: Cannot attempt single-attempt quiz again', async () => {
    const res = await request('/api/attempts/start', {
      method: 'POST',
      cookie: studentCookie,
      body: { quizId }
    });
    assert.equal(res.status, 400); // Bad request: already attempted
  });

  await t.test('Analytics: Result & Leaderboard visibility for teacher', async () => {
    const res = await request(`/api/teacher/quizzes/${quizId}/analytics`, { cookie: teacherCookie });
    assert.equal(res.status, 200);
    assert.equal(res.payload.summary.attemptCount, 1);
    assert.equal(typeof res.payload.summary.averageScore, 'number');
    assert.equal(res.payload.leaderboard.length, 1);
  });
});
