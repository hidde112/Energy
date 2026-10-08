import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";

describe("translate", () => {
  it("provides navigation labels in English and Dutch", () => {
    expect(translate("en", "nav.collection")).toBe("Collection");
    expect(translate("nl", "nav.collection")).toBe("Verzameling");
    expect(translate("nl", "nav.scan")).toBe("Scannen");
  });

  it("interpolates named values without evaluating them", () => {
    expect(
      translate("en", "dashboard.greeting", { name: "Pulse <script>" }),
    ).toBe("Welcome back, Pulse <script>");
  });
});
