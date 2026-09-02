export const CSES_SELECTORS = {
  content: '.content-wrapper .content, .content',
  title: '.title-block h1, .content h1',
  constraints: '.task-constraints',
  markdownContainer: '.content .md, .md',
  
  // Section headers inside .md
  inputHeader: '#input',
  outputHeader: '#output',
  constraintsHeader: '#constraints',
  exampleHeader: '#example, #example-1, [id^="example"]',
  
  // Sidebar & Navigation
  sidebar: '.nav.sidebar',
  categoryHeader: '.nav.sidebar h4',
  problemLinks: '.nav.sidebar a[href*="/problemset/task/"]',
  currentProblemLink: '.nav.sidebar a.current',
  submitTab: '.title-block .nav a[href*="/submit/"]'
};
