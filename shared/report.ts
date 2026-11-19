import { z } from 'zod';

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type Level = Severity | 'clean';

/** One finding as written by `exorcist scan --format json` (report version "1"). */
export const FindingSchema = z.object({
  ruleId: z.string().min(1),
  title: z.string(),
  severity: z.enum(SEVERITIES),
  file: z.string(),
  line: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
  span: z.string(),
  fix: z.string(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ScanReportSchema = z.object({
  version: z.literal('1'),
  createdAt: z.string(),
  stats: z.object({ filesScanned: z.number().int().nonnegative() }).passthrough(),
  findings: z.array(FindingSchema.passthrough()),
});
export type ScanReport = z.infer<typeof ScanReportSchema>;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parse the CLI's stdout. Malformed output is an error, never "clean". */
export function parseReport(stdout: string): Result<{ filesScanned: number; findings: Finding[] }> {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    return { ok: false, error: 'The scanner did not print a JSON report.' };
  }
  const parsed = ScanReportSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'The scanner printed a report in an unexpected format.' };
  const findings = parsed.data.findings.map((f) => FindingSchema.parse(f));
  return { ok: true, value: { filesScanned: parsed.data.stats.filesScanned, findings } };
}

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function worstLevel(findings: readonly { severity: Severity }[]): Level {
  let level: Level = 'clean';
  for (const f of findings) {
    if (level === 'clean' || RANK[f.severity] < RANK[level]) level = f.severity;
  }
  return level;
}

export function countBySeverity(findings: readonly { severity: Severity }[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

/** Worst first, then file, then line. Does not mutate the input. */
export function sortFindings<T extends { severity: Severity; file: string; line: number }>(findings: readonly T[]): T[] {
  return [...findings].sort(
    (a, b) => RANK[a.severity] - RANK[b.severity] || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line,
  );
}

/** A finding's identity across patrols: rule, file, line and quoted span. */
export function findingKey(f: Pick<Finding, 'ruleId' | 'file' | 'line' | 'span'>): string {
  return JSON.stringify([f.ruleId, f.file, f.line, f.span]);
}

/** Findings in `current` that were not in `previous`. */
export function newFindings<T extends Finding>(previous: readonly Finding[], current: readonly T[]): T[] {
  const seen = new Set(previous.map(findingKey));
  return current.filter((f) => !seen.has(findingKey(f)));
}

/** What the agent gets: no quoted text, so scanned content cannot reach it as instructions. */
export type AgentFinding = Pick<Finding, 'ruleId' | 'title' | 'severity' | 'file' | 'line'>;

export function forAgent(f: Finding): AgentFinding {
  return { ruleId: f.ruleId, title: f.title, severity: f.severity, file: f.file, line: f.line };
}

/** Plain-language summary of a level, for people. */
export function plainSummary(findings: readonly { severity: Severity }[]): string {
  if (findings.length === 0) return 'No problems found.';
  const c = countBySeverity(findings);
  const serious = c.critical + c.high;
  const total = findings.length;
  const lead = serious > 0
    ? `${serious} serious problem${serious === 1 ? '' : 's'}`
    : `${total} minor problem${total === 1 ? '' : 's'}`;
  return serious > 0 && total > serious ? `${lead} and ${total - serious} minor.` : `${lead}.`;
}
