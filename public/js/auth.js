import { api } from './api.js';
import { BRANCH_OPTIONS, SEMESTER_OPTIONS } from './constants.js';
import { getCurrentUser, hideMessage, qs, showMessage } from './common.js';

function getQueryRole() {
  const role = new URLSearchParams(window.location.search).get('role');
  if (role === 'teacher') return 'teacher';
  if (role === 'student') return 'student';
  return null;
}

function redirectToRoleSelect(next) {
  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  window.location.replace(`/role-select.html${q}`);
}

function fillBranchSemesterOptions() {
  const branchSel = qs('#signup-branch');
  const semSel = qs('#signup-semester');
  if (branchSel && !branchSel.dataset.filled) {
    branchSel.innerHTML = `<option value="">Select branch</option>${BRANCH_OPTIONS.map((b) => `<option value="${b}">${b}</option>`).join('')}`;
    branchSel.dataset.filled = '1';
  }
  if (semSel && !semSel.dataset.filled) {
    semSel.innerHTML = `<option value="">Select semester</option>${SEMESTER_OPTIONS.map((s) => `<option value="${s}">Semester ${s}</option>`).join('')}`;
    semSel.dataset.filled = '1';
  }
}

function setSignupMode(role) {
  const subtitle = qs('#signup-role-line');
  const studentBlock = qs('#student-profile-fields');
  const roleInput = qs('#signup-role-input');
  const loginLink = qs('#signup-login-link');
  if (roleInput) roleInput.value = role;
  if (subtitle) {
    subtitle.textContent = role === 'teacher' ? 'Teacher account (no branch or semester required)' : 'Student account — branch, semester, and registration number are required';
  }
  if (studentBlock) {
    studentBlock.classList.toggle('hide', role !== 'student');
    studentBlock.querySelectorAll('input, select').forEach((el) => {
      el.disabled = role !== 'student';
    });
  }
  if (loginLink) {
    loginLink.href = role ? `/login.html?role=${encodeURIComponent(role)}` : '/login.html';
  }
  const topLogin = qs('#signup-login-top');
  if (topLogin) {
    topLogin.href = role ? `/login.html?role=${encodeURIComponent(role)}` : '/login.html';
  }
}

(async () => {
  const path = window.location.pathname;
  if (path.endsWith('/signup.html')) {
    const role = getQueryRole();
    if (!role) {
      redirectToRoleSelect('signup');
      return;
    }
    fillBranchSemesterOptions();
    setSignupMode(role);
  }
  if (path.endsWith('/login.html')) {
    const role = getQueryRole();
    const href = role ? `/signup.html?role=${encodeURIComponent(role)}` : '/signup.html';
    const loginLink = qs('#login-signup-link');
    const topSignup = qs('#login-signup-top');
    if (loginLink) loginLink.href = href;
    if (topSignup) topSignup.href = href;
  }

  const user = await getCurrentUser();
  if (user) {
    window.location.href = user.role === 'teacher' ? '/teacher.html' : '/student.html';
  }
})();

const loginForm = qs('#login-form');
const signupForm = qs('#signup-form');

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = qs('#login-message');
    hideMessage(message);
    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());
    const expectedRole = getQueryRole();
    try {
      const { user } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (expectedRole && user.role !== expectedRole) {
        showMessage(
          message,
          `This account is a ${user.role}. Open the ${user.role} login link from the role page, or create a separate account.`,
          'error'
        );
        return;
      }
      showMessage(message, 'Login successful. Redirecting...', 'success');
      window.location.href = user.role === 'teacher' ? '/teacher.html' : '/student.html';
    } catch (error) {
      showMessage(message, error.message, 'error');
    }
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = qs('#signup-message');
    hideMessage(message);
    const role = getQueryRole();
    if (!role) {
      redirectToRoleSelect('signup');
      return;
    }
    const formData = new FormData(signupForm);
    const payload = Object.fromEntries(formData.entries());
    payload.role = role;

    if (role === 'student') {
      const branch = String(payload.branch || '').trim();
      const semester = String(payload.semester || '').trim();
      const registrationNo = String(payload.registrationNo || '').trim();
      if (!branch || !BRANCH_OPTIONS.includes(branch)) {
        showMessage(message, 'Please select your branch.', 'error');
        return;
      }
      if (!semester || !SEMESTER_OPTIONS.includes(semester)) {
        showMessage(message, 'Please select your semester.', 'error');
        return;
      }
      if (registrationNo.length < 3) {
        showMessage(message, 'Registration number must be at least 3 characters.', 'error');
        return;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9\-_/]*$/.test(registrationNo)) {
        showMessage(message, 'Registration number has invalid characters.', 'error');
        return;
      }
      payload.registrationNo = registrationNo;
    } else {
      delete payload.branch;
      delete payload.semester;
      delete payload.registrationNo;
    }

    try {
      const { user } = await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showMessage(message, 'Account created successfully. Redirecting...', 'success');
      window.location.href = user.role === 'teacher' ? '/teacher.html' : '/student.html';
    } catch (error) {
      showMessage(message, error.message, 'error');
    }
  });
}
