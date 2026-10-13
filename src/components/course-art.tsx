import Image from "next/image";
import type { ReactNode } from "react";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A decorative photo that fills its box. Size the box with `className`
 * (e.g. "aspect-video") and describe its rendered width with `sizes`.
 */
export function Thumbnail({
  src,
  accent,
  sizes,
  eager,
  className,
  imageClassName,
  children,
}: {
  src: string;
  /** Background shown while the photo loads. */
  accent?: string;
  sizes: string;
  /** Load immediately; use for the main image above the fold. */
  eager?: boolean;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative overflow-hidden bg-surface-2", className)}
      style={accent ? { backgroundColor: accent } : undefined}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        loading={eager ? "eager" : undefined}
        fetchPriority={eager ? "high" : undefined}
        className={cn("object-cover", imageClassName)}
      />
      {children}
    </div>
  );
}

export function CourseCover({
  course,
  sizes,
  eager,
  className,
  imageClassName,
  children,
}: {
  course: Course;
  sizes: string;
  /** Load immediately; use for the main image above the fold. */
  eager?: boolean;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
}) {
  return (
    <Thumbnail
      src={course.thumbnail}
      accent={course.accent}
      sizes={sizes}
      eager={eager}
      className={className}
      imageClassName={imageClassName}
    >
      {children}
    </Thumbnail>
  );
}
