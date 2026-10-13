import { ButtonLink, PageContainer } from "@/components/ui";

export default function NotFound() {
  return (
    <PageContainer className="flex flex-col items-start gap-4 py-24">
      <p className="text-sm text-ink-3">404</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="text-ink-2">The course, lesson or quiz may have been moved or removed.</p>
      <ButtonLink href="/courses">Browse courses</ButtonLink>
    </PageContainer>
  );
}
