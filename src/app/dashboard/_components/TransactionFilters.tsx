"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiDownload, FiSearch, FiX } from "react-icons/fi";
import { TRANSACTION_KINDS } from "@/lib/transaction-kinds";
import type { Business } from "@/types/voucher";
import { SelectMenu } from "./SelectMenu";

export type TransactionFilterValues = {
  business: string;
  kind: string;
  from: string;
  to: string;
  q: string;
};

/**
 * The transaction list's filter bar.
 *
 * Submitted rather than applied per keystroke: each change re-runs a union over
 * three tables, and an operator setting a month and a business means one query,
 * not five. The controls hold local state until Apply so a half-built filter
 * never reaches the server.
 */
export function TransactionFilters({
  businesses,
  initial,
  showBusiness,
}: {
  businesses: Pick<Business, "id" | "name">[];
  initial: TransactionFilterValues;
  showBusiness: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);

  const set = (key: keyof TransactionFilterValues) => (value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  function queryString(next: TransactionFilterValues) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    // Any filter change makes the old page number meaningless, so paging always
    // restarts rather than landing on an empty page 4 of a smaller result set.
    return params.toString();
  }

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const query = queryString(values);
    router.push(query ? `/dashboard/transactions?${query}` : "/dashboard/transactions");
  }

  function clear() {
    const empty = { business: "", kind: "", from: "", to: "", q: "" };
    setValues(empty);
    router.push("/dashboard/transactions");
  }

  const active = Object.values(initial).some(Boolean);
  const exportQuery = queryString(initial);

  return (
    <form className="transaction-filters" onSubmit={apply}>
      <div className="transaction-filter-controls">
        {/* SelectMenu carries its own caption rather than sitting in a <label>.
            A <label> forwards clicks to the first labelable element inside it —
            which is the dropdown's own trigger button — so picking an option
            closed the menu and the forwarded click reopened it. */}
        {showBusiness ? (
          <SelectMenu
            className="transaction-filter-field"
            label="Business"
            onChange={set("business")}
            options={[
              { value: "", label: "All businesses" },
              ...businesses.map((business) => ({
                value: business.id,
                label: business.name,
              })),
            ]}
            placeholder="All businesses"
            value={values.business}
          />
        ) : null}

        <SelectMenu
          className="transaction-filter-field"
          label="Type"
          onChange={set("kind")}
          options={[
            { value: "", label: "All types" },
            ...TRANSACTION_KINDS.map((kind) => ({
              value: kind.value,
              label: kind.label,
            })),
          ]}
          placeholder="All types"
          value={values.kind}
        />

        <label className="field transaction-filter-field transaction-filter-date">
          <span>From</span>
          <input
            max={values.to || undefined}
            onChange={(event) => set("from")(event.target.value)}
            type="date"
            value={values.from}
          />
        </label>

        <label className="field transaction-filter-field transaction-filter-date">
          <span>To</span>
          <input
            min={values.from || undefined}
            onChange={(event) => set("to")(event.target.value)}
            type="date"
            value={values.to}
          />
        </label>

        <label className="field transaction-filter-field transaction-filter-search">
          <span>Search</span>
          <span className="customer-search-field">
            <FiSearch aria-hidden="true" className="customer-search-icon" />
            <input
              onChange={(event) => set("q")(event.target.value)}
              placeholder="Phone, name, voucher code or staff"
              value={values.q}
            />
          </span>
        </label>
      </div>

      <div className="transaction-filter-actions">
        <button className="button" type="submit">
          Apply filters
        </button>
        {active ? (
          <button className="button secondary" onClick={clear} type="button">
            <FiX aria-hidden="true" /> Clear
          </button>
        ) : null}
        {/* A plain link, not a fetch: the response is a file download, and the
            export has to carry the filters currently in effect rather than the
            ones being typed. */}
        <a
          className="button secondary"
          href={`/api/dashboard/transactions/export${exportQuery ? `?${exportQuery}` : ""}`}
        >
          <FiDownload aria-hidden="true" /> Export CSV
        </a>
      </div>
    </form>
  );
}
