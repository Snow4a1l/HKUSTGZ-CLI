import { open } from 'node:fs/promises';
import { CliError } from './errors.js';

export async function readSnapshot(path) {
  let handle;
  try {
    handle = await open(path, 'r');
    const info = await handle.stat();
    const maximum = 1024 * 1024;
    if (!info.isFile() || info.size > maximum) throw new Error();
    const buffer = Buffer.alloc(maximum + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maximum) throw new Error();
    return JSON.parse(buffer.toString('utf8', 0, total).replace(/^\uFEFF/, ''));
  } catch {
    throw new CliError('SNAPSHOT_INVALID', 'Cannot read a JSON snapshot of at most 1 MiB.', 'Use a private local JSON file. Raw contents are not included in errors.');
  } finally { await handle?.close(); }
}
