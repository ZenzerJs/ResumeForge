import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";

describe("Database Key Security & Persistence Isolation", () => {
  it("asserts that Prisma schema contains zero columns or models for API keys or credentials", () => {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");

    // Forbidden key field names
    const forbiddenKeywords = ["apiKey", "api_key", "secretKey", "secret_key", "accessToken", "access_token", "authToken"];

    for (const keyword of forbiddenKeywords) {
      expect(schemaContent).not.toContain(keyword);
    }
  });

  it("asserts that Prisma model names do not include credential storage tables", () => {
    const dmmf = Prisma.dmmf;
    const modelNames = dmmf.datamodel.models.map((m) => m.name.toLowerCase());

    expect(modelNames).not.toContain("key");
    expect(modelNames).not.toContain("apikey");
    expect(modelNames).not.toContain("credential");
    expect(modelNames).not.toContain("secret");
  });

  it("asserts that no model field is named apiKey or key across all Prisma models", () => {
    const dmmf = Prisma.dmmf;
    for (const model of dmmf.datamodel.models) {
      for (const field of model.fields) {
        const fieldNameLower = field.name.toLowerCase();
        expect(fieldNameLower).not.toBe("apikey");
        expect(fieldNameLower).not.toBe("api_key");
        expect(fieldNameLower).not.toBe("secret");
        expect(fieldNameLower).not.toBe("token");
      }
    }
  });
});
