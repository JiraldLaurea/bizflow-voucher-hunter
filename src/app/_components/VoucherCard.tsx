import { FiCheckCircle, FiStar } from "react-icons/fi";
import { getVoucherPresentation } from "@/lib/voucher-presentation";
import type { VoucherAttempt } from "@/types/voucher";

export type VoucherCardProps = {
  benefit: Pick<VoucherAttempt, "benefitType" | "benefitValue" | "displayLabel">;
  detail: string;
  selected?: boolean;
  selectionControl?: boolean;
  code?: string;
};

/** Presentational voucher ticket (rarity styling, sparkles, optional code). */
export function VoucherCard({ benefit, detail, selected = false, selectionControl = false, code }: VoucherCardProps) {
  const presentation = getVoucherPresentation(benefit);

  return (
    <>
      <span className="voucher-glow" aria-hidden="true" />
      <span className="voucher-sparkles" aria-hidden="true">
        <FiStar />
        <FiStar />
        <FiStar />
      </span>
      {selectionControl ? (
        <span className={`radio ${selected ? "radio-selected" : ""}`}>
          {selected ? <FiCheckCircle aria-hidden="true" /> : null}
        </span>
      ) : null}
      <span className={`rarity-badge rarity-badge-${presentation.rarity}`}>
        <FiStar aria-hidden="true" />
        {presentation.label}
        <span aria-hidden="true">·</span>
        {presentation.description}
      </span>
      <h3>{benefit.displayLabel}</h3>
      <p>{detail}</p>
      {code ? (
        <>
          <small>Voucher code</small>
          <p className="code voucher-code">{code}</p>
        </>
      ) : null}
      <span className="voucher-cutout voucher-cutout-left" aria-hidden="true" />
      <span className="voucher-cutout voucher-cutout-right" aria-hidden="true" />
    </>
  );
}
