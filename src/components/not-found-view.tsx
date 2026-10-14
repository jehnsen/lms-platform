import { ButtonLink, PageContainer } from "@/components/ui";

/**
 * "We couldn't find that page". Used by the route-level not-found page and by
 * screens whose record is looked up in the browser: a course or lesson made in
 * the course builder is not known to the server, so the server cannot answer
 * 404 for it.
 */
export function NotFoundView({
  message = "The course, lesson or quiz may have been moved or removed.",
}: {
  message?: string;
}) {
  return (
    <PageContainer className="flex flex-col items-start gap-4 py-24">
      <p className="text-sm text-ink-3">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="text-ink-2">{message}</p>
      <ButtonLink href="/courses">Browse courses</ButtonLink>
    </PageContainer>
  );
}
