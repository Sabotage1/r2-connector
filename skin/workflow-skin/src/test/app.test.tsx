import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";

describe("App shell", () => {
  it("starts on the brew page and switches navigation tabs", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Brew" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Bags/i }));
    expect(screen.getByRole("heading", { name: "Bags" })).toBeInTheDocument();
  });
});
