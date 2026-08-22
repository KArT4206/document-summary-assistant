import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-(--color-primary)">404</p>
      <h1 className="text-2xl font-semibold text-(--color-text)">Page not found</h1>
      <p className="max-w-sm text-sm text-(--color-text-muted)">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-[var(--radius-md)] bg-(--color-primary) px-4 py-2.5 text-sm font-medium text-(--color-primary-fg) transition-colors hover:bg-(--color-primary-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-2"
      >
        Back to Document Summary Assistant
      </Link>
    </main>
  );
}
