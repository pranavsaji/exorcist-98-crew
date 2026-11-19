import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';

/**
 * The install-time rules from the Crew Manifest reference ("Enforced at
 * install time"), plus the field shapes this app uses. Unknown fields are
 * allowed, as Crew preserves them.
 */
const nonEmpty = z.string().min(1);

/** Relative, no `..` segment, no absolute or drive path. */
export function isContainedPath(p: string): boolean {
  if (p.length === 0 || isAbsolute(p) || /^[a-zA-Z]:/.test(p) || p.startsWith('\\')) return false;
  return !p.split(/[\\/]+/).some((seg) => seg === '..');
}

const appPath = nonEmpty.refine(isContainedPath, { message: 'must be a relative path inside the app root' });

const CronSchema = z
  .object({
    name: nonEmpty,
    every: z.number().int().positive().optional(),
    cron_expr: nonEmpty.optional(),
    message: nonEmpty,
    agent: nonEmpty.optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough()
  .refine((c) => (c.every === undefined) !== (c.cron_expr === undefined), {
    message: 'each cron needs exactly one of "every" or "cron_expr"',
  });

const PageSchema = z
  .object({
    route: nonEmpty,
    label: nonEmpty,
    icon: nonEmpty.optional(),
    iconUrl: nonEmpty.optional(),
    entryPoint: appPath.optional(),
    mountFunction: nonEmpty.optional(),
  })
  .passthrough();

export const ManifestSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'name must be kebab-case'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver X.Y.Z'),
    displayName: nonEmpty,
    description: nonEmpty,
    author: nonEmpty.optional(),
    license: nonEmpty.optional(),
    minKiroCrewVersion: nonEmpty.optional(),
    iconPath: nonEmpty.optional(),
    screenshots: z.array(nonEmpty).max(5).optional(),
    tags: z.array(nonEmpty).optional(),
    highlights: z.array(nonEmpty).max(10).optional(),
    agents: z.array(appPath).optional(),
    skills: z.array(appPath).optional(),
    sops: z.array(appPath).optional(),
    ui: z
      .object({
        entry: appPath.optional(),
        pages: z.array(PageSchema).optional(),
        sidebar: z.object({ section: nonEmpty.optional(), order: z.number().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
    backend: z
      .object({
        entryPoint: appPath,
        type: z.enum(['python', 'asgi', 'node', 'exec', '']).optional(),
        port: z.union([z.literal('auto'), z.number().int().positive()]).optional(),
        healthCheck: nonEmpty.optional(),
        routes: nonEmpty.optional(),
      })
      .passthrough()
      .optional(),
    crons: z.array(CronSchema).optional(),
    permissions: z
      .object({
        api: z.array(nonEmpty).optional(),
        events: z.array(nonEmpty).optional(),
        mcpTools: z.array(nonEmpty).optional(),
        memory: z.enum(['', 'app-scoped', 'shared']).optional(),
        jobs: z.boolean().optional(),
        storage: z.boolean().optional(),
        cron: z.boolean().optional(),
        network: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
  // Found by installing in Crew 0.12.2 (not in the Manifest reference): the
  // gateway refuses an app that declares crons without permissions.cron.
  .refine((m) => !m.crons?.length || m.permissions?.cron === true, {
    path: ['permissions', 'cron'],
    message: 'crons is declared but permissions.cron is not true (Crew refuses the install)',
  });
export type Manifest = z.infer<typeof ManifestSchema>;

/** Every path the manifest names. `ui.entry` and page entry points live under `ui/`. */
export function manifestPaths(m: Manifest): string[] {
  const paths = [...(m.agents ?? []), ...(m.skills ?? []), ...(m.sops ?? [])];
  if (m.ui?.entry) paths.push(`ui/${m.ui.entry}`);
  for (const p of m.ui?.pages ?? []) if (p.entryPoint) paths.push(`ui/${p.entryPoint}`);
  if (m.backend) paths.push(m.backend.entryPoint);
  return paths;
}

/** Schema errors plus missing or escaping files, as plain messages. Empty when valid. */
export function validateManifest(json: unknown, root: string): string[] {
  const parsed = ManifestSchema.safeParse(json);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  const errors: string[] = [];
  const realRoot = realpathSync(root);
  for (const p of manifestPaths(parsed.data)) {
    const abs = resolve(realRoot, p);
    if (!existsSync(abs)) { errors.push(`${p}: file not found`); continue; }
    const rel = relative(realRoot, realpathSync(abs));
    if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) errors.push(`${p}: resolves outside the app root`);
  }
  return errors;
}
