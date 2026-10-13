import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-on-primary">
        <GraduationCap aria-hidden className="size-4.5" />
      </span>
      <span className="text-lg font-semibold tracking-tight">3rdLoopLearning</span>
    </Link>
  );
}
