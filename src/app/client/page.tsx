import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FaGooglePlay } from "react-icons/fa";
import {
  BookIcon,
  ChooseItemIcon,
  CollectPartnerIcon,
  EarnIcon,
  HandoverIcon,
  HuntIcon,
} from "@/app/_components/MarketingIcons";
import { LanguageSelector } from "@/app/_components/LanguageSelector";
import { clientTranslator, type ClientTranslationKey } from "@/i18n/client";
import { resolveLanguage } from "@/lib/locale";
import { SUPPORT_EMAIL } from "@/lib/contact";

const APP_ICON = "/images/voucher-hunt-app-logo.png";

/**
 * `resolveLanguage()` reads the cookie and `Accept-Language`, neither of which
 * can be known at build time, so the page renders per request. The business
 * landing page is already `force-dynamic` for the same reason.
 */
export const dynamic = "force-dynamic";

/**
 * The tab title and the link preview follow the same language as the page, so a
 * Korean visitor sharing the URL does not paste an English description of a
 * Korean page.
 */
export function generateMetadata(): Metadata {
  const t = clientTranslator(resolveLanguage());
  return { title: t("meta.title"), description: t("meta.description") };
}

/**
 * The three steps, the three app screens and the three LP Shop steps are lists
 * of keys rather than of strings: the copy lives in the catalogue and the
 * artwork lives here, so a translator never has to step around an icon import.
 */
const CLIENT_STEPS: {
  icon: React.ReactNode;
  title: ClientTranslationKey;
  body: ClientTranslationKey;
}[] = [
  {
    icon: <HuntIcon aria-hidden="true" />,
    title: "steps.hunt.title",
    body: "steps.hunt.body",
  },
  {
    icon: <BookIcon aria-hidden="true" />,
    title: "steps.book.title",
    body: "steps.book.body",
  },
  {
    icon: <EarnIcon aria-hidden="true" />,
    title: "steps.earn.title",
    body: "steps.earn.body",
  },
];

const APP_SCREENS: {
  alt: ClientTranslationKey;
  body: ClientTranslationKey;
  image: string;
  title: ClientTranslationKey;
}[] = [
  {
    alt: "preview.discover.alt",
    body: "preview.discover.body",
    image: "/images/client-app/discover-v2.png",
    title: "preview.discover.title",
  },
  {
    alt: "preview.book.alt",
    body: "preview.book.body",
    image: "/images/client-app/book-v2.png",
    title: "preview.book.title",
  },
  {
    alt: "preview.redeem.alt",
    body: "preview.redeem.body",
    image: "/images/client-app/redeem-v2.png",
    title: "preview.redeem.title",
  },
];

const SHOP_STEPS: {
  icon: React.ReactNode;
  title: ClientTranslationKey;
  body: ClientTranslationKey;
}[] = [
  {
    icon: <ChooseItemIcon aria-hidden="true" />,
    title: "shop.choose.title",
    body: "shop.choose.body",
  },
  {
    icon: <CollectPartnerIcon aria-hidden="true" />,
    title: "shop.collect.title",
    body: "shop.collect.body",
  },
  {
    icon: <HandoverIcon aria-hidden="true" />,
    title: "shop.verify.title",
    body: "shop.verify.body",
  },
];

export default function ClientLandingPage() {
  const language = resolveLanguage();
  const t = clientTranslator(language);

  return (
    // `lang` sits here rather than on <html> so the root layout stays static for
    // every other route, matching the business landing page.
    <div className="marketing client-landing" lang={language}>
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
          <nav
            className="marketing-nav-links client-nav-links"
            aria-label={t("nav.sections")}
          >
            <a href="#how-it-works">{t("nav.howItWorks")}</a>
            <a href="#app-preview">{t("nav.insideApp")}</a>
            <a href="#lp-shop">{t("nav.lpShop")}</a>
            <a href="#loyalty-points">{t("nav.loyalty")}</a>
          </nav>
          <div className="marketing-nav-actions">
            <LanguageSelector language={language} />
            <Link className="marketing-nav-switcher" href="/">
              {t("nav.forBusinesses")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="client-hero has-art">
          <div className="client-hero-bg" aria-hidden="true" />
          <div className="marketing-shell client-hero-inner">
            <div className="client-hero-copy">
              <p className="marketing-eyebrow">{t("hero.eyebrow")}</p>
              <h1>{t("hero.title")}</h1>
              <p>{t("hero.lead")}</p>
              <span
                aria-label={t("hero.storeButtonLabel")}
                className="marketing-button marketing-button-lg client-store-button"
                role="img"
              >
                <FaGooglePlay aria-hidden="true" />
                {t("hero.storeButton")}
              </span>
              <p className="client-store-note">{t("hero.storeNote")}</p>
            </div>
          </div>
        </section>

        <section className="client-steps-section" id="how-it-works">
          <div className="marketing-shell">
            <div className="client-section-head">
              <p className="marketing-eyebrow">{t("steps.eyebrow")}</p>
              <h2>{t("steps.title")}</h2>
            </div>
            <ol className="client-steps">
              {CLIENT_STEPS.map((step) => (
                <li key={step.title}>
                  <span>{step.icon}</span>
                  <h3>{t(step.title)}</h3>
                  <p>{t(step.body)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="client-app-preview" id="app-preview">
          <div className="marketing-shell">
            <div className="client-app-preview-head">
              <div>
                <p className="marketing-eyebrow">{t("preview.eyebrow")}</p>
                <h2>{t("preview.title")}</h2>
              </div>
              <p>{t("preview.lead")}</p>
            </div>

            <div className="client-app-screens">
              {APP_SCREENS.map((screen) => (
                <figure className="client-app-screen" key={screen.title}>
                  <div className="client-phone-frame">
                    <Image
                      alt={t(screen.alt)}
                      height={1856}
                      sizes="(max-width: 760px) 72vw, 260px"
                      src={screen.image}
                      width={852}
                    />
                  </div>
                  <figcaption>
                    <strong>{t(screen.title)}</strong>
                    <span>{t(screen.body)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="client-app-demo-note">{t("preview.note")}</p>
          </div>
        </section>

        <section className="client-shop" id="lp-shop">
          <div className="marketing-shell client-shop-grid">
            <div className="client-shop-copy">
              <p className="marketing-eyebrow">{t("shop.eyebrow")}</p>
              <h2>{t("shop.title")}</h2>
              <p className="client-shop-lead">{t("shop.lead")}</p>
              <ol className="client-shop-steps">
                {SHOP_STEPS.map((step) => (
                  <li key={step.title}>
                    <span>{step.icon}</span>
                    <div>
                      <strong>{t(step.title)}</strong>
                      <p>{t(step.body)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <figure className="client-shop-screen">
              <div className="client-phone-frame">
                <Image
                  alt={t("shop.screenAlt")}
                  height={844}
                  sizes="(max-width: 760px) 76vw, 340px"
                  src="/images/client-app/lp-shop-v1.jpg"
                  width={390}
                />
              </div>
              <figcaption>{t("shop.caption")}</figcaption>
            </figure>
          </div>
        </section>

        <section className="client-loyalty" id="loyalty-points">
          <div className="marketing-shell client-loyalty-inner">
            <div>
              <p className="marketing-eyebrow">{t("loyalty.eyebrow")}</p>
              <h2>{t("loyalty.title")}</h2>
            </div>
            <p>{t("loyalty.body")}</p>
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
          <nav
            className="marketing-footer-links"
            aria-label={t("footer.linksLabel")}
          >
            <Link href="/">{t("nav.forBusinesses")}</Link>
            <Link href="/privacy">{t("footer.privacy")}</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
