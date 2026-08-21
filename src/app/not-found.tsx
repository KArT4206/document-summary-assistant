import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">404</p>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Back to Document Summary Assistant
      </Link>
    </main>
  );
}
