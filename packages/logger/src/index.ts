const sensitiveKeyPattern =
  /authorization|cookie|token|secret|password|api[-_]?key|initdata|document|conversation|message/i;

const sanitize = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitize(item, seen),
    ]),
  );
};

export const sanitizeLogData = (value: unknown): unknown => sanitize(value, new WeakSet());

export type LogContext = {
  requestId: string;
  environment: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  errorCategory?: string;
};

const emit = (level: "info" | "warn" | "error", event: string, context: LogContext): void => {
  const payload = JSON.stringify(
    sanitizeLogData({ level, event, timestamp: new Date().toISOString(), ...context }),
  );
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
};

export const logger = {
  info: (event: string, context: LogContext): void => emit("info", event, context),
  warn: (event: string, context: LogContext): void => emit("warn", event, context),
  error: (event: string, context: LogContext): void => emit("error", event, context),
};
