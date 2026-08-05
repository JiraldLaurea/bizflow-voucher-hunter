import Image from "next/image";
import Link from "next/link";
import {
  FiArrowRight,
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiGift,
  FiMessageSquare,
  FiUsers,
} from "react-icons/fi";
import { resolveCampaignImage } from "@/lib/campaign-image";
import { RevealOnScroll } from "./RevealOnScroll";
import { BUSINESS_ENQUIRY_MAILTO, SUPPORT_EMAIL } from "@/lib/contact";
import { campaignCategoryLabel } from "@/lib/campaign-category";
import type { CampaignCard } from "@/server/voucher-engine";
import { DashboardPreview } from "./DashboardPreview";

/**
 * The public front door, written for business owners.
 *
 * Deliberately business-first: a shopper who already has a campaign link never
 * passes through here, and the people who need convincing are the ones deciding
 * whether to run a campaign at all. Shoppers get one clearly-signposted strip
 * near the bottom rather than a competing hero.
 *
 * A server component on purpose — it is all copy and links, so there is no
 * reason to ship a kilobyte of JavaScript to the page most first-time visitors
 * will see.
 *
 * Every capability named below is one the product actually has. If a claim here
 * stops being true, it is a bug in this file.
 */

/** The same app icon the dashboard sidebar and the Play listing use. */
const APP_ICON = "/images/voucher-hunt-app-logo.png";

const STEPS = [
  {
    title: "An admin sets up your business",
    body: "Voucher Hunt creates your business account and first campaign. Your team starts with the right venue already assigned.",
  },
  {
    title: "You choose the prizes and times",
    body: "Set what customers can win, when each prize can be booked and how many guests you can serve.",
  },
  {
    title: "Staff scan at the counter",
    body: "Your team scans the customer's QR, confirms the purchase and completes the visit from any phone.",
  },
];

/**
 * The live customer sequence, in order. Verified against the route table in
 * `PublicStepClient` and the mobile `campaign/[slug]` screens: the draw happens
 * campaign-wide first, and `listSlotsForAttempt` then offers only the slots the
 * won tier is bound to.
 */
const CUSTOMER_JOURNEY = [
  "Open a campaign",
  "Spin for a voucher",
  "Book an available time",
  "Show the QR in store",
];

const LOYALTY_STEPS = [
  {
    title: "Earn",
    body: "Staff record an eligible purchase and 5% comes back to the customer as LP.",
  },
  {
    title: "Shop",
    body: "Customers spend LP on real items from participating partner shops.",
  },
  {
    title: "Collect",
    body: "A collection QR tells staff exactly which item to hand over and records the redemption.",
  },
];

const CAPABILITIES = [
  {
    icon: <FiCalendar aria-hidden="true" />,
    title: "Real capacity",
    body: "Each booking window closes when it fills.",
  },
  {
    icon: <FiGift aria-hidden="true" />,
    title: "Weighted prizes",
    body: "Control how often every prize is won.",
  },
  {
    icon: <FiCheckCircle aria-hidden="true" />,
    title: "Verified redemption",
    body: "Scan, reschedule or mark a no-show.",
  },
  {
    icon: <FiMessageSquare aria-hidden="true" />,
    title: "Verified numbers",
    body: "SMS sign-in keeps entries tied to real phones.",
  },
  {
    icon: <FiUsers aria-hidden="true" />,
    title: "Referrals",
    body: "Sharing can unlock another spin and bonus LP.",
  },
  {
    icon: <FiBarChart2 aria-hidden="true" />,
    title: "Clear reporting",
    body: "See bookings, redemptions and LP activity in one place.",
  },
];

