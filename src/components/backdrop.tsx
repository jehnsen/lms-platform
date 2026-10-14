import { cn } from "@/lib/utils";

/**
 * The decorative background of the public pages: two soft colour glows over a
 * faint grid that fades out towards the edges. Purely visual, so it is hidden
 * from assistive technology and ignores the pointer. Place it inside a
 * `relative` (and usually `overflow-hidden`) container.
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="bg-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent_75%)]" />
      <div className="absolute -top-48 left-[8%] size-[36rem] rounded-full bg-hero-from/20 blur-3xl" />
      <div className="absolute -top-24 right-[4%] size-[30rem] rounded-full bg-hero-to/15 blur-3xl" />
      <div className="absolute top-[45%] left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-spark-solid/10 blur-3xl" />
    </div>
  );
}
