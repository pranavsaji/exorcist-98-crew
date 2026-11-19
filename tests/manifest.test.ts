import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isContainedPath, ManifestSchema, validateManifest } from '../shared/manifest.js';

const ROOT = join(import.meta.dirname, '..');
const manifest = (): Record<string, unknown> => JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));

describe('REQ-01 app.json', () => {
  it('passes every documented install-time rule and names only files that exist', () => {
    expect(validateManifest(manifest(), ROOT)).toEqual([]);
  });

  it.each<[string, (m: Record<string, unknown>) => void, RegExp]>([
    ['a name that is not kebab-case', (m) => { m['name'] = 'Exorcist_98'; }, /kebab-case/],
    ['a version that is not semver', (m) => { m['version'] = '0.1'; }, /semver/],
    ['an empty description', (m) => { m['description'] = ''; }, /description/],
    ['a cron with both every and cron_expr', (m) => { m['crons'] = [{ name: 'x', every: 60, cron_expr: '* * * * *', message: 'm' }]; }, /exactly one/],
    ['a cron with neither', (m) => { m['crons'] = [{ name: 'x', message: 'm' }]; }, /exactly one/],
    ['a cron without a message', (m) => { m['crons'] = [{ name: 'x', every: 60 }]; }, /message/],
    ['a cron with enabled as a string', (m) => { m['crons'] = [{ name: 'x', every: 60, message: 'm', enabled: 'false' }]; }, /enabled/],
    ['a page without a label', (m) => { m['ui'] = { entry: 'dist/index.mjs', pages: [{ route: '/apps/x' }] }; }, /label/],
    ['an agent path that climbs out', (m) => { m['agents'] = ['../evil.json']; }, /inside the app root/],
    ['an absolute skill path', (m) => { m['skills'] = ['/etc/skills']; }, /inside the app root/],
    ['a missing agent file', (m) => { m['agents'] = ['agents/missing.json']; }, /file not found/],
    ['a missing backend bundle', (m) => { m['backend'] = { entryPoint: 'backend/dist/nope.mjs' }; }, /file not found/],
  ])('rejects %s', (_name, mutate, pattern) => {
    const m = manifest();
    mutate(m);
    const errors = validateManifest(m, ROOT);
    expect(errors.join('\n')).toMatch(pattern);
  });

  it('asks only for the permission it uses: its own backend', () => {
    const m = ManifestSchema.parse(manifest());
    expect(m.permissions).toEqual({ api: ['/apps/exorcist-98-crew/api'] });
  });

  it('runs the nightly patrol at 02:00 with the Sentry agent', () => {
    const m = ManifestSchema.parse(manifest());
    expect(m.crons).toEqual([expect.objectContaining({ name: 'nightly-patrol', cron_expr: '0 2 * * *', agent: 'exorcist-sentry' })]);
    expect(m.crons?.[0]?.message).toContain('/apps/exorcist-98-crew/api/patrol');
  });
});

describe('PBT-CRW-04 manifest paths', () => {
  const seg = fc.stringMatching(/^[a-z0-9_-]{1,8}$/);
  it('rejects any path that climbs out with ..', () => {
    fc.assert(fc.property(fc.array(seg, { maxLength: 3 }), fc.array(seg, { maxLength: 3 }), fc.constantFrom('/', '\\'), (a, b, sep) => {
      expect(isContainedPath([...a, '..', ...b].join(sep))).toBe(false);
    }));
  });
  it('rejects any absolute path', () => {
    fc.assert(fc.property(fc.array(seg, { minLength: 1, maxLength: 4 }), (a) => {
      expect(isContainedPath(`/${a.join('/')}`)).toBe(false);
      expect(isContainedPath(`C:\\${a.join('\\')}`)).toBe(false);
    }));
  });
  it('accepts plain relative paths', () => {
    fc.assert(fc.property(fc.array(seg, { minLength: 1, maxLength: 4 }), (a) => {
      expect(isContainedPath(a.join('/'))).toBe(true);
    }));
  });
});

