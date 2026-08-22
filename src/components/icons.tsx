// One coherent icon family: 1.5px stroke, 24x24 viewBox, rounded caps — matches
// the Heroicons-outline visual language without adding a dependency for a
// dozen glyphs. Every icon here is used for meaning (state, action), never
// as pure decoration.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    ...props,
  };
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
    </svg>
  );
}

export function FilePdfIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 12.75h1.5a1.5 1.5 0 000-3H9v6M14.25 9.75v6M14.25 12.75h1.5M18 9.75v6l2.25-6v6" />
      <path d="M6 3.75h7.5L18 8.25v11.25a1.5 1.5 0 01-1.5 1.5h-9a1.5 1.5 0 01-1.5-1.5V5.25a1.5 1.5 0 011.5-1.5z" />
    </svg>
  );
}

export function FileImageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.75h7.5L18 8.25v11.25a1.5 1.5 0 01-1.5 1.5h-9a1.5 1.5 0 01-1.5-1.5V5.25a1.5 1.5 0 011.5-1.5z" />
      <circle cx="10.5" cy="13" r="1" />
      <path d="M8.25 18l3-3 2 2 2.5-2.5 2.25 2.25" />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.25 2.25L15.5 9.5" />
    </svg>
  );
}

export function AlertCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 15.75h.008" />
    </svg>
  );
}

export function InfoCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8.25h.008" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8.25" y="8.25" width="12" height="12" rx="1.5" />
      <path d="M15.75 8.25V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8.25a1.5 1.5 0 001.5 1.5h2.25" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.75l7.5 3v5.25c0 4.5-3.15 7.755-7.5 8.75-4.35-.995-7.5-4.25-7.5-8.75V6.75l7.5-3z" />
      <path d="M9 12l2.25 2.25L15.5 9.5" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5L6 9.5l4.5-1.5L12 3.5z" />
      <path d="M18.5 15.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8z" />
    </svg>
  );
}
