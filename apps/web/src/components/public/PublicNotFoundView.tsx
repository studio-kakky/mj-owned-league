/**
 * Empty / not-found state for the public viewer surfaces.
 *
 * Surfaced when:
 *   - A `publicSlug` does not resolve (stale URL the viewer pasted).
 *   - A `sequenceNumber` / `playerId` does not exist inside the resolved
 *     League.
 *   - P3 `/m/:publicSlug` is hit while no Match-level slug exists in the
 *     data model — see `server/public.ts` file-level comment.
 *
 * Auth context: this surface is reachable by any visitor. We deliberately
 * do not link to `/login` here (the public footer already does) and we do
 * not reveal whether the slug exists for a different surface — saying
 * "not found" without distinguishing 404 vs. wrong-route makes the public
 * URL space less enumerable.
 */

export interface PublicNotFoundViewProps {
  /**
   * Body copy. Optional — when omitted the component renders the generic
   * "URL が無効、または公開されていません" line.
   */
  description?: string;
}

export const PublicNotFoundView = ({ description }: PublicNotFoundViewProps) => {
  return (
    <section className="space-y-3 text-center" data-testid="public-not-found">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">404</p>
      <h1 className="text-xl font-bold text-zinc-50">ページが見つかりません</h1>
      <p className="text-sm text-zinc-400">
        {description ?? 'URL が無効、または公開されていません。'}
      </p>
    </section>
  );
};
