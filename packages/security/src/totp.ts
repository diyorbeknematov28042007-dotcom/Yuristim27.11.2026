import { AppError } from "@yuristim/errors";
import { hmac } from "./crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const encodeBase32 = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += alphabet[(value << (5 - bits)) & 31];
  return result;
};

export const decodeBase32 = (value: string): Uint8Array => {
  const normalized = value.toUpperCase().replaceAll("=", "");
  if (!/^[A-Z2-7]+$/u.test(normalized))
    throw new AppError("VALIDATION_ERROR", "Invalid TOTP secret");
  const output: number[] = [];
  let bits = 0;
  let buffer = 0;
  for (const character of normalized) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(output);
};

export const generateTotpSecret = (): string => {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32(bytes);
};

export const generateTotpCode = async (secret: string, step: number): Promise<string> => {
  const counter = new Uint8Array(8);
  let remaining = BigInt(step);
  for (let index = 7; index >= 0; index -= 1) {
    counter[index] = Number(remaining & 255n);
    remaining >>= 8n;
  }
  const digest = new Uint8Array(await hmac("SHA-1", decodeBase32(secret), counter));
  const offset = (digest.at(-1) ?? 0) & 15;
  const binary =
    ((digest[offset] ?? 0) & 127) * 16_777_216 +
    (digest[offset + 1] ?? 0) * 65_536 +
    (digest[offset + 2] ?? 0) * 256 +
    (digest[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, "0");
};

export const verifyTotpCode = async (input: {
  secret: string;
  code: string;
  now: Date;
  lastUsedStep?: number | null;
}): Promise<number | null> => {
  if (!/^\d{6}$/u.test(input.code)) return null;
  const currentStep = Math.floor(input.now.getTime() / 30_000);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    if (
      input.lastUsedStep !== undefined &&
      input.lastUsedStep !== null &&
      step <= input.lastUsedStep
    ) {
      continue;
    }
    if ((await generateTotpCode(input.secret, step)) === input.code) return step;
  }
  return null;
};
