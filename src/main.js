import { parseArgs } from 'node:util';
import { CliError, failure } from './lib/errors.js';
import { loadIndex, searchIndex } from './lib/index.js';
import { listSnapshotCourses } from './modules/course.js';
import { listCanvasDeadlines } from './modules/lms.js';
import { queryAcademicIndex } from './modules/academic.js';
import { readGradeSnapshot } from './modules/grade.js';
import { dailyAgenda,dailyStatus } from './modules/daily.js';
import { setup } from './modules/setup.js';
import { dailyPlan } from './modules/plan.js';
import { explainCourse } from './modules/course-explain.js';

const usage = message => { throw new CliError('INVALID_ARGUMENT', message, 'Run: node src/cli.js help'); };
const commands = {
  'service search': { args: 'query', options: { limit: { type: 'string' } } },
  'service show': { args: 'id' },
  'document search': { args: 'query', options: { limit: { type: 'string' } } },
  'document show': { args: 'id' },
  'catalog search': { args: 'query', options: { term: { type: 'string' }, limit: { type: 'string' } } },
  'catalog show': { args: 'id', options: { term: { type: 'string' } } },
  'program list': { options: { intake: { type: 'string' }, search: { type: 'string' }, limit: { type: 'string' } } },
  'program show': { args: 'id', options: { intake: { type: 'string' } } },
  'grade list': { options: { source: { type: 'string' }, snapshot: { type: 'string' } } },
  'grade summary': { options: { source: { type: 'string' }, snapshot: { type: 'string' } } },
  doctor: { options: { offline: { type: 'boolean' } } },
  'course list': { options: { source: { type: 'string' }, snapshot: { type: 'string' }, day: { type: 'string' } } },
  'course explain': {args:'query',options:{term:{type:'string'}}},
  'auth status': {},
  setup: {},
  'daily status': {},
  'daily plan': { options: { days: {type:'string'}, minutes: {type:'string'}, window: {type:'string'} } },
  'daily agenda': { options: { date: { type:'string' }, days: { type:'string' }, 'max-age-minutes': { type:'string' }, 'allow-stale': { type:'boolean' } } },
  'lms deadlines': { options: { source: { type: 'string' }, course: { type: 'string' }, snapshot: { type: 'string' },
    type: { type: 'string' }, upcoming: { type: 'boolean' }, unsubmitted: { type: 'boolean' } } },
  help: {}
};

