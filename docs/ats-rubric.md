# ATS Rubric Specification — Deterministic 100-Point Evaluator

## 1. Overview & Scoring Architecture

ResumeForge implements a **deterministic 100-point rubric** for evaluating tailored `ResumeVariant` documents against target Job Descriptions (`JobRequirements`).

The evaluation is **100% deterministic** (zero LLM calls) and scores a variant across 4 core categories totaling exactly **100 points**.

---

## 2. Rubric Category Breakdown (100 Points Total)

| Category | Weight | Description |
| :--- | :---: | :--- |
| **1. Base Resume Health** | 30 pts | ATS readability, page constraint, section completeness, link presence, technical clarity, formatting consistency, and anti-gaming checks. |
| **2. Required Role Match** | 40 pts | Evidence-backed match for JD `requiredSkills` and core responsibilities. Full credit for contextual bullet demonstration, partial for keyword-only skills list, zero for absent. |
| **3. Preferred Match** | 15 pts | Evidence-backed match for `preferredSkills`. Absence is treated as a minor gap without major penalty. |
| **4. Role-Relevant Evidence** | 15 pts | Profile-aligned evidence evaluation based on the selected/inferred Role Profile overlay. |
| **TOTAL SCORE** | **100 pts** | **Strict 100-Point Scale** |

---

## 3. Category Specifications & Evaluation Rules

### 1. Base Resume Health (30 Points)
- **ATS Readability & Structure (8 pts)**: One-page fit heuristic, selectable text, standard section headers, clear date formatting.
- **Evidence Quality Signals (8 pts)**: Specific projects present, credible bullet structure, working links (URLs/GitHub), quantitative results/outcomes.
- **Technical Clarity (8 pts)**: Skills listed in the Skills section are demonstrated within experience/project bullets (no unexplained keyword dumps).
- **Consistency & Anti-Gaming Guardrail (6 pts)**: Consistent date formats, tenses, section layouts. Strict penalization for hidden/invisible text or keyword stuffing patterns (detection-only, never recommends adding hidden text).

### 2. Required Role Match (40 Points)
- Heavy weight on JD `requiredSkills` and core responsibilities (from Phase 3 extracted `JobRequirements`).
- **Scoring Per Required Skill/Requirement**:
  - **Full Credit (`DEMONSTRATED_IN_EXPERIENCE`)**: Skill is contextually demonstrated inside an accomplishment bullet point or project entry text.
  - **Partial Credit (`LISTED_IN_SKILLS_ONLY`)**: Keyword is present in the skills list section, but not contextually demonstrated in experience/project bullet bodies.
  - **Zero Credit (`UNSUPPORTED_GAP`)**: Completely absent from resume.

### 3. Preferred Match (15 Points)
- Same evidence-backed evaluation as Required Role Match against `preferredSkills`.
- Absence of preferred skills is treated as a **minor gap**, rather than a major penalty.
  - **Full Credit (`DEMONSTRATED_IN_EXPERIENCE`)**: Contextually demonstrated in bullet point or project entry text.
  - **Partial Credit (`LISTED_IN_SKILLS_ONLY`)**: Keyword present in skills list only.
  - **Zero Credit (`UNSUPPORTED_GAP`)**: Absent (minor gap).

### 4. Role-Relevant Evidence (15 Points)
Scores alignment against one of six user-adjustable/inferred **Role Profiles**:
- **Full-stack**: Frontend + backend evidence, deployed work, APIs, databases, automated testing.
- **Backend**: APIs, data modeling, reliability, validation, authentication, testing.
- **AI/LLM**: Agent workflows, tools, evaluation, retrieval, provider handling, guardrails.
- **ML**: Model training, evaluation, datasets, reproducibility, metrics.
- **Frontend**: UI architecture, accessibility, responsiveness, web performance, interaction.
- **Data/Platform**: Pipelines, SQL, data quality, automation, observability.

---

## 4. Output Breakdown Format

```
Overall Match: X / 100

Base Resume Health: X / 30
- [specific findings]

Required Role Match: X / 40
- [skill]: verified in [project/experience] | unsupported gap | listed but weakly demonstrated

Preferred Match: X / 15
- [skill]: verified | unsupported gap (minor)

Role-Relevant Evidence: X / 15
- [profile-specific findings]

Gaps (do not add unless truthful — user-facing guidance, never auto-injected content):
- [missing skill/evidence]
```

---

## 5. Role Profile Selector

The system infers the closest profile from the JD `roleTitle` / raw text by default, but permits manual user override prior to scoring:
1. `Full-stack`
2. `Backend`
3. `AI/LLM`
4. `ML`
5. `Frontend`
6. `Data/Platform`
