import { CliError } from '../lib/errors.js';
import { CANVAS_ORIGIN, validateCanvasPageUrl, parseCanvasAssignments } from '../parsers/canvas.js';

function nextPage(link) {
  if (!link) return null;
  const matches = [...link.matchAll(/<([^>]+)>\s*;\s*rel="([^"]+)"/g)];
  if (!matches.length) throw new CliError('UPSTREAM_FORMAT', 'Canvas pagination header is unsupported.');
  return matches.find(match => match[2].split(/\s+/).includes('next'))?.[1] ?? null;
}

export async function fetchCanvasAssignments(courseId, { token, fetchImpl = fetch, maxPages = 3 } = {}) {
  if (!Number.isSafeInteger(courseId) || courseId < 1 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 3) {
    throw new CliError('INVALID_ARGUMENT', 'Invalid Canvas course ID or page limit.');
  }
  if (!token || typeof token !== 'string' || /\s/.test(token)) {
    throw new CliError('AUTH_REQUIRED', 'Canvas HTTP authentication is not configured.',
      'Use an existing authorized token through the local HKUSTGZ_CANVAS_TOKEN environment variable, or use --snapshot. Do not paste credentials into chat.');
  }
  const initialUrl = `${CANVAS_ORIGIN}/api/v1/courses/${courseId}/assignments?per_page=20&include%5B%5D=submission`;
  let url = initialUrl;
  const assignments = [], visited = new Set();
  let pagesFetched = 0;
  while (url && pagesFetched < maxPages) {
    validateCanvasPageUrl(url, courseId);
    if (visited.has(url)) throw new CliError('UPSTREAM_FORMAT', 'Canvas pagination repeated a page.');
    visited.add(url);
    let response;
    try {
      response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(15000) });
    } catch { throw new CliError('NETWORK_ERROR', 'Canvas request failed or timed out. No automatic retry was made.'); }
    if (response.status === 401) throw new CliError('AUTH_REQUIRED', 'Canvas authentication expired or was rejected.');
    if (response.status === 403) throw new CliError('FORBIDDEN', 'Canvas denied access to this course.');
    if (response.status === 429) throw new CliError('RATE_LIMITED', 'Canvas rate limit reached. Retry later; no automatic retry was made.');
    if (!response.ok) throw new CliError('UPSTREAM_ERROR', 'Canvas returned an unsuccessful response.');
    if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      throw new CliError('UPSTREAM_FORMAT', 'Canvas returned a non-JSON response; check authentication.');
    }
    let values;
    try {
      const reader = response.body.getReader();
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw new Error(); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      values = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { throw new CliError('UPSTREAM_FORMAT', 'Canvas response is not valid bounded JSON.'); }
    parseCanvasAssignments(values, courseId); // Validate before accepting pagination or returning any tasks.
    assignments.push(...values);
    pagesFetched++;
    url = nextPage(response.headers.get('link'));
    if (url) validateCanvasPageUrl(url, courseId); // Never forward credentials to another origin/path.
  }
  // Return only the task whitelist; never retain descriptions, grades, secure_params or user IDs.
  const tasks = parseCanvasAssignments(assignments, courseId);
  return { tasks, sourceUrl: initialUrl, capturedAt: new Date().toISOString(),
    pagination: { pagesFetched, maxPages, complete: url === null } };
}
