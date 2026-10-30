// Use only on a browser tab visibly displaying the documented assignments JSON endpoint.
// Whitelist before returning anything to the caller; never export the raw JSON page.
export function readCanvasAssignments() {
  let values;
  try { values = JSON.parse(document.body.innerText); }
  catch { throw new Error('Canvas page is not assignments JSON.'); }
  if (!Array.isArray(values) || values.length > 100) throw new Error('Canvas assignment page shape is unsupported.');
  return values.map(value => ({
    id: value.id, course_id: value.course_id, name: value.name,
    due_at: value.due_at, unlock_at: value.unlock_at, lock_at: value.lock_at,
    html_url: value.html_url, submission_types: value.submission_types,
    is_quiz_assignment: value.is_quiz_assignment, locked_for_user: value.locked_for_user,
    ...(value.submission ? { submission: {
      workflow_state: value.submission.workflow_state, submitted_at: value.submission.submitted_at
    } } : {})
  }));
}
