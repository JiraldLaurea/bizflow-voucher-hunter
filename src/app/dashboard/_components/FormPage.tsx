import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowLeft } from "react-icons/fi";

/**
 * Chrome for a form that lives on its own route.
 *
 * Forms used to open in `AdminModal`, which capped them at a dialog's height
 * and gave a multi-section form a scrollbar of its own inside the page's. On a
 * route the browser owns the scrolling, the form survives a refresh, and the
 * URL is linkable — a half-filled campaign is no longer lost to a stray click
 * on the backdrop.
 *
 * No "use client": this is markup only, so a server page can render it around a
 * client form without pulling the page into the client bundle.
 */
export function FormPage({
  backHref,
  backLabel,
  children,
  description,
  title,
}: {
  backHref: string;
  backLabel: string;
  children: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <div className="form-page">
      <header className="form-page-header">
        <Link className="form-page-back" href={backHref}>
          <FiArrowLeft aria-hidden="true" />
          {backLabel}
        </Link>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </div>
  );
}

/** One titled card in a page form. Groups related fields under their own band. */
export function FormCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="form-card">
      <header className="form-card-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="form-card-body">{children}</div>
    </section>
  );
}
