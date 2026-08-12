/**
 * The placeholder a form route shows while its server render is in flight.
 *
 * `RouteSkeleton` draws a list page - a heading over one wide panel - which is
 * the wrong shape for a form: the form routes are a narrow centred column of
 * titled cards, so the swap slid the whole page sideways as it settled. This
 * mirrors `FormPage` instead, reusing its own classes so the geometry cannot
 * drift, and each route passes the card shape its form actually has.
 */
export type FormSkeletonCard = {
  /** Field rows to draw in the card body, laid out two to a row. */
  fields?: number;
  /** A tall block above the fields, for a map picker or an image preview. */
  media?: boolean;
  /** Field rows drawn above the media, where the card leads with plain inputs. */
  leadFields?: number;
};

function SkeletonFields({ count }: { count: number }) {
  return (
    <div className="form-skeleton-fields">
      {Array.from({ length: count }, (_, field) => (
        <span className="form-skeleton-field" key={field}>
          <span className="dashboard-loading-line form-skeleton-label" />
          <span className="form-skeleton-control" />
        </span>
      ))}
    </div>
  );
}

export function FormSkeleton({ cards }: { cards: FormSkeletonCard[] }) {
  return (
    <div className="form-page form-skeleton" aria-busy="true" aria-live="polite">
      <header aria-hidden="true" className="form-page-header">
        <span className="dashboard-loading-line form-skeleton-back" />
        <span className="dashboard-loading-line dashboard-loading-title" />
        <span className="dashboard-loading-line dashboard-loading-subtitle" />
      </header>

      {cards.map((card, index) => (
        <section aria-hidden="true" className="form-card" key={index}>
          <header className="form-card-header">
            <span className="dashboard-loading-line form-skeleton-card-title" />
            <span className="dashboard-loading-line form-skeleton-card-note" />
          </header>
          <div className="form-card-body">
            {card.leadFields ? <SkeletonFields count={card.leadFields} /> : null}
            {card.media ? <span className="form-skeleton-media" /> : null}
            {card.fields ? <SkeletonFields count={card.fields} /> : null}
          </div>
        </section>
      ))}

      {/* Cancel and submit, in that order - the widths differ so the pair does
          not read as one bar. */}
      <div aria-hidden="true" className="form-page-actions">
        <span className="form-skeleton-button" />
        <span className="form-skeleton-button form-skeleton-button-submit" />
      </div>

      <span className="visually-hidden">Loading form...</span>
    </div>
  );
}
