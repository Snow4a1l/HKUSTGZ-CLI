import { loadIndex, searchIndex } from '../lib/index.js';
import { CliError } from '../lib/errors.js';
import { readFile } from 'node:fs/promises';

export async function queryAcademicIndex(kind, action, positionals, options) {
  const index = await loadIndex(kind);
  const scopeKey = kind === 'program' ? 'intake' : 'term';
  const scope = options[scopeKey];
  if (!scope || (scopeKey === 'intake' ? !/^\d{4}-\d{2}$/.test(scope) : !/^\d{4}-\d{2} (Fall|Winter|Spring|Summer)$/.test(scope))) {
    throw new CliError('INVALID_ARGUMENT', `Specify --${scopeKey} explicitly.`, scopeKey === 'intake' ? 'Example: --intake 2026-27. Do not infer personal intake year.' : 'Example: --term "2026-27 Fall".');
  }
  const scopes=kind==='program'?(index.intakes??[index.intake]):[index.term];
  if (!scopes.includes(scope)) {
    throw new CliError('NOT_INDEXED', 'This intake or term has not been indexed.', 'Use the official PCC website; records from a different year are not substituted.');
  }
  let limit = 50;
  if (options.limit !== undefined) {
    if (!/^\d+$/.test(options.limit) || Number(options.limit) < 1 || Number(options.limit) > 50) {
      throw new CliError('INVALID_ARGUMENT', '--limit must be an integer from 1 to 50.');
    }
    limit = Number(options.limit);
  }
  let records=index.records.filter(record=>record[scopeKey]===scope);
  if (kind==='program') {
    let curriculum;
    try {
      curriculum=JSON.parse(await readFile(new URL('../../data/ai-requirements-2025-onwards.json',import.meta.url),'utf8'));
      if (!curriculum.bodyRead || !Array.isArray(curriculum.fundamentalGroups) || !Array.isArray(curriculum.majorRequiredCourses) ||
          !Array.isArray(curriculum.majorElectiveCourses) || !curriculum.sourceUrl || !curriculum.verifiedAt) throw new Error();
    } catch { throw new CliError('INDEX_INVALID','Cannot read the verified AI curriculum index.'); }
    records=records.map(record=>{
      if (!record.curriculumRequirementsFile) return record;
      const {curriculumRequirementsFile,...rest}=record;
      return {...rest,curriculumRequirements:curriculum};
    });
  }
  const metadata = { [scopeKey]: scope, verifiedAt: index.verifiedAt, retrieval: 'local-curated-index', liveChecked: false,
    coverage: index.coverageByIntake?.[scope]??index.coverage, directoryComplete: index.complete,
    ...(kind === 'program' ? { generalRequirements: index.generalRequirements, graduationAuditImplemented: false } :
      { officialTotalObserved: index.officialTotalObserved, timetableVerified: false }) };
  if (action === 'show') {
    const id=positionals[0].toLowerCase();
    const record = records.find(record => record.id === id || record.baseId === id);
    if (!record) throw new CliError('NOT_FOUND', 'No indexed record has this ID for the selected intake or term.');
    return { ...metadata, record };
  }
  const query = action === 'search' ? positionals.join(' ').trim() : options.search;
  const results = query === undefined ? records.slice(0, limit) : searchIndex(records, query, limit);
  return { ...metadata, query: query ?? null, results,
    ...(results.length === 0 ? { message: '未在当前已收录目录中找到，请到官方PCC查询；不能据此认定该专业或课程不存在。' } : {}) };
}
