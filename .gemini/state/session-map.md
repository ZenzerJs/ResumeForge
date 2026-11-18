### Modified Interfaces
- `src/lib/editor/mode-utils.ts`: Extracted pure `resolveDefaultEditorMode`, `isResumeSourceSafeForForm`, `createBlankResumeTypst`, `parseTypstToStructuredModel`, `serializeStructuredModelToTypst`, `legacyFormToResumeDocument`, `makeEntryId`. Re-exported by `code-editor.tsx` & `resume-form-builder.tsx`.
- `src/lib/editor/layout-persistence.ts`: `DEFAULT_EDITOR_LAYOUT.isAiCollapsed = true`.
- `src/components/editor/ai-sidebar.tsx`: Added `onRequestExpand?: () => void`; wired `htmlFor`/`id` on JD textarea; fixed `urlJobId` guard; removed duplicate `assertCanApplyPatches`; added `AbortController` to job preload & apply-patches.
- `src/components/design-system/brand-mark.tsx`: Shared `BrandMark` component across `TopNav`, `LandingFooter`, `LoginForm`.

### Verified Checks
- Running final `tsc --noEmit`, `check:env`, `lint`, and targeted Vitest after final edit (`top-nav.tsx`).

### Open Blockers
- `tests/managed-resume-form.test.ts:167-168`: Regex `/<textarea[^>]*\sid="([^"]+)"/g` expects 21 textareas while single-line `ManagedResumeForm` fields are now `<input type="text">` per #73; per coordinator #84, `@integrator-2` updates L167 to `<(?:textarea|input)[^>]*\sid="([^"]+)"` post-merge.
