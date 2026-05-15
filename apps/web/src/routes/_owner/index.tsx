/**
 * `/` — S3 Owner ダッシュボード (`04-screens.md` § S3, Issue #14).
 *
 * Wiring strategy mirrors `/groups` (Issue #15): the route loader is the only
 * place that crosses the TanStack Start RPC boundary. The presentational
 * {@link DashboardScreen} takes the already-projected payload as a prop and
 * never imports the server function directly.
 *
 *   - `getDashboardServerFn` → route `loader`. Reads the Owner-scoped
 *     `DashboardData` (groups, active leagues / matches, recent games,
 *     pending invitation count). Issue #14 only needs reads; no mutations
 *     happen on this screen — every edit affordance is a link to the
 *     destination screen (S4 / S15 / S9 / S14).
 *
 * Owner identity (`ownerId`) comes from the parent `_owner` layout's
 * `beforeLoad`, which we surface via `Route.useRouteContext()` for the
 * loader and projection.
 *
 * Loader-side aggregation:
 *   The S3 spec lists four data sources (Groups / Leagues / Matches /
 *   Invitations + the recent-games feed). We do not split these into
 *   parallel loaders — TanStack Start loaders run serially in a single
 *   round-trip, and the server function aggregates everything from the
 *   shared in-memory store in O(n) over a handful of Maps. When the D1
 *   binding lands (#39) the same handler will fan out into four scoped
 *   queries; the call signature on the client stays unchanged.
 */

import { createFileRoute } from '@tanstack/react-router';
import { DashboardScreen } from '../../components/dashboard';
import { getDashboardServerFn } from '../../server/dashboard';

export const Route = createFileRoute('/_owner/')({
  loader: async ({ context }) => {
    const data = await getDashboardServerFn({
      data: { ownerId: context.ownerSession.ownerId },
    });
    return { data };
  },
  component: OwnerDashboardPage,
});

function OwnerDashboardPage() {
  const { data } = Route.useLoaderData();
  return <DashboardScreen data={data} />;
}
