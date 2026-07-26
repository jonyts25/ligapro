import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureErrorAlertClass,
  humanizeCaptureError,
} from "@/lib/matches/capture-errors";

describe("humanizeCaptureError", () => {
  it("maps capture window closed distinctly from permission errors", () => {
    const window = humanizeCaptureError(
      "La ventana de captura para este partido ya cerró"
    );
    assert.equal(window.kind, "capture_window_closed");
    assert.match(window.message, /ventana de captura/i);

    const denied = humanizeCaptureError("Not authorized");
    assert.equal(denied.kind, "not_authorized");
    assert.notEqual(denied.kind, window.kind);
  });

  it("maps already voided events", () => {
    const parsed = humanizeCaptureError("match_event abc is already voided");
    assert.equal(parsed.kind, "already_voided");
  });
});

describe("captureErrorAlertClass", () => {
  it("uses warning styling for closed window", () => {
    assert.match(captureErrorAlertClass("capture_window_closed"), /warning/);
  });
});
