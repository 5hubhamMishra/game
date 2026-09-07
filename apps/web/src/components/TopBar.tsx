import Link from "next/link";

export function TopBar() {
  return (
    <header className="mx-auto flex h-[76px] w-full max-w-5xl items-center justify-between px-6">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-bold text-ink no-underline"
        aria-label="Between Words home"
      >
        <span
          className="grid size-8 place-items-center rounded-[10px] border-2 border-teal text-teal"
          aria-hidden="true"
        >
          ↔
        </span>
        <span>Between Words</span>
      </Link>
      <Link href="/how-to-play" className="font-semibold text-muted hover:text-teal">
        How to play
      </Link>
    </header>
  );
}
