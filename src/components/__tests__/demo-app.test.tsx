import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DemoApp } from "@/components/demo-app";
import { composeState } from "@/lib/orchestrator";
import { createInitialFlags } from "@/lib/scenario";

vi.mock("next/dynamic", () => ({
  default: () => function MockDynamicComponent() {
    return <div data-testid="mock-dynamic-component" />;
  },
}));

describe("DemoApp", () => {
  it("renders the seeded operations workspace", async () => {
    const state = await composeState({
      flags: createInitialFlags(),
    });

    render(<DemoApp initialState={state} />);

    expect(
      screen.getByRole("heading", {
        name: /Restoration operations/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Situation overview/i),
    ).toBeVisible();
    expect(
      screen.getByText(/Current ETR/i),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /^Detail rail$/i }),
    ).toBeVisible();
  });
});
