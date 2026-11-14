import { describe, expect, it } from "vitest";
import {
  literalPreviewText,
  locatePreviewText,
  provesPreviewMapping,
  type PreviewTextItem,
} from "./preview-mapping";
const item = (text: string, page = 0): PreviewTextItem => ({
  text,
  page,
  left: 10,
  top: 20,
  width: 30,
  height: 2,
});
describe("verified preview locations", () => {
  it("locates a wrapped bullet across pages only when whole items match", () => {
    const items = [item("Built reliable"), item("distributed services", 1)];
    expect(
      locatePreviewText(items, "- Built  reliable\n  distributed services"),
    ).toHaveLength(2);
    expect(
      locatePreviewText(items, "- Built reliable distributed services"),
    ).toHaveLength(2);
    expect(
      locatePreviewText(items, "reliable distributed services"),
    ).toBeNull();
  });
  it("refuses duplicated, empty, and marked-up anchors", () => {
    expect(locatePreviewText([item("same"), item("same")], "same")).toBeNull();
    expect(literalPreviewText("#strong[hello]")).toBeNull();
    expect(locatePreviewText([item("anything")], "")).toBeNull();
  });
  it("does not infer a source comment or invisible control from unrelated visible text", () => {
    const visible = [item("Visible phrase")];
    expect(
      provesPreviewMapping(visible, visible, "Visible phrase", "Sentinel"),
    ).toBe(false);
    expect(
      provesPreviewMapping(
        visible,
        [item("Sentinel"), item("other changed output")],
        "Visible phrase",
        "Sentinel",
      ),
    ).toBe(false);
  });
  it("requires a differential rendered text match", () => {
    const original = [item("Before"), item("Built services"), item("After")];
    const probe = [item("Before"), item("Sentinel"), item("After")];
    expect(
      provesPreviewMapping(original, probe, "Built services", "Sentinel"),
    ).toBe(true);
    expect(
      provesPreviewMapping(
        original,
        [item("Other"), item("Sentinel"), item("After")],
        "Built services",
        "Sentinel",
      ),
    ).toBe(false);
  });
});
