import { FormSkeleton } from "../../_components/FormSkeleton";

// Identity, role and access, password. The role card starts at one control:
// the business picker only appears once the role is set to staff.
export default function Loading() {
  return <FormSkeleton cards={[{ fields: 2 }, { fields: 1 }, { fields: 1 }]} />;
}
