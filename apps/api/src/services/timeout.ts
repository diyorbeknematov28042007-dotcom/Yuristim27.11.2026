import { AppError } from "@yuristim/errors";

export const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<T> => {
  if (signal.aborted) throw new AppError("SERVICE_UNAVAILABLE", "Request was cancelled");

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new AppError("SERVICE_UNAVAILABLE", "Dependency timed out")),
      timeoutMs,
    );
    abortListener = () => reject(new AppError("SERVICE_UNAVAILABLE", "Request was cancelled"));
    signal.addEventListener("abort", abortListener, { once: true });
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    if (abortListener !== undefined) signal.removeEventListener("abort", abortListener);
  }
};
