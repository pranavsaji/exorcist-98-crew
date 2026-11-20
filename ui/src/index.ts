import { plainSummary } from '../../shared/report.js';
import type { Finding, Level } from '../../shared/report.js';
import { LEVELS, StatusSchema, canQuarantine, countsText, formatWhen, revealHidden } from './view.js';
import type { Shape, Status, VaultItem } from './view.js';
import { CSS } from './style.js';

export type MountOptions = { apiBase?: string };
const DEFAULT_API = '/apps/exorcist-98-crew/api';
const SVG = 'http://www.w3.org/2000/svg';

type Child = Node | string | null | false;
/** Builds elements. Text is always inserted as text, never parsed as HTML. */
function h(tag: string, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) {
    if (c === null || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

function shapeIcon(shape: Shape): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const paths: Record<Shape, string> = {
    check: 'M3 8.5l3.2 3.2L13 5',
    circle: 'M8 2a6 6 0 1 0 0.01 0z',
    square: 'M3 3h10v10H3z',
    triangle: 'M8 2l6.5 12h-13z',
    diamond: 'M8 1l7 7-7 7-7-7z',
  };
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', paths[shape]);
  if (shape === 'check') {
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2.4');
  } else {
    p.setAttribute('fill', 'currentColor');
  }
  svg.append(p);
  return svg;
}

function badge(level: Level): HTMLElement {
  const info = LEVELS[level];
  const el = h('span', { class: `x98-sev x98-sev-${level}`, 'data-level': level });
  el.append(shapeIcon(info.shape), document.createTextNode(info.label));
  return el;
}

/**
 * An inline "are you sure" box. Focus goes to Cancel, the safe choice; Escape
 * cancels and puts focus back on the button that opened it.
 */
function confirmBox(o: { title: string; lines: string[]; confirmLabel: string; opener: HTMLElement; onConfirm: () => void }): HTMLElement {
  const id = `x98-c-${Math.random().toString(36).slice(2, 9)}`;
  const yes = h('button', { type: 'button', class: 'x98-btn x98-danger' }, o.confirmLabel) as HTMLButtonElement;
  const no = h('button', { type: 'button', class: 'x98-btn' }, 'Cancel') as HTMLButtonElement;
  const box = h('div', { class: 'x98-confirm', role: 'group', 'aria-labelledby': id },
    h('h4', { id }, o.title), ...o.lines.map((l) => h('p', {}, l)), h('div', { class: 'x98-row' }, yes, no));
  const close = () => { box.remove(); o.opener.removeAttribute('aria-expanded'); o.opener.focus(); };
  no.addEventListener('click', close);
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  yes.addEventListener('click', () => { yes.disabled = true; no.disabled = true; o.onConfirm(); });
  queueMicrotask(() => no.focus());
  return box;
}

type RowContext = { folder: string; inVault: ReadonlySet<string>; vaultAvailable: boolean; quarantine: (folder: string, file: string) => Promise<void> };

function findingRow(f: Finding, ctx?: RowContext): HTMLElement {
  const summary = h(
    'summary',
    {},
    badge(f.severity),
    ' ',
    h('span', { class: 'x98-title' }, f.title),
    ' ',
    h('span', { class: 'x98-loc' }, `${f.file}:${f.line}:${f.col}`),
    ctx?.inVault.has(f.file) ? h('span', { class: 'x98-tag' }, 'IN VAULT') : null,
  );
  let action: HTMLElement | null = null;
  if (ctx && ctx.vaultAvailable && canQuarantine(f.file, ctx.inVault)) {
    const open = h('button', { type: 'button', class: 'x98-btn x98-small' }, 'Move file to vault...') as HTMLButtonElement;
    action = h('div', { class: 'x98-act' }, open);
    open.addEventListener('click', () => {
      if (action?.querySelector('.x98-confirm')) return;
      open.setAttribute('aria-expanded', 'true');
      action?.append(confirmBox({
        title: `Move ${f.file} to the vault?`,
        lines: [
          `It is removed from ${ctx.folder} and an exact copy is kept in .exorcist/vault inside that folder.`,
          'Anything that reads this file (Kiro, your agents, your build) will no longer find it.',
          'You can put it back with Restore in the vault list below this folder.',
        ],
        confirmLabel: 'Move to vault',
        opener: open,
        onConfirm: () => { void ctx.quarantine(ctx.folder, f.file); },
      }));
    });
  }
  return h(
    'li',
    {},
    h(
      'details',
      { class: 'x98-finding' },
      summary,
      h(
        'dl',
        {},
        h('dt', {}, 'Where'), h('dd', {}, `${f.file}, line ${f.line}, column ${f.col}`),
        h('dt', {}, 'Quoted text'), h('dd', {}, h('code', { class: 'x98-span' }, revealHidden(f.span))),
        h('dt', {}, 'Threat'), h('dd', {}, `${f.title} (${f.ruleId}), ${LEVELS[f.severity].label}`),
        h('dt', {}, 'How to fix it'), h('dd', {}, f.fix.trim()),
      ),
      action,
    ),
  );
}

export function mount(target: HTMLElement, options: MountOptions = {}): () => void {
  const api = (options.apiBase ?? DEFAULT_API).replace(/\/+$/, '');
  let disposed = false;
  let status: Status | null = null;
  let busy = false;

  const style = h('style', {}, CSS);
  const live = h('p', { class: 'x98-live', role: 'status', 'aria-live': 'polite' });
  const list = h('div', { class: 'x98-folders' });
  const lastLine = h('p', { class: 'x98-last' }, 'Loading...');
  const patrolBtn = h('button', { type: 'button', class: 'x98-btn' }, 'Run patrol now') as HTMLButtonElement;
  const input = h('input', {
    id: 'x98-folder', type: 'text', class: 'x98-input', autocomplete: 'off', spellcheck: 'false',
    placeholder: '/home/me/my-project', 'aria-describedby': 'x98-folder-help',
  }) as HTMLInputElement;
  const form = h(
    'form',
    { class: 'x98-form' },
    h('label', { for: 'x98-folder' }, 'Folder to watch'),
    input,
    h('button', { type: 'submit', class: 'x98-btn' }, 'Add folder'),
    h('p', { id: 'x98-folder-help', class: 'x98-help' }, 'The full path of a project folder on the machine that runs Crew.'),
  );
  const root = h(
    'div',
    { class: 'x98' },
    style,
    h(
      'section',
      { class: 'x98-window', 'aria-labelledby': 'x98-heading' },
      h('div', { class: 'x98-titlebar' }, h('h1', { id: 'x98-heading' }, 'Exorcist 98 Patrol')),
      h(
        'div',
        { class: 'x98-body' },
        h('p', {}, 'Every night at 2:00 the patrol scans the folders below for text that tries to take over your AI agent, and for risky agent and MCP settings.'),
        h('div', { class: 'x98-row' }, patrolBtn, lastLine),
        live,
        form,
        h('h2', {}, 'Watched folders'),
        list,
      ),
    ),
  );
  target.replaceChildren(root);

  const say = (msg: string) => { live.textContent = msg; };

  async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<{ status: number; json: unknown }> {
    const init: RequestInit = { method, headers: { accept: 'application/json', ...extra } };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { accept: 'application/json', 'content-type': 'application/json', ...extra };
    }
    const res = await fetch(`${api}${path}`, init);
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: res.status, json };
  }

  const errorOf = (json: unknown, fallback: string): string =>
    json && typeof json === 'object' && 'error' in json && typeof json.error === 'string' ? json.error : fallback;

  function render(): void {
    if (disposed) return;
    patrolBtn.disabled = busy || (status?.patrolRunning ?? false);
    patrolBtn.setAttribute('aria-busy', String(busy));
    patrolBtn.textContent = busy ? 'Patrolling...' : 'Run patrol now';
    if (!status) return;
    lastLine.textContent = `Last patrol: ${formatWhen(status.lastPatrolAt)}.`;
    if (status.folders.length === 0) {
      list.replaceChildren(h('p', { class: 'x98-empty' }, 'No folders yet. Add a project folder above, then run a patrol.'));
      return;
    }
    list.replaceChildren(
      ...status.folders.map((folder) => {
        const r = folder.result;
        const remove = h('button', { type: 'button', class: 'x98-btn x98-small', 'aria-label': `Remove ${folder.path}` }, 'Remove');
        remove.addEventListener('click', () => { void removeFolder(folder.path); });
        const head = h(
          'div',
          { class: 'x98-folder-head' },
          h('h3', {}, folder.path),
          r ? badge(r.level) : h('span', { class: 'x98-pending' }, 'NOT SCANNED YET'),
          remove,
        );
        const vault = (folder.vault ?? []).filter((e) => e.status === 'quarantined');
        const inVault = new Set(vault.map((e) => e.file));
        const vaultList = vault.length > 0 && h(
          'section',
          { 'aria-label': `Vault of ${folder.path}` },
          h('h4', {}, `In the vault (${vault.length})`),
          h('ul', { class: 'x98-vault' }, ...vault.map((e) => vaultRow(folder.path, e))),
        );
        if (!r) return h('article', { class: 'x98-folder' }, head, vaultList);
        const lines: Child[] = [
          h('p', {}, `${plainSummary(r.findings)} Scanned ${r.filesScanned} file${r.filesScanned === 1 ? '' : 's'} ${formatWhen(r.ranAt)} (${countsText(r.counts)}${r.newCount > 0 ? `, ${r.newCount} new` : ''}).`),
          !r.ok && h('p', { class: 'x98-error', role: 'alert' }, `The last scan failed: ${r.error ?? 'unknown error'}. The findings below are from the scan before.`),
          r.findingsTotal > r.findings.length && h('p', {}, `Showing the ${r.findings.length} worst of ${r.findingsTotal} findings.`),
        ];
        return h(
          'article',
          { class: 'x98-folder' },
          head,
          ...lines,
          r.findings.length > 0 && h('ul', { class: 'x98-findings', 'aria-label': `Findings in ${folder.path}` },
            ...r.findings.map((f) => findingRow(f, { folder: folder.path, inVault, vaultAvailable: status?.vaultAvailable === true, quarantine }))),
          vaultList,
        );
      }),
    );
  }

  function vaultRow(folder: string, e: VaultItem): HTMLElement {
    const open = h('button', { type: 'button', class: 'x98-btn x98-small', 'aria-label': `Restore ${e.file}` }, 'Restore...') as HTMLButtonElement;
    const li = h('li', {}, h('code', {}, e.file), h('span', {}, `moved ${formatWhen(e.createdAt)}`), open);
    if (status?.vaultAvailable !== true) open.disabled = true;
    open.addEventListener('click', () => {
      if (li.querySelector('.x98-confirm')) return;
      open.setAttribute('aria-expanded', 'true');
      li.append(confirmBox({
        title: `Put ${e.file} back?`,
        lines: [
          `A patrol flagged this file (${e.reason}).`,
          'Once it is back, Kiro, your agents and your build will read it again.',
        ],
        confirmLabel: 'Restore file',
        opener: open,
        onConfirm: () => { void restore(folder, e); },
      }));
    });
    return li;
  }
  async function quarantine(folder: string, file: string): Promise<void> {
    say(`Moving ${file} to the vault...`);
    try {
      const { status: code, json } = await call('POST', '/quarantine', { folder, file, confirm: 'move-to-vault' }, { 'x-exorcist-action': 'quarantine' });
      say(code === 200 ? `Moved ${file} to the vault. Run a patrol to update the findings.` : errorOf(json, `Could not move the file (HTTP ${code}).`));
    } catch {
      say('Could not reach the patrol service.');
    }
    await refresh();
  }
  async function restore(folder: string, e: VaultItem): Promise<void> {
    say(`Restoring ${e.file}...`);
    try {
      const { status: code, json } = await call('POST', '/restore', { folder, id: e.id, confirm: 'restore-from-vault' }, { 'x-exorcist-action': 'restore' });
      say(code === 200 ? `Restored ${e.file}. The next patrol will scan it again.` : errorOf(json, `Could not restore the file (HTTP ${code}).`));
    } catch {
      say('Could not reach the patrol service.');
    }
    await refresh();
  }
  async function refresh(): Promise<void> {
    try {
      const { status: code, json } = await call('GET', '/status');
      if (code !== 200) { say(errorOf(json, `Could not load the patrol status (HTTP ${code}).`)); return; }
      const parsed = StatusSchema.safeParse(json);
      if (!parsed.success) { say('The patrol service sent a status this page does not understand.'); return; }
      status = parsed.data;
      render();
    } catch {
      say('Could not reach the patrol service. Is the app enabled?');
    }
  }

  async function removeFolder(path: string): Promise<void> {
    const { status: code, json } = await call('DELETE', `/folders?path=${encodeURIComponent(path)}`);
    say(code === 204 ? `Stopped watching ${path}.` : errorOf(json, 'Could not remove the folder.'));
    await refresh();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const path = input.value.trim();
    if (!path) { say('Type the full path of a folder first.'); input.focus(); return; }
    void (async () => {
      const { status: code, json } = await call('POST', '/folders', { path });
      if (code === 201 || code === 200) {
        say(code === 201 ? `Watching ${path}. Run a patrol to scan it now.` : `${path} is already watched.`);
        input.value = '';
        await refresh();
      } else {
        say(errorOf(json, 'Could not add the folder.'));
        input.focus();
      }
    })();
  });

  patrolBtn.addEventListener('click', () => {
    busy = true;
    render();
    say('Patrol running. Large folders can take a minute.');
    void (async () => {
      try {
        const { status: code, json } = await call('POST', '/patrol');
        if (code === 200 && json && typeof json === 'object' && 'newSeriousTotal' in json && typeof json.newSeriousTotal === 'number') {
          const n = json.newSeriousTotal;
          say(n === 0 ? 'Patrol finished. No new serious problems.' : `Patrol finished. ${n} new serious problem${n === 1 ? '' : 's'} found.`);
        } else {
          say(errorOf(json, `The patrol failed (HTTP ${code}).`));
        }
      } catch {
        say('Could not reach the patrol service.');
      } finally {
        busy = false;
        await refresh();
      }
    })();
  });

  void refresh();
  return () => {
    disposed = true;
    target.replaceChildren();
  };
}

export default mount;
