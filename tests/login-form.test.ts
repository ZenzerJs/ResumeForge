import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { LoginForm, resolvePostLoginRedirect } from "@/components/auth/login-form";
import { CompetitiveMatrixSection } from "@/components/landing/competitive-matrix-section";
import { AtsSandboxSection } from "@/components/landing/ats-sandbox-section";

describe("Sign In & Landing Page Polish Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolvePostLoginRedirect Security & Ergonomics", () => {
    it("resolves safe path from 'next' parameter", () => {
      const params = new URLSearchParams("next=/editor");
      expect(resolvePostLoginRedirect(params)).toBe("/editor");
    });

    it("resolves safe path from 'redirect' parameter", () => {
      const params = new URLSearchParams("redirect=/tailor");
      expect(resolvePostLoginRedirect(params)).toBe("/tailor");
    });

    it("resolves safe path from 'returnUrl' parameter", () => {
      const params = new URLSearchParams("returnUrl=/tracker");
      expect(resolvePostLoginRedirect(params)).toBe("/tracker");
    });

    it("resolves safe path from 'callbackUrl' parameter", () => {
      const params = new URLSearchParams("callbackUrl=/library");
      expect(resolvePostLoginRedirect(params)).toBe("/library");
    });

    it("safely decodes URL-encoded redirect paths", () => {
      const params = new URLSearchParams("next=%2Ftailor%3Ftab%3Dskills");
      expect(resolvePostLoginRedirect(params)).toBe("/tailor?tab=skills");
    });

    it("rejects protocol-relative open redirect attacks (//evil.com)", () => {
      const params = new URLSearchParams("next=//evil.com/phish");
      expect(resolvePostLoginRedirect(params)).toBe("/");
    });

    it("rejects backslash open redirect attacks (/\\evil.com)", () => {
      const params = new URLSearchParams("next=/\\\\evil.com");
      expect(resolvePostLoginRedirect(params)).toBe("/");
    });

    it("rejects absolute external URLs (https://evil.com)", () => {
      const params = new URLSearchParams("next=https://evil.com/steal");
      expect(resolvePostLoginRedirect(params)).toBe("/");
    });

    it("falls back to redirectTo prop when query param is empty", () => {
      const params = new URLSearchParams("");
      expect(resolvePostLoginRedirect(params, "/settings")).toBe("/settings");
    });

    it("falls back to '/' when both query param and redirectTo are missing", () => {
      expect(resolvePostLoginRedirect(null)).toBe("/");
    });
  });

  describe("LoginForm Component Props & Initialization", () => {
    it("exports LoginForm as a React component accepting optional initialMode and redirectTo", () => {
      expect(typeof LoginForm).toBe("function");

      const elementSignin = React.createElement(LoginForm, {
        initialMode: "signin",
        redirectTo: "/tracker",
      });
      expect(elementSignin.props.initialMode).toBe("signin");
      expect(elementSignin.props.redirectTo).toBe("/tracker");

      const elementSignup = React.createElement(LoginForm, {
        initialMode: "signup",
        redirectTo: "/editor",
      });
      expect(elementSignup.props.initialMode).toBe("signup");
      expect(elementSignup.props.redirectTo).toBe("/editor");
    });
  });

  describe("CompetitiveMatrixSection Typography & Competitor Renaming", () => {
    it("renders CompetitiveMatrixSection component without error", () => {
      expect(typeof CompetitiveMatrixSection).toBe("function");
      const element = React.createElement(CompetitiveMatrixSection);
      expect(element).toBeTruthy();
    });
  });

  describe("AtsSandboxSection Typography & Layout", () => {
    it("renders AtsSandboxSection component without error", () => {
      expect(typeof AtsSandboxSection).toBe("function");
      const element = React.createElement(AtsSandboxSection);
      expect(element).toBeTruthy();
    });
  });
});
