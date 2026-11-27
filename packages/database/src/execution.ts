import { AppError } from "@yuristim/errors";

export interface D1ExecutionPolicy {
  timeoutMs: number;
  signal: AbortSignal;
}

export const runD1Operation = async <T>(
  operationFactory: () => Promise<T>,
  policy: D1ExecutionPolicy,
): Promise<T> => {
  if (!Number.isSafeInteger(policy.timeoutMs) || policy.timeoutMs <= 0) {
    throw new AppError("SERVICE_UNAVAILABLE", "Database timeout policy is invalid");
  }
  if (policy.signal.aborted) {
    throw new AppError("SERVICE_UNAVAILABLE", "Request was cancelled");
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new AppError("SERVICE_UNAVAILABLE", "Database operation timed out")),
      policy.timeoutMs,
    );
    abortListener = () => reject(new AppError("SERVICE_UNAVAILABLE", "Request was cancelled"));
    policy.signal.addEventListener("abort", abortListener, { once: true });
  });

  const operation = Promise.resolve().then(operationFactory);
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    if (abortListener !== undefined) policy.signal.removeEventListener("abort", abortListener);
  }
};
