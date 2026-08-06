import type { ReactNode, SVGProps } from "react";

type MarketingIconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: MarketingIconProps & { children: ReactNode }) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

const strokeProps = {
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
};

export function HuntIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" fill="currentColor" opacity="0.12" r="6" />
      <circle cx="10" cy="10" r="6" {...strokeProps} />
      <path d="m14.5 14.5 5.25 5.25" {...strokeProps} />
      <path d="m10 6.5.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" fill="currentColor" />
      <path d="M18.25 3.25v3M16.75 4.75h3" {...strokeProps} />
    </IconBase>
  );
}

export function BookIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <rect height="16" rx="2.75" width="18" x="3" y="5" {...strokeProps} />
      <path d="M3 9h18M7 3v4M17 3v4" {...strokeProps} />
      <path d="m8 15 2 2 5-5" {...strokeProps} />
      <path d="M7 12.5h3v4H7z" fill="currentColor" opacity="0.14" />
    </IconBase>
  );
}

export function EarnIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <ellipse cx="10" cy="16.5" fill="currentColor" opacity="0.14" rx="6.5" ry="3" />
      <ellipse cx="10" cy="14" rx="6.5" ry="3" {...strokeProps} />
      <path d="M3.5 14v4c0 1.65 2.91 3 6.5 3s6.5-1.35 6.5-3v-4" {...strokeProps} />
      <path d="m17.5 3 .75 1.75L20 5.5l-1.75.75L17.5 8l-.75-1.75L15 5.5l1.75-.75L17.5 3Z" fill="currentColor" />
      <path d="M11.75 5.5v4M9.75 7.5h4" {...strokeProps} />
    </IconBase>
  );
}

export function CapacityIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <rect height="16" rx="2.75" width="18" x="3" y="5" {...strokeProps} />
      <path d="M3 9h18M7 3v4M17 3v4" {...strokeProps} />
      <circle cx="7.5" cy="14" fill="currentColor" r="1.6" />
      <circle cx="12" cy="14" fill="currentColor" r="1.6" />
      <circle cx="16.5" cy="14" r="1.6" {...strokeProps} />
    </IconBase>
  );
}

export function WeightedPrizeIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 10h16v11H4zM2.75 7h18.5v4H2.75zM12 7v14" {...strokeProps} />
      <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" {...strokeProps} />
      <path d="M5 12h6v8H5z" fill="currentColor" opacity="0.14" />
      <circle cx="17" cy="15" fill="currentColor" r="1.5" />
      <circle cx="17" cy="18.5" fill="currentColor" opacity="0.55" r="0.85" />
    </IconBase>
  );
}

export function VerifiedRedemptionIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" {...strokeProps} />
      <circle cx="12" cy="12" fill="currentColor" opacity="0.14" r="5" />
      <path d="m8.5 12 2.25 2.25L15.5 9.5" {...strokeProps} />
    </IconBase>
  );
}

export function VerifiedNumberIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <rect height="19" rx="3" width="12" x="3" y="2.5" {...strokeProps} />
      <path d="M7 5h4M8 18.5h2" {...strokeProps} />
      <circle cx="17" cy="15" fill="currentColor" opacity="0.16" r="4.5" />
      <circle cx="17" cy="15" r="4.5" {...strokeProps} />
      <path d="m14.8 15 1.45 1.45 3-3" {...strokeProps} />
    </IconBase>
  );
}

export function ReferralIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="8" cy="8" fill="currentColor" opacity="0.16" r="3" />
      <circle cx="8" cy="7.5" r="3" {...strokeProps} />
      <path d="M2.75 19c.35-3.5 2.05-5.25 5.25-5.25 2 0 3.45.7 4.35 2.1" {...strokeProps} />
      <circle cx="17" cy="10" r="2.25" {...strokeProps} />
      <path d="M14.75 17.25c.6-1.5 1.7-2.25 3.3-2.25 1.7 0 2.75.8 3.2 2.4M13 6h6m0 0-2-2m2 2-2 2" {...strokeProps} />
    </IconBase>
  );
}

export function ReportingIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <rect height="18" rx="2.5" width="17" x="3.5" y="3" {...strokeProps} />
      <path d="m7 8 1.4 1.4L11 6.75M7 17v-3M12 17v-5.5M17 17V8.5" {...strokeProps} />
      <path d="M5.75 18.5h12.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" opacity="0.3" />
    </IconBase>
  );
}

export function ChooseItemIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 8h14l-1 13H6L5 8Z" {...strokeProps} />
      <path d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9" {...strokeProps} />
      <path d="m12 11.5.8 1.8 1.9.2-1.4 1.3.4 1.9-1.7-.9-1.7.9.4-1.9-1.4-1.3 1.9-.2.8-1.8Z" fill="currentColor" />
    </IconBase>
  );
}

export function CollectPartnerIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 10v10h16V10M3 9l2-5h14l2 5" {...strokeProps} />
      <path d="M3 9c0 1.4 1.1 2.5 2.5 2.5S8 10.4 8 9c0 1.4 1.1 2.5 2.5 2.5S13 10.4 13 9c0 1.4 1.1 2.5 2.5 2.5S18 10.4 18 9c0 1.4.7 2.5 2 2.5" {...strokeProps} />
      <path d="M9 20v-5h6v5" {...strokeProps} />
      <path d="M9 4h6" stroke="currentColor" strokeLinecap="round" strokeWidth="3" opacity="0.16" />
    </IconBase>
  );
}

export function HandoverIcon(props: MarketingIconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" {...strokeProps} />
      <rect height="11" rx="3" width="11" x="6.5" y="6.5" fill="currentColor" opacity="0.13" />
      <path d="m8.75 12 2.15 2.15 4.35-4.35" {...strokeProps} />
    </IconBase>
  );
}
