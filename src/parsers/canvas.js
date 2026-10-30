import { CliError } from '../lib/errors.js';

export const CANVAS_ORIGIN = 'https://hkust-gz.instructure.com';
const invalid = () => { throw new CliError('UPSTREAM_FORMAT', 'Canvas assignment data has an unsupported shape.', 'Refresh the source and inspect only sanitized fields; raw responses are not echoed.'); };
const positiveId = value => Number.isSafeInteger(value) && value > 0;

export function canvasDate(value) {
  if (value === null) return null;
  if (typeof value !== 'string') invalid();
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || Number.isNaN(Date.parse(value)) ||
      new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1]) invalid();
  return new Date(value).toISOString();
}

export function validateCanvasPageUrl(value, courseId) {
  let url;
  try { url = new URL(value); } catch { invalid(); }
  if (url.origin !== CANVAS_ORIGIN || url.username || url.password || url.hash ||
      url.pathname !== `/api/v1/courses/${courseId}/assignments`) invalid();
  for (const [key, item] of url.searchParams) {
    if ((key === 'include[]' && item === 'submission') ||
        (key === 'per_page' && /^(?:[1-9]|[1-9]\d|100)$/.test(item)) ||
        (key === 'page' && /^[1-9]\d{0,5}$/.test(item))) continue;
    invalid();
  }
  return url;
}

export function parseCanvasAssignments(values, courseId) {
  if (!positiveId(courseId) || !Array.isArray(values) || values.length > 300) invalid();
  const seen = new Set();
  return values.map(value => {
    if (!value || !positiveId(value.id) || seen.has(value.id) || value.course_id !== courseId ||
        typeof value.name !== 'string' || !value.name.trim() || value.name.length > 1000 ||
        !Array.isArray(value.submission_types) || !value.submission_types.every(type => typeof type === 'string') ||
        typeof value.is_quiz_assignment !== 'boolean' || typeof value.locked_for_user !== 'boolean') invalid();
    seen.add(value.id);
    let url;
    try { url = new URL(value.html_url); } catch { invalid(); }
    if (url.origin !== CANVAS_ORIGIN || url.username || url.password || url.search || url.hash ||
        !new RegExp(`^/courses/${courseId}/(?:assignments|quizzes)/[1-9]\\d*$`).test(url.pathname)) invalid();
    const types = value.submission_types;
    const type = value.is_quiz_assignment || types.includes('online_quiz') ? 'quiz' :
      types.includes('external_tool') ? 'external-tool' : types.includes('discussion_topic') ? 'discussion' : 'assignment';
    const workflow = value.submission?.workflow_state;
    const submissionState = ['unsubmitted', 'submitted', 'graded', 'pending_review'].includes(workflow) ? workflow : 'unknown';
    return { source: 'canvas', courseId, id: value.id, title: value.name.trim(), type, url: url.href,
      submissionTypes:[...types],submissionStateScope:'canvas-record-only',
      reminderOnly:/only serves as a reminder/i.test(value.name),
      dueAt: canvasDate(value.due_at), unlockAt: canvasDate(value.unlock_at), lockAt: canvasDate(value.lock_at),
      lockedForUser: value.locked_for_user, submissionState,
      submittedAt: value.submission?.submitted_at == null ? null : canvasDate(value.submission.submitted_at) };
  });
}
