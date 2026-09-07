import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-8 text-sm text-muted sm:flex-row sm:justify-between">
      <span>Between Words — a game of careful clues</span>
      <Link href="/privacy" className="text-muted hover:text-teal">
        Privacy
      </Link>
    </footer>
  );
}
