export default function DashboardLoading() {
  return (
    <div className="dashboard-route-loading" aria-live="polite" aria-busy="true">
      <div className="dashboard-route-loading-heading">
        <span className="dashboard-loading-line dashboard-loading-title" />
        <span className="dashboard-loading-line dashboard-loading-subtitle" />
      </div>
      <div className="dashboard-loading-metrics" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="dashboard-loading-card" key={index} />
        ))}
      </div>
      <span className="dashboard-loading-panel" aria-hidden="true" />
      <span className="visually-hidden">Loading dashboard page...</span>
    </div>
  );
}
