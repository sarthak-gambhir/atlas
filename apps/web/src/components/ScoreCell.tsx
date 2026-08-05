import { Badge, Table, TBody, Td, Th, Tooltip, Tr } from '@astrabound/duality';
import { CLOSED_STATUSES, relevantDue, urgencyFor, type TaskDto } from '@atlas/shared';

import { todayIso } from '../lib/dates.ts';

interface ScoreCellProps {
  task: TaskDto;
}

/**
 * The score badge, shown inside task tables, with a hover popover that breaks
 * the score down into the factors that produced it.
 */
export function ScoreCell({ task }: ScoreCellProps) {
  // Mirror computeScore: closed tasks freeze urgency at their completion date, so
  // the popover shows the same urgency that produced the (frozen) score.
  const closed = (CLOSED_STATUSES as readonly string[]).includes(task.status);
  const completedDay = task.completedAt ? task.completedAt.slice(0, 10) : null;
  const reference = closed ? completedDay : todayIso();
  const relevantDate =
    closed && completedDay == null
      ? null
      : relevantDue(task.status, task.dueStartDate, task.dueEndDate).date;
  const urgency = urgencyFor(relevantDate, task.urgencyOverride, reference ?? todayIso());
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
