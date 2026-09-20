import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "@/components/Header";

describe("Header", () => {
  it("renders $10,000.00 in both the cash and total figures when both props are 10000", () => {
    render(<Header status="connected" cashBalance={10000} totalValue={10000} />);

    expect(screen.getAllByText("$10,000.00")).toHaveLength(2);
  });

  it("renders the em dash in both figures, with no digit, when both props are null (initial load)", () => {
    render(<Header status="connecting" cashBalance={null} totalValue={null} />);

    expect(screen.getByTestId("header-cash")).toHaveTextContent("—");
    expect(screen.getByTestId("header-total-value")).toHaveTextContent("—");
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("renders the em dash identically, with no additional error element, when both props are null (fetch failed)", () => {
    render(<Header status="disconnected" cashBalance={null} totalValue={null} />);

    expect(screen.getByTestId("header-cash")).toHaveTextContent("—");
    expect(screen.getByTestId("header-total-value")).toHaveTextContent("—");
    // Only the existing connection dot signals health -- no second error element.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("still shows the wordmark and simulated-data disclosure in every case", () => {
    render(<Header status="connected" cashBalance={10000} totalValue={10000} />);
    expect(screen.getByText("FinAlly")).toBeInTheDocument();
    expect(screen.getByText(/Simulated market data/)).toBeInTheDocument();

    render(<Header status="connecting" cashBalance={null} totalValue={null} />);
    expect(screen.getAllByText("FinAlly").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Simulated market data/).length).toBeGreaterThan(0);
  });

  it("still renders the connection dot reflecting the status prop", () => {
    render(<Header status="disconnected" cashBalance={null} totalValue={null} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "disconnected");
  });
});
