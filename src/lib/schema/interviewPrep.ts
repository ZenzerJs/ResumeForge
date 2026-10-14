export type InterviewTrack = "algorithms" | "system_design" | "oa_screening" | "behavioral";

export interface CompanyLogo {
  slug: string;
  name: string;
  logoPath: string;
}

export interface InterviewQuestion {
  id: string;
  title: string;
  track: InterviewTrack;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  companyTags: string[];
  sourceSet: string;
  rubricGuide: string;
  constraints?: string[];
  timeComplexity?: string;
  spaceComplexity?: string;
  starRubric?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}
