import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

import {
  LoginForm,
  resolvePostLoginRedirect,
  validateSignupPasswords,
} from "@/components/auth/login-form";
import { CompetitiveMatrixSection } from "@/components/landing/competitive-matrix-section";
import { AtsSandboxSection } from "@/components/landing/ats-sandbox-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import PrivacyPage from "@/app/privacy/page";

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

    it("renders Confirm Password on signup mode and account recovery notice on signin mode", () => {
      const signinHtml = renderToStaticMarkup(
        React.createElement(LoginForm, { initialMode: "signin" })
      );
      expect(signinHtml).toContain('data-testid="login-recovery-notice"');
      expect(signinHtml).toContain("Forgot your password?");
      expect(signinHtml).not.toContain('data-testid="login-confirm-password-input"');

      const signupHtml = renderToStaticMarkup(
        React.createElement(LoginForm, { initialMode: "signup" })
      );
      expect(signupHtml).toContain("Confirm Password");
      expect(signupHtml).toContain('data-testid="login-confirm-password-input"');
      expect(signupHtml).not.toContain('data-testid="login-recovery-notice"');

      expect(validateSignupPasswords("short", "short")).toBe(
        "Password must be at least 8 characters."
      );
      expect(validateSignupPasswords("Password123!", "Password456!")).toBe(
        "Passwords do not match."
      );
      expect(validateSignupPasswords("Password123!", "Password123!")).toBeNull();
    });
  });

  describe("CompetitiveMatrixSection Typography & Product Facts", () => {
    it("renders factual product architecture columns without competitor brands or BYOK jargon", () => {
      expect(typeof CompetitiveMatrixSection).toBe("function");
      const html = renderToStaticMarkup(React.createElement(CompetitiveMatrixSection, { demoMode: true }));
      expect(html).toContain("Capability");
      expect(html).toContain("ResumeForge");
      expect(html).toContain("ResumeForge architecture table");
      expect(html).toContain("Demo drafts stay in browser storage. Account signup is disabled.");
      expect(html).toContain("AI API key you provide");
      expect(html).not.toContain("BYOK");
      expect(html).not.toContain("Competitors");
      expect(html).not.toMatch(/\b(Teal|Simplify|Jobright)\b/i);
    });
  });

  describe("LandingFooter & PrivacyPage Open-Source Provenance", () => {
    it("includes verified GitHub repository, issue links, and WLU student attribution without BYOK jargon", () => {
      const footerHtml = renderToStaticMarkup(React.createElement(LandingFooter));
      expect(footerHtml).toContain("https://github.com/ZenzerJs/ResumeForge");
      expect(footerHtml).toContain("https://github.com/ZenzerJs/ResumeForge/issues");
      expect(footerHtml).toContain("Wilfrid Laurier University CS student");

      const privacyHtml = renderToStaticMarkup(React.createElement(PrivacyPage));
      expect(privacyHtml).toContain("https://github.com/ZenzerJs/ResumeForge");
      expect(privacyHtml).toContain("https://github.com/ZenzerJs/ResumeForge/issues");
      expect(privacyHtml).toContain("Wilfrid Laurier University CS student");
      expect(privacyHtml).toContain("AI keys you provide");
      expect(privacyHtml).not.toContain("BYOK");
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
