import React, { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types";
import { triggerTextSound } from "../../utils/sound";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

/** Collapsible table chat. Plays a text-triggered sound for each new message. */
export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSend }) => {
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seenCountRef = useRef(0);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest && messages.length > seenCountRef.current) {
      triggerTextSound(latest.text, latest.sender);
    }
    seenCountRef.current = messages.length;

    if (!collapsed) {
      endRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages, collapsed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className={`chat-box-container ${collapsed ? "chat-collapsed" : ""}`}>
      <div className="chat-header">
        <span>Table Chat ({messages.length})</span>
        <button
          type="button"
          className="btn-secondary btn-small chat-toggle-btn"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? "Expand ▲" : "Hide ▼"}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">blub blub blub</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="chat-message-item">
                  <span className="chat-msg-sender">{msg.sender}:</span>
                  <span>{msg.text}</span>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <form className="chat-input-row" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="chat-send-btn" disabled={!input.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
};

