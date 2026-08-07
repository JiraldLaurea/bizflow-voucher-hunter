/**
 * The placeholder a dashboard route shows while its server render is in flight.
 *
 * Each segment declares its own `loading.tsx` so the shape that appears matches
 * the page that is coming: a single parent skeleton meant the table routes
 * flashed four metric cards they do not have, and the swap read as the page
 * changing its mind.
 */
export function RouteSkeleton({ metricCards = 0 }: { metricCards?: number }) {
  return (
    <div className="dashboard-route-loading" aria-live="polite" aria-busy="true">
      <div className="dashboard-route-loading-heading">
        <span className="dashboard-loading-line dashboard-loading-title" />
        <span className="dashboard-loading-line dashboard-loading-subtitle" />
      </div>
      {metricCards > 0 ? (
        <div className="dashboard-loading-metrics" aria-hidden="true">
          {Array.from({ length: metricCards }, (_, index) => (
            <span className="dashboard-loading-card" key={index} />
          ))}
        </div>
      ) : null}
      <span className="dashboard-loading-panel" aria-hidden="true" />
      <span className="visually-hidden">Loading dashboard page...</span>
    </div>
  );
}
