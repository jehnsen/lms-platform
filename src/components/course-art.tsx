import { Brain, CodeXml, Coins, Dna, type LucideIcon } from "lucide-react";
import type { Course, CourseIcon } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<CourseIcon, LucideIcon> = {
  brain: Brain,
  code: CodeXml,
  dna: Dna,
  coins: Coins,
};

/**
 * Generated cover art: the course colour with its subject glyph. "banner" adds
 * an oversized glyph bleeding off the corner; "thumb" is a small square tile.
 */
export function CourseCover({
  course,
  variant = "banner",
  className,
}: {
  course: Course;
  variant?: "banner" | "thumb";
  className?: string;
}) {
  const Icon = ICONS[course.icon];
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden",
        variant === "thumb" && "grid size-12 shrink-0 place-items-center rounded-lg",
        className,
      )}
      style={{ backgroundColor: course.cover.bg, color: course.cover.fg }}
    >
      {variant === "banner" ? (
        <>
          <Icon strokeWidth={1} className="absolute -right-6 -bottom-8 size-40 opacity-25" />
          <Icon strokeWidth={1.5} className="absolute top-4 left-4 size-7" />
        </>
      ) : (
        <Icon strokeWidth={1.5} className="size-6" />
      )}
    </div>
  );
}
