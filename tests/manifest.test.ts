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
