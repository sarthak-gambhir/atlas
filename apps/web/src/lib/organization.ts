import type {
  CreateProjectInput,
  ProjectDto,
  TagDto,
  UpdateProjectInput,
  UserSummaryDto,
} from '@atlas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api.ts';
import { taskKeys } from './tasks.ts';

export const projectKeys = { all: ['projects'] as const };

export function useProjects(includeArchived = false) {
  return useQuery({
    queryKey: [...projectKeys.all, { includeArchived }],
    queryFn: async () =>
      (
        await api.get<{ projects: ProjectDto[] }>(
          `/projects${includeArchived ? '?includeArchived=true' : ''}`,
        )
      ).projects,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get<{ tags: TagDto[] }>('/tags')).tags,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<{ users: UserSummaryDto[] }>('/users')).users,
    staleTime: 10 * 60 * 1000,
  });
}

function useProjectMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      // Project changes move task counts, so both caches are stale.
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useCreateProject() {
  return useProjectMutation((input: CreateProjectInput) =>
    api.post<{ project: ProjectDto }>('/projects', input),
  );
}

export function useUpdateProject() {
  return useProjectMutation(({ id, ...patch }: UpdateProjectInput & { id: string }) =>
    api.patch<{ project: ProjectDto }>(`/projects/${id}`, patch),
  );
}
