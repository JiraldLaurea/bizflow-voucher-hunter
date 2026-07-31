"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

/**
 * Search box for the users list.
 *
 * Submits rather than filtering as you type: the query runs against the whole
 * customer table server-side, and a request per keystroke would be wasteful for
 * a list an operator scans occasionally.
 */
export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/dashboard/users?q=${encodeURIComponent(trimmed)}` : "/dashboard/users");
  }

  return (
    <form className="customer-search" onSubmit={submit}>
      <input
        aria-label="Search customers by name or number"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or mobile number"
        value={query}
      />
      <button className="button" type="submit">
        <FiSearch aria-hidden="true" /> Search
      </button>
      {initialQuery ? (
        <button
          className="button secondary"
          onClick={() => {
            setQuery("");
            router.push("/dashboard/users");
          }}
          type="button"
        >
          <FiX aria-hidden="true" /> Clear
        </button>
      ) : null}
    </form>
  );
}
