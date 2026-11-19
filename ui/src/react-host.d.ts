// The few React APIs the Crew entry uses. React is supplied at run time by the
// Crew dashboard's import map, so it is not a dependency of this repository.
declare module 'react' {
  export function createElement(type: string, props: Record<string, unknown> | null, ...children: unknown[]): unknown;
  export function useRef<T>(initial: T): { current: T };
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
}
