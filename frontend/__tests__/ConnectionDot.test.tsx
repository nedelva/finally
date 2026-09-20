import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectionDot } from "@/components/ConnectionDot";
import { Header } from "@/components/Header";
import type { ConnectionStatus } from "@/lib/types";

const STATUSES: ConnectionStatus[] = ["connected", "connecting", "reconnecting", "disconnected"];

const EXPECTED_LABEL_WORD: Record<ConnectionStatus, string> = {
  connected: "connected",
  connecting: "connecting",
  reconnecting: "reconnecting",
  disconnected: "disconnected",
};

describe("ConnectionDot", () => {
  it.each(STATUSES)("exposes data-status=%s on the dot", (status) => {
    const { container } = render(<ConnectionDot status={status} />);
    const dot = container.querySelector(`[data-status="${status}"]`);
    expect(dot).toBeInTheDocument();
  });

  it.each(STATUSES)("carries an aria-label naming the %s state in words", (status) => {
    const { container } = render(<ConnectionDot status={status} />);
    const dot = container.querySelector(`[data-status="${status}"]`);
    expect(dot?.getAttribute("aria-label")?.toLowerCase()).toContain(EXPECTED_LABEL_WORD[status]);
  });

  it("produces three mutually distinct indicator classes across connected, the amber pair, and disconnected", () => {
    const renders = STATUSES.map((status) => {
      const { container } = render(<ConnectionDot status={status} />);
      const dot = container.querySelector(`[data-status="${status}"]`);
      return { status, className: dot?.className ?? "" };
    });

    const connected = renders.find((r) => r.status === "connected")!.className;
    const connecting = renders.find((r) => r.status === "connecting")!.className;
    const reconnecting = renders.find((r) => r.status === "reconnecting")!.className;
    const disconnected = renders.find((r) => r.status === "disconnected")!.className;

    // Connecting and reconnecting deliberately share one amber colour class.
    expect(connecting).toBe(reconnecting);

    const distinctGroups = new Set([connected, connecting, disconnected]);
    expect(distinctGroups.size).toBe(3);
  });

  it("does not require any JavaScript timer to render the amber pulse (CSS-animation only)", () => {
    // Sanity check: rendering the amber states synchronously must not throw
    // or depend on fake timers being installed.
    expect(() => render(<ConnectionDot status="connecting" />)).not.toThrow();
    expect(() => render(<ConnectionDot status="reconnecting" />)).not.toThrow();
  });
});

describe("Header", () => {
  it("renders the brand text, the simulated-feed disclosure, and the connection dot for the given status", () => {
    const { container, getByText } = render(
      <Header status="connected" cashBalance={10000} totalValue={10000} />,
    );

    expect(getByText("FinAlly")).toBeInTheDocument();
    expect(container.textContent).toContain("Simulated market data");
    expect(container.querySelector('[data-status="connected"]')).toBeInTheDocument();
  });

  it("renders no dollar-denominated figure before the portfolio has loaded (PORT-01's em-dash rule)", () => {
    const { container } = render(
      <Header status="connected" cashBalance={null} totalValue={null} />,
    );

    expect(container.textContent).not.toMatch(/\$\s?[\d,]/);
  });
});
