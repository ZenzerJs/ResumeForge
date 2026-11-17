# Impeccable Detect — Known False Positives

Recorded false positives from `impeccable detect` that are intentional design/engineering patterns and should be ignored in automated audits.

## `side-tab` Warnings
- `src/components/editor/confirm-master-dialog.tsx:292` (`border-l-2 border-status-success`): Semantic diff-line indicator for added lines (`+`) inside `master-diff-container`, not a decorative side-tab card accent.
- `src/components/editor/confirm-master-dialog.tsx:306` (`border-l-2 border-red-500`): Semantic diff-line indicator for deleted lines (`-`) inside `master-diff-container`, not a decorative side-tab card accent.

## Translucent `rgb()` / `rgba()` Overlays
- Glass surfaces (`.glass-pane`, `.glass-bar`), clear-window radial canvas masks (`radial-gradient(... rgb(0 0 0 / 0.35) ...)`), ambient orb gradients (`.ambient-blob-a`..`.ambient-blob-f`), and specular inset highlights (`rgb(255 255 255 / 0.04)`) intentionally use translucent `rgb(... / alpha)` and `rgba(...)` values over the espresso-black ground ramp.
