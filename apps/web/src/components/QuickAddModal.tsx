import {
  Badge,
  Button,
  DatePicker,
  FormField,
  Heading,
  Inline,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Select,
  Stack,
  TagInput,
  useToast,
} from '@astrabound/duality';
import { bucketFor, computeScore } from '@atlas/shared';
import { useState, type FormEvent } from 'react';

import { BucketBadge } from './BucketBadge.tsx';
import { formatIsoDate, parseIsoDate, todayIso } from '../lib/dates.ts';
import { useProjects } from '../lib/organization.ts';
import { useCreateTask, useScoringSettings } from '../lib/tasks.ts';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
  const create = useCreateTask();
  const { data: scoring } = useScoringSettings();
  const { data: projects } = useProjects();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [impact, setImpact] = useState(3);
  const [effort, setEffort] = useState(3);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [projectId, setProjectId] = useState('');

  const preview = computeScore(
    { impact, effort, confidence: 1, dueDate, urgencyOverride: null },
    scoring,
    todayIso(),
  );

  const reset = () => {
    setTitle('');
    setImpact(3);
    setEffort(3);
    setDueDate(null);
    setTags([]);
    setProjectId('');
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      { title, impact, effort, dueDate, tags, projectId: projectId === '' ? null : projectId },
      {
        onSuccess: () => {
          toast({ title: 'Task added', tone: 'success' });
          reset();
          onClose();
        },
        onError: (error) =>
          toast({ title: 'Could not add task', description: error.message, tone: 'error' }),
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showCloseButton aria-label="New task">
      <form onSubmit={submit}>
        <ModalHeader>
          <Inline gap={3} align="center" justify="between">
            <Heading level={2} visualLevel={4}>
              New task
            </Heading>
            <Inline gap={2} align="center">
              <Badge variant="solid">{preview}</Badge>
              <BucketBadge bucket={bucketFor(preview, scoring.thresholds)} />
            </Inline>
          </Inline>
        </ModalHeader>

        <ModalBody>
          <Stack gap={4}>
            <FormField label="Title" required>
              <Input
                value={title}
                autoFocus
                placeholder="What needs doing?"
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>

            <Inline gap={3} align="start">
              <FormField label="Impact" hint="1 low, 5 high">
                <NumberInput
                  value={impact}
                  min={1}
                  max={5}
                  onValueChange={(value) => setImpact(value ?? 1)}
                />
              </FormField>

              <FormField label="Effort" hint="1 cheap, 5 costly">
                <NumberInput
                  value={effort}
                  min={1}
                  max={5}
                  onValueChange={(value) => setEffort(value ?? 1)}
                />
              </FormField>
            </Inline>

            <FormField label="Project">
              <Select
                value={projectId}
                options={[
                  { value: '', label: 'No project' },
                  ...(projects ?? []).map((project) => ({
                    value: project.id,
                    label: project.name,
                  })),
                ]}
                onValueChange={setProjectId}
              />
            </FormField>

            <FormField label="Due date">
              <DatePicker
                value={parseIsoDate(dueDate)}
                clearable
                placeholder="No due date"
                onValueChange={(value) => setDueDate(formatIsoDate(value))}
              />
            </FormField>

            <FormField label="Tags">
              <TagInput value={tags} onValueChange={setTags} placeholder="Add a tag" />
            </FormField>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Inline gap={2} justify="end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" disabled={create.isPending || title.trim() === ''}>
              {create.isPending ? 'Adding...' : 'Add task'}
            </Button>
          </Inline>
        </ModalFooter>
      </form>
    </Modal>
  );
}
