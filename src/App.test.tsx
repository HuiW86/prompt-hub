import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the M0 spike hint", () => {
    render(<App />);
    expect(screen.getByText(/M0 wake spike/i)).toBeInTheDocument();
  });
});
