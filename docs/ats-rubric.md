# ATS Rubric Specification — Internship & Early-Career Focus

## 1. Overview & Scoring Architecture

ResumeForge implements an **internship and early-career focused 100-point base rubric** for ATS evaluation.

Unlike traditional corporate executive rubrics that heavily weigh 10+ years of senior leadership experience, our rubric prioritizes project depth, technical evidence, alignment with job requirements, and high-impact metrics suitable for students, interns, and junior engineers.

The base rubric totals **exactly 100 points**, with up to **10 optional bonus points** awarded for exceptional signals.

---

## 2. Base Rubric Breakdown (100 Base Points)

| Category | Base Weight | Description |
| :--- | :---: | :--- |
| **1. Job Match Evidence** | 25 pts | Direct overlap between job requirement keywords and verified Evidence Bank items. |
| **2. Project Depth & Artifacts** | 25 pts | Complexity, technical rigor, live links, and problem-solving demonstrated in projects. |
| **3. Practical Experience** | 20 pts | Internships, research assistantships, open-source contributions, or campus technical roles. |
| **4. Technical Depth & Skills** | 15 pts | Breadth and appropriateness of tools, frameworks, languages, and core CS fundamentals. |
| **5. Education & Academic Growth**| 10 pts | Degree relevance, GPA (if >3.5), relevant coursework, honors, or technical certs. |
| **6. Base Resume Quality** | 5 pts | Formatting precision, action verb usage, typography clarity, and one-page adherence. |
| **TOTAL BASE SCORE** | **100 pts** | **Standard Base Benchmark** |

---

## 3. Category Rationales

### 1. Job Match Evidence (25 Points)
*Rationale*: Early-career candidates often fail initial ATS screens due to keyword mismatches between their resume bullet phrasing and the specific terminology used in the job description. Allocating 25 points to job match ensures the resume uses exact, truthful terminology required by the posting without keyword stuffing.

### 2. Project Depth & Artifacts (25 Points)
*Rationale*: For students and early-career candidates, complex personal or capstone projects serve as the primary proxy for engineering capability. 25 points are assigned here to evaluate technical complexity, deployment status (live URLs, GitHub repos), and measurable outcomes.

### 3. Practical Experience (20 Points)
*Rationale*: While student candidates may not have years of full-time industry history, prior internships, research labs, or co-ops demonstrate readiness for professional environments. 20 points credit demonstrated performance in structured team environments.

### 4. Technical Depth & Skills (15 Points)
*Rationale*: Modern technical roles require both foundational knowledge (data structures, system design) and specific stack tools (React, PyTorch, Docker). 15 points evaluate whether the technical skills listed are reflected in project/work bullet points rather than isolated keyword lists.

### 5. Education & Academic Growth (10 Points)
*Rationale*: Academic standing, computer science coursework, and university background remain relevant early-career indicators. 10 points reward relevant degree programs, strong academic trajectory, and specialized domain coursework.

### 6. Base Resume Quality (5 Points)
*Rationale*: Fundamental document quality—such as using strong action verbs, avoiding passive voice, ensuring zero typos, and strictly adhering to a single page—provides the essential foundation for human review. 5 points guarantee basic presentation excellence.

---

## 4. Bonus Points (0 to 10 Optional Points)

- **Open Source Contributions (+3 pts)**: Active maintainer or merged PRs in recognized public repositories.
- **Hackathon Wins / Technical Awards (+3 pts)**: First/second place or specialized track awards in competitive events.
- **Published Research / Papers (+4 pts)**: Co-authored peer-reviewed papers or workshop publications.

---

## 5. Role Profile Weight Adjustments

While the base score always sums to 100 points, ResumeForge adjusts intra-category focus weights depending on the selected **Role Profile**:

- **Backend Engineering Profile**: Increases weight on API design, database indexing, and concurrency bullets.
- **Frontend Engineering Profile**: Increases weight on UI component architecture, state management, and performance metrics.
- **AI/ML Engineering Profile**: Increases weight on model evaluation metrics, dataset processing, and PyTorch/TensorFlow depth.
- **Data Engineering Profile**: Increases weight on ETL pipelines, SQL query optimization, and data warehousing tools.

Adjustments redistribute points within category boundaries to maintain the invariant **100-point total base**.