function formatRange(start: string, end: string) {
  const fmt = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function MarketingHome({ campaigns }: { campaigns: CampaignCard[] }) {
  // Proof, not filler: with nothing live the section is dropped rather than
  // shown empty, which would argue against the page it sits on.
  const showcase = campaigns.slice(0, 3);

  return (
    <div className="marketing">
      <RevealOnScroll />
      <header className="marketing-nav">
        <div className="marketing-shell marketing-nav-inner">
          <Link className="marketing-wordmark" href="/">
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

          <nav className="marketing-nav-links" aria-label="Page sections">
            <a href="#how-it-works">How it works</a>
            <a href="#loyalty">Loyalty Points</a>
            <a href="#dashboard">Dashboard</a>
            <a href="#capabilities">What you get</a>
            {showcase.length > 0 ? <a href="#demo">Demo</a> : null}
          </nav>

          <div className="marketing-nav-actions">
            <Link className="marketing-nav-client" href="/client">
              For Clients
            </Link>
            <Link className="marketing-nav-login" href="/login">
              Business log in
            </Link>
            <a className="marketing-button" href={BUSINESS_ENQUIRY_MAILTO}>
              Talk to us
            </a>
          </div>
        </div>
      </header>

      <main>
        {/*
         * The background lives in its own layer so artwork can be dropped on
         * `.marketing-hero-bg` without touching this markup or the copy's
         * stacking. `.marketing-hero.is-dark` flips the copy to white and
         * deepens the scrim for dark photography.
         */}
        <section className="marketing-hero has-art">
          <div className="marketing-hero-bg" aria-hidden="true" />
          <div className="marketing-shell marketing-hero-inner">
            <p className="marketing-eyebrow" data-rise="1">
              For business owners
            </p>
            <h1 data-rise="2">Fill quiet hours. Bring customers back.</h1>
            <p className="marketing-hero-lead" data-rise="3">
              Customers win a voucher, book a time you choose and earn Loyalty
              Points when they spend — turning one promotion into the next visit.
            </p>
            <div className="marketing-cta-row" data-rise="4">
              <a className="marketing-button marketing-button-lg" href={BUSINESS_ENQUIRY_MAILTO}>
                Talk to us
                <FiArrowRight aria-hidden="true" />
              </a>
              <Link className="marketing-button-ghost marketing-button-lg" href="/login">
                Business log in
              </Link>
            </div>
            <p className="marketing-hero-note" data-rise="5">
              No card, no contract to read. Tell us what you sell and we will set
              up the first campaign with you.
            </p>
          </div>
        </section>

        <section className="marketing-section marketing-section-tight">
          <div className="marketing-shell">
            <div className="marketing-problem-grid">
              <div data-reveal>
                <p className="marketing-eyebrow">The problem with a coupon</p>
                <h2>Three things a discount code cannot tell you.</h2>
              </div>
              <ul className="marketing-problem-list">
                <li data-reveal="1">
                  <strong>When they will come.</strong> A code is valid for a
                  month, so it gets used on your busiest evening — the one that
                  did not need help.
                </li>
                <li data-reveal="2">
                  <strong>How many will come.</strong> There is no cap on a
                  shared code, and no way to stop it spreading past the audience
                  you meant it for.
                </li>
                <li data-reveal="3">
                  <strong>Whether it worked.</strong> Redemptions live in your
                  POS, the promotion lives somewhere else, and nobody joins them
                  up afterwards.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-how-it-works" id="how-it-works">
          <div className="marketing-shell">
            <div className="marketing-section-head" data-reveal>
              <p className="marketing-eyebrow">How it works</p>
              <h2>Set it up once, run it every week.</h2>
              <p className="marketing-section-lead">
                We handle the business setup. You control the offer, timing and capacity.
              </p>
            </div>

            <ol className="marketing-steps">
              {STEPS.map((step, index) => (
                <li
                  className="marketing-step"
                  data-reveal={String(index + 1)}
                  key={step.title}
                >
                  <span className="marketing-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>

            {/* Spelled out because the order is the whole product: the prize is
                drawn first, and the slot is picked from the windows that prize
                is valid at. Stating it backwards is what the copy above used
                to do. */}
            <div className="marketing-journey" data-reveal>
              <p className="marketing-journey-label">What your customer does</p>
              <ol className="marketing-journey-steps">
                {CUSTOMER_JOURNEY.map((stage) => (
                  <li className="marketing-journey-step" key={stage}>
                    {stage}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-loyalty" id="loyalty">
          <div className="marketing-shell">
            <div className="marketing-section-head" data-reveal>
              <p className="marketing-eyebrow">Loyalty Points</p>
              <h2>The next visit starts at checkout.</h2>
              <p className="marketing-section-lead">
                Voucher Hunt turns eligible spend into LP customers can use for
                real items across participating partner shops.
              </p>
            </div>

            <ol className="marketing-loyalty-steps">
              {LOYALTY_STEPS.map((step, index) => (
                <li data-reveal={String(index + 1)} key={step.title}>
                  <span className="marketing-loyalty-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="marketing-loyalty-note" data-reveal>
              Opening the app and successful referrals can add bonus LP too. For
              partners, LP issued and redeemed is reconciled in one monthly record.
            </p>
          </div>
        </section>

        <section
          className="marketing-section marketing-section-alt marketing-capabilities-section"
          id="capabilities"
        >
          <div className="marketing-shell">
            <div className="marketing-section-head" data-reveal>
              <p className="marketing-eyebrow">What you get</p>
              <h2>The essentials, handled.</h2>
              <p className="marketing-section-lead">
                Simple controls for every campaign, booking and redemption.
              </p>
            </div>

            <div className="marketing-capabilities">
              {CAPABILITIES.map((capability, index) => (
                <article
                  className="marketing-capability"
                  // Cycles 1-4 so each row of four staggers, rather than the
                  // last card waiting on seven delays before it appears.
                  data-reveal={String((index % 4) + 1)}
                  key={capability.title}
                >
                  <span className="marketing-capability-icon">{capability.icon}</span>
                  <h3>{capability.title}</h3>
                  <p>{capability.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-product-preview" id="dashboard">
          <div className="marketing-shell marketing-product-preview-grid">
            <div className="marketing-product-preview-copy" data-reveal>
              <p className="marketing-eyebrow">Your dashboard</p>
              <h2>See the whole campaign at a glance.</h2>
              <p>
                Manage campaigns and time slots, track bookings and redemptions,
                and follow Loyalty Points activity from one workspace.
              </p>
              <ul>
                <li>Campaign and capacity controls</li>
                <li>Booking and redemption metrics</li>
                <li>Loyalty Points and billing</li>
              </ul>
            </div>

            <DashboardPreview />
          </div>
        </section>

        {showcase.length > 0 ? (
          <section className="marketing-section" id="demo">
            <div className="marketing-shell">
              <div className="marketing-section-head" data-reveal>
                <p className="marketing-eyebrow">Demo campaigns</p>
                <h2>See how a campaign can look.</h2>
                <p className="marketing-section-lead">
                  Sample campaigns shown for demonstration only.
                </p>
              </div>

              <div className="marketing-campaigns">
                {showcase.map(({ campaign, businessName, businessIndustry }, index) => {
                  const image = resolveCampaignImage(campaign);
                  return (
                    <article
                      className="marketing-campaign"
                      data-reveal={String(index + 1)}
                      key={campaign.id}
                    >
                      <div className="marketing-campaign-media">
                        {image ? (
                          <Image
                            alt={image.alt}
                            fill
                            sizes="(max-width: 900px) 100vw, 360px"
                            src={image.src}
                            unoptimized
                          />
                        ) : (
                          <span className="marketing-campaign-fallback" aria-hidden="true">
                            {businessName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="marketing-campaign-body">
                        <span className="marketing-chip">
                          {campaignCategoryLabel(businessIndustry)}
                        </span>
                        <h3>{campaign.title}</h3>
                        <p className="marketing-campaign-business">{businessName}</p>
                        <p className="marketing-campaign-dates">
                          {formatRange(campaign.startDate, campaign.endDate)}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section className="marketing-section marketing-section-tight">
          <div className="marketing-shell">
            <div className="marketing-closer" data-reveal>
              <div>
                <h2>Want to see it on your own menu?</h2>
                <p>
                  Send us what you sell and roughly when you are quiet. We will
                  come back with a campaign shaped around it.
                </p>
              </div>
              <a className="marketing-button marketing-button-lg" href={BUSINESS_ENQUIRY_MAILTO}>
                Talk to us
                <FiArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* Customer traffic gets a dedicated landing page rather than entering
            the retired browser version of the customer app. */}
        <section className="marketing-shopper">
          <div className="marketing-shell marketing-shopper-inner" data-reveal>
            <div>
              <p className="marketing-eyebrow">For clients</p>
              <p className="marketing-shopper-copy">
                Hunt for vouchers, book your visit and collect Loyalty Points in
                the customer app.
              </p>
            </div>
            <div className="marketing-cta-row">
              <Link className="marketing-button-ghost" href="/client">
                For Clients
                <FiArrowRight aria-hidden="true" />
              </Link>
            </div>
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
              priority
              src={APP_ICON}
              width={32}
            />
            Voucher&nbsp;Hunt
          </span>
          <nav className="marketing-footer-links" aria-label="Legal and contact">
            <Link href="/privacy">Privacy</Link>
            <Link href="/delete-account">Delete your account</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
