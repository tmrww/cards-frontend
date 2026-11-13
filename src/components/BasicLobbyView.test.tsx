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

  it("joins with an upper-cased, trimmed code on the Join tab", () => {
    const { onJoinRoom } = setup();
    fireEvent.click(screen.getByTestId("lobby-tab-join"));
    fireEvent.change(screen.getByLabelText(/Code/), { target: { value: "ab12 " } });
    fireEvent.click(screen.getByText("Join"));
    expect(onJoinRoom).toHaveBeenCalledWith("AB12");
  });

  it("disables Join and Host without a name, a code, or a connection", () => {
    setup({ playerName: "  " });
    expect(screen.getByText("Host")).toBeDisabled();
    fireEvent.click(screen.getByTestId("lobby-tab-join"));
    expect(screen.getByText("Join")).toBeDisabled();
  });

  it("disables Join until a code is entered", () => {
    setup();
    expect(screen.getByText("Host")).toBeEnabled();
    fireEvent.click(screen.getByTestId("lobby-tab-join"));
    expect(screen.getByText("Join")).toBeDisabled();
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

  it("pre-fills the room code from the ?code= URL parameter", () => {
    const prev = window.location.search;
    window.history.replaceState(null, "", "/?code=ab12c9");
    try {
      const { onJoinRoom } = setup();
      expect(screen.getByLabelText(/Code/)).toHaveValue("AB12C");
      expect(screen.getByText("Join")).toBeEnabled();
      fireEvent.click(screen.getByText("Join"));
      expect(onJoinRoom).toHaveBeenCalledWith("AB12C");
    } finally {
      window.history.replaceState(null, "", prev || "/");
    }
  });

  it("separates Host (game dropdown) and Join (code box) into two tabs", () => {
    setup();
    expect(screen.getByTestId("lobby-tab-host")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Game/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Code/)).toBeNull();

    fireEvent.click(screen.getByTestId("lobby-tab-join"));
    expect(screen.getByTestId("lobby-tab-join")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Code/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Game/)).toBeNull();

    fireEvent.click(screen.getByTestId("lobby-tab-host"));
    expect(screen.getByLabelText(/Game/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Code/)).toBeNull();
  });

  it("renders inside .lobby-screen and .lobby-card containers", () => {
    setup();
    const screenEl = document.querySelector(".lobby-screen");
    const cardEl = document.querySelector(".lobby-card");
    expect(screenEl).toBeInTheDocument();
    expect(cardEl).toBeInTheDocument();
    expect(screenEl).toContainElement(cardEl as HTMLElement);
    expect(screen.getByRole("heading", { name: "Card Games" })).toHaveClass("lobby-title");
  });

  it("clears the code input and ?code= URL parameter when room is not found", () => {
    const prev = window.location.search;
    window.history.replaceState(null, "", "/?code=BAD12");
    try {
      const { rerender } = render(
        <BasicLobbyView
          connected
          playerName="Ann"
          error={null}
          onPlayerNameChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
      expect(screen.getByLabelText(/Code/)).toHaveValue("BAD12");

      rerender(
        <BasicLobbyView
          connected
          playerName="Ann"
          error="Room not found."
          onPlayerNameChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/Code/)).toHaveValue("");
      expect(window.location.search).toBe("");
    } finally {
      window.history.replaceState(null, "", prev || "/");
    }
  });
});

