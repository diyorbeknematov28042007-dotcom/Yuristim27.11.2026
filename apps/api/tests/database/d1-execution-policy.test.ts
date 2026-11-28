import { runD1Operation } from "@yuristim/database";
import { describe, expect, it } from "vitest";

describe("D1 execution policy", () => {
  it("does not start a query after request cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    let started = false;

    await expect(
      runD1Operation(
        () => {
          started = true;
          return Promise.resolve("unreachable");
        },
        { timeoutMs: 100, signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "Request was cancelled" });
    expect(started).toBe(false);
  });

  it("stops awaiting a D1 operation at the configured deadline", async () => {
    let platformOperationFinished = false;
    const operation = runD1Operation(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => {
            platformOperationFinished = true;
            resolve("late result");
          }, 30);
        }),
      { timeoutMs: 5, signal: new AbortController().signal },
    );

    await expect(operation).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Database operation timed out",
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(platformOperationFinished).toBe(true);
  });

  it("stops awaiting when the request is cancelled after query start", async () => {
    const controller = new AbortController();
    const operation = runD1Operation(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("late result"), 30)),
      { timeoutMs: 100, signal: controller.signal },
    );
    controller.abort();

    await expect(operation).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Request was cancelled",
    });
  });
});
