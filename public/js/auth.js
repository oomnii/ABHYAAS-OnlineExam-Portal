import { api } from './api.js';
import { getCurrentUser, hideMessage, qs, showMessage } from './common.js';

const loginForm = qs('#login-form');
const signupForm = qs('#signup-form');

(async () => {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = user.role === 'teacher' ? '/teacher.html' : '/student.html';
  }
})();

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = qs('#login-message');
    hideMessage(message);
    const formData = new FormData(loginForm);
    try {
      const payload = Object.fromEntries(formData.entries());
      const { user } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
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
    const formData = new FormData(signupForm);
    try {
      const payload = Object.fromEntries(formData.entries());
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
