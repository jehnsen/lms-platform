import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronRight, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "spark";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-button hover:bg-primary-hover",
  secondary: "border border-line-strong bg-surface text-ink shadow-card hover:border-ink-3/50 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  spark: "border border-spark-solid/40 bg-spark-soft text-spark hover:border-spark-solid",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}, className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return <button type={type} className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}

/**
 * Shared look for text inputs and selects. Focus uses the global
 * `:focus-visible` outline. `fieldBaseClass` leaves height and padding to the
 * caller, for fields with an icon or a smaller size.
 */
export const fieldBaseClass =
  "rounded-lg border border-line-strong bg-surface text-sm placeholder:text-ink-3 aria-invalid:border-bad disabled:opacity-50";
export const fieldClass = `${fieldBaseClass} h-10 px-3`;

/**
 * A box that scrolls sideways when its content is wider than the screen, such
 * as a wide table on a phone (NFR-6). It can be focused, so someone using a
 * keyboard can scroll it with the arrow keys (WCAG 2.1.1), and it is a named
 * region, so a screen reader says what it holds. It is positioned, so text
 * that is visually hidden inside it stays inside it instead of widening the page.
 */
export function ScrollRegion({ label, className, ...props }: ComponentProps<"div"> & { label: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn("relative overflow-x-auto focus-visible:outline-offset-[-2px]", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...props} />;
}

/** The trail above a detail page. The last crumb is the page itself and is not a link. */
export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-3">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0" /> : null}
            {item.href ? (
              <Link href={item.href} className="rounded transition-colors hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-ink-2">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A quiet placeholder for a list with nothing in it yet. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {children ? <div className="mt-1 max-w-xs text-sm text-ink-2 text-pretty">{children}</div> : null}
    </div>
  );
}

/**
 * One fact in a row of key figures (a quiz's length, an assignment's due date).
 * Render inside a `<dl>`.
 */
export function FactTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    // `dt` and `dd` stay direct children of this group, as a definition list requires; the icon rides in the `dt`.
    <div className="relative flex min-h-15 min-w-0 flex-col justify-center rounded-xl bg-surface-2/70 py-3 pr-3 pl-15">
      <dt className="text-xs text-ink-3">
        <span className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-lg bg-surface text-primary-ink shadow-card">
          <Icon aria-hidden className="size-4" />
        </span>
        {label}
      </dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}

const AVATAR_SIZES = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-11 text-sm" };

/** Initials in a circle, for a person with no photo. Decorative: the name is always written beside it. */
export function Avatar({ initials, size = "md", className }: { initials: string; size?: keyof typeof AVATAR_SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold tracking-wide text-primary-ink",
        AVATAR_SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

type BadgeTone = "neutral" | "primary" | "good" | "warn" | "bad" | "spark";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  primary: "bg-primary-soft text-primary-ink",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  spark: "bg-spark-soft text-spark",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Marks a feature or piece of content as AI-generated or AI-assisted. */
export function AiBadge({ children = "AI" }: { children?: ReactNode }) {
  return (
    <Badge tone="spark">
      <Sparkles aria-hidden className="size-3" />
      {children}
    </Badge>
  );
}

export function Meter({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1.5 overflow-hidden rounded-full bg-primary-soft", className)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10", className)}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 flex items-center gap-2 text-sm text-ink-3">{eyebrow}</div> : null}
        <h1 className="text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-ink-2 text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-ink-2">{label}</div>
        {Icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink">
            <Icon aria-hidden className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</div>
      {hint ? <div className="mt-1 text-xs text-ink-3 text-pretty">{hint}</div> : null}
    </Card>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Placeholder shown while a route's URL-specific content streams in. */
export function PageSkeleton() {
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="h-4 w-40 rounded bg-surface-2" />
      <div className="mt-4 h-10 w-2/3 max-w-xl rounded-lg bg-surface-2" />
      <div className="mt-8 h-72 rounded-2xl bg-surface-2" />
    </PageContainer>
  );
}
