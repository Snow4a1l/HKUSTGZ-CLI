import { CliError } from '../lib/errors.js';
import { readSnapshot } from '../lib/snapshot.js';
import { fetchCanvasAssignments } from '../clients/canvas.js';
import { canvasDate, parseCanvasAssignments, validateCanvasPageUrl } from '../parsers/canvas.js';

export async function listCanvasDeadlines(options) {
  const courseId = Number(options.course);
  let result;
  const snapshotMode = options.snapshot !== undefined;
  if (snapshotMode) {
    const snapshot = await readSnapshot(options.snapshot);
    try {
      if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.source !== 'canvas' || snapshot.kind !== 'assignments-api' ||
          snapshot.courseId !== courseId || !snapshot.pagination ||
          !Number.isInteger(snapshot.pagination.page) || snapshot.pagination.page < 1 ||
          !Number.isInteger(snapshot.pagination.perPage) || snapshot.pagination.perPage < 1 || snapshot.pagination.perPage > 100 ||
          snapshot.pagination.complete !== false) throw new Error();
      const capturedAt = canvasDate(snapshot.capturedAt);
      if (!capturedAt || Date.parse(capturedAt) > Date.now() + 300000) throw new Error();
      validateCanvasPageUrl(snapshot.sourceUrl, courseId);
      if (!Array.isArray(snapshot.assignments) || snapshot.assignments.length > snapshot.pagination.perPage) throw new Error();
      result = { tasks: parseCanvasAssignments(snapshot.assignments, courseId), sourceUrl: snapshot.sourceUrl,
        capturedAt, pagination: snapshot.pagination };
    } catch { throw new CliError('SNAPSHOT_INVALID', 'Canvas snapshot metadata or assignments are invalid.', 'Use a sanitized assignments-api snapshot; pagination completeness from Browser is unverified.'); }
  } else {
    result = await fetchCanvasAssignments(courseId, { token: process.env.HKUSTGZ_CANVAS_TOKEN });
  }
  const all = result.tasks;
  const now = Date.now();
  const tasks = all.filter(task => (!options.type || task.type === options.type) &&
    (!options.upcoming || (task.dueAt !== null && Date.parse(task.dueAt) >= now)) &&
    (!options.unsubmitted || task.submissionState === 'unsubmitted'))
    .sort((a, b) => (a.dueAt === null) - (b.dueAt === null) || (a.dueAt ?? '').localeCompare(b.dueAt ?? '') || a.id - b.id)
    .map(task => ({ ...task, dueAtLocal: task.dueAt === null ? null :
      new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(task.dueAt)) }));
  return { source: 'canvas', courseId, sourceUrl: result.sourceUrl, capturedAt: result.capturedAt,
    ageSeconds: Math.max(0, Math.floor((now - Date.parse(result.capturedAt)) / 1000)), timezone: 'Asia/Shanghai',
    retrieval: snapshotMode ? 'browser-api-snapshot' : 'canvas-http-api', liveChecked: !snapshotMode,
    ...(snapshotMode ? { snapshotProvenance: 'caller-supplied' } : {}),
    pagination: result.pagination, scope: 'one-course-captured-assignment-pages',
    filters: { type: options.type ?? null, upcoming: options.upcoming === true, unsubmitted: options.unsubmitted === true },
    totalCaptured: all.length, undatedCount: all.filter(task => task.dueAt === null).length,
    unknownSubmissionCount: all.filter(task => task.submissionState === 'unknown').length, tasks,
    warnings: [
      ...(!result.pagination.complete ? ['Pagination is incomplete or unverified; results are not the complete course or account task list.'] : []),
      ...(snapshotMode ? ['This command parses a supplied capture and does not refresh Canvas or check the current login.'] : []),
      ...(options.unsubmitted && all.some(task => task.submissionState === 'unknown') ? ['Tasks with unknown personal submission state are excluded by --unsubmitted.'] : []),
      'Due, unlock and lock times are separate fields. No quiz attempt was started or submitted.'
    ] };
}
