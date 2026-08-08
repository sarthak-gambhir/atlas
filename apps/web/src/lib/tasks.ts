import {
  DEFAULT_SCORING,
  type BulkUpdateInput,
  type BulkUpdateResultDto,
  type CreateTaskInput,
  type ScoringSettings,
  type SubtaskDto,
  type TaskDto,
  type TaskFilter,
  type UpdateSubtaskInput,
  type UpdateTaskInput,
} from '@atlas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api.ts';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filter: TaskFilter) => ['tasks', 'list', filter] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
};

function toSearch(filter: TaskFilter): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value == null || value === '') continue;
    // Arrays (statuses, tags) become repeated keys: ?statuses=a&statuses=b.
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useTasks(filter: TaskFilter = {}) {
  return useQuery({
    queryKey: taskKeys.list(filter),
    queryFn: async () => (await api.get<{ tasks: TaskDto[] }>(`/tasks${toSearch(filter)}`)).tasks,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: async () => (await api.get<{ task: TaskDto }>(`/tasks/${id!}`)).task,
    enabled: id != null,
    // A 404 (deleted or no access) should surface at once, not after retries.
    retry: false,
  });
}

export function useScoringSettings() {
  return useQuery({
    queryKey: ['settings', 'scoring'],
    queryFn: async () => (await api.get<{ scoring: ScoringSettings }>('/settings/scoring')).scoring,
    staleTime: 10 * 60 * 1000,
    // The defaults render immediately, but count as stale so the real weights
    // are fetched on mount rather than after staleTime.
    initialData: DEFAULT_SCORING,
    initialDataUpdatedAt: 0,
  });
}

/** Every task mutation invalidates the whole list: the ranking is global. */
function useTaskMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useCreateTask() {
  return useTaskMutation((input: CreateTaskInput) =>
    api.post<{ task: TaskDto }>('/tasks', input),
  );
}

export function useUpdateTask() {
  return useTaskMutation(({ id, ...patch }: UpdateTaskInput & { id: string }) =>
    api.patch<{ task: TaskDto }>(`/tasks/${id}`, patch),
  );
}

export function useCompleteTask() {
  return useTaskMutation((id: string) => api.post<{ task: TaskDto }>(`/tasks/${id}/complete`));
}

export function useDeleteTask() {
  return useTaskMutation((id: string) => api.delete<void>(`/tasks/${id}`));
}

export function useBulkUpdateTasks() {
  return useTaskMutation((input: BulkUpdateInput) =>
    api.post<BulkUpdateResultDto>('/tasks/bulk', input),
  );
}

/** Subtasks live inside their task's DTO, so their mutations invalidate the list too. */
export function useAddSubtask() {
  return useTaskMutation(({ taskId, description }: { taskId: string; description: string }) =>
    api.post<{ subtask: SubtaskDto }>(`/tasks/${taskId}/subtasks`, { description }),
  );
}

export function useUpdateSubtask() {
  return useTaskMutation(({ id, ...patch }: UpdateSubtaskInput & { id: string }) =>
    api.patch<{ subtask: SubtaskDto }>(`/subtasks/${id}`, patch),
  );
}

export function useDeleteSubtask() {
  return useTaskMutation((id: string) => api.delete<void>(`/subtasks/${id}`));
}
