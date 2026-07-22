"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { FiArrowRight, FiMapPin, FiSearch } from "react-icons/fi";
import {
  resolveCampaignImage,
} from "@/lib/campaign-image";
import type { CampaignCard } from "@/server/voucher-engine";
import { CustomerBottomNav } from "./CustomerBottomNav";

const MODE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  online_shop: "Online Shop",
  beauty: "Beauty",
  pet: "Pet",
  retail: "Retail",
  other: "Other",
};

function formatRange(start: string, end: string) {
  const fmt = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CampaignDirectory({ cards }: { cards: CampaignCard[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  // Only offer category filters that actually appear in the active campaigns.
  const categories = useMemo(() => {
    const present = new Set(cards.map((card) => String(card.businessIndustry)));
    return [
      "all",
      ...Object.keys(MODE_LABELS).filter((mode) => present.has(mode)),
    ];
  }, [cards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(({ campaign, businessName, businessIndustry }) => {
      if (category !== "all" && businessIndustry !== category) return false;
      if (!q) return true;
      return (
        campaign.title.toLowerCase().includes(q) ||
        businessName.toLowerCase().includes(q) ||
        (campaign.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [cards, query, category]);

  return (
    <main className="mobile-flow-shell">
      <div className="mobile-app-frame">
        <section className="landing-app-bar">
          <strong>Voucher Hunt</strong>
        </section>
        <section className="directory-screen">
          <div className="directory-intro">
            <h1>Find a voucher hunt</h1>
            <p className="muted">
              Search active campaigns and pick one to start hunting.
            </p>
          </div>

          <div className="directory-search">
            <FiSearch aria-hidden="true" />
            <input
              aria-label="Search campaigns"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search campaign, business, or location"
              value={query}
            />
          </div>

          {categories.length > 2 ? (
            <div className="directory-filters">
              {categories.map((cat) => (
                <button
                  className={`directory-filter ${category === cat ? "active" : ""}`}
                  key={cat}
                  onClick={() => setCategory(cat)}
                  type="button"
                >
                  {cat === "all" ? "All" : MODE_LABELS[cat]}
                </button>
              ))}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="directory-empty">
              {cards.length === 0
                ? "No active campaigns yet. Create one from the Admin Dashboard."
                : "No campaigns match your search."}
            </div>
          ) : (
            <div className="directory-list">
              {filtered.map(
                ({ campaign, businessName, businessIndustry }) => {
                  const campaignImage = resolveCampaignImage(campaign);
                  return (
                    <Link
                      className="directory-card"
                      href={`/campaign/${campaign.slug}`}
                      key={campaign.id}
                      prefetch={false}
                    >
                      {campaignImage ? (
                        <div className="directory-card-media">
                          <Image
                            alt={campaignImage.alt}
                            fill
                            sizes="(max-width: 480px) calc(100vw - 68px), 352px"
                            src={campaignImage.src}
                            unoptimized={campaignImage.src.startsWith("data:")}
                          />
                        </div>
                      ) : null}
                      <div className="directory-card-top">
                        <div className="directory-card-details">
                          <h2 className="directory-card-title">{campaign.title}</h2>
                          <p className="directory-card-business">{businessName}</p>
                          <p className="directory-card-location">
                            <FiMapPin aria-hidden="true" />
                            {campaign.location ?? "Location to be announced"}
                          </p>
                        </div>
                        <span className={`chip mode-${businessIndustry}`}>
                          {MODE_LABELS[businessIndustry] ?? businessIndustry}
                        </span>
                      </div>
                      <div className="directory-card-foot">
                        <span className="directory-card-dates">
                          {formatRange(campaign.startDate, campaign.endDate)}
                        </span>
                        <span className="directory-card-cta">
                          Hunt now <FiArrowRight aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </section>
        <CustomerBottomNav
          active="home"
          homeHref="/"
          vouchersHref="/vouchers"
          moreHref="/more"
        />
      </div>
    </main>
  );
}
