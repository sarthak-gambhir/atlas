import { Badge, Table, TBody, Td, Th, Tooltip, Tr } from '@astrabound/duality';
import { urgencyFor, type TaskDto } from '@atlas/shared';

import { todayIso } from '../lib/dates.ts';

interface ScoreCellProps {
  task: TaskDto;
}

/**
 * The score badge, shown inside task tables, with a hover popover that breaks
 * the score down into the factors that produced it.
 */
export function ScoreCell({ task }: ScoreCellProps) {
  const urgency = urgencyFor(task.dueDate, task.urgencyOverride, todayIso());
  const factors: Array<[label: string, value: string | number]> = [
    ['Impact', task.impact],
    ['Effort', task.effort],
    ['Urgency', urgency],
    ['Confidence', `${Math.round(task.confidence * 100)}%`],
  ];

  return (
    // These cells live inside a DataTable whose rows navigate on click, so keep
    // clicking the score from bubbling up into a row navigation.
    <span onClick={(event) => event.stopPropagation()}>
      <Tooltip
        className="atlas-score-tip"
        placement="bottom"
        content={
          <Table aria-label="Score factors" style={{ minInlineSize: '9rem' }}>
            <TBody>
              {factors.map(([label, value]) => (
                <Tr key={label}>
                  <Th scope="row">{label}</Th>
                  <Td align="end">{value}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        }
      >
        <span className="atlas-score-trigger" tabIndex={0} aria-label={`Score ${task.score}`}>
          <Badge variant="solid">{task.score}</Badge>
        </span>
      </Tooltip>
    </span>
  );
}
