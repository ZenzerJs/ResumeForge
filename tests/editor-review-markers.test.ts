import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  CodeEditor,
  REVIEW_MARKER_HELP_TEXT,
  formatReviewMarkerComment,
  formatReviewMarkerCount,
  insertReviewMarkerInView,
} from "@/components/editor/code-editor";

function createTestCodeMirrorView(doc: string, selection: { anchor: number; head?: number }) {
  let state = EditorState.create({
    doc,
    selection: EditorSelection.single(selection.anchor, selection.head),
  });

  return {
    get state() {
      return state;
    },
    dispatch(tr: ReturnType<EditorState["update"]>) {
      state = tr.state;
    },
  };
}

describe("Editor review markers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders 'Add review marker' with accessible help and no verified/Task 7.7 wording", () => {
    const markup = renderToStaticMarkup(
      React.createElement(CodeEditor, {
        value: "= Resume\n- Built distributed cache",
        onChange: () => {},
      })
    );

    expect(markup).toContain("Add review marker");
    expect(markup).toContain(REVIEW_MARKER_HELP_TEXT);
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain(`title="${REVIEW_MARKER_HELP_TEXT}"`);
    expect(markup).not.toContain("Task 7.7");
    expect(markup).not.toContain("@verified");
    expect(markup).not.toContain("review marker</span");
  });

  it("inserts a dated review comment after selected text and at caret without touching fetch/evidence APIs", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("Unexpected network request during review marker insertion");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const fixedDate = new Date("2026-11-17T12:00:00.000Z");
    const expectedComment = formatReviewMarkerComment(fixedDate);
    expect(expectedComment).toBe("// Reviewed: 2026-11-17");

    // 1. Insertion with an active selection appends the marker on a new line after selection.to
    const source = "= Experience\n- Reduced p99 latency by 40%\n- Led migration\n";
    const bulletStart = source.indexOf("- Reduced p99 latency by 40%");
    const bulletEnd = bulletStart + "- Reduced p99 latency by 40%".length;
    const selectionView = createTestCodeMirrorView(source, {
      anchor: bulletStart,
      head: bulletEnd,
    });

    expect(insertReviewMarkerInView(selectionView, fixedDate)).toBe(true);
    expect(selectionView.state.doc.toString()).toBe(
      `= Experience\n- Reduced p99 latency by 40%\n${expectedComment}\n\n- Led migration\n`
    );

    // 2. Insertion at caret (empty selection) inserts at selection.from followed by newline
    const caretPos = source.indexOf("- Led migration");
    const caretView = createTestCodeMirrorView(source, { anchor: caretPos });

    expect(insertReviewMarkerInView(caretView, fixedDate)).toBe(true);
    expect(caretView.state.doc.toString()).toBe(
      `= Experience\n- Reduced p99 latency by 40%\n${expectedComment}\n- Led migration\n`
    );

    // 3. Whitespace-only selection behaves like caret insertion at selection.from
    const wsStart = source.indexOf("\n- Led");
    const wsView = createTestCodeMirrorView(source, { anchor: wsStart, head: wsStart + 1 });
    expect(insertReviewMarkerInView(wsView, fixedDate)).toBe(true);
    expect(wsView.state.doc.toString()).toContain(`${expectedComment}\n\n- Led migration`);

    // 4. Zero evidence or backend API requests were issued
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves legacy @verified comments unchanged when inserting new review markers and formats singular/plural counts", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const legacyComment = "// ✓ @verified:2025-04-01";
    const sourceWithLegacy = `= Experience\n${legacyComment}\n- Maintained core API\n`;
    const caretView = createTestCodeMirrorView(sourceWithLegacy, {
      anchor: sourceWithLegacy.indexOf("- Maintained core API"),
    });

    insertReviewMarkerInView(caretView, new Date("2026-11-17T00:00:00.000Z"));
    const updated = caretView.state.doc.toString();

    expect(updated).toContain(legacyComment);
    expect(updated).toContain("// Reviewed: 2026-11-17");
    expect(formatReviewMarkerCount(1)).toBe("1 review marker");
    expect(formatReviewMarkerCount(2)).toBe("2 review markers");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
