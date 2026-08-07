# Atlas

A minimal task planner that ranks work for you. Every task carries an impact, an
effort, a confidence and an optional due date; Atlas turns those into a score and
sorts the backlog by it, so the top of the list is always the next thing to do.

Nothing about the ranking is stored — scores are computed per request, so a task
climbs the list on its own as its due date approaches.

## Stack

| Layer    | Choice                                                              |
| -------- | ------------------------------------------------------------------- |
| Frontend | React 18, Vite, `@astrabound/duality`, TanStack Query, React Router |
| API      | Node 24, Fastify 5, Zod                                             |
| Data     | Postgres 18 via `pg` + Drizzle ORM, `drizzle-kit` migrations        |
| Shared   | `packages/shared` — scoring model and request schemas, used by both |

The server runs TypeScript directly through Node's type stripping, so there is no
build step for the API in development or in tests.

## Prerequisites

- Node 24
- A local Postgres 18 reachable on port 5432

## Setup

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL if your Postgres differs
```

Create the two databases (the second is for the API tests):

```bash
psql -U postgres -c "create database atlas"
psql -U postgres -c "create database atlas_test"
```

Apply the schema to both:

```bash
npm run db:migrate
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/atlas_test npx drizzle-kit migrate --config apps/server/drizzle.config.ts
```

Create your account. There is no sign-up page: accounts are made from the CLI.

```bash
npm run create-user -- --username you --name "Your Name" --admin
```

Omit `--password` and the command prompts for one without echoing it. After the
first admin exists, further accounts are made from Settings rather than the CLI.

## Running

```bash
npm run dev
```

The API listens on <http://localhost:8787> and the web client on
<http://localhost:5173>, which proxies `/api` to the server.

## Views and shortcuts

| Where    | What it shows                                                      |
| -------- | ------------------------------------------------------------------ |
| Tasks    | Every open task in score order, with multi-select for bulk edits   |
| Board    | The same tasks in columns by status                                |
| Matrix   | An impact against effort grid, to spot the cheap wins              |
| Projects | Project list with open counts, plus archive and restore            |
| Settings | Scoring weights, appearance, your password, people, export, import |

`Ctrl`/`Cmd` + `K` opens the command palette; `N` adds a task from anywhere.

Selecting rows in the backlog reveals a bar that sets status, project or
assignee across the whole selection in one request. Impact, effort, confidence
and due dates are deliberately absent from it: those are per-task judgements, so
they stay editable one task at a time.

## Backup

Settings offers a JSON export of every project, task and tag. Projects, tags and
assignees are written by name rather than by id, so a bundle can be restored into
a different database; passwords are never included. Importing either merges into
what is already there or replaces the tasks and projects outright, and an
assignee who does not exist in the target arrives unassigned with their name
reported back.

## Deploying to Vercel

One project holds both halves: the client ships as static output and the whole
API runs as a single function at `api/index.ts`, which hands each request to the
same Fastify instance the dev server uses. `vercel.json` carries the build
command, the output directory, the rewrites and the cron schedule, so the only
manual steps are the database and the secrets.

1. Import the repository as a Vercel project and leave the root directory at the
   repository root.
2. Add the Neon integration and attach a database. It sets `DATABASE_URL` (the
   pooled endpoint, which the API uses) and `DATABASE_URL_UNPOOLED` (a direct
   connection, which migrations prefer).
3. Add `CRON_SECRET` as a long random string. Vercel sends it as the bearer token
   on the cron request, and `/api/cron/sweep` refuses to run without it.
4. Deploy. `vercel-build` applies migrations before building the client, so the
   schema is in place before the first request arrives.
5. Create the first account against the deployed database:

```bash
DATABASE_URL="<the unpooled URL>" npm run create-user -- --username you --admin
```

A few deliberate choices for the free tiers: each function instance keeps a pool
of exactly one connection and lets Neon's pooler do the multiplexing, nothing in
the client polls on a timer, and the daily sweep at 00:00 UTC is the only
scheduled work — Hobby cron jobs run once a day.

## Checks

```bash
npm run verify      # typecheck, lint, then tests
npm test            # vitest: unit tests plus API tests against atlas_test
```

The API tests run against real Postgres rather than mocks, so they need
`TEST_DATABASE_URL` set and migrated. They share one database and truncate
between cases, which is why test files run serially.

## How the score works

```text
score = (impact x impactWeight + urgency x urgencyWeight) x confidence / effort
```

Urgency is derived from the due date — overdue or due today is 5, within three
days is 4, within a week 3, within a month 2, and undated work sits at 1. Effort
divides rather than subtracts, so between two equally valuable tasks the cheaper
one wins. The weights and the bucket thresholds (`now`, `next`, `later`,
`someday`) are configurable and stored in the `settings` table.

Pinning a task writes a sparse `manual_rank`, which floats it above the scored
list without renumbering anything else.

## Layout

```text
apps/server      Fastify API, Drizzle schema and migrations, CLI scripts
apps/web         Vite React client
packages/shared  Scoring model, domain vocabulary, Zod request schemas
```
