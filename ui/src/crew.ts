// Entry Crew loads (ui.entry). Seen in Crew 0.12.2's dashboard: the host does
// `React.lazy(() => import(entry))` and renders the module's DEFAULT export as
// a React component with no props; `mountFunction` is not used on that path.
// So the default export is a component that hosts the plain-DOM page.
// `react` comes from the host's import map and is never bundled.
import { createElement, useEffect, useRef } from 'react';
import { mount } from './index.js';

export default function ExorcistPage(): unknown {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? mount(el) : undefined;
  }, []);
  return createElement('div', { ref, className: 'x98-host', style: { flex: '1 1 auto', overflow: 'auto', minHeight: 0 } });
}

export { mount };
