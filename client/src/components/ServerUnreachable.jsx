import React from "react";
import { Button } from "react-bootstrap";

/** Full-page state shown when the session could not be checked because the server was unreachable. */
function ServerUnreachable({ onRetry, retrying = false }) {
  return (
    <div className="container d-flex flex-column align-items-center justify-content-center text-center py-5" style={{ minHeight: "60vh" }} role="alert">
      <h4 className="mb-2">Can't reach the server</h4>
      <p className="text-muted mb-4">Check your internet connection. If it's working, the server may be temporarily unavailable.</p>
      <Button variant="primary" onClick={onRetry} disabled={retrying}>
        {retrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
}

export default ServerUnreachable;
