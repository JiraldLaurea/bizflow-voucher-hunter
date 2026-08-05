"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

export function ClickableCustomerRow({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function openCustomer() {
    router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCustomer();
    }
  }

  return (
    <tr
      className="customer-row-link"
      role="link"
      tabIndex={0}
      onClick={openCustomer}
      onKeyDown={handleKeyDown}
    >
      {children}
    </tr>
  );
}
