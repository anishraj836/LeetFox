export interface ProblemState {
  solved: boolean;
  attempted: boolean;
  bookmarked: boolean;
  notes: string;
  lastVisited: number;
}

export const DEFAULT_PROBLEM_STATE: ProblemState = {
  solved: false,
  attempted: false,
  bookmarked: false,
  notes: '',
  lastVisited: 0,
};

export interface CategoryProgress {
  category: string;
  solvedCount: number;
  totalCount: number;
}
