/** Scoped under `.x98` so nothing leaks into the Crew dashboard. */
export const CSS = `
.x98 { font: 14px/1.45 "MS Sans Serif", Tahoma, Verdana, system-ui, sans-serif; color: #000; padding: 16px; }
.x98 *, .x98 *::before, .x98 *::after { box-sizing: border-box; }
.x98-window { background: #c0c0c0; border: 2px solid; border-color: #fff #404040 #404040 #fff; box-shadow: 1px 1px 0 #000; max-width: 980px; }
.x98-titlebar { background: linear-gradient(90deg, #4b0a0a, #8a1c1c); color: #fff; padding: 4px 8px; }
.x98-titlebar h1 { font-size: 15px; margin: 0; letter-spacing: .5px; }
.x98-body { padding: 12px 14px 16px; }
.x98 h2 { font-size: 15px; margin: 18px 0 8px; }
.x98 h3 { font-size: 14px; margin: 0; word-break: break-all; font-family: "Courier New", monospace; }
.x98-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.x98-last { margin: 0; }
.x98-btn { font: inherit; color: #000; background: #c0c0c0; padding: 4px 14px; border: 2px solid; border-color: #fff #404040 #404040 #fff; cursor: pointer; }
.x98-btn:active { border-color: #404040 #fff #fff #404040; }
.x98-btn:disabled { color: #4a4a4a; cursor: default; }
.x98-small { padding: 1px 8px; font-size: 13px; }
.x98 :focus-visible { outline: 3px solid #000; outline-offset: 2px; box-shadow: 0 0 0 5px #ffe66d; }
.x98-form { display: grid; grid-template-columns: auto 1fr auto; gap: 6px 8px; align-items: center; margin-top: 12px; }
.x98-help { grid-column: 1 / -1; margin: 0; font-size: 13px; color: #1a1a1a; }
.x98-input { font: 14px "Courier New", monospace; padding: 4px 6px; background: #fff; color: #000; border: 2px solid; border-color: #404040 #fff #fff #404040; min-width: 0; }
.x98-live { min-height: 1.45em; margin: 8px 0 0; background: #000; color: #39ff6a; font-family: "Courier New", monospace; padding: 4px 8px; }
.x98-live:empty::before { content: "> ready"; }
.x98-folders { display: grid; gap: 10px; }
.x98-folder { background: #d4d0c8; border: 2px solid; border-color: #404040 #fff #fff #404040; padding: 8px 10px; }
.x98-folder p { margin: 6px 0; }
.x98-folder-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.x98-folder-head h3 { flex: 1 1 260px; }
.x98-empty { margin: 0; }
.x98-pending { font-weight: 700; font-size: 12px; border: 1px solid #000; padding: 1px 6px; }
.x98-error { background: #fff; border: 2px solid #8b0000; padding: 4px 8px; }
.x98-sev { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: 12px; padding: 1px 6px; border: 1px solid #000; white-space: nowrap; }
.x98-sev-critical { background: #8b0000; color: #fff; }
.x98-sev-high { background: #ffb000; color: #000; }
.x98-sev-medium { background: #ffe66d; color: #000; }
.x98-sev-low { background: #cfe8ff; color: #000; }
.x98-sev-clean { background: #1f5f1f; color: #fff; }
.x98-findings { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
.x98-finding { background: #fff; border: 1px solid #808080; padding: 4px 8px; }
.x98-finding summary { cursor: pointer; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.x98-title { font-weight: 700; }
.x98-loc { font-family: "Courier New", monospace; word-break: break-all; }
.x98-finding dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 8px 0 4px; }
.x98-finding dt { font-weight: 700; }
.x98-finding dd { margin: 0; white-space: pre-wrap; word-break: break-word; }
.x98-span { background: #000; color: #39ff6a; padding: 1px 4px; font-family: "Courier New", monospace; }
@media (max-width: 600px) { .x98 { padding: 6px; } .x98-form { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .x98 * { transition: none !important; animation: none !important; } }
`;
