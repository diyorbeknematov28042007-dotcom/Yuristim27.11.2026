import { AppError } from "@yuristim/errors";

const CBU_RATES_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const RATE_SCALE = 1_000_000;

type CbuRatePayload = {
  Ccy?: unknown;
  Date?: unknown;
  Nominal?: unknown;
  Rate?: unknown;
};

export type VerifiedFxRate = {
  currency: string;
  rateDate: string;
  microUzsPerUnit: number;
  verifiedAt: string;
};

const parsePositiveNumber = (value: unknown): number => {
  if (typeof value !== "string" && typeof value !== "number") return Number.NaN;
  return Number(String(value).replaceAll(" ", "").replace(",", "."));
};

const parseCbuDate = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("CBU rate date is missing");
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(value);
  if (match === null) throw new Error("CBU rate date is invalid");
  const [, day, month, year] = match;
  const result = `${year}-${month}-${day}`;
  const date = new Date(`${result}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error("CBU rate date is invalid");
  }
  return result;
};

export class CbuFxProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  async fetchLatest(currencies: readonly string[], now = new Date()): Promise<VerifiedFxRate[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(CBU_RATES_URL, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`CBU returned HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error("CBU payload is not an array");

      const byCurrency = new Map<string, CbuRatePayload>();
      for (const item of payload) {
        if (typeof item !== "object" || item === null) continue;
        const rate = item as CbuRatePayload;
        if (typeof rate.Ccy === "string") byCurrency.set(rate.Ccy.toUpperCase(), rate);
      }

      return currencies.map((requested) => {
        const currency = requested.toUpperCase();
        if (!/^[A-Z]{3}$/u.test(currency)) throw new Error("Invalid currency allowlist entry");
        const rate = byCurrency.get(currency);
        if (rate === undefined) throw new Error(`CBU rate missing for ${currency}`);
        const nominal = parsePositiveNumber(rate.Nominal);
        const value = parsePositiveNumber(rate.Rate);
        if (!Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(value) || value <= 0) {
          throw new Error(`CBU rate invalid for ${currency}`);
        }
        const microUzsPerUnit = Math.round((value * RATE_SCALE) / nominal);
        if (!Number.isSafeInteger(microUzsPerUnit) || microUzsPerUnit <= 0) {
          throw new Error(`CBU rate exceeds safe integer range for ${currency}`);
        }
        return {
          currency,
          rateDate: parseCbuDate(rate.Date),
          microUzsPerUnit,
          verifiedAt: now.toISOString(),
        };
      });
    } catch (error) {
      throw new AppError("SERVICE_UNAVAILABLE", "CBU exchange-rate synchronization failed", {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
