import { redirect } from "next/navigation";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

// Only allow same-origin relative paths as the post-sign-in destination.
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function SignInPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  // Already signed in (valid, non-stale)? Skip straight to the destination.
  if (await getSignedInCustomerPhone()) {
    redirect(next);
  }
  return <SignInForm next={next} />;
}
