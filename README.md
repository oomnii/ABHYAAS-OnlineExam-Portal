# Abhyaas — Online Quiz & Examination Portal

A premium, full-stack web application for **online examinations Creation + Attempting**. It connects two roles:

- **Student** — attempt quizzes, resume in-progress exams, view personal results, history, and leaderboard.
- **Teacher** — create quizzes, manage questions, publish/close exams, and inspect ranked student attempts.

The project is built with:

- **Frontend:** Vanilla HTML, CSS (Premium Dark/Glassmorphism theme), JavaScript
- **Backend:** Node.js (dependency-free HTTP server)
- **Database:** SQLite via `node:sqlite` (WAL-mode tracking)

> A modern academic application delivering an engaging, fast, and secure examination workflow with zero external dependencies.

---

## Highlights

- Landing page with about section and role-aware entry points
- Student and Teacher signup/login
- Teacher panel to:
  - create/edit/delete quizzes
  - set title, subject, instructions, timer, and status
  - add/edit/delete questions
  - view quiz-wise analytics and ranked attempt list
- Student panel to:
  - attempt **pre-saved subject quizzes** (DSA, OS, DBMS, CN)
  - attempt **published teacher-created quizzes**
  - view own history and subject-wise performance only
- Result dashboard with:
  - score
  - percentage
  - grade
  - correct / wrong / unanswered count
  - time taken
  - answer review
- Random question + option shuffle per attempt
- Auto-save + resume after refresh
- Tab switch warning tracking saved in database
- Exam-specific leaderboard using ranking rule:
  1. Higher score
  2. Higher percentage
  3. Lower time taken
- Responsive UI with a custom dark/light warm-blue palette

---

## Demo Accounts

These are seeded automatically on first run:

- **Teacher**
  - Email: `teacher@abhyaas.local`
  - Password: `Teacher@123`
- **Student**
  - Email: `student@abhyaas.local`
  - Password: `Student@123`

You can also create your own accounts from the signup page.

---

## Attempt Rules

- **Teacher-created quizzes:** one attempt per student by default
- **Pre-saved subject practice quizzes:** multiple attempts allowed

Quiz visibility:

- `Draft` → visible only to teacher
- `Published` → visible to students
- `Closed` → no new attempts allowed

---

## Run Locally

### Requirements

- Node.js **22+** (recommended, because `node:sqlite` is used)

### Start the project

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

> This project intentionally uses **no third-party npm dependencies**, so `npm install` is effectively optional. `npm start` is enough on Node 22+.

### Development mode

```bash
npm run dev
```

### Run smoke tests

```bash
npm test
```

---

## Project Structure

```text
OQEP/
├── package.json
├── README.md
├── public/
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── student.html
│   ├── teacher.html
│   ├── quiz.html
│   ├── result.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── api.js
│       ├── auth.js
│       ├── common.js
│       ├── quiz.js
│       ├── result.js
│       ├── student.js
│       └── teacher.js
├── server/
│   ├── app.js
│   ├── db/
│   │   └── database.js
│   └── utils/
│       ├── http.js
│       ├── password.js
│       └── quiz.js
└── tests/
    └── smoke.test.js
```

---

## Database Design

Main tables used in SQLite:

- `users`
- `sessions`
- `quizzes`
- `questions`
- `attempts`
- `attempt_items`
- `warnings`

These together handle authentication, quiz creation, attempt state, autosave, answer review, and teacher analytics.

---

## Key Screens

- Landing page
- Login / Signup
- Student dashboard
- Teacher dashboard
- Quiz instruction + attempt page
- Result + leaderboard page

---

## Notes

- Passwords are hashed using Node's built-in crypto utilities.
- Autosave stores current answers, current question index, remaining time, and warning count.
- Tab switching increments the warning count for the active attempt.
- The UI palette blends deep navy, sky blue, ivory, and warm neutral browns for a polished academic look.

---

## Future Upgrade Ideas

- Express migration (if preferred)
- Password reset
- CSV bulk question upload
- Negative marking
- PDF result export
- Deployment with an external database for larger multi-user usage
