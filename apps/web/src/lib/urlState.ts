import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * A boolean backed by a URL query param (`?key=true`). Absent means false.
 * Writes replace history (so toggling never spams the back button) and preserve
 * every other param, so several of these can coexist on one route.
 */
export function useBooleanParam(key: string): [boolean, (value: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const setValue = useCallback(
    (value: boolean) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, 'true');
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [key, setParams],
  );
  return [params.get(key) === 'true', setValue];
}

/**
 * A string backed by a URL query param. Empty means "not set" and drops the key.
 * Same replace-and-preserve semantics as {@link useBooleanParam}.
 */
export function useStringParam(key: string): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const setValue = useCallback(
    (value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [key, setParams],
  );
  return [params.get(key) ?? '', setValue];
}
