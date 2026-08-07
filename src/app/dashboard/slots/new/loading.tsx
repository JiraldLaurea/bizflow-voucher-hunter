import { FormSkeleton } from "../../_components/FormSkeleton";

export default function Loading() {
  return <FormSkeleton cards={[{ fields: 5 }]} />;
}
