import { Alert, Box, Grid, Skeleton, Stack, Stat, StatGroup, Text } from '@astrabound/duality';
import type { TaskDto } from '@atlas/shared';
import { useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { TaskFilterToolbar } from '../components/FilterToolbar.tsx';
import { MatrixCell } from '../components/matrix/MatrixCell.tsx';
import { MatrixCellModal } from '../components/matrix/MatrixCellModal.tsx';
import {
  MatrixQuadrantCard,
  type QuadrantStats,
} from '../components/matrix/MatrixQuadrantCard.tsx';
import { MatrixQuadrantModal } from '../components/matrix/MatrixQuadrantModal.tsx';
import { statsForQuadrant } from '../components/matrix/quadrantStats.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { backState } from '../lib/backNav.ts';
import { useFilters } from '../lib/filters.ts';
import { PAGE_ICONS } from '../lib/nav.ts';
import { useTasks } from '../lib/tasks.ts';
import { useIsMobile } from '../lib/useIsMobile.ts';

const QUADRANT_META = [
  {
    id: 'quickWins',
    label: 'Quick wins',
    description: 'High impact, low effort — do these first.',
    high: true,
    low: true,
  },
  {
    id: 'bigBets',
    label: 'Big bets',
    description: 'High impact, high effort — worth the investment.',
    high: true,
    low: false,
  },
  {
    id: 'fillIns',
    label: 'Fill-ins',
    description: 'Low impact, low effort — nice when you have spare time.',
    high: false,
    low: true,
  },
  {
    id: 'timeSinks',
    label: 'Time sinks',
    description: 'Low impact, high effort — deprioritize or cut.',
    high: false,
    low: false,
  },
] as const;

type QuadrantId = (typeof QUADRANT_META)[number]['id'];

const LEVELS = [1, 2, 3, 4, 5] as const;
/** High impact at the top, so the cheapest wins sit in the top-left. */
const IMPACT_ROWS = [...LEVELS].reverse();

/** Split at the middle: impact >= 3 is high, effort <= 3 is low. */
const isHighImpact = (task: TaskDto) => task.impact >= 3;
const isLowEffort = (task: TaskDto) => task.effort <= 3;

export function MatrixPage() {
  const filters = useFilters({ includeClosed: true });
  const { data: tasks, isPending, error } = useTasks(filters.query);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [openCell, setOpenCell] = useState<{ impact: number; effort: number } | null>(null);
  const [openQuadrant, setOpenQuadrant] = useState<QuadrantId | null>(null);

  // Group by impact:effort, each list sorted by score so the tile shows the top
  // score and the modal reads the same order.
  const cells = useMemo(() => {
    const grouped = new Map<string, TaskDto[]>();
    for (const task of tasks ?? []) {
      const key = `${task.impact}:${task.effort}`;
      const existing = grouped.get(key);
      if (existing) existing.push(task);
      else grouped.set(key, [task]);
    }
    for (const list of grouped.values()) list.sort((a, b) => b.score - a.score);
    return grouped;
  }, [tasks]);

  const quadrantTasks = useMemo(() => {
    const groups: Record<QuadrantId, TaskDto[]> = {
      quickWins: [],
      bigBets: [],
      fillIns: [],
      timeSinks: [],
    };
    for (const task of tasks ?? []) {
      const high = isHighImpact(task);
      const low = isLowEffort(task);
      if (high && low) groups.quickWins.push(task);
      else if (high && !low) groups.bigBets.push(task);
      else if (!high && low) groups.fillIns.push(task);
      else groups.timeSinks.push(task);
    }
    for (const list of Object.values(groups)) list.sort((a, b) => b.score - a.score);
    return groups;
  }, [tasks]);

  const quadrantStats = useMemo(
    () =>
      Object.fromEntries(
        QUADRANT_META.map((meta) => [meta.id, statsForQuadrant(quadrantTasks[meta.id])]),
      ) as Record<QuadrantId, QuadrantStats>,
    [quadrantTasks],
  );

  const openTasks = openCell ? (cells.get(`${openCell.impact}:${openCell.effort}`) ?? []) : [];

  const mobileQuadrantCards = isMobile ? (
    isPending ? (
      <Grid minChildWidth={240} gap={3}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={160} />
        ))}
      </Grid>
    ) : (
      <Grid minChildWidth={240} gap={3}>
        {QUADRANT_META.map((meta) => (
          <MatrixQuadrantCard
            key={meta.id}
            label={meta.label}
            description={meta.description}
            stats={quadrantStats[meta.id]}
            onClick={() => setOpenQuadrant(meta.id)}
          />
        ))}
      </Grid>
    )
  ) : null;

  return (
    <Stack gap={4}>
      <PageHeader
        title="Matrix"
        icon={PAGE_ICONS.matrix}
        description={
          isMobile
            ? 'Four impact/effort quadrants. Tap one to see its tasks.'
            : 'Impact down, effort across. The top-left corner is where the cheap wins live.'
        }
        actions={<TaskFilterToolbar filters={filters} />}
      />

      {!isMobile ? (
        <Text size="sm">
          High impact and low effort is a quick win. Click any cell to see its tasks.
        </Text>
      ) : null}

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {!isMobile ? (
        <StatGroup>
          <Stat label="Quick wins" value={quadrantStats.quickWins.count} />
          <Stat label="Big bets" value={quadrantStats.bigBets.count} />
          <Stat label="Fill-ins" value={quadrantStats.fillIns.count} />
          <Stat label="Time sinks" value={quadrantStats.timeSinks.count} />
        </StatGroup>
      ) : null}

      {mobileQuadrantCards}

      {!isMobile ? (
        <Grid
          columns={6}
          gap={2}
          align="stretch"
          justify="center"
          // A narrow first column for the impact labels, five equal effort columns.
          style={{ ['--du-cols']: 'minmax(6rem, auto) repeat(5, minmax(0, 1fr))' } as CSSProperties}
        >
          <Box
            paddingX={1}
            paddingY={1}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text size="sm" weight="bold">
              Impact / Effort
            </Text>
          </Box>

          {LEVELS.map((effort) => (
            <Box
              paddingX={1}
              paddingY={1}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              key={`head-${effort}`}
            >
              <Text size="sm" weight="bold" align="center">
                E{effort}
              </Text>
            </Box>
          ))}

          {IMPACT_ROWS.map((impact) => (
            <MatrixRow
              key={impact}
              impact={impact}
              cells={cells}
              isPending={isPending}
              onOpen={(i, e) => setOpenCell({ impact: i, effort: e })}
            />
          ))}
        </Grid>
      ) : null}

      {openCell ? (
        <MatrixCellModal
          impact={openCell.impact}
          effort={openCell.effort}
          tasks={openTasks}
          onClose={() => setOpenCell(null)}
          onOpenTask={(id) =>
            void navigate(`/tasks/${id}`, {
              state: backState({ label: 'Matrix', to: location.pathname + location.search }),
            })
          }
        />
      ) : null}

      {openQuadrant ? (
        <MatrixQuadrantModal
          label={QUADRANT_META.find((meta) => meta.id === openQuadrant)!.label}
          tasks={quadrantTasks[openQuadrant]}
          onClose={() => setOpenQuadrant(null)}
          onOpenTask={(id) =>
            void navigate(`/tasks/${id}`, {
              state: backState({ label: 'Matrix', to: location.pathname + location.search }),
            })
          }
        />
      ) : null}
    </Stack>
  );
}

interface MatrixRowProps {
  impact: number;
  cells: Map<string, TaskDto[]>;
  isPending: boolean;
  onOpen: (impact: number, effort: number) => void;
}

/** A fragment, so every cell stays a direct child of the one grid. */
function MatrixRow({ impact, cells, isPending, onOpen }: MatrixRowProps) {
  return (
    <>
      <Box
        paddingX={1}
        paddingY={1}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text size="md" weight="bold" align="center">
          I{impact}
        </Text>
      </Box>

      {LEVELS.map((effort) =>
        isPending ? (
          <Skeleton key={`${impact}:${effort}`} height={64} />
        ) : (
          <MatrixCell
            key={`${impact}:${effort}`}
            impact={impact}
            effort={effort}
            tasks={cells.get(`${impact}:${effort}`) ?? []}
            onOpen={onOpen}
          />
        ),
      )}
    </>
  );
}
