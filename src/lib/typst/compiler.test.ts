import { describe, it, expect } from "vitest";
import { parseTypstError } from "./compiler";

describe("Typst Error Parser Unit Tests", () => {
  it("extracts line number from 'at line X' format", () => {
    const raw = "error: unexpected token at line 14, column 3";
    const parsed = parseTypstError(raw);
    expect(parsed.line).toBe(14);
    expect(parsed.message).toContain("unexpected token at line 14");
  });

  it("extracts line number from '14:5:' format", () => {
    const raw = "14:5: error: missing closing parenthesis";
    const parsed = parseTypstError(raw);
    expect(parsed.line).toBe(14);
    expect(parsed.message).toContain("14:5: error: missing closing parenthesis");
  });

  it("returns undefined line when error message contains no line number", () => {
    const raw = "Generic WASM compilation failure";
    const parsed = parseTypstError(raw);
    expect(parsed.line).toBe(1);
    expect(parsed.message).toBe("Generic WASM compilation failure");
  });
});
