import { redactLogData } from "@/lib/logging/logger";

describe("redactLogData", () => {
  it("redacts credentials, cookies, images, and PIN fields recursively", () => {
    expect(
      redactLogData({
        authorization: "Bearer secret",
        cookie: "session=secret",
        nested: {
          openaiApiKey: "sk-secret",
          pin: "1234",
          image: "base64-data",
          operation: "scan.identify",
        },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      nested: {
        openaiApiKey: "[REDACTED]",
        pin: "[REDACTED]",
        image: "[REDACTED]",
        operation: "scan.identify",
      },
    });
  });
});
