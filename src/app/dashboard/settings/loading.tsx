import { RouteSkeleton } from "../_components/RouteSkeleton";

// A heading over panels, with no metric row — without this the segment fell
// back to the dashboard's boundary and flashed four cards it does not have.
export default function Loading() {
  return <RouteSkeleton />;
}
