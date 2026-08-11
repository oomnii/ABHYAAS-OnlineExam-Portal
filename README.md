# ABHYAAS – Online Quiz & Examination Portal

Abhyaas is a full-stack online examination platform where **teachers** create and publish exams, **students** attempt them live under timed and proctored conditions, and both sides receive detailed analytics dashboards.

## 🌐 Live Demo

[![Open Live Demo](https://img.shields.io/badge/Live_Demo-Open_ABHYAAS-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://abhyaas-online-exam-portal.onrender.com)

> **Note:** The application uses Render’s free tier, so the first load may take around 30–60 seconds after inactivity.

---

## ✨ Features

### Teacher Panel
- **Create Quizzes** with title, subject, timer, instructions, and publish status (draft / published / closed)
- **5 Question Types** — MCQ, True/False, Fill in the Blank, One-word Answer, Numerical
- **Manage Questions** — Add, edit, delete questions per quiz with marks and correct answers
- **Quiz Analytics** — Leaderboard view with ranked student attempts (score, %, grade, time taken, warnings)
- **PDF Export** — Download quiz analytics as a printable report

### Student Panel
- **Browse Available Quizzes** — View published quizzes with subject, question count, and timer info
- **Start Quiz** — Enter Name and Roll Number to begin a timed exam session
- **Live Exam Shell** — Timer, question palette, answer per question (MCQ, text input, numerical)
- **Anti-Cheating Protection** — Tab-switch warnings, fullscreen enforcement, copy/right-click disabled
- **View Results** — Score, percentage, grade, rank, and detailed answer review with correct answers
- **Subject-wise Performance** — Track average scores across subjects
- **Study Notes** — Personal notes CRUD for revision

### System
- Role-based authentication (Teacher / Student)
- Automatic question & option shuffling per attempt for fair exams
- Single-session exam enforcement (no resume)
- Seeded demo data: 3 preset quizzes (DBMS, OS, DSA) with 10 questions each

---

## 🛠 Tech Stack

| Layer       | Technology                    |
|-------------|-------------------------------|
| **Backend** | Node.js (ES Modules)          |
| **Database**| SQLite (via `node:sqlite`)     |
| **Frontend**| Vanilla HTML / CSS / JavaScript|
| **Design**  | Dark glassmorphic theme       |
| **Auth**    | Cookie-based sessions (bcrypt)|

---

## 🚀 Quick Start

### Prerequisites
- **Node.js v22+** (uses experimental `node:sqlite`)

### Install & Run

```bash
git clone https://github.com/<YOUR_REPO>/abhyaas-online-exam-portal.git
cd abhyaas-online-exam-portal
npm install
npm start
```

The server starts at **http://localhost:3000**

### Demo Credentials

| Role    | Email                    | Password      |
|---------|--------------------------|---------------|
| Teacher | `teacher@abhyaas.local`  | `Teacher@123` |
| Student | `student@abhyaas.local`  | `Student@123` |

---

## 📂 Project Structure

```
├── public/                     # Frontend static files
│   ├── assets/                 # Logo and icons
│   ├── css/styles.css          # Global stylesheet (dark glassmorphic theme)
│   ├── js/
│   │   ├── api.js              # Fetch wrapper for API calls
│   │   ├── auth.js             # Login / Signup logic
│   │   ├── common.js           # Shared utilities (escapeHtml, formatDuration, etc.)
│   │   ├── quiz.js             # Live exam session + anti-cheat
│   │   ├── result.js           # Result page rendering
│   │   ├── student.js          # Student dashboard logic
│   │   ├── teacher.js          # Teacher dashboard (Overview/Create/Manage/Analysis)
│   │   └── export.js           # PDF export logic
│   ├── index.html              # Landing page
│   ├── login.html / signup.html
│   ├── student.html / teacher.html
│   ├── quiz.html               # Live exam session page
│   ├── result.html             # Result view page
│   └── export.html             # PDF export view
├── server/
│   ├── app.js                  # HTTP server & all API routes
│   ├── db/
│   │   ├── database.js         # SQLite schema, seed data, all DB operations
│   │   └── data/               # SQLite database file (auto-created at runtime)
│   └── utils/
│       ├── http.js             # HTTP helpers (static file serving, JSON parsing)
│       ├── password.js         # bcrypt hashing & verification
│       └── quiz.js             # Question shuffling & grading logic
├── package.json
├── .gitignore
└── README.md
```

---

## 📋 API Endpoints

### Auth
| Method | Endpoint             | Description              |
|--------|----------------------|--------------------------|
| POST   | `/api/auth/signup`   | Create account           |
| POST   | `/api/auth/login`    | Login                    |
| POST   | `/api/auth/logout`   | Logout                   |
| GET    | `/api/auth/me`       | Get current user         |

### Teacher
| Method | Endpoint                                  | Description             |
|--------|-------------------------------------------|-------------------------|
| GET    | `/api/teacher/dashboard`                  | Dashboard stats + quizzes|
| POST   | `/api/quizzes`                            | Create quiz             |
| PUT    | `/api/quizzes/:id`                        | Update quiz             |
| DELETE | `/api/quizzes/:id`                        | Delete quiz + questions  |
| GET    | `/api/quizzes/:id/questions`              | List questions           |
| POST   | `/api/quizzes/:id/questions`              | Add question             |
| PUT    | `/api/questions/:id`                      | Update question          |
| DELETE | `/api/questions/:id`                      | Delete question          |
| GET    | `/api/teacher/quizzes/:id/analytics`      | Quiz analytics           |

### Student
| Method | Endpoint                           | Description              |
|--------|------------------------------------|--------------------------|
| GET    | `/api/student/dashboard`           | Dashboard + quizzes      |
| GET    | `/api/quizzes/student`             | Available quizzes        |
| POST   | `/api/attempts/start`              | Start new attempt        |
| POST   | `/api/attempts/:id/answer`         | Save answer per question |
| POST   | `/api/attempts/:id/warning`        | Record tab-switch warning|
| POST   | `/api/attempts/:id/submit`         | Submit attempt           |
| GET    | `/api/results/:id`                 | View result + review     |

---

## 🔒 Anti-Cheating Features

1. **Tab-switch detection** — Warning count increments when student switches tabs
2. **Fullscreen enforcement** — Exam requests fullscreen; exiting counts as a warning
3. **Copy/Paste disabled** — Text selection, copy, cut, paste, and right-click are blocked during exams
4. **Single-session enforcement** — No resume; each quiz start creates a fresh attempt

---

## 👤 Author

**OM SETH** — [GitHub](https://github.com/)

---

## 📜 License

MIT
