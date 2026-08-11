# ABHYAAS – Online Quiz & Examination Portal

Abhyaas is a full-stack online examination portal where **teachers** create and publish exams (optionally targeted by branch/semester), **students** attempt them in a timed session with anti-cheat warnings, and both sides get results, review, and analytics.

## Live demo

[![Open Live Demo](https://img.shields.io/badge/Live_Demo-Open_ABHYAAS-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://abhyaas-online-exam-portal.onrender.com)

**Live app:** [https://abhyaas-online-exam-portal.onrender.com](https://abhyaas-online-exam-portal.onrender.com)

**Repository:** [https://github.com/oomnii/ABHYAAS-OnlineExam-Portal](https://github.com/oomnii/ABHYAAS-OnlineExam-Portal)

> Render free tier may take about 30–60 seconds to wake after inactivity.

---

## Features

### Academic targeting
- **Student profile** — branch, semester, and registration number required at student signup
- **Quiz audience** — teachers can set target branch and/or semester, or leave as **All**
- **Visibility rules** — students only see and start published quizzes that match their profile (or All)
- Shared branch/semester lists in `public/js/constants.js` and `server/utils/academic.js`

Supported branches: CSE, IT, ECE, ME, CE, EE, AIML, Data Science, MCA, Other  
Semesters: 1–8

### Teacher panel
- Create/update/delete quizzes (title, subject, timer, instructions, status: draft / published / closed)
- Target branch and target semester selectors on the quiz form
- Five question types: MCQ, True/False, Fill in the Blank, One-word, Numerical
- Manage questions (add, edit, delete) with marks and correct answers
- Dashboard stats and per-quiz analytics (leaderboard, averages, warnings)
- Printable analytics report via browser print (`export.html` → Print to PDF)

### Student panel
- Role-first entry via `role-select.html`, then login or signup
- Browse available quizzes filtered by branch/semester targeting
- Start quiz with name and roll number; timed exam shell with question palette
- Anti-cheat: tab-switch warnings, fullscreen exit warnings, copy/cut/paste/right-click blocked in the exam UI
- Results: score, percentage, grade, rank, answer review
- Subject-wise performance and personal study notes (CRUD)

### System
- Role-based auth (teacher / student) with HttpOnly cookie sessions
- Password hashing with Node.js `crypto.scryptSync` (salted; timing-safe verify)
- Question and MCQ option shuffling per attempt; attempt paper snapshotted in `attempt_items`
- Single-session attempts (no resume); one attempt per quiz unless `allow_multiple` is set via API
- Light SQLite column migrations for academic fields on existing DBs
- Seeded demo data when the database has no users: demo teacher, demo student (CSE / semester 5), and three published quizzes (DSA, OS, DBMS) with 10 questions each (targets = All)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js (ES Modules), native `node:http` |
| Database | SQLite via Node built-in `node:sqlite` |
| Frontend | Vanilla HTML / CSS / JavaScript (ES modules) |
| Auth | Cookie session (`oqep_session`) + scrypt password hashes |
| Dependencies | None (no npm runtime packages) |

---

## Quick start

### Prerequisites
- **Node.js v22+** (uses `node:sqlite`)

### Install & run

```bash
git clone https://github.com/oomnii/ABHYAAS-OnlineExam-Portal.git
cd ABHYAAS-OnlineExam-Portal
npm start
```

For auto-restart during development:

```bash
npm run dev
```

Server listens on **http://localhost:3000** (or `PORT` if set).

Optional environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | HTTP port | `3000` |
| `OQEP_DB_PATH` | Full path to SQLite file | `server/db/data/oqep.sqlite` |

### Demo credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Teacher | `teacher@abhyaas.local` | `Teacher@123` | No branch/semester |
| Student | `student@abhyaas.local` | `Student@123` | Branch **CSE**, semester **5**, reg **DEMO2025001** |

---

## Project structure

```
├── public/
│   ├── assets/logo.png
│   ├── css/styles.css
│   ├── js/
│   │   ├── api.js           # fetch wrapper (credentials: include)
│   │   ├── auth.js          # login / signup + role query handling
│   │   ├── common.js        # shared UI helpers
│   │   ├── constants.js     # branch / semester dropdown lists
│   │   ├── quiz.js          # live exam + anti-cheat
│   │   ├── result.js
│   │   ├── student.js
│   │   ├── teacher.js
│   │   └── export.js        # printable analytics (window.print)
│   ├── index.html
│   ├── role-select.html     # choose Student or Teacher
│   ├── login.html / signup.html
│   ├── student.html / teacher.html
│   ├── quiz.html / result.html / export.html
├── server/
│   ├── app.js               # HTTP server + API routes
│   ├── db/
│   │   ├── database.js      # schema, migrations, seed, DB operations
│   │   └── data/            # SQLite file (created at runtime; gitignored)
│   └── utils/
│       ├── academic.js      # branch/semester validation helpers
│       ├── http.js          # cookies, JSON, static files, status helpers
│       ├── password.js      # scrypt hash / verify
│       └── quiz.js          # shuffle, grading helpers, leaderboard sort
├── scripts/
│   └── e2e-smoke.ps1    # Local end-to-end API smoke tests (PowerShell)
├── package.json
├── .gitignore
└── README.md
```

---

## API endpoints

### System & auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/auth/me` | Current user (or `null`) |
| POST | `/api/auth/signup` | Create account (students must send branch, semester, registrationNo) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |

### Teacher
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teacher/dashboard` | Stats + quizzes |
| GET | `/api/quizzes/teacher` | Teacher quiz list |
| POST | `/api/quizzes` | Create quiz (supports `targetBranch`, `targetSemester`, `allowMultiple`) |
| PUT | `/api/quizzes/:id` | Update quiz |
| DELETE | `/api/quizzes/:id` | Delete quiz |
| GET | `/api/quizzes/:id/questions` | List questions |
| POST | `/api/quizzes/:id/questions` | Add question |
| PUT | `/api/questions/:id` | Update question |
| DELETE | `/api/questions/:id` | Delete question |
| GET | `/api/teacher/quizzes/:id/analytics` | Quiz analytics |

### Student & attempts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student/dashboard` | Stats, filtered quizzes, history, notes |
| GET | `/api/quizzes/student` | Available published quizzes (branch/semester filtered) |
| POST | `/api/student/notes` | Create note |
| PUT | `/api/student/notes/:id` | Update note |
| DELETE | `/api/student/notes/:id` | Delete note |
| POST | `/api/attempts/start` | Start attempt |
| POST | `/api/attempts/:id/answer` | Save answer |
| POST | `/api/attempts/:id/warning` | Record warning |
| POST | `/api/attempts/:id/submit` | Submit and grade |
| GET | `/api/results/:id` | Result + review (+ embedded leaderboard) |
| GET | `/api/leaderboard/:id` | Leaderboard for a quiz (API available; UI mainly uses embedded leaderboard in results/analytics) |

---

## Anti-cheating (implemented)

1. Tab hidden (`visibilitychange`) → warning API increment  
2. Leaving fullscreen → warning + re-request fullscreen  
3. Copy / cut / paste / context menu blocked while the exam is running  
4. No resume of an in-progress attempt from a dedicated resume API  

These are browser-side deterrents plus server-stored warning counts, not webcam/proctoring.

---

## Author

**OM SETH** — [GitHub](https://github.com/oomnii)

---

## License

MIT
