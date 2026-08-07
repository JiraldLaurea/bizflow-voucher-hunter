import { FormSkeleton } from "../../../_components/FormSkeleton";

// As the new-member form, plus the account status control that only an
// existing member has.
export default function Loading() {
  return <FormSkeleton cards={[{ fields: 2 }, { fields: 2 }, { fields: 1 }]} />;
}
