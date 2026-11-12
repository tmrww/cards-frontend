import React from "react";

export const ErrorBanner: React.FC<{ error: string | null; onClear: () => void }> = ({
  error,
  onClear,
}) =>
  error ? (
    <div className="hand-error-banner">
      <span>{error}</span>
      <button type="button" className="btn-clear" onClick={onClear}>
        ✕
      </button>
    </div>
  ) : null;

