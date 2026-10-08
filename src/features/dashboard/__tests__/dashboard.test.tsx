import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import {
  getDashboard,
  type DashboardRepository,
} from "@/features/dashboard/server/dashboard-query";

const repository: DashboardRepository = {
  getCollectionRows: async () => [
    {
      productId: "product-1",
      status: "tried",
      productName: "Red Bull Energy Drink",
      brandId: "brand-1",
      brandName: "Red Bull",
    },
    {
      productId: "product-2",
      status: "collected_physical",
      productName: "Monster Ultra",
      brandId: "brand-2",
      brandName: "Monster Energy",
    },
    {
      productId: "product-1",
      status: "favorite",
      productName: "Red Bull Energy Drink",
      brandId: "brand-1",
      brandName: "Red Bull",
    },
  ],
  getCurrentRatings: async () => [8.5, 7.5],
};

describe("dashboard", () => {
  it("derives unique persisted product, brand, and current-rating summaries", async () => {
    const summary = await getDashboard("user-1", repository);

    expect(summary).toMatchObject({
      uniqueProducts: 2,
      uniqueBrands: 2,
      averageRating: 8,
      physicallyCollected: 1,
    });
    expect(summary.recentProducts).toHaveLength(2);
  });

  it("renders a useful empty state", async () => {
    const empty = await getDashboard("user-1", {
      getCollectionRows: async () => [],
      getCurrentRatings: async () => [],
    });
    render(<Dashboard summary={empty} />);

    expect(screen.getByText(/first scan/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scan a drink/i })).toHaveAttribute(
      "href",
      "/scan",
    );
  });

  it("renders persisted summary values accessibly", async () => {
    render(<Dashboard summary={await getDashboard("user-1", repository)} />);

    expect(screen.getByLabelText("Unique products")).toHaveTextContent("2");
    expect(screen.getByLabelText("Unique brands")).toHaveTextContent("2");
    expect(screen.getByLabelText("Average rating")).toHaveTextContent("8.0");
  });
});
