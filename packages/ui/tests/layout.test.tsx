import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell, ResponsiveGrid, SafeArea, TelegramViewport } from "../src";

describe("responsive layout contracts", () => {
  it("provides skip navigation, 4/8/12 grids and no global bottom navigation", () => {
    const { container } = render(
      <AppShell header={<div>Header</div>} sidebar={<div>Sidebar</div>}>
        <ResponsiveGrid>
          <div>Content</div>
        </ResponsiveGrid>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Asosiy kontentga o‘tish" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(container.querySelector(".grid-cols-4")).not.toBeNull();
    expect(container.querySelector("nav[aria-label='Bottom navigation']")).toBeNull();
  });

  it("applies safe-area variables for Apple and Telegram viewports", () => {
    const { container } = render(
      <TelegramViewport>
        <SafeArea>Safe content</SafeArea>
      </TelegramViewport>,
    );
    expect(container.innerHTML).toContain("var(--yr-safe-bottom)");
    expect(container.innerHTML).toContain("var(--yr-safe-top)");
  });
});
