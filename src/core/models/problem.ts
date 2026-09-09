export interface ProblemExample {
  id: number;
  input: string;
  output: string;
}

export interface ProblemLimits {
  timeLimit?: string;
  memoryLimit?: string;
}

export interface ProblemContestInfo {
  id?: string;
  name?: string;
  url?: string;
}

export interface ProblemNavigation {
  previousUrl?: string;
  previousTitle?: string;
  nextUrl?: string;
  nextTitle?: string;
  problemsetUrl?: string;
}

export interface Problem {
  platform: 'codeforces' | 'cses' | string;
  id: string; // e.g. "4A", "1068"
  qualifiedId: string; // e.g. "codeforces:4a", "cses:1068"
  title: string;
  statementHtml: string;
  inputSpecificationHtml?: string;
  outputSpecificationHtml?: string;
  interactionSpecificationHtml?: string;
  noteHtml?: string;
  examples: ProblemExample[];
  tags: string[];
  difficulty?: number | string; // e.g. 800 or "800"
  category?: string; // e.g. "Introductory Problems"
  limits: ProblemLimits;
  contest?: ProblemContestInfo;
  navigation: ProblemNavigation;
  url: string;
  submitUrl?: string;
  solutionsUrl?: string;
  submissionsUrl?: string;
  mySubmissionsUrl?: string;
  editorialUrl?: string;
  isLiveContest?: boolean;
}