export async function run(argv) {
  let command = null;
  try {
    const tokens = [...argv];
    command = tokens.shift() ?? 'help';
    if (['service', 'document', 'course', 'auth', 'lms', 'catalog', 'program', 'grade', 'daily'].includes(command)) command += ` ${tokens.shift() ?? ''}`;
    if (command === '--help' || command === '-h') command = 'help';
    const spec = commands[command];
    if (!spec) usage('Unknown command.');
    let parsed;
    try {
      parsed = parseArgs({ args: tokens, options: { json: { type: 'boolean' }, ...spec.options }, allowPositionals: true, strict: true });
    } catch { usage('Unknown option or missing option value.'); }
    const { values: options, positionals } = parsed;
    if (spec.args === 'query' ? positionals.length < 1 : positionals.length !== (spec.args ? 1 : 0)) usage('Incorrect number of arguments.');
    let data;
    if (command === 'help') {
      data = { commands: Object.entries(commands).map(([name, value]) => ({ command: name, argument: value.args ?? null, options: Object.keys(value.options ?? {}) })),
        output: 'Always JSON; --json is accepted for agent compatibility.',
        limitations: 'Browser-assisted daily refresh through the installed AI skill; curated indexes have limited coverage. Check setup, freshness, source year/term and coverage. No standalone unattended browser login.' };
    } else if (command==='setup') {
      data=await setup();
    } else if (command==='daily status') {
      data=await dailyStatus();
    } else if (command==='daily plan') {
      for(const key of ['days','minutes'])if(options[key]!==undefined&&!/^\d+$/.test(options[key]))usage(`--${key} must be a positive integer.`);
      data=await dailyPlan({days:Number(options.days??14),minutes:Number(options.minutes??90),window:options.window??'19:00-21:00'});
    } else if (command==='daily agenda') {
      for(const key of ['days','max-age-minutes'])if(options[key]!==undefined&&!/^\d+$/.test(options[key]))usage(`--${key} must be a positive integer.`);
      data=await dailyAgenda({date:options.date,days:Number(options.days??14),maxAgeMinutes:Number(options['max-age-minutes']??60),allowStale:options['allow-stale']===true});
    } else if (command.startsWith('catalog ') || command.startsWith('program ')) {
      const [kind, action] = command.split(' ');
      data = await queryAcademicIndex(kind, action, positionals, options);
    } else if (command.startsWith('grade ')) {
      if (options.source !== 'sisn') usage('Grade queries require --source sisn.');
      if (!options.snapshot) throw new CliError('NOT_IMPLEMENTED', 'SISN HTTP grade client is not connected.', 'Use --snapshot <private-file.json> from My Academics > My Term Information.');
      data = await readGradeSnapshot(options.snapshot, command.split(' ')[1]);
    } else if (command === 'auth status') {
      data = { mode: 'offline-capabilities', authenticated: null, sessionChecked: false,
        systems: ['portal', 'sisn', 'klms', 'canvas'].map(system => ({ system,
          adapter: system === 'canvas' ? 'read-only-assignment-query' : 'not-implemented',
          ...(system === 'canvas' ? { queryAdapter: 'assignment-http-api-or-snapshot', credentialConfigured: Boolean(process.env.HKUSTGZ_CANVAS_TOKEN) } : {}),
          ...(system === 'sisn' ? { snapshotAdapter: 'browser-dom-snapshot' } : {}), session: 'unknown' })) };
    } else if (command === 'lms deadlines') {
      if (options.source !== 'canvas') usage('lms deadlines currently requires --source canvas.');
      if (!/^[1-9]\d*$/.test(options.course ?? '') || !Number.isSafeInteger(Number(options.course))) usage('--course must be a positive integer Canvas course ID.');
      if (options.type !== undefined && !['assignment', 'quiz', 'external-tool', 'discussion'].includes(options.type)) usage('--type must be assignment|quiz|external-tool|discussion.');
      if (options.snapshot !== undefined && !options.snapshot.trim()) usage('--snapshot requires a nonempty private file path.');
      data = await listCanvasDeadlines(options);
    } else if (command === 'course explain') {
      data=await explainCourse(positionals.join(' ').trim(),options);
    } else if (command === 'course list') {
      if (!['sisn', 'klms'].includes(options.source)) usage('course list requires --source sisn|klms.');
      if (options.day !== undefined && !/^[1-7]$/.test(options.day)) usage('--day must be 1 (Monday) through 7 (Sunday).');
      if (!options.snapshot) {
        throw new CliError('NOT_IMPLEMENTED', `${options.source} HTTP course adapter is not connected.`,
          'For a Browser-read SISN calendar, use --source sisn --snapshot <private-file.json>. See docs/BROWSER_COURSES.md.');
      }
      if (options.source !== 'sisn') usage('--snapshot currently supports only --source sisn.');
      data = await listSnapshotCourses(options.snapshot, options.day);
    } else if (command === 'doctor') {
      if (options.offline !== true) usage('Only doctor --offline is available in this version.');
      const indexes = await Promise.all(['service', 'document', 'catalog', 'program'].map(async kind => {
        const index = await loadIndex(kind);
        if (kind==='program') await queryAcademicIndex('program','list',[],{intake:index.intakes?.[0]??index.intake,limit:'1'});
        return { kind, records: index.records.length, verifiedAt: index.verifiedAt };
      }));
      data = { offline: true, node: process.versions.node, nodeSupported: Number(process.versions.node.split('.')[0]) >= 20,
        indexes, networkChecked: false, browserChecked: false, sessionChecked: false };
    } else {
      const [kind, action] = command.split(' ');
      const index = await loadIndex(kind);
      if (action === 'show') {
        data = index.records.find(record => record.id === positionals[0]);
        if (!data) throw new CliError('NOT_FOUND', 'No indexed record has this ID.');
        data = { ...data, retrieval: 'local-curated-index', liveChecked: false };
      } else {
        const limit = options.limit === undefined ? 10 : Number(options.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (options.limit !== undefined && !/^\d+$/.test(options.limit))) usage('--limit must be an integer from 1 to 50.');
        const query = positionals.join(' ').trim();
        const results = searchIndex(index.records, query, limit);
        data = { query, results, retrieval: 'local-curated-index', liveChecked: false,
          coverage: index.coverage, verifiedAt: index.verifiedAt,
          ...(results.length === 0 ? { message: '未在当前索引中找到；不表示学校没有这项服务或文件。' } : {}) };
      }
    }
    return { exitCode: 0, payload: { ok: true, command, data } };
  } catch (error) { return failure(command, error); }
}
