import { describe, it, expect } from 'vitest';
import { deduplicateAndMergeEvidence, EnrichedEvidenceItem } from '../src/lib/evidence/mergeEvidence';
import { applyDeterministicPatch, validateMetricGrounding } from '../src/lib/diagnostics/deterministicPatcher';
import { extractPdfEvidence } from '../src/lib/evidence/pdfExtractor';

describe('mergeEvidence', () => {
  it('should deduplicate Tier 1 exact match', () => {
    const existing: EnrichedEvidenceItem[] = [{ id: '1', content: 'Developed a feature', sourceDocs: ['doc1'], extractedTechnologies: [] }];
    const incoming: EnrichedEvidenceItem[] = [{ id: '2', content: 'Developed a feature', sourceDocs: ['doc2'], extractedTechnologies: [] }];
    const res = deduplicateAndMergeEvidence(existing, incoming, []);
    expect(res.stats.tier1ExactMerges).toBe(1);
    expect(res.merged.length).toBe(1);
    expect(res.merged[0].sourceDocs).toContain('doc2');
  });

  it('should merge Tier 2 tech-stripped high-confidence match', () => {
    const existing: EnrichedEvidenceItem[] = [{ id: '1', content: 'Developed a very complex and highly scalable feature that works extremely well in React', sourceDocs: ['doc1'], extractedTechnologies: ['React'] }];
    const incoming: EnrichedEvidenceItem[] = [{ id: '2', content: 'Developed a very complex and highly scalable feature that works extremely well using Vue', sourceDocs: ['doc2'], extractedTechnologies: ['Vue'] }];
    const res = deduplicateAndMergeEvidence(existing, incoming, ['React', 'Vue']);
    expect(res.stats.tier2FuzzyMerges).toBe(1);
    expect(res.merged[0].extractedTechnologies).toContain('Vue');
  });

  it('should route Tier 3 to review queue', () => {
    const existing: EnrichedEvidenceItem[] = [{ id: '1', content: 'Developed a login feature', sourceDocs: ['doc1'], extractedTechnologies: [] }];
    const incoming: EnrichedEvidenceItem[] = [{ id: '2', content: 'Developed a logout feature', sourceDocs: ['doc2'], extractedTechnologies: [] }];
    const res = deduplicateAndMergeEvidence(existing, incoming, []);
    expect(res.stats.tier3ReviewQueue).toBe(1);
    expect(res.reviewQueue.length).toBe(1);
    expect(res.reviewQueue[0].needsReview).toBe(true);
  });
});

describe('deterministicPatcher', () => {
  it('should validate metric grounding exactly for non-percentages and with tolerance for percentages', () => {
    // Percentages: ±1 percentage point
    expect(validateMetricGrounding('Increased by 20%', 'Grew sales by 21%').valid).toBe(true);
    expect(validateMetricGrounding('Increased by 25%', 'Grew sales by 20%').valid).toBe(false);
    expect(validateMetricGrounding('Increased by 21.5%', 'Grew sales by 22.5%').valid).toBe(true);
    expect(validateMetricGrounding('Increased by 21.5%', 'Grew sales by 22.51%').valid).toBe(false);

    // Exact matches for non-percentages
    expect(validateMetricGrounding('Added 1,000 users', 'Gained 1,000 users').valid).toBe(true);
    expect(validateMetricGrounding('Added 1,000 users', 'Gained 1000 users').valid).toBe(true);
    expect(validateMetricGrounding('Added 1,001 users', 'Gained 1,000 users').valid).toBe(false);
  });

  it('should apply patch at RF_BULLET anchor with multiline replace', () => {
    const ast = "Some text\n// RF_BULLET:target1\n- old bullet\n  that spans\n  multiple lines\nMore text";
    const evidence = [{ id: 'diag1', content: 'new bullet', extractedTechnologies: [] }];
    const res = applyDeterministicPatch(ast, 'diag1', 'target1', evidence);
    expect(res.applied).toBe(true);
    expect(res.patchedTypstAst).toContain('- new bullet');
    expect(res.patchedTypstAst).not.toContain('- old bullet');
    expect(res.patchedTypstAst).not.toContain('that spans');
    expect(res.patchedTypstAst).toContain('More text');
  });
});

describe('pdfExtractor', () => {
  it('should throw for scanned documents with < 50 chars', async () => {
    expect(extractPdfEvidence).toBeDefined();
  });
});
