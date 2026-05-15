/**
 * `/l/$publicSlug` — P1 League 公開ページ (`04-screens.md` § P1, Issue #23).
 *
 * Wiring strategy mirrors the Owner-side `/leagues/$leagueId` route:
 *   - `getPublicLeagueServerFn` → route loader. Returns the projected
 *     {@link PublicLeagueData} payload or `null` for unknown slugs.
 *   - On `null` we render {@link PublicNotFoundView} inline rather than
 *     redirecting — viewers might land on a stale URL from any channel, and
 *     bouncing them silently elsewhere would mask the cause.
 *   - No auth check; `_public.tsx` provides the shell without an
 *     `beforeLoad` gate. The slug is the access control.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PublicLeagueScreen, PublicNotFoundView } from '../../components/public';
import { getPublicLeagueServerFn } from '../../server/public';

export const Route = createFileRoute('/_public/l/$publicSlug')({
  loader: async ({ params }) => {
    const data = await getPublicLeagueServerFn({ data: { publicSlug: params.publicSlug } });
    return { data };
  },
  component: PublicLeaguePage,
});

function PublicLeaguePage() {
  const { data } = Route.useLoaderData();
  if (data === null) return <PublicNotFoundView />;
  return <PublicLeagueScreen data={data} />;
}
