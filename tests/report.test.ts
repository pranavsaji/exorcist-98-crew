import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { countBySeverity, findingKey, forAgent, newFindings, parseReport, plainSummary, worstLevel } from '../shared/report.js';
import { finding, report } from './arb.js';

const RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

describe('report parsing', () => {
  it('reads a CLI report', () => {
    const r = parseReport(report([{ ruleId: 'EX-001', title: 't', severity: 'high', file: 'a', line: 1, col: 1, span: 's', fix: 'f' }], 7));
    expect(r.ok && r.value.filesScanned).toBe(7);
    expect(r.ok && r.value.findings).toHaveLength(1);
  });

  it.each([
    ['not JSON', 'Scanning...'],
    ['empty', ''],
    ['wrong version', JSON.stringify({ version: '2', createdAt: 'x', stats: { filesScanned: 1 }, findings: [] })],
    ['bad severity', report([]).replace('"findings":[]', '"findings":[{"ruleId":"EX-1","title":"t","severity":"scary","file":"a","line":1,"col":1,"span":"s","fix":"f"}]')],
    ['missing findings', JSON.stringify({ version: '1', createdAt: 'x', stats: { filesScanned: 1 } })],
  ])('treats %s output as an error, never as clean', (_name, out) => {
    expect(parseReport(out).ok).toBe(false);
  });
});

describe('PBT-CRW-01 diff', () => {
  it('a report diffed against itself has no new findings', () => {
    fc.assert(fc.property(fc.array(finding, { maxLength: 30 }), (fs) => {
      expect(newFindings(fs, fs)).toEqual([]);
    }));
  });

  it('new findings are a subset of the current findings and absent from the previous ones', () => {
    fc.assert(fc.property(fc.array(finding, { maxLength: 20 }), fc.array(finding, { maxLength: 20 }), (prev, cur) => {
      const fresh = newFindings(prev, cur);
      const curKeys = new Set(cur.map(findingKey));
      const prevKeys = new Set(prev.map(findingKey));
      for (const f of fresh) {
        expect(curKeys.has(findingKey(f))).toBe(true);
        expect(prevKeys.has(findingKey(f))).toBe(false);
      }
      // Every current finding not seen before is reported.
      expect(fresh.length).toBe(cur.filter((f) => !prevKeys.has(findingKey(f))).length);
    }));
  });

  it('a moved finding (new line) counts as new', () => {
    const a = { ruleId: 'EX-001', title: 't', severity: 'high' as const, file: 'a', line: 1, col: 1, span: 's', fix: 'f' };
    expect(newFindings([a], [{ ...a, line: 2 }])).toHaveLength(1);
  });
});

describe('PBT-CRW-02 infection level', () => {
  it('is the worst severity present, or clean', () => {
    fc.assert(fc.property(fc.array(finding, { maxLength: 30 }), (fs) => {
      const level = worstLevel(fs);
      if (fs.length === 0) { expect(level).toBe('clean'); return; }
      expect(level).not.toBe('clean');
      const best = Math.min(...fs.map((f) => RANK[f.severity]));
      expect(RANK[level as keyof typeof RANK]).toBe(best);
    }));
  });

  it('counts add up', () => {
    fc.assert(fc.property(fc.array(finding, { maxLength: 30 }), (fs) => {
      const c = countBySeverity(fs);
      expect(c.critical + c.high + c.medium + c.low).toBe(fs.length);
    }));
  });
});

describe('PBT-CRW-05 agent summary', () => {
  it('never carries the quoted span or the fix text', () => {
    fc.assert(fc.property(finding, (f) => {
      const a = forAgent(f);
      expect(Object.keys(a).sort()).toEqual(['file', 'line', 'ruleId', 'severity', 'title']);
      expect('span' in a).toBe(false);
    }));
  });
});

describe('plain language', () => {
  it('leads with serious problems', () => {
    const f = (severity: 'critical' | 'low') => ({ severity });
    expect(plainSummary([])).toBe('No problems found.');
    expect(plainSummary([f('critical')])).toBe('1 serious problem.');
    expect(plainSummary([f('critical'), f('critical'), f('low')])).toBe('2 serious problems and 1 minor.');
    expect(plainSummary([f('low'), f('low')])).toBe('2 minor problems.');
  });
});
