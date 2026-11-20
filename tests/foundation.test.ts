import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const ROOT = join(import.meta.dirname, '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

describe('M0 REQ-01 repo foundation', () => {
  it('has the files docs/PLAN.md section 3 names', () => {
    for (const p of ['app.json', 'agents/exorcist-sentry.json', 'skills/agent-hygiene/SKILL.md', 'ui', 'backend', '.kiro/steering/product.md', 'docs/PLAN.md', 'README.md', 'LICENSE']) {
      expect(existsSync(join(ROOT, p)), p).toBe(true);
    }
  });
  it('commits the bundles Crew serves, with no runtime imports of bare packages', () => {
    for (const p of ['ui/dist/index.mjs', 'backend/dist/server.mjs']) {
      const text = read(p);
      const bare = [...text.matchAll(/(?:^|[;\n])\s*import\s*(?:[^'"]*from)?\s*["']([^"'.\/][^"']*)["']/g)].map((m) => m[1] as string);
      const allowed = (s: string): boolean => s.startsWith('node:');
      expect(bare.filter((s) => !allowed(s)), p).toEqual([]);
    }
  });
  it('does not depend on @kirocrew/app-sdk and keeps host-provided packages out of the page bundle', () => {
    expect(read('package.json')).not.toContain('@kirocrew/app-sdk');
    expect(read('scripts/build.mjs')).toMatch(/hostProvided = \[[^\]]*'react'[^\]]*'react-dom'[^\]]*'react\/jsx-runtime'[^\]]*'lucide-react'[^\]]*'@kirocrew\/app-sdk'/);
    expect(read('ui/dist/index.mjs')).not.toMatch(/from\s*["'](react|react-dom|lucide-react|@kirocrew\/app-sdk)/);
  });
  it('has no symlinks (Crew drops links that point outside the app)', () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      if (n === 'node_modules' || n === '.git') return [];
      const p = join(dir, n);
      const st = lstatSync(p);
      return st.isSymbolicLink() ? [p] : st.isDirectory() ? walk(p) : [];
    });
    expect(walk(ROOT)).toEqual([]);
  });
  it('is Apache-2.0 licensed', () => {
    expect(read('LICENSE')).toMatch(/Apache License\s+Version 2\.0/);
    expect(JSON.parse(read('package.json')).license).toBe('Apache-2.0');
    expect(JSON.parse(read('app.json')).license).toBe('Apache-2.0');
  });
  it('holds no copy of the main repo scanner', () => {
    expect(existsSync(join(ROOT, 'packages'))).toBe(false);
  });
});

describe('M0 REQ-04 manifest hook', () => {
  const hook = JSON.parse(read('.kiro/hooks/validate-app-json.json')) as { hooks: { trigger: string; matcher: string; action: { type: string; command: string } }[] };
  const h = hook.hooks[0]!;
  it('runs the manifest tests when app.json is saved', () => {
    expect(h.trigger).toBe('PostFileSave');
    const re = new RegExp(h.matcher);
    expect(re.test('app.json')).toBe(true);
    expect(re.test('/Users/x/proj/app.json')).toBe(true);
    expect(re.test('package.json')).toBe(false);
    expect(re.test('docs/app.json.md')).toBe(false);
    expect(h.action).toMatchObject({ type: 'command', command: expect.stringContaining('tests/manifest.test.ts') });
  });
  it('only reads and tests: no writes, network or deletes', () => {
    expect(h.action.command).not.toMatch(/\b(rm|mv|cp|curl|wget|git|sed -i|tee)\b|>\s*[^&]/);
  });
  it('the command it runs exists as a test file', () => {
    expect(existsSync(join(ROOT, 'tests/manifest.test.ts'))).toBe(true);
  });
});

describe('C-014 App Store art', () => {
  /** Width and height from a PNG's IHDR chunk. */
  const png = (p: string): { w: number; h: number } => {
    const b = readFileSync(join(ROOT, p));
    expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };
  const m = JSON.parse(read('app.json')) as Record<string, unknown>;
  it('has a square PNG icon of at least 256x256 (Manifest reference)', () => {
    const { w, h } = png(m['iconPath'] as string);
    expect(w).toBe(h);
    expect(w).toBeGreaterThanOrEqual(256);
  });
  it('has 16:9 light and dark hero images at 1200x675', () => {
    for (const k of ['heroImage', 'heroImageDark']) expect(png(m[k] as string)).toEqual({ w: 1200, h: 675 });
  });
  it('lists at most 5 screenshots, all present', () => {
    const shots = m['screenshots'] as string[];
    expect(shots.length).toBeLessThanOrEqual(5);
    for (const s of shots) expect(existsSync(join(ROOT, s)), s).toBe(true);
  });
});
