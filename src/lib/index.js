import { readFile } from 'node:fs/promises';
import { CliError } from './errors.js';

export async function loadIndex(kind) {
  try {
    const index = JSON.parse(await readFile(new URL(`../../data/${kind}s.json`, import.meta.url), 'utf8'));
    if (index.schemaVersion !== 1 || !Array.isArray(index.records)) throw new Error();
    const ids = new Set();
    for (const record of index.records) {
      if (!record.id || ids.has(record.id) || !record.title || !record.sourceUrl ||
          !record.verifiedAt || !Array.isArray(record.aliases) || !Array.isArray(record.evidence)) throw new Error();
      const url = new URL(record.sourceUrl);
      if (url.protocol !== 'https:' || !(url.hostname === 'hkust-gz.edu.cn' || url.hostname.endsWith('.hkust-gz.edu.cn'))) throw new Error();
      ids.add(record.id);
    }
    return index;
  } catch {
    throw new CliError('INDEX_INVALID', `Cannot read valid ${kind} index.`, 'Check the bundled data files; no network fallback was attempted.');
  }
}

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '');

export function searchIndex(records, query, limit = 10) {
  const q = normalize(query);
  if (!q) throw new CliError('INVALID_ARGUMENT', 'Search query must contain text.');
  return records.map(record => {
    const matchedFields = [];
    let score = 0;
    const fields = { title: [record.title], aliases: record.aliases, description: [record.description],
      text: [record.text], evidence: record.evidence.map(item => item.text) };
    for (const [field, values] of Object.entries(fields)) {
      const hits = values.filter(value => {
        const normalized = normalize(value);
        return normalized && (normalized.includes(q) || (field === 'aliases' && normalized.length >= 2 && q.includes(normalized)));
      });
      if (hits.length) {
        matchedFields.push({ field, values: hits });
        score += { title: 10, aliases: 8, description: 3, text: 2, evidence: 2 }[field];
      }
    }
    return { ...record, score, matchedFields };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
