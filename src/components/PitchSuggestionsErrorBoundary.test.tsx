import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PitchSuggestionsErrorBoundary } from "./PitchSuggestionsErrorBoundary";

afterEach(() => cleanup());

const Boom = () => {
  throw new Error("boom");
};

describe("PitchSuggestionsErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <PitchSuggestionsErrorBoundary resetKey="store-1">
        <p>AI Suggestions content</p>
      </PitchSuggestionsErrorBoundary>
    );
    expect(screen.getByText("AI Suggestions content")).toBeTruthy();
  });

  it("isolates a render crash to the fallback message, without throwing past the boundary", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PitchSuggestionsErrorBoundary resetKey="store-1">
        <Boom />
      </PitchSuggestionsErrorBoundary>
    );
    expect(screen.getByText("AI Suggestions are temporarily unavailable. You can continue placing your order manually.")).toBeTruthy();
    spy.mockRestore();
  });

  it("gives a fresh attempt when resetKey changes (e.g. switching retailers)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <PitchSuggestionsErrorBoundary resetKey="store-1">
        <Boom />
      </PitchSuggestionsErrorBoundary>
    );
    expect(screen.getByText(/temporarily unavailable/)).toBeTruthy();
    rerender(
      <PitchSuggestionsErrorBoundary resetKey="store-2">
        <p>Fresh content for a new retailer</p>
      </PitchSuggestionsErrorBoundary>
    );
    expect(screen.getByText("Fresh content for a new retailer")).toBeTruthy();
    spy.mockRestore();
  });
});
