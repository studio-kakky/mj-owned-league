/**
 * `/l/$publicSlug/players/$playerId` — P4 個人成績ページ
 * (`04-screens.md` § P4, Issue #23).
 *
 * The Player must belong to the same Group as the League resolved from the
 * slug — `getPublicPlayerHandler` enforces that and returns `null` on
 * mismatch so a malicious URL cannot bridge into a foreign Owner's data.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PublicNotFoundView, PublicPlayerScreen } from '../../components/public';
import { getPublicPlayerServerFn } from '../../server/public';

const PublicLeaguePlayerPage = () => {
  const { data } = Route.useLoaderData();
  if (data === null) return <PublicNotFoundView />;
  return <PublicPlayerScreen data={data} />;
};

export const Route = createFileRoute('/_public/l/$publicSlug/players/$playerId')({
  loader: async ({ params }) => {
    const data = await getPublicPlayerServerFn({
      data: { publicSlug: params.publicSlug, playerId: params.playerId },
    });
    return { data };
  },
  component: PublicLeaguePlayerPage,
});
