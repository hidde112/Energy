"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="state-card" role="alert">
      <p className="eyebrow">Something interrupted the flow</p>
      <h1>ENERGYDEX could not load this screen.</h1>
      <p>Your collection is untouched. Try the request again.</p>
      <button className="button button-primary" onClick={reset} type="button">
        Try again
      </button>
    </section>
  );
}
