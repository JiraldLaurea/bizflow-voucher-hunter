import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  FiCalendar,
  FiCheckCircle,
  FiGift,
  FiMapPin,
  FiShoppingBag,
  FiStar,
} from "react-icons/fi";
import { FaGooglePlay } from "react-icons/fa";
import { SUPPORT_EMAIL } from "@/lib/contact";

const APP_ICON = "/images/voucher-hunt-app-logo.png";

export const metadata: Metadata = {
  title: "Voucher Hunt for Customers",
  description:
    "Win vouchers, book an eligible time and collect Loyalty Points with the Voucher Hunt customer app.",
};

const CLIENT_STEPS = [
  {
    icon: <FiGift aria-hidden="true" />,
    title: "Hunt",
    body: "Open a campaign from a participating business and reveal your voucher.",
  },
  {
    icon: <FiCalendar aria-hidden="true" />,
    title: "Book",
    body: "Choose an available time when your winning voucher can be used.",
  },
  {
    icon: <FiStar aria-hidden="true" />,
    title: "Earn",
    body: "Show your QR in store and earn Loyalty Points on eligible purchases.",
  },
];

const APP_SCREENS = [
  {
    alt: "Voucher Hunt app showing active campaigns from nearby businesses",
    body: "Find active campaigns from participating businesses.",
    hideDevControl: true,
    image: "/images/client-app/discover-v1.jpg",
    title: "Discover",
  },
  {
    alt: "Voucher Hunt app showing available dates and time slots for a voucher",
    body: "Reserve one of the times made available for your reward.",
    hideDevControl: true,
    image: "/images/client-app/book-v1.jpg",
    title: "Book",
  },
  {
    alt: "Voucher Hunt app showing a won voucher and its redemption QR code",
    body: "Keep the voucher and redemption QR ready in the app.",
    hideDevControl: true,
    image: "/images/client-app/redeem-v1.jpg",
    title: "Redeem",
  },
];

export default function ClientLandingPage() {
  return (
    <div className="marketing client-landing">
      <header className="marketing-nav">
        <div className="marketing-shell marketing-nav-inner client-nav-inner">
          <Link className="marketing-wordmark" href="/client">
            <Image
              alt=""
              className="marketing-mark"
              height={32}
              priority
              src={APP_ICON}
              width={32}
            />
            Voucher&nbsp;Hunt
          </Link>
          <nav className="marketing-nav-links client-nav-links" aria-label="Customer page">
            <a href="#how-it-works">How it works</a>
            <a href="#app-preview">Inside the app</a>
            <a href="#lp-shop">LP Shop</a>
            <a href="#loyalty-points">Loyalty Points</a>
          </nav>
          <Link className="marketing-button-ghost" href="/">
            For Businesses
          </Link>
        </div>
      </header>

      <main>
        <section className="client-hero has-art">
          <div className="client-hero-bg" aria-hidden="true" />
          <div className="marketing-shell client-hero-inner">
            <div className="client-hero-copy">
              <p className="marketing-eyebrow">The customer app</p>
              <h1>Win it. Book it. Enjoy it.</h1>
              <p>
                Discover voucher campaigns from participating businesses, reserve
                the right time and keep every reward in one place.
              </p>
              <span
                aria-label="Download on Google Play — coming soon"
                className="marketing-button marketing-button-lg client-store-button"
                role="img"
              >
                <FaGooglePlay aria-hidden="true" />
                Download on Google Play
              </span>
            </div>
          </div>
        </section>

        <section className="client-steps-section" id="how-it-works">
          <div className="marketing-shell">
            <div className="client-section-head">
              <p className="marketing-eyebrow">How it works</p>
              <h2>One simple journey.</h2>
            </div>
            <ol className="client-steps">
              {CLIENT_STEPS.map((step) => (
                <li key={step.title}>
                  <span>{step.icon}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="client-app-preview" id="app-preview">
          <div className="marketing-shell">
            <div className="client-app-preview-head">
              <div>
                <p className="marketing-eyebrow">Inside the app</p>
                <h2>See the full journey.</h2>
              </div>
              <p>
                From finding a campaign to showing the final QR, every step stays
                in one customer app.
              </p>
            </div>

            <div className="client-app-screens">
              {APP_SCREENS.map((screen) => (
                <figure className="client-app-screen" key={screen.title}>
                  <div className="client-phone-frame">
                    <Image
                      alt={screen.alt}
                      height={1560}
                      sizes="(max-width: 760px) 72vw, 260px"
                      src={screen.image}
                      width={720}
                    />
                    {screen.hideDevControl ? (
                      <span className="client-screen-dev-cover" aria-hidden="true" />
                    ) : null}
                  </div>
                  <figcaption>
                    <strong>{screen.title}</strong>
                    <span>{screen.body}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="client-app-demo-note">Screens show a demo campaign.</p>
          </div>
        </section>

        <section className="client-shop" id="lp-shop">
          <div className="marketing-shell client-shop-grid">
            <div className="client-shop-copy">
              <p className="marketing-eyebrow">LP Shop</p>
              <h2>Turn Loyalty Points into something real.</h2>
              <p className="client-shop-lead">
                Customers spend earned LP on items from participating partners,
                then collect their purchase in person with a verified code.
              </p>
              <ol className="client-shop-steps">
                <li>
                  <span><FiShoppingBag aria-hidden="true" /></span>
                  <div>
                    <strong>Choose an item</strong>
                    <p>Browse products and see the LP price before buying.</p>
                  </div>
                </li>
                <li>
                  <span><FiMapPin aria-hidden="true" /></span>
                  <div>
                    <strong>Collect from the partner</strong>
                    <p>The app keeps the purchase ready for collection.</p>
                  </div>
                </li>
                <li>
                  <span><FiCheckCircle aria-hidden="true" /></span>
                  <div>
                    <strong>Verify at handover</strong>
                    <p>Partner staff scan the code and complete the order.</p>
                  </div>
                </li>
              </ol>
            </div>

            <figure className="client-shop-screen">
              <div className="client-phone-frame">
                <Image
                  alt="Voucher Hunt LP Shop showing a points balance and participating partner products"
                  height={844}
                  sizes="(max-width: 760px) 76vw, 340px"
                  src="/images/client-app/lp-shop-v1.jpg"
                  width={390}
                />
              </div>
              <figcaption>Actual app screen · Demo data</figcaption>
            </figure>
          </div>
        </section>

        <section className="client-loyalty" id="loyalty-points">
          <div className="marketing-shell client-loyalty-inner">
            <div>
              <p className="marketing-eyebrow">Loyalty Points</p>
              <h2>Every visit can lead to the next reward.</h2>
            </div>
            <p>
              Earn LP on eligible purchases, then use it for real items from
              participating partner shops.
            </p>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-shell marketing-footer-inner">
          <span className="marketing-wordmark">
            <Image
              alt=""
              className="marketing-mark"
              height={32}
              src={APP_ICON}
              width={32}
            />
            Voucher&nbsp;Hunt
          </span>
          <nav className="marketing-footer-links" aria-label="Customer page links">
            <Link href="/">For Businesses</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
