import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogSearch } from "@/features/catalog/components/catalog-search";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { ProductSummary } from "@/features/catalog/domain/types";

const verifiedProduct: ProductSummary = {
  id: "30000000-0000-0000-0000-000000000001",
  name: "Red Bull Energy Drink",
  normalizedName: "red bull energy drink",
  brand: { id: "brand-1", name: "Red Bull", slug: "red-bull" },
  flavor: null,
  variant: "Original",
  sizeMl: 250,
  verificationStatus: "verified",
  image: null,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("catalog search", () => {
  it("debounces input and renders returned products", async () => {
    vi.useFakeTimers();
    const search = vi.fn().mockResolvedValue([verifiedProduct]);
    render(<CatalogSearch search={search} debounceMs={300} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "red bull" },
    });
    expect(search).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(search).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith("red bull");
    expect(screen.getByText("Red Bull Energy Drink")).toBeInTheDocument();
  });

  it("shows a useful empty state", async () => {
    vi.useFakeTimers();
    render(
      <CatalogSearch search={vi.fn().mockResolvedValue([])} debounceMs={100} />,
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "missing can" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText(/no drinks found/i)).toBeInTheDocument();
  });

  it("labels verified catalog entries and owner-visible provisional entries", () => {
    const { rerender } = render(<ProductCard product={verifiedProduct} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();

    rerender(
      <ProductCard
        product={{ ...verifiedProduct, verificationStatus: "provisional" }}
      />,
    );
    expect(screen.getByText(/provisional/i)).toBeInTheDocument();
  });
});
