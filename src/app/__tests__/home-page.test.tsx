import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("introduces ENERGYDEX and its purpose", async () => {
    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: "ENERGYDEX" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Scan it. Rate it. Collect it."),
    ).toBeInTheDocument();
  });
});
