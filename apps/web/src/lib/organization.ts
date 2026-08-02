import type {
  CreateProjectInput,
  ProjectDto,
  ProjectMemberRole,
  SessionUser,
  TagDto,
  UpdateProjectInput,
  UserSummaryDto,
} from '@atlas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api.ts';
import { taskKeys } from './tasks.ts';

export const projectKeys = { all: ['projects'] as const };

/** Owner-or-admin may edit/archive a project and manage its members. */
export function canManageProject(
  project: Pick<ProjectDto, 'ownerId'>,
  session: SessionUser | null | undefined,
): boolean {
  if (!session) return false;
  return session.role === 'admin' || project.ownerId === session.id;
}

/**
 * Whether the session user may edit a project's tasks: admins and the owner
 * always, plus members whose project role is `editor`. Viewers are read-only.
 */
export function canEditProject(
  project: Pick<ProjectDto, 'ownerId' | 'memberRoles'>,
  session: SessionUser | null | undefined,
): boolean {
  if (!session) return false;
  if (session.role === 'admin' || project.ownerId === session.id) return true;
  return project.memberRoles[session.id] === 'editor';
}

/** The session user's effective role in a project, for labels and gating. */
export function projectRoleFor(
  project: Pick<ProjectDto, 'ownerId' | 'memberRoles'>,
  userId: string,
): 'owner' | ProjectMemberRole | null {
  if (project.ownerId === userId) return 'owner';
  return project.memberRoles[userId] ?? null;
}

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

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: [...projectKeys.all, 'detail', id],
    queryFn: async () => (await api.get<{ project: ProjectDto }>(`/projects/${id}`)).project,
    enabled: id != null,
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

export function useDeleteProject() {
  return useProjectMutation((id: string) => api.delete<void>(`/projects/${id}`));
}

export function useAddProjectMember() {
  return useProjectMutation(
    ({ id, userId, role }: { id: string; userId: string; role?: ProjectMemberRole }) =>
      api.post<{ project: ProjectDto }>(`/projects/${id}/members`, { userId, role }),
  );
}

export function useUpdateMemberRole() {
  return useProjectMutation(
    ({ id, userId, role }: { id: string; userId: string; role: ProjectMemberRole }) =>
      api.patch<{ project: ProjectDto }>(`/projects/${id}/members/${userId}`, { role }),
  );
}

export function useRemoveProjectMember() {
  return useProjectMutation(({ id, userId }: { id: string; userId: string }) =>
    api.delete<{ project: ProjectDto }>(`/projects/${id}/members/${userId}`),
  );
}

export function useTransferProjectOwnership() {
  return useProjectMutation(({ id, userId }: { id: string; userId: string }) =>
    api.post<{ project: ProjectDto }>(`/projects/${id}/owner`, { userId }),
  );
}
