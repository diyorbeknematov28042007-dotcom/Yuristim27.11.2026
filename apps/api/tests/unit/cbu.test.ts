import { describe, expect, it, vi } from "vitest";
import { CbuFxProvider } from "../../src/adapters/cbu";

describe("CBU FX provider", () => {
  it("normalizes official rate, nominal and date fields to integer micro-UZS", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          { Ccy: "USD", Nominal: "1", Rate: "12 500,25", Date: "28.11.2026" },
          { Ccy: "RUB", Nominal: "100", Rate: "150000", Date: "28.11.2026" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const now = new Date("2026-11-28T00:10:00.000Z");
    const result = await new CbuFxProvider(fetchImpl).fetchLatest(["USD", "RUB"], now);
    expect(result).toEqual([
      {
        currency: "USD",
        rateDate: "2026-11-28",
        microUzsPerUnit: 12_500_250_000,
        verifiedAt: now.toISOString(),
      },
      {
        currency: "RUB",
        rateDate: "2026-11-28",
        microUzsPerUnit: 1_500_000_000,
        verifiedAt: now.toISOString(),
      },
    ]);
  });

  it("fails closed when the requested currency or payload is invalid", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([])))
      .mockResolvedValue(new Response(JSON.stringify([{ Ccy: "USD", Rate: "bad" }])));
    await expect(new CbuFxProvider(fetchImpl).fetchLatest(["USD"])).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    await expect(new CbuFxProvider(fetchImpl).fetchLatest(["USD"])).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
