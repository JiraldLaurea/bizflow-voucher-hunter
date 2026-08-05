import Image from "next/image";

const DASHBOARD_IMAGE = "/images/voucher-hunt-dashboard-v1.png";

export function DashboardPreview() {
  return (
    <figure className="marketing-dashboard-figure" data-reveal="2">
      <div className="marketing-dashboard-window">
        <span className="marketing-dashboard-window-bar" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <Image
          alt="Voucher Hunt dashboard showing sample campaign metrics, slots and voucher activity"
          height={900}
          sizes="(max-width: 900px) 100vw, 760px"
          src={DASHBOARD_IMAGE}
          width={1440}
        />
      </div>
      <figcaption>Sample data</figcaption>
    </figure>
  );
}
