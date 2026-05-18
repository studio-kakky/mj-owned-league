/**
 * `/m/$publicSlug` — P3 Match 公開ページ (League 外)
 * (`04-screens.md` § P3, Issue #23).
 *
 * Reserved by the URL namespace doc (`04-screens.md` § URL 名前空間の整理)
 * for a future Match-only sharing surface. `02-domain-model.md` § Match does
 * not yet define a Match-level publicSlug, so `getPublicMatchHandler` always
 * returns `null` today and this route renders the not-found state.
 *
 * Reserving the route now means the URL namespace is locked in — a future
 * Issue can add the slug + lookup without colliding with anything we add in
 * the meantime.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PublicMatchScreen, PublicNotFoundView } from '../../components/public';
import { getPublicMatchServerFn } from '../../server/public';

const PublicMatchPage = () => {
  const { data } = Route.useLoaderData();
  if (data === null) {
    return <PublicNotFoundView description="League 外 Match の公開 URL は MVP では未対応です。" />;
  }
  return <PublicMatchScreen data={data} />;
};

export const Route = createFileRoute('/_public/m/$publicSlug')({
  loader: async ({ params }) => {
    const data = await getPublicMatchServerFn({ data: { publicSlug: params.publicSlug } });
    return { data };
  },
  component: PublicMatchPage,
});
