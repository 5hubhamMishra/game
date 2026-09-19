import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  alternates: { canonical: "/contact" },
  openGraph: { url: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Contact</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Between Words is an independent, non-commercial project with no dedicated support team.
        There is no phone line or business address to publish.
      </p>
      <p className="mt-2 leading-relaxed text-muted">
        For a bug report, a question, or feedback, open an issue on the project&apos;s{" "}
        <a
          href="https://github.com/5hubhamMishra/game"
          className="font-semibold text-teal underline"
          rel="noopener noreferrer"
        >
          public GitHub repository
        </a>
        .
      </p>
    </div>
  );
}
