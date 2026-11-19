import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { countsText, formatWhen, LEVELS, revealHidden } from '../ui/src/view.js';

const ROOT = join(import.meta.dirname, '..');

describe('REQ-04 page logic', () => {
  it('every level has a text label and a distinct shape', () => {
    const shapes = Object.values(LEVELS).map((l) => l.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
    for (const l of Object.values(LEVELS)) expect(l.label).toMatch(/^[A-Z]+$/);
  });

  it('reveals hidden characters as visible markers', () => {
    expect(revealHidden('ig\u200Bnore')).toBe('ig<U+200B>nore');
    expect(revealHidden('a\u202Eb')).toBe('a<U+202E>b');
    expect(revealHidden('\u{E0041}')).toBe('<U+E0041>');
    fc.assert(fc.property(fc.string(), (s) => {
      expect(revealHidden(revealHidden(s))).toBe(revealHidden(s));
    }));
  });

  it('describes counts and times in plain words', () => {
    expect(countsText({ critical: 2, high: 0, medium: 1, low: 0 })).toBe('2 critical, 1 medium');
    expect(countsText({ critical: 0, high: 0, medium: 0, low: 0 })).toBe('no findings');
    const now = new Date('2026-11-18T12:00:00Z');
    expect(formatWhen(null, now)).toBe('never');
    expect(formatWhen('2026-11-18T11:59:40Z', now)).toBe('just now');
    expect(formatWhen('2026-11-18T11:00:00Z', now)).toBe('1 hour ago');
    expect(formatWhen('2026-11-18T02:00:00Z', now)).toBe('10 hours ago');
  });

  it('never inserts scanned text as HTML', () => {
    const src = readFileSync(join(ROOT, 'ui/src/index.ts'), 'utf8');
    expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });

  it('the built bundle exports mount and has no imports', () => {
    const bundle = readFileSync(join(ROOT, 'ui/dist/index.mjs'), 'utf8');
    expect(bundle).toMatch(/export\s*\{[^}]*\bmount\b/);
    expect(bundle).not.toMatch(/^\s*import[\s{*]/m);
    expect(bundle).not.toMatch(/innerHTML/);
  });

  it('the built backend has no package imports', () => {
    const bundle = readFileSync(join(ROOT, 'backend/dist/server.mjs'), 'utf8');
    const imports = [...bundle.matchAll(/^import .* from "([^"]+)";?$/gm)].map((m) => m[1]);
    for (const i of imports) expect(i).toMatch(/^node:/);
  });
});
