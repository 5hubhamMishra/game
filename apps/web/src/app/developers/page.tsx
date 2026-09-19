import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developers",
  alternates: { canonical: "/developers" },
  openGraph: { url: "/developers" },
};

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Developers</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Between Words does not currently offer a general-purpose third-party gameplay API. The
        routes under <code className="rounded border border-line bg-card px-1.5 py-0.5">/api/*</code> are internal
        helpers this site&apos;s own client uses to reach the game server through a same-origin
        session cookie — they are not intended for external programmatic use and are excluded from
        indexing.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">Public machine-readable resources</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed text-muted">
        <li>
          <a href="/sitemap.xml" className="font-semibold text-teal underline">
            /sitemap.xml
          </a>{" "}
          — canonical indexable URLs.
        </li>
        <li>
          <a href="/robots.txt" className="font-semibold text-teal underline">
            /robots.txt
          </a>{" "}
          — crawler policy.
        </li>
        <li>
          <a href="/llms.txt" className="font-semibold text-teal underline">
            /llms.txt
          </a>{" "}
          — a short product guide for automated clients and language models.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-xl font-semibold">Authentication model</h2>
      <p className="mt-2 leading-relaxed text-muted">
        Online play uses an opaque guest session, not an account or API key. There is no OAuth
        flow, no scoped token issuance, and no MCP server — none of these are offered, rather than
        partially implemented.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">Internal API errors</h2>
      <p className="mt-2 leading-relaxed text-muted">
        The same-origin routes used by the web client return RFC 9457-style Problem Details for
        failures, with an HTTP status, stable <code>code</code>, and a safe request instance. A
        rate-limited request returns <code>429</code> with <code>Retry-After</code> when available.
        These routes are internal and do not grant access to private room state.
      </p>
    </div>
  );
}
