// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { AnalyticsHost } from "./AnalyticsHost.js";
import { App } from "./App.js";

describe("example minimal host analytics ownership", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/dev/login") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/api/forms") && init?.method === "POST") {
        return new Response(JSON.stringify({ formId: "f_example", draftRevision: 1 }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("gates selected event delivery by host enablement and consent", async () => {
    const events: Array<{ event: { type?: string; semanticId?: string }; context: { trackingPath?: readonly string[] } | undefined }> = [];
    render(
      <AnalyticsHost adapters={[{ id: "capture", kind: "custom", onEvent: (event, context) => { events.push({ event, context }); } }]}>
        <App />
      </AnalyticsHost>
    );

    await userEvent.click(screen.getByRole("button", { name: "Renderer" }));
    const title = await screen.findByRole("textbox", { name: /Request title/i });

    const selected = () => events.filter(item => item.event.type === "ui.text_field.change" && item.event.semanticId === "request-title-control");

    await userEvent.type(title, "A");
    expect(selected()).toHaveLength(0);

    await userEvent.click(screen.getByRole("switch", { name: "Enable example analytics" }));
    await userEvent.type(title, "B");
    expect(selected()).toHaveLength(0);

    await userEvent.click(screen.getByRole("switch", { name: "Grant analytics consent" }));
    await userEvent.type(title, "C");
    await waitFor(() => expect(selected().length).toBeGreaterThan(0));
    const deliveredCount = selected().length;
    expect(selected().some(item => (item.context?.trackingPath ?? []).includes("example-app"))).toBe(true);

    await userEvent.click(screen.getByRole("switch", { name: "Grant analytics consent" }));
    await userEvent.type(title, "D");
    await waitFor(() => expect(selected().length).toBe(deliveredCount));
  });
});
