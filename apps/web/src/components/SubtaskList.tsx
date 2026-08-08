import { Button, Checkbox, Icon, Inline, Input, Stack, Text } from '@astrabound/duality';
import type { SubtaskDto } from '@atlas/shared';
import { useState, type FormEvent } from 'react';

import { ACTION_ICONS } from '../lib/icons.ts';
import { useAddSubtask, useDeleteSubtask, useUpdateSubtask } from '../lib/tasks.ts';

interface SubtaskListProps {
  taskId: string;
  subtasks: SubtaskDto[];
  /** Read-only when the task is locked (archived project/task or view-only access). */
  disabled?: boolean;
}

/**
 * A flat checklist under a task. Each item mutates the server immediately and
 * independently of the surrounding modal's Save/Cancel, since subtasks are their
 * own records rather than task fields.
 */
export function SubtaskList({ taskId, subtasks, disabled = false }: SubtaskListProps) {
  const add = useAddSubtask();
  const update = useUpdateSubtask();
  const remove = useDeleteSubtask();
  const [draft, setDraft] = useState('');

  const doneCount = subtasks.filter((subtask) => subtask.done).length;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const description = draft.trim();
    if (description === '') return;
    add.mutate({ taskId, description }, { onSuccess: () => setDraft('') });
  };

  return (
    <Stack gap={2}>
      <Inline gap={2} align="center" justify="between">
        <Text weight="bold" size="sm">
          Subtasks
        </Text>
        {subtasks.length > 0 ? (
          <Text size="sm">
            {doneCount}/{subtasks.length} done
          </Text>
        ) : null}
      </Inline>

      {subtasks.length === 0 ? (
        <Text size="sm">No subtasks yet.</Text>
      ) : (
        <Stack gap={1}>
          {subtasks.map((subtask) => (
            <Inline key={subtask.id} gap={2} align="center" justify="between">
              <Checkbox
                label={
                  <span style={{ textDecoration: subtask.done ? 'line-through' : undefined }}>
                    {subtask.description}
                  </span>
                }
                checked={subtask.done}
                disabled={disabled || update.isPending}
                onChange={(event) =>
                  update.mutate({ id: subtask.id, done: event.target.checked })
                }
              />
              {!disabled ? (
                <Button
                  className="atlas-button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete subtask: ${subtask.description}`}
                  onClick={() => remove.mutate(subtask.id)}
                  disabled={remove.isPending}
                >
                  <Icon icon={ACTION_ICONS.delete} />
                </Button>
              ) : null}
            </Inline>
          ))}
        </Stack>
      )}

      {!disabled ? (
        <form onSubmit={submit}>
          <Inline gap={2} align="center">
            <Input
              value={draft}
              placeholder="Add a subtask"
              aria-label="New subtask"
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              type="submit"
              className="atlas-button"
              size="md"
              variant="solid"
              aria-label="Add subtask"
              disabled={add.isPending || draft.trim() === ''}
            >
              <Icon icon={ACTION_ICONS.create} />
            </Button>
          </Inline>
        </form>
      ) : null}
    </Stack>
  );
}
