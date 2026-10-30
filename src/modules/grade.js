import { readSnapshot } from '../lib/snapshot.js';
import { parseSisnGrades } from '../parsers/grades.js';

export async function readGradeSnapshot(path, action) {
  const snapshot=await readSnapshot(path);
  const {courses,officialStatistics}=parseSisnGrades(snapshot);
  return {source:'sisn',sourceUrl:snapshot.sourceUrl,term:snapshot.term,capturedAt:snapshot.capturedAt,
    ageSeconds:Math.max(0,Math.floor((Date.now()-Date.parse(snapshot.capturedAt))/1000)),
    retrieval:'browser-dom-snapshot',snapshotProvenance:'caller-supplied',liveChecked:false,
    scope:'one-selected-term-and-its-displayed-cumulative-statistics',officialStatistics,
    ...(action==='list'?{courses}:{}),localGpaCalculated:false,officialRanking:null,
    warnings:['Official term and cumulative values are preserved, not recalculated from letter grades.',
      'Blank values are unknown, not zero. ** is retained as an unreported grade.',
      'Term Statistics page states data may take one to two days to populate.',
      'This is a supplied page snapshot, not a refreshed transcript, ranking or graduation audit.']};
}
