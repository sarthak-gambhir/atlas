import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Grid,
  Stat,
  Text,
} from '@astrabound/duality';

export interface QuadrantStats {
  count: number;
  maxScore: number | '—';
  activeCount: number;
  closedCount: number;
}

interface MatrixQuadrantCardProps {
  label: string;
  description: string;
  stats: QuadrantStats;
  onClick: () => void;
}

/** Clickable quadrant summary: task count, active work, and score range. */
export function MatrixQuadrantCard({ label, description, stats, onClick }: MatrixQuadrantCardProps) {
  return (
    <Card
      as="button"
      type="button"
      interactive
      className="atlas-matrix-quadrant-card"
      onClick={onClick}
    >
      <CardHeader>
        <Text weight="bold">{label}</Text>
      </CardHeader>

      <CardBody className="atlas-matrix-quadrant-card__body">
        <Grid columns={2} gap={0}>
          <Stat label="Tasks" value={stats.count} />
          <Stat label="Active" value={stats.activeCount} />
          <Stat label="Max score" value={stats.maxScore} />
          <Stat label="Closed" value={stats.closedCount} />
        </Grid>
      </CardBody>

      <CardFooter>
        <Text size="sm">{description}</Text>
      </CardFooter>
    </Card>
  );
}
