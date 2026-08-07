import { FormSkeleton } from "../../_components/FormSkeleton";

export default function Loading() {
  return <FormSkeleton cards={[{ fields: 3 }, { media: true, fields: 2 }]} />;
}
