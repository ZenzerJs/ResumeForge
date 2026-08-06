# DESIGN.md — Visual Identity & Design System Specification

## 1. Visual Identity & Workspace Philosophy

ResumeForge is designed as a **calm, precise, professional document workspace**.

Unlike marketing landing pages or gamified productivity apps, ResumeForge prioritizes legibility, high information density, structural clarity, and focus. The visual atmosphere should resemble a modern IDE or desktop publishing tool (like Linear or Figma) rather than a flashy consumer Web3 dashboard.

### Core Principles
- **Document-Centric**: The resume draft and live preview are the visual centerpiece.
- **High Contrast & Clarity**: Clean dark/light neutral surfaces with crisp slate typography.
- **Intentional Accent Color**: Slate/Indigo accents used strictly for interactive focus, active states, and patch diff actions.
- **Zero Distraction**: No background particle effects, floating blobs, decorative looping animations, or unnecessary popovers.

---

## 2. Color Roles & Design Tokens

ResumeForge uses a curated Slate color system configured with CSS custom properties:

| Role | Token | Hex / Value | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `--bg-canvas` | `#fcfcfd` | Workspace root background |
| **Surface Base** | `--bg-surface` | `#ffffff` | Panel containers, sidebar cards |
| **Surface Muted** | `--bg-muted` | `#f1f5f9` | Table headers, secondary buttons |
| **Border Soft** | `--border-subtle` | `#e2e8f0` | Dividers, card boundaries |
| **Border Focus** | `--border-focus` | `#6366f1` | Active inputs, selected cards |
| **Text Primary** | `--text-primary` | `#0f172a` | Main headings, body text |
| **Text Secondary**| `--text-muted` | `#64748b` | Subtitles, labels, metadata |
| **Diff Addition** | `--diff-add-bg` | `#f0fdf4` | Added text background (`#166534` text) |
| **Diff Removal**  | `--diff-del-bg` | `#fef2f2` | Removed text background (`#991b1b` text) |
| **Evidence Tag**  | `--tag-evidence` | `#eff6ff` | Evidence bank pill tag (`#1e40af` text) |

---

## 3. Typography Scale

Font Family: System UI sans-serif stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`).

- **Display Heading** (`text-2xl`): 24px / 1.3 leading, Semibold (Workspace titles)
- **Section Heading** (`text-lg`): 18px / 1.4 leading, Medium (Panel headers)
- **Body Text** (`text-sm`): 14px / 1.5 leading, Regular (Main content, diffs)
- **Caption / Tag** (`text-xs`): 12px / 1.4 leading, Medium (Metadata, timestamps, evidence IDs)
- **Monospace Code** (`font-mono text-xs`): Typst source editor, schema JSON views

---

## 4. Spacing Scale & Layout Boundaries

- **Grid Baseline**: 4px / 8px incremental grid.
- **Panel Padding**: `p-4` (16px) or `p-6` (24px) for main workspace splits.
- **Card Gaps**: `space-y-3` (12px) between patch cards.
- **Workspace Layout**: 
  - Left Pane (350px): Job Description & Matcher Panel
  - Middle Pane (Flexible): Tailoring Workspace & Diff Review
  - Right Pane (Flexible / Fixed ratio): Live Typst PDF Preview

---

## 5. Component Behavior Principles

### Diff Cards & Patch Review
- Each AI-proposed patch is rendered inside a distinct card.
- Red strikethrough background for removed text (`-`).
- Green highlight background for inserted text (`+`).
- Explicit citation badge: e.g. `[Evidence: EXP-2023-01]` linking directly to the verified evidence item.
- Interactive controls: `Accept` (Green), `Reject` (Red/Slate), `Edit` (Neutral ghost button).

### Evidence Citations
- Clicking an evidence badge opens an inline inspector highlighting the exact metric/bullet stored in the Evidence Bank.

---

## 6. Explicit Anti-Patterns

- ❌ **No Decorative Animations**: No bouncing icons, confetti effects, or delayed fade-in transitions.
- ❌ **No Dark-Pattern UI**: No aggressive popups urging upgrades or hidden actions.
- ❌ **No Gamified Scoring**: ATS scores are presented as objective quality rubrics, not arcade high-scores with flashing badges.
