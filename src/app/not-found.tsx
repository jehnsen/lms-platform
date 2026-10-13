import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Brand />
      <p className="mt-6 text-sm text-ink-3">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="text-ink-2">The address may be mistyped, or the page may have moved.</p>
      <ButtonLink href="/">Go to dashboard</ButtonLink>
    </div>
  );
}
