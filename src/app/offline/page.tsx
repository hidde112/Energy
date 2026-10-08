import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <section className="state-card offline-state">
      <WifiOff aria-hidden="true" size={36} />
      <p className="eyebrow">Connection paused</p>
      <h1>You’re offline.</h1>
      <p>
        Saved writes are never faked. Reconnect before scanning, rating, or
        changing your collection.
      </p>
      <Link className="button button-primary" href="/">
        Try again
      </Link>
    </section>
  );
}
