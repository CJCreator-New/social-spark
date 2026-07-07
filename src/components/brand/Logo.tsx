import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/constants/branding";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";
type LogoVariant = "full" | "icon" | "wordmark";

const ICON_PX: Record<LogoSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
};

const WORDMARK_TEXT_SIZE: Record<LogoSize, string> = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

interface LogoMarkProps {
  size?: LogoSize;
  className?: string;
  animated?: boolean;
}

/**
 * Icon-only "spark/flame" mark. Purely decorative — always aria-hidden.
 * The accessible name must come from the wrapping element.
 */
export function LogoMark({ size = "md", className, animated = false }: LogoMarkProps) {
  const px = ICON_PX[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn(animated && "animate-pulse motion-reduce:animate-none", className)}
    >
      <rect x="0" y="0" width="32" height="32" rx="9" fill="var(--color-primary)" />
      <path
        fill="var(--color-surface)"
        d="M16 6 C 20 10, 22.5 14, 21 18.5 C 20 21.8, 17 24, 14 24 C 10.5 24, 8 21.3, 8 18 C 8 14.2, 10.5 11, 13.5 8.2 C 14.5 7.3, 15.3 6.6, 16 6 Z"
      />
      <path
        fill="var(--color-primary)"
        d="M14.5 14 C 16.5 16, 17.3 18, 16.3 20 C 15.6 21.4, 14 22, 12.6 21.3 C 11.3 20.6, 10.8 19, 11.4 17.6 C 12 16.1, 13.2 14.9, 14.5 14 Z"
      />
    </svg>
  );
}

function LogoWordmark({ size = "md", className }: { size?: LogoSize; className?: string }) {
  const splitIndex = APP_NAME.indexOf("Forge");
  const firstHalf = splitIndex >= 0 ? APP_NAME.slice(0, splitIndex) : APP_NAME;
  const secondHalf = splitIndex >= 0 ? APP_NAME.slice(splitIndex) : "";

  return (
    <span
      className={cn("font-medium whitespace-nowrap", WORDMARK_TEXT_SIZE[size], className)}
      style={{ fontFamily: "var(--font-sans)", color: "var(--color-text)" }}
    >
      {firstHalf}
      {secondHalf && (
        <em
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            color: "var(--color-primary)",
          }}
        >
          {secondHalf}
        </em>
      )}
    </span>
  );
}

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  animated?: boolean;
  className?: string;
  href?: string;
}

/**
 * Single source of truth for the ContentForge brand mark.
 */
export function Logo({
  variant = "full",
  size = "md",
  animated = false,
  className,
  href,
}: LogoProps) {
  const inner = (
    <>
      {variant !== "wordmark" && <LogoMark size={size} animated={animated} />}
      {variant !== "icon" && <LogoWordmark size={size} />}
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        aria-label={`${APP_NAME} home`}
        className={cn("inline-flex items-center gap-2 no-underline", className)}
      >
        {inner}
      </Link>
    );
  }

  return <span className={cn("inline-flex items-center gap-2", className)}>{inner}</span>;
}
