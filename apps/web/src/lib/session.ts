import type { LoginInput, SessionUser, UpdateProfileInput } from '@atlas/shared';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { ApiError, api } from './api.ts';

export const sessionKey = ['session'] as const;

/**
 * The public demo account seeded by `npm run seed-demo`. Used by the "Try the
 * demo" buttons to sign a visitor straight in as John Doe.
 */
export const DEMO_CREDENTIALS: LoginInput = {
  username: 'john.doe',
  password: 'demo-password-123',
};

/**
 * True for the shared public demo login. Its username and password are locked
 * server-side, so the UI hides those controls rather than letting them fail.
 */
export function isDemoAccount(user?: Pick<SessionUser, 'username'> | null): boolean {
  return user?.username.toLowerCase() === DEMO_CREDENTIALS.username.toLowerCase();
}

/** Resolves to null when signed out, rather than surfacing a 401 as an error. */
export function useSession(): UseQueryResult<SessionUser | null> {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        const { user } = await api.get<{ user: SessionUser }>('/auth/me');
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => api.post<{ user: SessionUser }>('/auth/login', input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(sessionKey, user);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api.patch<{ user: SessionUser }>('/auth/me', input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(sessionKey, user);
    },
  });
}

/**
 * Live availability probe for the profile editor. Only runs when `enabled`, so
 * callers can gate it on a valid, changed, debounced username. Pass the id of
 * the account being edited so its own current name is treated as available.
 */
export function useUsernameAvailability(username: string, enabled: boolean, excludeUserId?: string) {
  return useQuery({
    queryKey: ['username-available', username.toLowerCase(), excludeUserId ?? 'self'],
    queryFn: () => {
      const params = new URLSearchParams({ username });
      if (excludeUserId) params.set('excludeUserId', excludeUserId);
      return api.get<{ available: boolean }>(`/auth/username-available?${params.toString()}`);
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useSignOutOtherDevices() {
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/auth/logout-others'),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(sessionKey, null);
      // Everything else in the cache belonged to the previous session.
      queryClient.removeQueries({ predicate: (query) => query.queryKey !== sessionKey });
    },
  });
}
