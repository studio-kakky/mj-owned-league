/**
 * `/l/$publicSlug/matches/$sequenceNumber` — P2 Match 公開ページ
 * (`04-screens.md` § P2, Issue #23).
 *
 * `sequenceNumber` is a string at the router level and must parse to a
 * positive integer. Anything else (negative, NaN, decimal) is treated as a
 * stale URL — we render the not-found view so a malformed copy/paste does
 * not crash the loader.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PublicMatchScreen, PublicNotFoundView } from '../../components/public';
import { getPublicLeagueMatchServerFn } from '../../server/public';

const PublicLeagueMatchPage = () => {
  const { data } = Route.useLoaderData();
  if (data === null) return <PublicNotFoundView />;
  return <PublicMatchScreen data={data} />;
};

export const Route = createFileRoute('/_public/l/$publicSlug/matches/$sequenceNumber')({
  loader: async ({ params }) => {
    const parsed = Number.parseInt(params.sequenceNumber, 10);
    // Guard against URL-bar typos. We return data: null instead of throwing
    // so the screen falls through to the not-found state cleanly.
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { data: null };
    }
    const data = await getPublicLeagueMatchServerFn({
      data: { publicSlug: params.publicSlug, sequenceNumber: parsed },
    });
    return { data };
  },
  component: PublicLeagueMatchPage,
});
