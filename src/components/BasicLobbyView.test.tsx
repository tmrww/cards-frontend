import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BasicLobbyView } from "./BasicLobbyView";

const setup = (props = {}) => {
  const handlers = {
    onPlayerNameChange: vi.fn(),
    onCreateRoom: vi.fn(),
    onJoinRoom: vi.fn(),
  };
  render(
    <BasicLobbyView connected playerName="Ann" error={null} {...handlers} {...props} />
  );
  return handlers;
};

describe("BasicLobbyView", () => {
  it("lists registry games in the dropdown, defaulting to the first", () => {
    setup();
    const select = screen.getByLabelText(/Game/) as HTMLSelectElement;
    const labels = [...select.options].map((o) => o.textContent);
    expect(labels[0]).toBe("Guan Dan");
    expect(select.value).toBe("guandan");
  });

  it("hosts with the default game type", () => {
    const { onCreateRoom } = setup();
    fireEvent.click(screen.getByText("Host"));
    expect(onCreateRoom).toHaveBeenCalledWith("guandan");
  });

  it("hosts with the selected game type", () => {
    const { onCreateRoom } = setup();
    fireEvent.change(screen.getByLabelText(/Game/), { target: { value: "placeholder" } });
    fireEvent.click(screen.getByText("Host"));
    expect(onCreateRoom).toHaveBeenCalledWith("placeholder");
  });

  it("joins with an upper-cased, trimmed code", () => {
    const { onJoinRoom } = setup();
    fireEvent.change(screen.getByLabelText(/Code/), { target: { value: "ab12 " } });
    fireEvent.click(screen.getByText("Join"));
    expect(onJoinRoom).toHaveBeenCalledWith("AB12");
  });

  it("disables Join and Host without a name, a code, or a connection", () => {
    setup({ playerName: "  " });
    expect(screen.getByText("Join")).toBeDisabled();
    expect(screen.getByText("Host")).toBeDisabled();
  });

  it("disables Join until a code is entered", () => {
    setup();
    expect(screen.getByText("Join")).toBeDisabled();
    expect(screen.getByText("Host")).toBeEnabled();
  });

  it("shows connection status and errors", () => {
    setup({ connected: false, error: "Nope" });
    expect(screen.getByText("Connecting to server...")).toBeInTheDocument();
    expect(screen.getByText("Nope")).toHaveClass("lobby-error");
    expect(screen.getByText("Host")).toBeDisabled();
  });

  it("reports username edits", () => {
    const { onPlayerNameChange } = setup();
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "Bo" } });
    expect(onPlayerNameChange).toHaveBeenCalledWith("Bo");
  });
});

