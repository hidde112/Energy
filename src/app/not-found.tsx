import Link from "next/link";

export default function NotFound() {
  return (
    <section className="state-card">
      <p className="eyebrow">404 · Uncatalogued</p>
      <h1>That can is not on this shelf.</h1>
      <p>The page may have moved, or the link may be incomplete.</p>
      <Link className="button button-primary" href="/">
        Back home
      </Link>
    </section>
  );
}
