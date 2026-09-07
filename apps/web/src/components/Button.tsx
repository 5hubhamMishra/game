import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-teal text-white hover:bg-teal-dark",
  secondary: "bg-card border border-line text-ink hover:border-teal",
  danger: "bg-danger-bg border border-danger/30 text-danger hover:bg-danger/10",
};

const BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold " +
  "transition-[background-color,border-color,transform] duration-200 disabled:opacity-50 " +
  "disabled:pointer-events-none active:scale-[0.98]";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </Link>
  );
}
