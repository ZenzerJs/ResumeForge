import { ResumeDiagnosticReport, ResumeDiagnosticItem } from "../schema/resumeFeedback";

export function auditResume(params: {
  resumeText: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  evidenceIds?: string[];
  bullets?: Array<{ id: string; text: string; evidenceId?: string }>;
}): ResumeDiagnosticReport {
  const items: ResumeDiagnosticItem[] = [];
  const text = params.resumeText.toLowerCase();

  for (const skill of params.requiredSkills) {
    if (!text.includes(skill.toLowerCase())) {
      items.push({
        id: `missing-${skill}`,
        severity: "urgent",
        category: "missing_hard_requirement",
        message: `Missing required skill: ${skill}`,
        targetLineOrBulletId: "global",
        suggestedFix: `Add ${skill} to your resume`,
      });
    }
  }

  if (params.bullets) {
    for (const bullet of params.bullets) {
      if (!bullet.evidenceId) {
        items.push({
          id: `unsub-${bullet.id}`,
          severity: "urgent",
          category: "unsubstantiated_claim",
          message: "Bullet has no associated evidence.",
          targetLineOrBulletId: bullet.id,
          suggestedFix: "Link this bullet to a verified evidence item.",
        });
      }
    }
  }

  if (!text.includes("experience") || !text.includes("education")) {
    items.push({
      id: "missing-section",
      severity: "urgent",
      category: "missing_hard_requirement",
      message: "Resume must contain 'Experience' and 'Education' sections.",
      targetLineOrBulletId: "global",
      suggestedFix: "Add 'Experience' and 'Education' headings.",
    });
  }

  const numericPattern = /\d+[%xk]?|percent|million|billion/i;
  const passiveVerbs = ["responsible for", "assisted with", "helped with", "worked on", "was involved"];
  if (params.bullets) {
    for (const bullet of params.bullets) {
      if (!numericPattern.test(bullet.text)) {
        items.push({
          id: `weak-quant-${bullet.id}`,
          severity: "non_urgent",
          category: "weak_quantification",
          message: "Bullet lacks numeric metrics.",
          targetLineOrBulletId: bullet.id,
          suggestedFix: "Quantify your achievements (e.g., % improvement, # of users).",
        });
      }
      
      const bulletText = bullet.text.toLowerCase();
      for (const verb of passiveVerbs) {
        if (bulletText.includes(verb)) {
          items.push({
            id: `passive-${bullet.id}`,
            severity: "non_urgent",
            category: "passive_tone",
            message: `Uses passive or weak verb: "${verb}"`,
            targetLineOrBulletId: bullet.id,
            suggestedFix: "Use strong action verbs (e.g., 'Led', 'Developed', 'Engineered').",
          });
          break;
        }
      }
    }
  }

  if (params.preferredSkills) {
    for (const skill of params.preferredSkills) {
      if (!text.includes(skill.toLowerCase())) {
        items.push({
          id: `missing-pref-${skill}`,
          severity: "non_urgent",
          category: "weak_quantification",
          message: `Consider adding preferred tooling: ${skill}`,
          targetLineOrBulletId: "global",
          suggestedFix: `Add ${skill} to your resume if you have experience with it.`,
        });
      }
    }
  }

  const datePattern1 = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i;
  const datePattern2 = /\b\d{2}\/\d{4}\b|\b\d{4}-\d{2}\b/;
  if (datePattern1.test(params.resumeText) && datePattern2.test(params.resumeText)) {
    items.push({
      id: "mixed-dates",
      severity: "cosmetic",
      category: "formatting_overflow",
      message: "Mixed date formats detected.",
      targetLineOrBulletId: "global",
      suggestedFix: "Use a consistent date format (e.g., all 'Jan 2024' or all '01/2024').",
    });
  }

  if (params.bullets && params.bullets.length > 0) {
    let hasDot = false;
    let hasNoDot = false;
    for (const bullet of params.bullets) {
      if (bullet.text.trim().endsWith(".")) {
        hasDot = true;
      } else {
        hasNoDot = true;
      }
    }
    if (hasDot && hasNoDot) {
      items.push({
        id: "mixed-punctuation",
        severity: "cosmetic",
        category: "formatting_overflow",
        message: "Inconsistent terminal punctuation in bullets.",
        targetLineOrBulletId: "global",
        suggestedFix: "Ensure all bullets either end with a period or none do.",
      });
    }
  }

  let urgentCount = 0;
  let nonUrgentCount = 0;
  let cosmeticCount = 0;

  for (const item of items) {
    if (item.severity === "urgent") urgentCount++;
    if (item.severity === "non_urgent") nonUrgentCount++;
    if (item.severity === "cosmetic") cosmeticCount++;
  }

  const overallScore = Math.max(0, 100 - urgentCount * 15 - nonUrgentCount * 5 - cosmeticCount * 2);

  return {
    items,
    urgentCount,
    nonUrgentCount,
    cosmeticCount,
    overallScore,
  };
}
