import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RatingForm } from "@/features/reviews/components/rating-form";

describe("RatingForm", () => {
  it("saves a rating and optional tasting in one idempotent action", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        reviewId: "review-1",
        tastingSessionId: "tasting-1",
        rating: 8.5,
      },
    });
    const user = userEvent.setup();
    render(
      <RatingForm
        initialRating={7}
        onSave={save}
        productId="30000000-0000-0000-0000-000000000001"
      />,
    );

    const input = screen.getByLabelText(/overall rating/i);
    await user.clear(input);
    await user.type(input, "8.5");
    await user.click(screen.getByLabelText(/record a new tasting/i));
    await user.click(screen.getByRole("button", { name: /save rating/i }));

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "30000000-0000-0000-0000-000000000001",
        rating: 8.5,
        recordTasting: true,
        idempotencyKey: expect.any(String),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/rating saved/i);

    const firstKey = save.mock.calls[0]?.[0].idempotencyKey;
    await user.clear(input);
    await user.type(input, "9");
    await user.click(screen.getByRole("button", { name: /save rating/i }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0].idempotencyKey).not.toBe(firstKey);
  });

  it("submits half-point ratings and reports failed writes without clearing input", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        type: "https://energydex.app/problems/unexpected",
        title: "Rating could not be saved.",
        status: 500,
        code: "UNEXPECTED",
        correlationId: "rating-test",
      },
    });
    const user = userEvent.setup();
    render(
      <RatingForm
        initialRating={7}
        onSave={save}
        productId="30000000-0000-0000-0000-000000000001"
      />,
    );

    const input = screen.getByLabelText(/overall rating/i);
    await user.clear(input);
    await user.type(input, "8.5");
    await user.click(screen.getByRole("button", { name: /save rating/i }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ rating: 8.5 }));
    expect(input).toHaveValue(8.5);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Rating could not be saved.",
    );
  });
});
