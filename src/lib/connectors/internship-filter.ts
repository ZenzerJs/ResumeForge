/**
 * Internship and Co-op role matching for job connectors.
 * Matches word-boundary variants: intern, internship, co-op, coop, co_op (and plurals).
 */

const INTERNSHIP_OR_COOP_REGEX = /\b(internships?|interns?|co-ops?|coops?|co_ops?)\b/i;

/**
 * Checks whether a job title represents an internship or co-op position.
 * Uses word-boundary matching so words like 'internal', 'internet',
 * 'international', or 'cooperation' are not matched.
 */
export function isInternshipOrCoopTitle(title: string): boolean {
  if (!title || typeof title !== "string") {
    return false;
  }
  return INTERNSHIP_OR_COOP_REGEX.test(title);
}

export interface FilterInternshipOptions {
  includeAllRoles?: boolean;
}

/**
 * Filters an array of job listings to only include internship/co-op positions,
 * unless options.includeAllRoles is explicitly true.
 */
export function filterInternshipListings<T extends { title?: string | null }>(
  jobs: T[],
  options?: FilterInternshipOptions
): T[] {
  if (options?.includeAllRoles === true) {
    return jobs;
  }
  return jobs.filter((job) => Boolean(job.title && isInternshipOrCoopTitle(job.title)));
}
