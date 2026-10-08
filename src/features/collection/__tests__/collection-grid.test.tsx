import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionGrid } from "@/features/collection/components/collection-grid";
import type { CollectionListItem } from "@/features/collection/domain/collection";

const item: CollectionListItem = {
  id: "collection-1",
  status: "tried",
  note: null,
  product: {
    id: "30000000-0000-0000-0000-000000000001",
    name: "Red Bull Energy Drink",
    normalizedName: "red bull energy drink",
    brand: { id: "brand-1", name: "Red Bull", slug: "red-bull" },
    flavor: null,
    variant: "Original",
    sizeMl: 250,
    verificationStatus: "verified",
    image: null,
  },
};

describe("CollectionGrid", () => {
  it("rolls an optimistic status change back after a failed write", async () => {
    const update = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        type: "https://energydex.app/problems/unexpected",
        title: "Could not update your collection.",
        status: 500,
        code: "UNEXPECTED",
        correlationId: "collection-test",
      },
    });
    const user = userEvent.setup();
    render(<CollectionGrid initialItems={[item]} onSetStatus={update} />);

    await user.click(screen.getByRole("button", { name: /mark collected/i }));

    expect(update).toHaveBeenCalledWith({
      productId: item.product.id,
      status: "collected_physical",
    });
    expect(screen.getByLabelText("Current status")).toHaveTextContent("Tried");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not update your collection.",
    );
  });
});
