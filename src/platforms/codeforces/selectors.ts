export const CODEFORCES_SELECTORS = {
  container: '.problem-statement',
  header: '.problem-statement .header',
  title: '.problem-statement .header .title',
  timeLimit: '.problem-statement .header .time-limit',
  memoryLimit: '.problem-statement .header .memory-limit',
  inputFile: '.problem-statement .header .input-file',
  outputFile: '.problem-statement .header .output-file',
  
  // Content sections
  inputSpecification: '.problem-statement .input-specification',
  outputSpecification: '.problem-statement .output-specification',
  interaction: '.problem-statement .interaction',
  sampleTests: '.problem-statement .sample-tests',
  sampleTestItem: '.problem-statement .sample-tests .sample-test',
  sampleInput: '.sample-test .input',
  sampleOutput: '.sample-test .output',
  note: '.problem-statement .note',
  
  // Metadata / Sidebar
  sidebar: '#sidebar',
  sideboxes: '#sidebar .sidebox',
  tagBox: '.tag-box',
  tagLink: 'a[href*="/problemset/tags/"], a[href*="/problemset/customtest"]',
  ratingTag: 'span[title="Difficulty"]',
  contestTitle: '#sidebar .rtable th a, .contest-name, #sidebar a[href*="/contest/"]',
  problemListTable: '#sidebar .rtable tr, table.problems tr',
  submitForm: 'form.submitForm',
  submitLink: 'a[href*="/submit"]'
};
