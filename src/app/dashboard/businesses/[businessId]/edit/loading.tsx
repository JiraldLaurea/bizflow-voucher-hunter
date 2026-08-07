import { FormSkeleton } from "../../../_components/FormSkeleton";

// Editing shows one field under Identity: the category and logo mark are set
// at creation and are not editable here.
export default function Loading() {
  return <FormSkeleton cards={[{ fields: 1 }, { media: true, fields: 2 }]} />;
}
