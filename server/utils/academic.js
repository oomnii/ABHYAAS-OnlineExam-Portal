/** Curated lists — keep in sync with `public/js/constants.js` for dropdowns. */

export const BRANCH_OPTIONS = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE', 'AIML', 'Data Science', 'MCA', 'Other'];

export const SEMESTER_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const BRANCH_SET = new Set(BRANCH_OPTIONS);

const SEMESTER_SET = new Set(SEMESTER_OPTIONS);

export function isKnownBranch(value) {
  return BRANCH_SET.has(String(value || '').trim());
}

export function isKnownSemester(value) {
  return SEMESTER_SET.has(String(value || '').trim());
}

export function normalizeNullableText(value) {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

/** Quiz targeting: empty / null means "All". */
export function normalizeQuizTarget(value) {
  return normalizeNullableText(value);
}

export function validateStudentRegistrationNo(value) {
  const s = String(value || '').trim();
  if (s.length < 3 || s.length > 40) return 'Registration number must be 3–40 characters.';
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_/]*$/.test(s)) {
    return 'Registration number may contain letters, digits, hyphen, underscore, or slash.';
  }
  return null;
}
