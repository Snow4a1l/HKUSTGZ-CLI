import { CliError } from '../lib/errors.js';

const invalid = () => { throw new CliError('SNAPSHOT_INVALID', 'SISN grade snapshot does not match My Term Information.', 'Refresh the selected term using the supported Browser workflow. Raw grades are not included in errors.'); };
const numberOrNull = value => {
  if (value === '') return null;
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) invalid();
  return Number(value);
};

export function parseSisnGrades(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.source !== 'sisn' || snapshot.view !== 'term-information' ||
      snapshot.sourceUrl !== 'https://sisn.hkust-gz.edu.cn/student-record/my-academics' ||
      typeof snapshot.term !== 'string' || !/^\d{4}-\d{2} (Fall|Winter|Spring|Summer)$/.test(snapshot.term) ||
      typeof snapshot.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.capturedAt) ||
      Number.isNaN(Date.parse(snapshot.capturedAt)) || new Date(snapshot.capturedAt).toISOString() !== snapshot.capturedAt ||
      Date.parse(snapshot.capturedAt) > Date.now()+300000 || !Array.isArray(snapshot.tables) || snapshot.tables.length !== 4) invalid();
  const [courseHeader, rows, statsHeader, stats] = snapshot.tables;
  if (JSON.stringify(courseHeader) !== JSON.stringify([['Class','Description','Units','Grading','Grade','Grade Points']]) ||
      JSON.stringify(statsHeader) !== JSON.stringify([['','From Enrollment','Cumulative Total']]) ||
      !Array.isArray(rows) || rows.length > 200 || !Array.isArray(stats) || stats.length > 20) invalid();
  const seen = new Set();
  const courses = rows.map(row => {
    if (!Array.isArray(row) || row.length !== 6 || !row.every(value=>typeof value==='string'&&value.length<=1000) ||
        !/^[A-Z]{2,8}\s?\d{4}[A-Z]?$/.test(row[0]) || !row[1]) invalid();
    const code=row[0].replace(/\s/g,'');
    if (seen.has(code)) invalid(); seen.add(code);
    const units=numberOrNull(row[2]);
    return {courseCode:code,title:row[1],units,unitsUnreported:units===null,gradingBasis:row[3],grade:row[4]||null,
      gradePoints:numberOrNull(row[5]),gradeUnreported:row[4]===''||row[4]==='**'};
  });
  const names=['Units Toward GPA:','Units Not for GPA:','GPA Calculation'];
  const groups=names.map(()=>new Map());
  let group=-1;
  for (const row of stats) {
    if (!Array.isArray(row)) invalid();
    if (row.length===1) {
      group++;
      if (row[0]!==names[group] || group>2) invalid();
    } else {
      const allowed=group===2?['Total Grade Points','/ Units Taken Toward GPA','= GPA']:['Taken','Passed','In Progress'];
      if (group<0 || row.length!==3 || !allowed.includes(row[0]) || groups[group].has(row[0])) invalid();
      groups[group].set(row[0],{term:numberOrNull(row[1]),cumulative:numberOrNull(row[2])});
    }
  }
  if (group!==2 || groups.slice(0,2).some(g=>!g.has('Taken')||!g.has('Passed')) || groups[2].size!==3) invalid();
  const units=g=>({taken:g.get('Taken'),passed:g.get('Passed'),inProgress:g.get('In Progress')??null});
  return {courses,officialStatistics:{
    unitsTowardGpa:units(groups[0]),unitsNotForGpa:units(groups[1]),
    totalGradePoints:groups[2].get('Total Grade Points'),unitsTakenTowardGpa:groups[2].get('/ Units Taken Toward GPA'),
    gpa:groups[2].get('= GPA')
  }};
}
