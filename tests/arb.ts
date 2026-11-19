import fc from 'fast-check';
import { SEVERITIES } from '../shared/report.js';
import type { Finding } from '../shared/report.js';

export const severity = fc.constantFrom(...SEVERITIES);

export const finding: fc.Arbitrary<Finding> = fc.record({
  ruleId: fc.constantFrom('EX-001', 'EX-002', 'EX-005', 'EX-012'),
  title: fc.string({ maxLength: 20 }),
  severity,
  file: fc.constantFrom('README.md', 'AGENTS.md', '.kiro/settings/mcp.json', 'docs/a.md'),
  line: fc.nat({ max: 50 }),
  col: fc.nat({ max: 80 }),
  span: fc.string({ minLength: 1, maxLength: 30 }),
  fix: fc.string({ maxLength: 30 }),
});

export const report = (findings: Finding[], filesScanned = 3) =>
  JSON.stringify({ version: '1', createdAt: '2026-11-18T00:00:00.000Z', stats: { filesScanned, filesSkipped: 0, findingsTotal: findings.length, durationMs: 1 }, findings: findings.map((f) => ({ ...f, source: 'signature', owasp: [] })) });
