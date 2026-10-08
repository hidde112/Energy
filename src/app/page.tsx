import Link from "next/link";
import { ArrowRight, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import {
  emptyDashboard,
  getDashboard,
} from "@/features/dashboard/server/dashboard-query";
import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let summary = emptyDashboard;
  try {
    const client = await createServerSupabaseClient();
    const auth = await client.auth.getUser();
    if (auth.data.user) summary = await getDashboard(auth.data.user.id);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "CONFIGURATION_MISSING")
      throw error;
  }

  return (
    <div className="home-page">
      <header className="mobile-header">
        <span className="eyebrow">Your energy collection</span>
        <span aria-hidden="true" className="live-dot" />
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Built for curious collectors</span>
          <h1>ENERGYDEX</h1>
          <p className="hero-slogan">Scan it. Rate it. Collect it.</p>
          <p className="hero-description">
            Turn every can into a discovery. Build a collection with reliable
            product data and ratings that stay yours.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/scan">
              <ScanLine aria-hidden="true" size={20} />
              Start scanning
            </Link>
            <Link className="button button-secondary" href="/discover">
              Explore catalog
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="energy-orb">
          <span>EDX</span>
        </div>
      </section>

      <section aria-label="What ENERGYDEX protects" className="feature-grid">
        <article className="feature-card">
          <ScanLine aria-hidden="true" />
          <div>
            <h2>Fast identification</h2>
            <p>Barcode first, AI only when it adds value.</p>
          </div>
        </article>
        <article className="feature-card">
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2>Facts with sources</h2>
            <p>Unknown details stay unknown instead of being invented.</p>
          </div>
        </article>
        <article className="feature-card">
          <Sparkles aria-hidden="true" />
          <div>
            <h2>Your taste, mapped</h2>
            <p>
              Ratings and tasting history become a collection that feels
              personal.
            </p>
          </div>
        </article>
      </section>

      <Dashboard summary={summary} />
    </div>
  );
}
