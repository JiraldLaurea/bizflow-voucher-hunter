import { FormSkeleton } from "../../_components/FormSkeleton";

// Benefit, expiry, availability - the three cards `PoolForm` renders.
export default function Loading() {
  return <FormSkeleton cards={[{ fields: 6 }, { fields: 3 }, { fields: 2 }]} />;
}
