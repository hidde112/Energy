import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("exposes the five product destinations in mobile and desktop navigation", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Desktop navigation" }),
    ).toBeInTheDocument();

    for (const destination of [
      "Home",
      "Discover",
      "Scan",
      "Collection",
      "Friends",
    ]) {
      expect(screen.getAllByRole("link", { name: destination })).toHaveLength(
        2,
      );
    }
  });

  it("marks Scan as the primary action", () => {
    render(<AppShell>Content</AppShell>);

    expect(
      screen
        .getAllByRole("link", { name: "Scan" })
        .every((link) => link.dataset.primaryAction === "true"),
    ).toBe(true);
  });
});
