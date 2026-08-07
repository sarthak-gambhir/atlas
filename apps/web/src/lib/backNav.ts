import { useLocation } from 'react-router';

/** Where a detail page's "Back" control should return to, and how to name it. */
export interface BackTarget {
  /** Human label, e.g. 'Tasks', 'Board', or a project's name. */
  label: string;
  /** Route to navigate back to. */
  to: string;
}

/**
 * Wraps an origin as router navigation `state`, so a detail page can read where
 * the user came from. Spread into `navigate(to, backState(target))` or a `Link`'s
 * `state` prop.
 */
export function backState(target: BackTarget): { from: BackTarget } {
  return { from: target };
}

function isBackTarget(value: unknown): value is BackTarget {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.label === 'string' && typeof candidate.to === 'string';
}

/**
 * The origin recorded by whoever navigated here, or `fallback` when there is
 * none (a deep link, a hard refresh, or an entry point that did not tag state).
 * The `state` shape is untyped in React Router, so it is validated before use.
 */
export function useBackTarget(fallback: BackTarget): BackTarget {
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  return isBackTarget(from) ? from : fallback;
}
