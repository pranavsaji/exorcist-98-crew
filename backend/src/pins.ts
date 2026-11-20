import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_PIN_FILE_BYTES, PIN_FILE, PIN_FILE_RULE, pinFindings } from '../../shared/pins.js';
import type { Finding } from '../../shared/report.js';
import type { Scanner } from './scanner.js';

/**
 * Read a folder's Shield pin file. Read-only. A symlink or a file over the size
 * cap is reported instead of followed or parsed, so a scanned folder cannot point
 * the backend at another file or make it load a huge one.
 */
export function readPinFile(folder: string): Finding[] {
  const path = join(folder, PIN_FILE);
  let st;
  try {
    st = lstatSync(path);
  } catch {
    return []; // No pin file: the Shield is not used in this folder.
  }
  const refuse = (why: string): Finding[] => [{
    ruleId: PIN_FILE_RULE, title: 'Shield pin file is unreadable', severity: 'high',
    file: PIN_FILE, line: 1, col: 1, span: why,
    fix: 'Replace it with the regular file the Exorcist 98 Shield writes, or delete it so the Shield pins every tool again on its next start.',
  }];
  if (st.isSymbolicLink()) return refuse('The pin file is a symbolic link; it was not followed.');
  if (!st.isFile()) return refuse('The pin file is not a regular file.');
  if (st.size > MAX_PIN_FILE_BYTES) return refuse(`The pin file is larger than ${MAX_PIN_FILE_BYTES / 1024 / 1024} MB; it was not read.`);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return refuse('The pin file could not be read.');
  }
  return pinFindings(text);
}

/**
 * The scanner's "Encoded payload" rule fires on the Shield's own SHA-256 pin
 * hashes (seen in Crew 0.13.0: 3 high findings for one pinned tool). Only that
 * rule, only on the pin file, is dropped; every other rule still applies there.
 */
const isPinHashNoise = (f: Finding): boolean => f.file === PIN_FILE && f.ruleId === 'EX-003';

/** The scanner plus the rug-pull watch: pin findings are added to a successful scan. */
export function withPinWatch(scanner: Scanner, readPins: (folder: string) => Finding[] = readPinFile): Scanner {
  return async (folder) => {
    const outcome = await scanner(folder);
    if (!outcome.ok) return outcome;
    const findings = [...outcome.value.findings.filter((f) => !isPinHashNoise(f)), ...readPins(folder)];
    return { ok: true, value: { ...outcome.value, findings } };
  };
}
