import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TurnBanner } from "./TurnBanner";

describe("TurnBanner", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(<TurnBanner show={false} fast={false} leaving={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Your Turn!' when visible", () => {
    const { getByText } = render(<TurnBanner show fast={false} leaving={false} />);
    expect(getByText("Your Turn!")).toBeInTheDocument();
  });

  it("adds fast and leaving classes", () => {
    const { getByText, container } = render(<TurnBanner show fast leaving />);
    expect(getByText("Your Turn!")).toHaveClass("turn-popup-fast", "turn-popup-leaving");
    expect(container.querySelector(".turn-popup-overlay")).toHaveClass("turn-popup-fast");
  });
});

