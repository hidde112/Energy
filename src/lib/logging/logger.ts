const redactedValue = "[REDACTED]";
const sensitiveKey =
  /authorization|cookie|token|secret|password|pin|image|photo|service.*key|api.*key/i;

export function redactLogData(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) {
    return redactedValue;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogData(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogData(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

function write(
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown>,
) {
  console[level](JSON.stringify({ level, event, data: redactLogData(data) }));
}

export const logger = {
  info: (event: string, data: Record<string, unknown> = {}) =>
    write("info", event, data),
  warn: (event: string, data: Record<string, unknown> = {}) =>
    write("warn", event, data),
  error: (event: string, data: Record<string, unknown> = {}) =>
    write("error", event, data),
};
