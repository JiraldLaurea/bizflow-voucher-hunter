import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="mock-header">
        <div className="brand-lockup">
          <div className="logo-tile">%</div>
          <div>
            <h1>BizFlow Voucher Hunt</h1>
            <p className="muted">
              Reservation-based voucher hunting for restaurants, shops, and
              local SMEs.
            </p>
          </div>
        </div>
        <div className="rule-strip">
          <div className="rule-chip">
            <span className="icon-box">D</span> Choose Date/Time Before Hunt
          </div>
          <div className="rule-chip">
            <span className="icon-box">3</span> 3 Base Attempts
          </div>
          <div className="rule-chip">
            <span className="icon-box">1</span> 1 Final Voucher
          </div>
        </div>
      </header>

      <section className="phone-gallery" style={{ marginTop: 24 }}>
        <div className="phone-frame">
          <div className="phone-top">
            <span>9:41</span>
            <span>BizFlow Voucher Hunt</span>
            <span>⌁</span>
          </div>
          <div className="tabs">
            <Link className="tab active" href="/campaign/july-dinner">
              Restaurant
            </Link>
            <Link className="tab" href="/campaign/8pm-drop">
              Online Shop
            </Link>
          </div>
          <h2 className="phone-title">
            Choose your time and hunt for a voucher
          </h2>
          <p className="muted">
            A runnable MVP implementation of the provided UI flow.
          </p>
          <div className="voucher-art" aria-hidden="true">
            <div className="ticket left">20% OFF</div>
            <div className="gift-box" />
            <div className="ticket right">Free Dessert</div>
            <div className="ticket bottom">50% OFF</div>
          </div>
          <Link className="button full" href="/campaign/july-dinner">
            Let&apos;s Hunt!
          </Link>
        </div>

        <div className="work-area">
          <section className="panel">
            <h2>Implemented Surfaces</h2>
            <div className="date-list">
              <Link className="date-card" href="/campaign/july-dinner">
                <strong>Customer Flow</strong>
                <span className="badge">Mobile UI</span>
              </Link>
              <Link className="date-card" href="/dashboard">
                <strong>Admin Dashboard</strong>
                <span className="badge">Analytics</span>
              </Link>
              <Link className="date-card" href="/staff">
                <strong>Staff Validation</strong>
                <span className="badge warning">Redemption</span>
              </Link>
            </div>
          </section>
          <section className="panel">
            <h2>Core Product Rules</h2>
            <div className="summary-list">
              {[
                "Users must select a date and time before voucher hunting.",
                "Remaining voucher quantity is visible before the challenge.",
                "Users get 3 initial hunting chances.",
                "Users can select 1 final voucher from revealed candidates.",
                "The same phone cannot issue another final voucher for the campaign.",
              ].map((rule, index) => (
                <div className="summary-row" key={rule}>
                  <span className="icon-box">{index + 1}</span>
                  <p>{rule}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
