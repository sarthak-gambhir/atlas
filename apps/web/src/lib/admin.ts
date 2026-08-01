import type {
  BackupBundle,
  ChangePasswordInput,
  CreateUserInput,
  ImportResultDto,
  ScoringSettings,
  UpdateUserInput,
  UserSummaryDto,
} from '@atlas/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './api.ts';
import { projectKeys } from './organization.ts';
import { taskKeys } from './tasks.ts';

export function useSaveScoring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scoring: ScoringSettings) =>
      api.put<{ scoring: ScoringSettings }>('/settings/scoring', scoring),
    onSuccess: async ({ scoring }) => {
      queryClient.setQueryData(['settings', 'scoring'], scoring);
      // Every score in the cache was computed with the old weights.
      await queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

function useUserMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCreateUser() {
  return useUserMutation((input: CreateUserInput) =>
    api.post<{ user: UserSummaryDto }>('/users', input),
  );
}

export function useUpdateUser() {
  return useUserMutation(({ id, ...patch }: UpdateUserInput & { id: string }) =>
    api.patch<{ user: UserSummaryDto }>(`/users/${id}`, patch),
  );
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/users/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      // Their assigned tasks are now unassigned.
      await queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.post<{ ok: true }>('/auth/password', input),
  });
}

/**
 * A random, easy-to-copy temporary password for an admin-driven reset. Uses an
 * unambiguous alphabet (no 0/O/1/l) and stays within the 8-1024 server bound.
 */
export function generateTempPassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let password = '';
  for (const byte of bytes) password += alphabet[byte % alphabet.length];
  return password;
}

export function useImportBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      mode: 'merge' | 'replace';
      bundle: BackupBundle;
      assigneeMap?: Record<string, string>;
    }) => api.post<{ result: ImportResultDto }>('/import', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskKeys.all });
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

/** Streams the export straight to a file, so a large backlog never sits in state. */
export async function downloadBackup(): Promise<void> {
  const response = await fetch('/api/export', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Export failed with status ${response.status}`);

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `atlas-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
