import { redirect } from "next/navigation";

/**
 * A shared voucher link. Same reasoning as the campaign redirect: the app
 * intercepts this URL when installed, and a browser that lands here has no
 * wallet to show the voucher in, so the app landing page is the destination.
 */
export default function VoucherRedirectPage() {
  redirect("/client");
}
