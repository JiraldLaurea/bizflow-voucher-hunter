import { FormSkeleton } from "../../../_components/FormSkeleton";

// One card: the current artwork above the file picker that replaces it.
export default function Loading() {
  return <FormSkeleton cards={[{ media: true, fields: 1 }]} />;
}
