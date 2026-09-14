export interface EnrichedEvidenceItem {
  id: string;
  content: string;
  sourceDocs: string[];
  extractedTechnologies: string[];
  impactMetrics?: string[];
  needsReview?: boolean;
  reviewPair?: { candidateContent: string; similarity: number };
}

export function normalizeStringHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '').replace(/[^\w\s]|_/g, '');
}

export function techStrippedJaccardSimilarity(a: string, b: string, techKeywords: string[]): number {
  let cleanA = a.toLowerCase();
  let cleanB = b.toLowerCase();
  
  for (const tech of techKeywords) {
    // Basic word boundary replace, case-insensitive
    const regex = new RegExp(`\\b${tech.toLowerCase()}\\b`, 'gi');
    cleanA = cleanA.replace(regex, '');
    cleanB = cleanB.replace(regex, '');
  }
  
  const setA = new Set(cleanA.split(/\s+/).filter(Boolean));
  const setB = new Set(cleanB.split(/\s+/).filter(Boolean));
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function deduplicateAndMergeEvidence(
  existing: EnrichedEvidenceItem[],
  incoming: EnrichedEvidenceItem[],
  techKeywords: string[]
): {
  merged: EnrichedEvidenceItem[];
  reviewQueue: EnrichedEvidenceItem[];
  stats: { tier1ExactMerges: number; tier2FuzzyMerges: number; tier3ReviewQueue: number; newItems: number };
} {
  const merged = [...existing];
  const reviewQueue: EnrichedEvidenceItem[] = [];
  const stats = { tier1ExactMerges: 0, tier2FuzzyMerges: 0, tier3ReviewQueue: 0, newItems: 0 };

  for (const inc of incoming) {
    let matched = false;
    
    // Tier 1 Exact Match
    for (let i = 0; i < merged.length; i++) {
      if (normalizeStringHash(inc.content) === normalizeStringHash(merged[i].content)) {
        merged[i].sourceDocs = Array.from(new Set([...(merged[i].sourceDocs || []), ...(inc.sourceDocs || [])]));
        stats.tier1ExactMerges++;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 2 & 3
    let bestMatchIndex = -1;
    let highestSim = 0;
    
    for (let i = 0; i < merged.length; i++) {
      const sim = techStrippedJaccardSimilarity(inc.content, merged[i].content, techKeywords);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatchIndex = i;
      }
    }

    if (highestSim >= 0.82 && highestSim < 1.0) {
      // Tier 2
      const bestMatch = merged[bestMatchIndex];
      bestMatch.content = bestMatch.content.length >= inc.content.length ? bestMatch.content : inc.content;
      bestMatch.extractedTechnologies = Array.from(new Set([...(bestMatch.extractedTechnologies || []), ...(inc.extractedTechnologies || [])]));
      bestMatch.sourceDocs = Array.from(new Set([...(bestMatch.sourceDocs || []), ...(inc.sourceDocs || [])]));
      stats.tier2FuzzyMerges++;
      matched = true;
    } else if (highestSim >= 0.60 && highestSim < 0.82) {
      // Tier 3
      inc.needsReview = true;
      inc.reviewPair = { candidateContent: merged[bestMatchIndex].content, similarity: highestSim };
      reviewQueue.push(inc);
      stats.tier3ReviewQueue++;
      matched = true;
    }
    
    if (!matched) {
      merged.push(inc);
      stats.newItems++;
    }
  }

  return { merged, reviewQueue, stats };
}
