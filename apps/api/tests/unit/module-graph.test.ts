import { assertAcyclicModuleGraph, moduleNames } from "@yuristim/core";
import { describe, expect, it } from "vitest";

describe("backend module boundaries", () => {
  it("defines all 16 logical modules without cycles", () => {
    expect(moduleNames).toHaveLength(16);
    expect(assertAcyclicModuleGraph).not.toThrow();
  });
});
