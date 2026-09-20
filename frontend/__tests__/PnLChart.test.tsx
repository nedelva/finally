import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PnLChart } from "@/components/PnLChart";
import type { PortfolioSnapshot } from "@/lib/types";

function snapshot(totalValue: number, recordedAt: string): PortfolioSnapshot {
  return { total_value: totalValue, recorded_at: recordedAt };
}

describe("PnLChart", () => {
  it("plots every snapshot returned by the server: svg, line path, one dot per point", () => {
    const snapshots = [
      snapshot(10000, "2026-01-01T00:00:00Z"),
      snapshot(10250, "2026-01-01T00:00:30Z"),
      snapshot(10180, "2026-01-01T00:01:00Z"),
    ];
    const { container } = render(
      <PnLChart
        snapshots={snapshots}
        currentTotalValue={10180}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-dot")).toHaveLength(3);
  });

  it("plots exactly one point from currentTotalValue when snapshots is empty (D-13)", () => {
    const { container } = render(
      <PnLChart
        snapshots={[]}
        currentTotalValue={10000}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-dot")).toHaveLength(1);
    expect(screen.queryByText(/waiting for data/i)).not.toBeInTheDocument();
  });

  it("renders the waiting placeholder, not a chart, when snapshots and currentTotalValue are both empty", () => {
    const { container } = render(
      <PnLChart
        snapshots={[]}
        currentTotalValue={null}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );

    expect(screen.getByText(/waiting for data/i)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders the waiting placeholder while loading, regardless of snapshots/currentTotalValue", () => {
    const { container } = render(
      <PnLChart
        snapshots={[snapshot(10000, "2026-01-01T00:00:00Z")]}
        currentTotalValue={10000}
        loading={true}
        error={null}
        width={400}
        height={240}
      />,
    );

    expect(screen.getByText(/waiting for data/i)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders a panel-level error message and no chart when error is set", () => {
    const { container } = render(
      <PnLChart
        snapshots={[]}
        currentTotalValue={10000}
        loading={false}
        error="Network error — unable to reach the server."
        width={400}
        height={240}
      />,
    );

    expect(screen.getByText("Network error — unable to reach the server.")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("plots two snapshots recorded one second apart without collapsing them", () => {
    const snapshots = [
      snapshot(10000, "2026-01-01T00:00:00.000Z"),
      snapshot(10005, "2026-01-01T00:00:01.000Z"),
    ];
    const { container } = render(
      <PnLChart
        snapshots={snapshots}
        currentTotalValue={10005}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );

    expect(container.querySelectorAll(".recharts-dot")).toHaveLength(2);
  });

  it("renders no time-range control of any kind (D-12)", () => {
    const snapshots = [snapshot(10000, "2026-01-01T00:00:00Z")];
    const { container } = render(
      <PnLChart
        snapshots={snapshots}
        currentTotalValue={10000}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });
});
