import Link from "next/link";
import { BatteryCharging, Boxes, ScanLine, Star } from "lucide-react";
import type { DashboardSummary } from "@/features/dashboard/server/dashboard-query";

export function Dashboard({ summary }: { summary: DashboardSummary }) {
  if (summary.uniqueProducts === 0) {
    return (
      <section className="dashboard-empty" aria-labelledby="dashboard-heading">
        <p className="eyebrow">Your dashboard</p>
        <h2 id="dashboard-heading">Your first scan starts the story.</h2>
        <p>
          Identify a can, confirm it, then rate it to build your personal energy
          map.
        </p>
        <Link className="button button-primary" href="/scan">
          <ScanLine aria-hidden="true" size={19} /> Scan a drink
        </Link>
      </section>
    );
  }

  return (
    <section className="dashboard" aria-labelledby="dashboard-heading">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Your dashboard</p>
          <h2 id="dashboard-heading">The Dex, at a glance.</h2>
        </div>
        <Link href="/collection">View collection</Link>
      </div>
      <dl className="dashboard-stats">
        <div aria-label="Unique products">
          <BatteryCharging aria-hidden="true" />
          <dt>Products</dt>
          <dd>{summary.uniqueProducts}</dd>
        </div>
        <div aria-label="Unique brands">
          <Boxes aria-hidden="true" />
          <dt>Brands</dt>
          <dd>{summary.uniqueBrands}</dd>
        </div>
        <div aria-label="Average rating">
          <Star aria-hidden="true" />
          <dt>Average</dt>
          <dd>{summary.averageRating?.toFixed(1) ?? "—"}</dd>
        </div>
      </dl>
      <div className="recent-products">
        <h3>Recent energy</h3>
        {summary.recentProducts.map((product) => (
          <Link href={`/products/${product.id}`} key={product.id}>
            <span>{product.brandName}</span>
            <strong>{product.name}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
