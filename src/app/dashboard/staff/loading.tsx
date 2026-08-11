import { RouteSkeleton } from "../_components/RouteSkeleton";

// Scan & Redeem is a client page, but its payload still has to arrive before
// anything renders, so it wants the same placeholder as the rest.
export default function Loading() {
  return <RouteSkeleton />;
}
