import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Grid,
  Heading,
  Icon,
  Inline,
  Stack,
  Text,
} from '@astrabound/duality';
import type { IconType } from 'react-icons';
import { useNavigate } from 'react-router';

import { BrandMark } from '../components/BrandMark.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { ACTION_ICONS } from '../lib/icons.ts';
import { PAGE_ICONS } from '../lib/nav.ts';

interface AboutPageProps {
  /** Rendered inside the app shell (signed in) rather than as the standalone,
   * public landing (signed out). Switches the layout and the primary action. */
  inShell?: boolean;
}

const TAGLINE = 'Do the highest-leverage thing next.';

const INTRO =
  'Atlas is a personal work tracker that ranks everything you have to do by how much it matters, how soon it is due, and how much it will cost you. Capture tasks freely, organize them into projects, and let a single score decide what deserves your attention right now.';

/** The four inputs behind every task's score. */
const FACTORS: ReadonlyArray<{ name: string; detail: string }> = [
  { name: 'Impact', detail: 'How much finishing this moves the needle, rated 1 to 5.' },
  {
    name: 'Urgency',
    detail:
      'A 1 to 5 pressure that climbs on its own as a due date approaches — or pin it by hand when a date does not tell the whole story.',
  },
  {
    name: 'Effort',
    detail:
      'What it costs to finish. Effort divides the score rather than subtracting, so between two equally valuable tasks the cheaper one rises first.',
  },
  {
    name: 'Confidence',
    detail:
      'How sure you are it is worth it (100%, 80%, or 50%), scaling the whole score down when you are guessing.',
  },
];

/** The three lenses on the same task list. */
const VIEWS: ReadonlyArray<{ icon: IconType; title: string; detail: string }> = [
  {
    icon: PAGE_ICONS.tasks,
    title: 'Tasks',
    detail:
      'One ranked list of everything open, highest score first. Pin a task to lock its place at the top.',
  },
  {
    icon: PAGE_ICONS.board,
    title: 'Board',
    detail:
      'Your work in columns by status — Backlog, Next, In progress, Blocked, and Done — so you can see flow at a glance.',
  },
  {
    icon: PAGE_ICONS.matrix,
    title: 'Matrix',
    detail:
      'An impact-versus-effort grid that clusters quick wins and big bets, and quietly flags the time sinks.',
  },
];

/** Everything that keeps a growing backlog under control. */
const ORGANIZE: ReadonlyArray<{ icon: IconType; title: string; detail: string }> = [
  {
    icon: PAGE_ICONS.projects,
    title: 'Projects',
    detail: 'Group related tasks, invite members with roles, and star the projects you live in.',
  },
  {
    icon: ACTION_ICONS.tag,
    title: 'Tags',
    detail: 'Label tasks however you think about them, then filter by tag anywhere.',
  },
  {
    icon: ACTION_ICONS.calendar,
    title: 'Dates & urgency',
    detail:
      'Give a task a start and due date; its urgency — and its score — rise as the deadline nears.',
  },
  {
    icon: ACTION_ICONS.export,
    title: 'Backups',
    detail: 'Export your whole workspace to a JSON file and import it back whenever you need.',
  },
];

/** Body sections shared between the in-shell page and the public landing. */
function AboutSections() {
  return (
    <>
      <Card>
        <CardHeader>
          <Heading level={2} visualLevel={5}>
            How it ranks your work
          </Heading>
        </CardHeader>
        <CardBody>
          <Stack gap={4}>
            <Text>
              Every task earns a score from four inputs. Impact and urgency add up, confidence
              scales the total, and effort divides it — value over cost — so the next best thing to
              do is always at the top.
            </Text>
            <Stack as="dl" gap={3} style={{ margin: 0 }}>
              {FACTORS.map((factor) => (
                <Stack key={factor.name} gap={0}>
                  <Text as="dt" weight="bold">
                    {factor.name}
                  </Text>
                  <Text as="dd" size="sm" style={{ margin: 0 }}>
                    {factor.detail}
                  </Text>
                </Stack>
              ))}
            </Stack>
            <Text size="sm">
              Scores settle into four priority buckets — Now, Next, Later, and Someday — with
              thresholds you can tune in Settings.
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Heading level={2} visualLevel={5}>
            Ways to see your work
          </Heading>
        </CardHeader>
        <CardBody>
          <Grid className="atlas-about-views" columns={3} gap={5}>
            {VIEWS.map((view) => (
              <Inline key={view.title} gap={3} align="start" wrap={false}>
                <Icon icon={view.icon} size="xl" />
                <Stack gap={0}>
                  <Text weight="bold">{view.title}</Text>
                  <Text size="sm">{view.detail}</Text>
                </Stack>
              </Inline>
            ))}
          </Grid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Heading level={2} visualLevel={5}>
            Stay organized
          </Heading>
        </CardHeader>
        <CardBody>
          <Grid as="dl" className="atlas-about-facts" columns={2} gap={5} style={{ margin: 0 }}>
            {ORGANIZE.map((item) => (
              <Inline key={item.title} gap={3} align="start" wrap={false}>
                <Icon icon={item.icon} size="xl" />
                <Stack gap={0}>
                  <Text weight="bold">{item.title}</Text>
                  <Text size="sm">{item.detail}</Text>
                </Stack>
              </Inline>
            ))}
          </Grid>
        </CardBody>
      </Card>
    </>
  );
}

export function AboutPage({ inShell = false }: AboutPageProps) {
  const navigate = useNavigate();

  if (inShell) {
    return (
      <Stack gap={5}>
        <PageHeader title="About" icon={PAGE_ICONS.about} description={TAGLINE} />

        <Card>
          <CardHeader>
            <Heading level={2} visualLevel={5}>
              What Atlas is
            </Heading>
          </CardHeader>
          <CardBody>
            <Text>{INTRO}</Text>
          </CardBody>
        </Card>

        <AboutSections />

        <Inline>
          <Button
            className="atlas-button"
            size="md"
            variant="solid"
            onClick={() => void navigate('/tasks')}
          >
            <IconLabel icon={ACTION_ICONS.task}>Go to Tasks</IconLabel>
          </Button>
        </Inline>
      </Stack>
    );
  }

  return (
    <Box
      paddingX={4}
      paddingY={5}
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
    >
      <Container size="xl" style={{ width: '100%' }}>
        <Stack gap={6}>
          <Stack gap={3} align="center">
            <BrandMark size={48} />
            <Heading level={1}>Atlas</Heading>
            <Text size="lg" align="center">
              {TAGLINE}
            </Text>
            <Text align="center" style={{ maxWidth: '100ch' }}>
              {INTRO}
            </Text>
            <Button
              className="atlas-button"
              size="lg"
              variant="solid"
              onClick={() => void navigate('/login')}
            >
              Sign in
            </Button>
          </Stack>

          <AboutSections />
        </Stack>
      </Container>
    </Box>
  );
}
