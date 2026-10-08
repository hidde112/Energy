import { render, screen } from "@testing-library/react";
import { ProductDetail } from "@/features/catalog/components/product-detail";
import type { ProductDetail as ProductDetailType } from "@/features/catalog/domain/types";

const product: ProductDetailType = {
  id: "30000000-0000-0000-0000-000000000001",
  name: "Red Bull Energy Drink",
  normalizedName: "red bull energy drink",
  brand: { id: "brand-1", name: "Red Bull", slug: "red-bull" },
  flavor: null,
  variant: "Original",
  sizeMl: 250,
  verificationStatus: "verified",
  image: null,
  productLine: null,
  description: null,
  countryCode: null,
  isSugarFree: false,
  caffeineMgPer100Ml: 32,
  sugarGPer100Ml: 11,
  caloriesPer100Ml: 45,
  sweeteners: null,
  ingredients: null,
  isLimitedEdition: false,
  isDiscontinued: false,
  introducedYear: 1987,
  barcodes: [],
  sources: [],
};

describe("ProductDetail", () => {
  it("provides a reachable rating action", () => {
    render(<ProductDetail product={product} />);
    expect(
      screen.getByRole("link", { name: /rate this drink/i }),
    ).toHaveAttribute("href", `/products/${product.id}/rate`);
  });
});
