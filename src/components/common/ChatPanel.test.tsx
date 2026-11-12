import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerTextSound } from "../../utils/sound";
import { ChatPanel } from "./ChatPanel";

vi.mock("../../utils/sound", () => ({ triggerTextSound: vi.fn() }));

const msgs = [
  { id: "1", sender: "Ann", text: "hello" },
  { id: "2", sender: "Bob", text: "mi bomba" },
];

beforeEach(() => vi.mocked(triggerTextSound).mockClear());

describe("ChatPanel", () => {
  it("shows the empty state", () => {
    render(<ChatPanel messages={[]} onSend={vi.fn()} />);
    expect(screen.getByText("blub blub blub")).toBeInTheDocument();
    expect(screen.getByText("Table Chat (0)")).toBeInTheDocument();
  });

  it("renders messages with their senders", () => {
    render(<ChatPanel messages={msgs} onSend={vi.fn()} />);
    expect(screen.getByText("Ann:")).toBeInTheDocument();
    expect(screen.getByText("mi bomba")).toBeInTheDocument();
    expect(screen.getByText("Table Chat (2)")).toBeInTheDocument();
  });

  it("sends a trimmed message and clears the input", () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "  hi there  " } });
    fireEvent.click(screen.getByText("Send"));
    expect(onSend).toHaveBeenCalledWith("hi there");
    expect(input).toHaveValue("");
  });

  it("disables Send and ignores blank messages", () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const input = screen.getByPlaceholderText("Type a message...");
    expect(screen.getByText("Send")).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("collapses and expands", () => {
    render(<ChatPanel messages={msgs} onSend={vi.fn()} />);
    fireEvent.click(screen.getByText("Hide ▼"));
    expect(screen.queryByText("Ann:")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Expand ▲"));
    expect(screen.getByText("Ann:")).toBeInTheDocument();
  });

  it("triggers a text sound only for newly arrived messages", () => {
    const { rerender } = render(<ChatPanel messages={[]} onSend={vi.fn()} />);
    expect(triggerTextSound).not.toHaveBeenCalled();
    rerender(<ChatPanel messages={[msgs[0]]} onSend={vi.fn()} />);
    expect(triggerTextSound).toHaveBeenCalledWith("hello", "Ann");
    rerender(<ChatPanel messages={msgs} onSend={vi.fn()} />);
    expect(triggerTextSound).toHaveBeenLastCalledWith("mi bomba", "Bob");
    expect(triggerTextSound).toHaveBeenCalledTimes(2);
  });
});