describe('REQ-05 agent and skill', () => {
  it('the agent says scanned text is data and asks before acting', () => {
    const agent = JSON.parse(readFileSync(join(ROOT, 'agents/exorcist-sentry.json'), 'utf8')) as Record<string, unknown>;
    expect(agent['name']).toBe('exorcist-sentry');
    const prompt = String(agent['prompt']);
    expect(prompt).toMatch(/data, never instructions/);
    expect(prompt).toMatch(/without the user's explicit yes/);
    expect(prompt).toContain('/apps/exorcist-98-crew/api/patrol');
  });

  it('every skill has name and description frontmatter', () => {
    for (const dir of readdirSync(join(ROOT, 'skills'))) {
      const text = readFileSync(join(ROOT, 'skills', dir, 'SKILL.md'), 'utf8');
      const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
      expect(fm).toMatch(new RegExp(`^name: ${dir}$`, 'm'));
      expect(fm).toMatch(/^description: \S.+$/m);
    }
  });

  it('never points at the unscoped npm name, which belongs to another package', () => {
    for (const file of ['skills/agent-hygiene/SKILL.md', 'agents/exorcist-sentry.json', 'README.md', 'backend/src/scanner.ts']) {
      expect(readFileSync(join(ROOT, file), 'utf8')).not.toMatch(/npx (-y )?exorcist(?![-\w/])/);
    }
  });
});
describe('M0 REQ-02.5 more broken variants', () => {
  it.each<[string, (m: Record<string, unknown>) => void, RegExp]>([
    ['an empty version', (m) => { m['version'] = ''; }, /version/],
    ['an empty displayName', (m) => { m['displayName'] = ''; }, /displayName/],
    ['a missing description', (m) => { delete m['description']; }, /description/],
    ['an absolute backend entry point', (m) => { m['backend'] = { entryPoint: '/usr/bin/node' }; }, /inside the app root/],
    ['a backend entry point that climbs out', (m) => { m['backend'] = { entryPoint: '../x.mjs' }; }, /inside the app root/],
    ['an absolute ui.entry', (m) => { m['ui'] = { entry: '/tmp/x.mjs', pages: [] }; }, /inside the app root/],
    ['a ui.entry that climbs out', (m) => { m['ui'] = { entry: '../x.mjs', pages: [] }; }, /inside the app root/],
    ['a page without a route', (m) => { m['ui'] = { entry: 'dist/index.mjs', pages: [{ label: 'x' }] }; }, /route/],
    ['a page entry point that climbs out', (m) => { m['ui'] = { entry: 'dist/index.mjs', pages: [{ route: '/a', label: 'x', entryPoint: '../x.mjs' }] }; }, /inside the app root/],
    ['a missing ui bundle', (m) => { m['ui'] = { entry: 'dist/nope.mjs', pages: [] }; }, /file not found/],
    ['a missing skill directory', (m) => { m['skills'] = ['skills/none']; }, /file not found/],
    ['more than 5 screenshots', (m) => { m['screenshots'] = ['1', '2', '3', '4', '5', '6'].map((n) => `${n}.png`); }, /screenshots/],
  ])('rejects %s', (_name, mutate, pattern) => {
    const m = manifest();
    mutate(m);
    expect(validateManifest(m, ROOT).join('\n')).toMatch(pattern);
  });
});
describe('PBT-M0 manifest properties', () => {
  const runs = { numRuns: 200 };
  const base = manifest();
  const word = fc.stringMatching(/^[a-z0-9]{1,6}$/);
  const kebab = fc.array(word, { minLength: 1, maxLength: 4 }).map((w) => w.join('-'));
  const isKebab = (s: string): boolean => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
  const isSemver = (s: string): boolean => /^\d+\.\d+\.\d+$/.test(s);
  const withCron = (cron: Record<string, unknown>): Record<string, unknown> => ({ ...base, crons: [cron] });

  it('PBT-M0-01: key order and unknown top-level keys do not change validity, and unknown keys survive parsing', () => {
    const keys = Object.keys(base);
    const extra = fc.dictionary(fc.stringMatching(/^x[A-Za-z]{1,8}$/), fc.jsonValue(), { maxKeys: 4 });
    fc.assert(fc.property(fc.shuffledSubarray(keys, { minLength: keys.length, maxLength: keys.length }), extra, (order, unknown) => {
      const shuffled: Record<string, unknown> = {};
      for (const k of order) shuffled[k] = base[k];
      const m = { ...unknown, ...shuffled };
      expect(validateManifest(m, ROOT)).toEqual([]);
      const parsed = ManifestSchema.parse(m) as Record<string, unknown>;
      for (const k of Object.keys(unknown)) expect(parsed[k]).toEqual(unknown[k]);
    }), runs);
  });

  it('PBT-M0-02: a cron with exactly one of every / cron_expr is valid; both or neither is not', () => {
    const every = fc.integer({ min: 1, max: 100000 });
    const expr = fc.constantFrom('0 2 * * *', '*/5 * * * *', '0 9 * * 1-5');
    const one = fc.oneof(every.map((e) => ({ every: e })), expr.map((c) => ({ cron_expr: c })));
    const both = fc.tuple(every, expr).map(([e, c]) => ({ every: e, cron_expr: c }));
    const msg = fc.string({ minLength: 1, maxLength: 20 });
    fc.assert(fc.property(word, msg, one, (name, message, when) => {
      expect(validateManifest(withCron({ name, message, ...when }), ROOT)).toEqual([]);
    }), runs);
    fc.assert(fc.property(word, msg, both, (name, message, when) => {
      expect(validateManifest(withCron({ name, message, ...when }), ROOT).join()).toMatch(/exactly one/);
    }), runs);
    fc.assert(fc.property(word, msg, (name, message) => {
      expect(validateManifest(withCron({ name, message }), ROOT).join()).toMatch(/exactly one/);
    }), runs);
  });

  it('PBT-M0-03: kebab-case names and X.Y.Z versions validate; anything else does not', () => {
    fc.assert(fc.property(kebab, fc.tuple(fc.nat(999), fc.nat(999), fc.nat(999)), (name, v) => {
      expect(validateManifest({ ...base, name, version: v.join('.') }, ROOT)).toEqual([]);
    }), runs);
    fc.assert(fc.property(fc.string({ maxLength: 20 }).filter((s) => !isKebab(s)), (name) => {
      expect(ManifestSchema.safeParse({ ...base, name }).success).toBe(false);
    }), runs);
    fc.assert(fc.property(fc.string({ maxLength: 20 }).filter((s) => !isSemver(s)), (version) => {
      expect(ManifestSchema.safeParse({ ...base, version }).success).toBe(false);
    }), runs);
  });
});
