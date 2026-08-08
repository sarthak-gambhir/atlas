import '@testing-library/jest-dom/vitest';

import type { SubtaskDto } from '@atlas/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtaskList } from './SubtaskList.tsx';

const { addMutate, updateMutate, deleteMutate } = vi.hoisted(() => ({
  addMutate: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
}));

vi.mock('../lib/tasks.ts', () => ({
  useAddSubtask: () => ({ mutate: addMutate, isPending: false }),
  useUpdateSubtask: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteSubtask: () => ({ mutate: deleteMutate, isPending: false }),
}));

const subtasks: SubtaskDto[] = [
  { id: 's1', taskId: 't1', description: 'First step', done: false, position: 0 },
  { id: 's2', taskId: 't1', description: 'Second step', done: true, position: 1 },
];

beforeEach(() => {
  addMutate.mockReset();
  updateMutate.mockReset();
  deleteMutate.mockReset();
});

describe('SubtaskList', () => {
  it('renders each subtask and a done count', () => {
    render(<SubtaskList taskId="t1" subtasks={subtasks} />);

    expect(screen.getByText('First step')).toBeInTheDocument();
    expect(screen.getByText('Second step')).toBeInTheDocument();
    expect(screen.getByText('1/2 done')).toBeInTheDocument();
  });

  it('toggles a subtask done through the update mutation', async () => {
    const user = userEvent.setup();
    render(<SubtaskList taskId="t1" subtasks={subtasks} />);

    await user.click(screen.getByRole('checkbox', { name: /First step/ }));

    expect(updateMutate).toHaveBeenCalledWith({ id: 's1', done: true });
  });

  it('adds a subtask from the input', async () => {
    const user = userEvent.setup();
    render(<SubtaskList taskId="t1" subtasks={subtasks} />);

    await user.type(screen.getByRole('textbox', { name: 'New subtask' }), 'Third step');
    await user.click(screen.getByRole('button', { name: 'Add subtask' }));

    expect(addMutate).toHaveBeenCalledWith(
      { taskId: 't1', description: 'Third step' },
      expect.any(Object),
    );
  });

  it('hides the controls when disabled', () => {
    render(<SubtaskList taskId="t1" subtasks={subtasks} disabled />);

    expect(screen.queryByRole('textbox', { name: 'New subtask' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete subtask/ })).not.toBeInTheDocument();
  });
});
