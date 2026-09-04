import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { snippet } from '@codemirror/autocomplete';

export interface TrieItem {
  label: string;
  type?: 'type' | 'function' | 'keyword' | 'class' | 'variable' | 'text';
  detail?: string;
  info?: string;
  template?: string;
  boost?: number;
}

class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public items: TrieItem[] = [];
}

export class CompletionTrie {
  private root: TrieNode = new TrieNode();
  private localWords: Set<string> = new Set();

  public insert(item: TrieItem): void {
    const word = item.label.toLowerCase();
    let current = this.root;

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      let next = current.children.get(char);
      if (!next) {
        next = new TrieNode();
        current.children.set(char, next);
      }
      current = next;
    }

    // Avoid exact duplicate labels
    if (!current.items.some(existing => existing.label === item.label)) {
      current.items.push(item);
    }
  }

  public search(prefix: string, limit = 25): TrieItem[] {
    if (!prefix) return [];
    const lowerPrefix = prefix.toLowerCase();
    let current = this.root;

    for (let i = 0; i < lowerPrefix.length; i++) {
      const char = lowerPrefix[i];
      const next = current.children.get(char);
      if (!next) return [];
      current = next;
    }

    const results: TrieItem[] = [];
    const queue: TrieNode[] = [current];

    while (queue.length > 0 && results.length < limit * 2) {
      const node = queue.shift()!;
      for (const item of node.items) {
        results.push(item);
        if (results.length >= limit * 2) break;
      }
      for (const child of node.children.values()) {
        queue.push(child);
      }
    }

    // Sort by boost descending, then by length ascending
    results.sort((a, b) => {
      const boostA = a.boost ?? 0;
      const boostB = b.boost ?? 0;
      if (boostA !== boostB) return boostB - boostA;
      return a.label.length - b.label.length;
    });

    return results.slice(0, limit);
  }

  /**
   * Dynamically index identifier tokens from current document
   */
  public indexDocumentTokens(text: string): void {
    const tokens = text.match(/\b[a-zA-Z_]\w{2,}\b/g) || [];
    for (const token of tokens) {
      if (!this.localWords.has(token)) {
        this.localWords.add(token);
        this.insert({
          label: token,
          type: 'variable',
          detail: 'local',
          boost: -10
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-populated CP Dictionaries for Supported Languages
// ---------------------------------------------------------------------------

export function createTrieForLanguage(lang: string): CompletionTrie {
  const trie = new CompletionTrie();

  if (lang === 'cpp') {
    populateCppTrie(trie);
  } else if (lang === 'python') {
    populatePythonTrie(trie);
  } else if (lang === 'java') {
    populateJavaTrie(trie);
  } else if (lang === 'rust') {
    populateRustTrie(trie);
  } else if (lang === 'go') {
    populateGoTrie(trie);
  }

  return trie;
}

function populateCppTrie(trie: CompletionTrie): void {
  // STL Containers & Types
  const types: [string, string, string, string?][] = [
    ['vector', 'std::vector<T>', 'Sequence container representing array that can change in size', 'vector<${1:int}> ${2:v};'],
    ['pair', 'std::pair<T1, T2>', 'Combines two values into a single unit', 'pair<${1:int}, ${2:int}> ${3:p};'],
    ['tuple', 'std::tuple<Types...>', 'Fixed-size collection of heterogeneous values', 'tuple<${1:int}, ${2:int}, ${3:int}> ${4:t};'],
    ['string', 'std::string', 'Standard text string container', 'string ${1:s};'],
    ['map', 'std::map<Key, Val>', 'Sorted associative key-value container (O(log n))', 'map<${1:int}, ${2:int}> ${3:mp};'],
    ['unordered_map', 'std::unordered_map<Key, Val>', 'Hash-table based key-value container (O(1) avg)', 'unordered_map<${1:int}, ${2:int}> ${3:mp};'],
    ['set', 'std::set<Key>', 'Sorted collection of unique keys (O(log n))', 'set<${1:int}> ${2:st};'],
    ['unordered_set', 'std::unordered_set<Key>', 'Hash-table based collection of unique keys (O(1) avg)', 'unordered_set<${1:int}> ${2:st};'],
    ['multiset', 'std::multiset<Key>', 'Sorted collection of keys with duplicates (O(log n))', 'multiset<${1:int}> ${2:mst};'],
    ['queue', 'std::queue<T>', 'First-in first-out FIFO container adapter', 'queue<${1:int}> ${2:q};'],
    ['deque', 'std::deque<T>', 'Double-ended queue container', 'deque<${1:int}> ${2:dq};'],
    ['stack', 'std::stack<T>', 'Last-in first-out LIFO container adapter', 'stack<${1:int}> ${2:stk};'],
    ['priority_queue', 'std::priority_queue<T>', 'Max-heap container adapter (O(log n))', 'priority_queue<${1:int}> ${2:pq};'],
    ['bitset', 'std::bitset<N>', 'Fixed-size sequence of bits with bitwise operations', 'bitset<${1:64}> ${2:bs};'],
    ['array', 'std::array<T, N>', 'Fixed-size sequence container', 'array<${1:int}, ${2:N}> ${3:arr};'],
    ['stringstream', 'std::stringstream', 'Stream class to operate on strings', 'stringstream ${1:ss}(${2:str});'],
    ['long long', '64-bit integer type', 'typedef long long ll;', 'long long'],
    ['nullptr', 'Null pointer constant', 'nullptr', 'nullptr']
  ];

  for (const [label, detail, info, tmpl] of types) {
    trie.insert({
      label,
      type: 'type',
      detail,
      info,
      template: tmpl || label,
      boost: 100
    });
  }

  // Common Algorithms & Functions
  const functions: [string, string, string, string?][] = [
    ['sort', 'std::sort(begin, end)', 'Sorts elements in range in non-descending order', 'sort(${1:v}.begin(), ${1:v}.end());'],
    ['reverse', 'std::reverse(begin, end)', 'Reverses the order of elements in range', 'reverse(${1:v}.begin(), ${1:v}.end());'],
    ['lower_bound', 'std::lower_bound(begin, end, val)', 'Returns iterator to first element >= val', 'lower_bound(${1:v}.begin(), ${1:v}.end(), ${2:val})'],
    ['upper_bound', 'std::upper_bound(begin, end, val)', 'Returns iterator to first element > val', 'upper_bound(${1:v}.begin(), ${1:v}.end(), ${2:val})'],
    ['binary_search', 'std::binary_search(begin, end, val)', 'Tests if value exists in sorted sequence', 'binary_search(${1:v}.begin(), ${1:v}.end(), ${2:val})'],
    ['min', 'std::min(a, b)', 'Returns smaller of two values', 'min(${1:a}, ${2:b})'],
    ['max', 'std::max(a, b)', 'Returns greater of two values', 'max(${1:a}, ${2:b})'],
    ['min_element', 'std::min_element(begin, end)', 'Returns iterator to smallest element', 'min_element(${1:v}.begin(), ${1:v}.end())'],
    ['max_element', 'std::max_element(begin, end)', 'Returns iterator to greatest element', 'max_element(${1:v}.begin(), ${1:v}.end())'],
    ['accumulate', 'std::accumulate(begin, end, init)', 'Sums up elements in range', 'accumulate(${1:v}.begin(), ${1:v}.end(), 0LL)'],
    ['count', 'std::count(begin, end, val)', 'Counts occurrences of val in range', 'count(${1:v}.begin(), ${1:v}.end(), ${2:val})'],
    ['fill', 'std::fill(begin, end, val)', 'Assigns value to elements in range', 'fill(${1:v}.begin(), ${1:v}.end(), ${2:val});'],
    ['iota', 'std::iota(begin, end, val)', 'Fills range with sequential values', 'iota(${1:v}.begin(), ${1:v}.end(), ${2:0});'],
    ['gcd', 'std::gcd(a, b)', 'Greatest common divisor (C++17)', 'gcd(${1:a}, ${2:b})'],
    ['lcm', 'std::lcm(a, b)', 'Least common multiple (C++17)', 'lcm(${1:a}, ${2:b})'],
    ['swap', 'std::swap(a, b)', 'Swaps values of two objects', 'swap(${1:a}, ${2:b});'],
    ['push_back', 'v.push_back(val)', 'Appends element to end of container', 'push_back(${1:val});'],
    ['emplace_back', 'v.emplace_back(args...)', 'Constructs element in-place at end', 'emplace_back(${1:args});'],
    ['pop_back', 'v.pop_back()', 'Removes last element of container', 'pop_back();'],
    ['push', 'q.push(val)', 'Pushes element into queue/stack', 'push(${1:val});'],
    ['pop', 'q.pop()', 'Removes top/front element', 'pop();'],
    ['top', 'pq.top()', 'Returns top element of stack/priority_queue', 'top()'],
    ['front', 'q.front()', 'Returns first element of queue/deque', 'front()'],
    ['back', 'q.back()', 'Returns last element of queue/deque', 'back()'],
    ['insert', 'st.insert(val)', 'Inserts element into set/map', 'insert(${1:val});'],
    ['erase', 'st.erase(val)', 'Erases element or iterator from container', 'erase(${1:val});'],
    ['find', 'st.find(val)', 'Searches for element with key', 'find(${1:val})'],
    ['clear', 'c.clear()', 'Removes all elements from container', 'clear();'],
    ['size', 'c.size()', 'Returns number of elements in container', 'size()'],
    ['empty', 'c.empty()', 'Checks whether container is empty', 'empty()'],
    ['begin', 'c.begin()', 'Returns iterator to beginning', 'begin()'],
    ['end', 'c.end()', 'Returns iterator to end', 'end()'],
    ['rbegin', 'c.rbegin()', 'Returns reverse iterator to reverse beginning', 'rbegin()'],
    ['rend', 'c.rend()', 'Returns reverse iterator to reverse end', 'rend()'],
    ['resize', 'v.resize(count)', 'Resizes container to contain count elements', 'resize(${1:n});'],
    ['reserve', 'v.reserve(capacity)', 'Reserves storage for capacity elements', 'reserve(${1:n});']
  ];

  for (const [label, detail, info, tmpl] of functions) {
    trie.insert({
      label,
      type: 'function',
      detail,
      info,
      template: tmpl || label,
      boost: 80
    });
  }

  // Fast I/O & Keywords
  const ioKeywords: [string, string, string, string?][] = [
    ['cin', 'Standard input stream', 'Reads from standard input', 'cin >> ${1:x};'],
    ['cout', 'Standard output stream', 'Writes to standard output', 'cout << ${1:ans} << "\\n";'],
    ['endl', 'std::endl', 'Inserts newline and flushes stream', 'endl'],
    ['fastio', 'Fast I/O template', 'Disables stdio sync and unties cin for fast CP input', 'ios_base::sync_with_stdio(false);\ncin.tie(NULL);'],
    ['getline', 'std::getline(cin, str)', 'Reads line from input stream into string', 'getline(cin, ${1:s});']
  ];

  for (const [label, detail, info, tmpl] of ioKeywords) {
    trie.insert({
      label,
      type: 'keyword',
      detail,
      info,
      template: tmpl || label,
      boost: 85
    });
  }

  // CP Code Snippets
  const snippets: [string, string, string, string][] = [
    ['vec2d', '2D Vector snippet', 'vector<vector<int>> dp(n, vector<int>(m, 0));', 'vector<vector<${1:int}>> ${2:dp}(${3:n}, vector<${1:int}>(${4:m}, ${5:0}));'],
    ['fori', 'For loop (0 to n-1)', 'for (int i = 0; i < n; i++)', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    $0\n}'],
    ['forr', 'Reverse for loop (n-1 down to 0)', 'for (int i = n - 1; i >= 0; i--)', 'for (int ${1:i} = ${2:n} - 1; ${1:i} >= 0; --${1:i}) {\n    $0\n}'],
    ['fora', 'Range-based for loop', 'for (auto& x : v)', 'for (auto& ${1:x} : ${2:v}) {\n    $0\n}'],
    ['whilet', 'Testcases loop', 'while (t--)', 'int ${1:t} = 1;\ncin >> ${1:t};\nwhile (${1:t}--) {\n    ${2:solve}();\n}'],
    ['pqmin', 'Min-heap priority queue', 'priority_queue<int, vector<int>, greater<int>>', 'priority_queue<${1:int}, vector<${1:int}>, greater<${1:int}>> ${2:pq};'],
    ['all', 'Container begin/end helper', 'v.begin(), v.end()', '${1:v}.begin(), ${1:v}.end()'],
    ['rall', 'Container reverse begin/end helper', 'v.rbegin(), v.rend()', '${1:v}.rbegin(), ${1:v}.rend()']
  ];

  for (const [label, detail, info, tmpl] of snippets) {
    trie.insert({
      label,
      type: 'keyword',
      detail,
      info,
      template: tmpl,
      boost: 80
    });
  }
}

function populatePythonTrie(trie: CompletionTrie): void {
  const items: [string, string, string, string, 'type' | 'function' | 'keyword'][] = [
    ['defaultdict', 'collections.defaultdict', 'Dict with default factory for missing keys', 'from collections import defaultdict\n${1:d} = defaultdict(${2:int})', 'type'],
    ['Counter', 'collections.Counter', 'Dict subclass for counting hashable items', 'from collections import Counter\n${1:counts} = Counter(${2:arr})', 'type'],
    ['deque', 'collections.deque', 'Double-ended queue with O(1) appends and pops', 'from collections import deque\n${1:q} = deque([${2}])', 'type'],
    ['heapq', 'heapq module', 'Binary heap implementation for Python', 'import heapq\nheapq.heappush(${1:h}, ${2:val})', 'type'],
    ['heappush', 'heapq.heappush(heap, item)', 'Push item onto heap maintaining heap invariant', 'heapq.heappush(${1:heap}, ${2:item})', 'function'],
    ['heappop', 'heapq.heappop(heap)', 'Pop and return smallest element from heap', 'heapq.heappop(${1:heap})', 'function'],
    ['heapify', 'heapq.heapify(list)', 'Transform list into heap in linear time', 'heapq.heapify(${1:arr})', 'function'],
    ['bisect_left', 'bisect.bisect_left(a, x)', 'Locate insertion point for x in a to maintain sorted order', 'from bisect import bisect_left\n${1:idx} = bisect_left(${2:arr}, ${3:x})', 'function'],
    ['bisect_right', 'bisect.bisect_right(a, x)', 'Locate rightmost insertion point for x in a', 'from bisect import bisect_right\n${1:idx} = bisect_right(${2:arr}, ${3:x})', 'function'],
    ['combinations', 'itertools.combinations(p, r)', 'r-length tuples in sorted order without repeated elements', 'from itertools import combinations', 'function'],
    ['permutations', 'itertools.permutations(p, r)', 'r-length tuples of all possible permutations', 'from itertools import permutations', 'function'],
    ['accumulate', 'itertools.accumulate(p)', 'Returns running accumulated sums', 'from itertools import accumulate', 'function'],
    ['math', 'math module', 'Standard mathematical functions', 'import math', 'type'],
    ['gcd', 'math.gcd(a, b)', 'Greatest common divisor', 'math.gcd(${1:a}, ${2:b})', 'function'],
    ['lcm', 'math.lcm(a, b)', 'Least common multiple', 'math.lcm(${1:a}, ${2:b})', 'function'],
    ['inf', 'float("inf")', 'Positive infinity representation', 'float("inf")', 'keyword'],
    ['print', 'print(*args, sep=" ", end="\\n")', 'Prints objects to text stream', 'print(${1:ans})', 'function'],
    ['input', 'sys.stdin.readline', 'Reads line from input', 'sys.stdin.readline().strip()', 'function'],
    ['range', 'range(start, stop, step)', 'Produces sequence of integers', 'range(${1:n})', 'type'],
    ['enumerate', 'enumerate(iterable, start=0)', 'Yields (index, value) tuples', 'enumerate(${1:iterable})', 'function'],
    ['sorted', 'sorted(iterable, key=None, reverse=False)', 'Returns sorted list of elements', 'sorted(${1:iterable})', 'function'],
    ['reversed', 'reversed(seq)', 'Returns reverse iterator over values', 'reversed(${1:seq})', 'function']
  ];

  for (const [label, detail, info, tmpl, kind] of items) {
    trie.insert({
      label,
      type: kind,
      detail,
      info,
      template: tmpl || label,
      boost: 85
    });
  }
}

function populateJavaTrie(trie: CompletionTrie): void {
  const items: [string, string, string, string, 'type' | 'function' | 'keyword'][] = [
    ['ArrayList', 'java.util.ArrayList<E>', 'Resizable-array implementation of List', 'ArrayList<${1:Integer}> ${2:list} = new ArrayList<>();', 'type'],
    ['HashMap', 'java.util.HashMap<K,V>', 'Hash table based implementation of Map', 'HashMap<${1:Integer}, ${2:Integer}> ${3:map} = new HashMap<>();', 'type'],
    ['HashSet', 'java.util.HashSet<E>', 'Hash table based implementation of Set', 'HashSet<${1:Integer}> ${2:set} = new HashSet<>();', 'type'],
    ['TreeMap', 'java.util.TreeMap<K,V>', 'Red-Black tree based NavigableMap', 'TreeMap<${1:Integer}, ${2:Integer}> ${3:map} = new TreeMap<>();', 'type'],
    ['TreeSet', 'java.util.TreeSet<E>', 'Red-Black tree based NavigableSet', 'TreeSet<${1:Integer}> ${2:set} = new TreeSet<>();', 'type'],
    ['PriorityQueue', 'java.util.PriorityQueue<E>', 'Unbounded priority heap', 'PriorityQueue<${1:Integer}> ${2:pq} = new PriorityQueue<>();', 'type'],
    ['LinkedList', 'java.util.LinkedList<E>', 'Doubly-linked list implementation', 'LinkedList<${1:Integer}> ${2:list} = new LinkedList<>();', 'type'],
    ['ArrayDeque', 'java.util.ArrayDeque<E>', 'Resizable-array implementation of Deque', 'ArrayDeque<${1:Integer}> ${2:dq} = new ArrayDeque<>();', 'type'],
    ['StringTokenizer', 'java.util.StringTokenizer', 'Fast string tokenizer for input', 'StringTokenizer ${1:st} = new StringTokenizer(${2:br.readLine()});', 'type'],
    ['BufferedReader', 'java.io.BufferedReader', 'Fast buffered reader for input', 'BufferedReader ${1:br} = new BufferedReader(new InputStreamReader(System.in));', 'type'],
    ['PrintWriter', 'java.io.PrintWriter', 'Fast formatted output writer', 'PrintWriter ${1:out} = new PrintWriter(System.out);', 'type'],
    ['Arrays.sort', 'Arrays.sort(arr)', 'Sorts specified array into ascending order', 'Arrays.sort(${1:arr});', 'function'],
    ['Collections.sort', 'Collections.sort(list)', 'Sorts specified list into ascending order', 'Collections.sort(${1:list});', 'function'],
    ['Math.min', 'Math.min(a, b)', 'Returns smaller of two values', 'Math.min(${1:a}, ${2:b})', 'function'],
    ['Math.max', 'Math.max(a, b)', 'Returns greater of two values', 'Math.max(${1:a}, ${2:b})', 'function']
  ];

  for (const [label, detail, info, tmpl, kind] of items) {
    trie.insert({
      label,
      type: kind,
      detail,
      info,
      template: tmpl || label,
      boost: 85
    });
  }
}

function populateRustTrie(trie: CompletionTrie): void {
  const items: [string, string, string, string, 'type' | 'function' | 'keyword'][] = [
    ['Vec', 'std::vec::Vec<T>', 'Contiguous growable array type', 'let mut ${1:v}: Vec<${2:i32}> = Vec::new();', 'type'],
    ['HashMap', 'std::collections::HashMap<K, V>', 'Hash Map implementation', 'let mut ${1:map}: HashMap<${2:i32}, ${3:i32}> = HashMap::new();', 'type'],
    ['HashSet', 'std::collections::HashSet<T>', 'Hash Set implementation', 'let mut ${1:set}: HashSet<${2:i32}> = HashSet::new();', 'type'],
    ['BTreeMap', 'std::collections::BTreeMap<K, V>', 'Map based on B-Tree', 'let mut ${1:map}: BTreeMap<${2:i32}, ${3:i32}> = BTreeMap::new();', 'type'],
    ['BTreeSet', 'std::collections::BTreeSet<T>', 'Set based on B-Tree', 'let mut ${1:set}: BTreeSet<${2:i32}> = BTreeSet::new();', 'type'],
    ['BinaryHeap', 'std::collections::BinaryHeap<T>', 'Priority queue implemented with binary heap', 'let mut ${1:pq}: BinaryHeap<${2:i32}> = BinaryHeap::new();', 'type'],
    ['VecDeque', 'std::collections::VecDeque<T>', 'Double-ended queue implemented with growable ring buffer', 'let mut ${1:dq}: VecDeque<${2:i32}> = VecDeque::new();', 'type'],
    ['println!', 'println!(...)', 'Prints formatted text to stdout with newline', 'println!("{}", ${1:ans});', 'function'],
    ['print!', 'print!(...)', 'Prints formatted text to stdout without newline', 'print!("{}", ${1:ans});', 'function'],
    ['Option', 'enum Option<T> { Some(T), None }', 'Type representing optional value', 'Option<${1:i32}>', 'type'],
    ['Result', 'enum Result<T, E> { Ok(T), Err(E) }', 'Type representing either success or failure', 'Result<${1:i32}, ${2:String}>', 'type']
  ];

  for (const [label, detail, info, tmpl, kind] of items) {
    trie.insert({
      label,
      type: kind,
      detail,
      info,
      template: tmpl || label,
      boost: 85
    });
  }
}

function populateGoTrie(trie: CompletionTrie): void {
  const items: [string, string, string, string, 'type' | 'function' | 'keyword'][] = [
    ['fmt.Println', 'fmt.Println(a ...any)', 'Formats and writes to standard output with newline', 'fmt.Println(${1:ans})', 'function'],
    ['fmt.Printf', 'fmt.Printf(format, a ...any)', 'Formats according to format specifier and writes to stdout', 'fmt.Printf("%v\\n", ${1:ans})', 'function'],
    ['fmt.Scan', 'fmt.Scan(a ...any)', 'Scans text read from standard input', 'fmt.Scan(&${1:n})', 'function'],
    ['bufio.NewReader', 'bufio.NewReader(os.Stdin)', 'Returns new Reader with default buffer size', 'in := bufio.NewReader(os.Stdin)', 'function'],
    ['bufio.NewWriter', 'bufio.NewWriter(os.Stdout)', 'Returns new Writer with default buffer size', 'out := bufio.NewWriter(os.Stdout)\ndefer out.Flush()', 'function'],
    ['make', 'make(t Type, size ...IntegerType)', 'Allocates and initializes slice, map, or chan', 'make([]${1:int}, ${2:n})', 'function'],
    ['append', 'append(slice, elems ...T)', 'Appends elements to the end of a slice', 'append(${1:slice}, ${2:elem})', 'function'],
    ['sort.Ints', 'sort.Ints(x []int)', 'Sorts slice of ints in increasing order', 'sort.Ints(${1:arr})', 'function'],
    ['sort.Slice', 'sort.Slice(x any, less func(i, j int) bool)', 'Sorts slice with provided less function', 'sort.Slice(${1:arr}, func(i, j int) bool {\n    return ${1:arr}[i] < ${1:arr}[j]\n})', 'function'],
    ['strings.Split', 'strings.Split(s, sep)', 'Slices s into all substrings separated by sep', 'strings.Split(${1:s}, " ")', 'function'],
    ['strings.Join', 'strings.Join(elems, sep)', 'Concatenates elements to create single string', 'strings.Join(${1:elems}, " ")', 'function']
  ];

  for (const [label, detail, info, tmpl, kind] of items) {
    trie.insert({
      label,
      type: kind,
      detail,
      info,
      template: tmpl || label,
      boost: 85
    });
  }
}

/**
 * Creates a CodeMirror 6 CompletionSource backed by the Trie
 */
export function createTrieCompletionSource(trie: CompletionTrie): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Match word prefix preceding cursor
    const word = context.matchBefore(/[a-zA-Z_]\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    // Query Trie for matching items
    const matches = trie.search(word.text, 30);
    if (matches.length === 0) {
      return null;
    }

    const options: Completion[] = matches.map(item => {
      const completion: Completion = {
        label: item.label,
        type: item.type || 'text',
        detail: item.detail,
        info: item.info,
        boost: item.boost ?? 0
      };

      if (item.template) {
        completion.apply = snippet(item.template);
      }

      return completion;
    });

    return {
      from: word.from,
      options,
      validFor: /^[a-zA-Z_]\w*$/
    };
  };
}
