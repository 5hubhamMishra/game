import { LinkButton } from "@/components/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-teal">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-muted">That page doesn&apos;t exist, or the link is out of date.</p>
      <LinkButton href="/" className="mt-6">
        Back home
      </LinkButton>
    </div>
  );
}
