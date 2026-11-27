import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Composer,
  SegmentedControl,
  createAssetRegistry,
  dictionaries,
  resolveTheme,
} from "../src";

describe("shared UI behavior", () => {
  it("disables a loading button and exposes busy state", () => {
    render(<Button loading>Saqlanmoqda</Button>);
    const button = screen.getByRole("button", { name: "Saqlanmoqda" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("submits the composer with Enter but not Shift+Enter", () => {
    const onSubmit = vi.fn();
    render(<Composer label="Xabar" onSubmit={onSubmit} />);
    const textarea = screen.getByRole("textbox", { name: "Xabar" });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("uses radiogroup semantics for segmented controls", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="Model"
        value="lite"
        onValueChange={onValueChange}
        options={[
          { value: "lite", label: "Lite" },
          { value: "pro", label: "Pro" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Lite" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Pro" }));
    expect(onValueChange).toHaveBeenCalledWith("pro");
  });

  it("resolves explicit, system and Telegram themes without custom modes", () => {
    expect(resolveTheme("dark", { systemDark: false, telegramTheme: "light" })).toBe("dark");
    expect(resolveTheme("system", { systemDark: true })).toBe("dark");
    expect(resolveTheme("system", { systemDark: false, telegramTheme: "dark" })).toBe("dark");
  });

  it("keeps all localization dictionaries key-compatible", () => {
    const keys = Object.keys(dictionaries.uz).sort();
    expect(Object.keys(dictionaries.ru).sort()).toEqual(keys);
    expect(Object.keys(dictionaries.en).sort()).toEqual(keys);
    expect(dictionaries.uz["model.pro"]).toBe("Pro");
  });

  it("rejects fabricated, duplicate or non-kebab-case asset records", () => {
    expect(() =>
      createAssetRegistry([{ id: "bad Name", kind: "logo", status: "missing", alt: "" }]),
    ).toThrow(/kebab-case/u);
    expect(() =>
      createAssetRegistry([
        { id: "logo", kind: "logo", status: "missing", alt: "" },
        { id: "logo", kind: "logo", status: "missing", alt: "" },
      ]),
    ).toThrow(/Duplicate/u);
    expect(() =>
      createAssetRegistry([{ id: "logo", kind: "logo", status: "available", alt: "Yuristim" }]),
    ).toThrow(/source/u);
  });
});
