import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, Card, Composer, Input, ModelSelector, Switch, Tabs } from "../src";

describe("representative component accessibility", () => {
  it("has no detectable axe violations", async () => {
    const { container } = render(
      <main>
        <h1>Yuristim komponentlari</h1>
        <Card>
          <Input label="Ismingiz" helperText="Profil nomi" />
          <Switch label="Bildirishnomalar" checked onCheckedChange={() => undefined} />
          <ModelSelector value="lite" onValueChange={() => undefined} />
          <Tabs
            label="Bo‘limlar"
            defaultValue="first"
            items={[
              { value: "first", label: "Birinchi", content: "Birinchi kontent" },
              { value: "second", label: "Ikkinchi", content: "Ikkinchi kontent" },
            ]}
          />
          <Composer label="Xabar" onSubmit={() => undefined} />
          <Button>Davom etish</Button>
        </Card>
      </main>,
    );
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
