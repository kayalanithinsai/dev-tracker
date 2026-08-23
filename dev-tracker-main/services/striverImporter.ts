import type { Problem } from '../types';

const DATA_URL = 'https://raw.githubusercontent.com/septilex/a2z-tracker/main/dsa_tracker/a2z_problems_simple.json';

type SourceProblem = {
  id: number;
  problem_name: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  leetcode_url?: string;
  youtube_url?: string;
};

const normalize = (value: string) => value.toLowerCase().replace(/[’'`]/g, '').trim();

export function inferSubtopic(topic: string, title: string, difficulty: string): string {
  const t = normalize(topic);
  const p = normalize(title);

  if (t.includes('learn the basics')) {
    if (/pattern/.test(p)) return 'Build-up Logical Thinking';
    if (/stl|collections/.test(p)) return 'Learn STL / Collections';
    if (/digit|number|palindrome|gcd|armstrong|divisor|prime/.test(p)) return 'Know Basic Maths';
    if (/recursion|factorial|fibonacci|reverse an array/.test(p)) return 'Learn Basic Recursion';
    if (/hash|frequenc|occurring/.test(p)) return 'Learn Basic Hashing';
    return 'Things to Know in C++ / Java / Python';
  }
  if (t.includes('sorting')) return ['Selection Sort', 'Bubble Sort', 'Insertion Sorting'].some(x => p.includes(normalize(x))) ? 'Sorting-I' : 'Sorting-II';
  if (t.includes('arrays')) return difficulty;
  if (t.includes('binary search')) {
    if (/matrix|2d|row|median of/.test(p)) return 'Applying BS on 2D Arrays';
    if (/sqrt|root|koko|bouquet|divisor|ship|aggressive|allocation|split array|missing positive|gas station|median of two|kth element/.test(p)) return 'Find Answers by BS in Search Space';
    return 'Learning BS on 1D Arrays';
  }
  if (t.includes('strings')) return t.includes('hard') || t.includes('advanced') ? 'Hard Problems and Standard Algos' : difficulty === 'Medium' ? 'Medium String Problems' : 'Basic and Easy String Problems';
  if (t.includes('linked')) {
    if (/doubly|dll/.test(p)) return 'Learn Doubly LinkedList';
    if (/group|rotate|flatten|clone/.test(p)) return 'Hard Problems of LL';
    return difficulty === 'Hard' ? 'Hard Problems of LL' : 'Medium Problems of LL';
  }
  if (t.includes('recursion')) {
    if (/subsequence|subset|combination|power set|phone/.test(p)) return 'Subsequences Pattern';
    if (/n queen|rat in|word break|m coloring|sudoku|sudoko|expression|palindrome partition|word search/.test(p)) return 'Trying out all Combos / Hard';
    return 'Get a Strong Hold';
  }
  if (t.includes('bit manipulation')) {
    if (/prime factor|divisor|sieve|factorisation|power\(/.test(p)) return 'Advanced Maths';
    if (/flip|odd number|power set|xor|appears odd/.test(p)) return 'Interview Problems';
    return 'Learn Bit Manipulation';
  }
  if (t.includes('stack')) {
    if (/infix|prefix|postfix/.test(p)) return 'Prefix, Infix, PostFix Conversion Problems';
    if (/next greater|next smaller|nge|trapping|subarray minimum|stock span|asteroid|histogram|maximal rectangle|remove k digits/.test(p)) return 'Monotonic Stack/Queue Problems';
    if (/sliding window|celebrity|rotten|lru|lfu/.test(p)) return 'Implementation Problems';
    return 'Learning';
  }
  if (t.includes('sliding')) return difficulty === 'Hard' ? 'Hard Problems' : 'Medium Problems';
  if (t.includes('heaps')) return difficulty === 'Hard' ? 'Hard Problems' : difficulty === 'Medium' ? 'Medium Problems' : 'Learning';
  if (t.includes('greedy')) return difficulty === 'Easy' ? 'Easy Problems' : 'Medium/Hard';
  if (t.includes('binary trees')) {
    if (/height|diameter|zig|boundary|vertical|top view|bottom view|right|left view|symmetric/.test(p)) return 'Medium Problems';
    if (/root to node|lca|maximum width|children sum|distance|burn|count total|construct|serialize|morris|flatten|requirements/.test(p)) return 'Hard Problems';
    return 'Traversals';
  }
  if (t.includes('binary search trees')) return /introduction|search in|find min|find max/.test(p) ? 'Concepts' : 'Practice Problems';
  if (t.includes('graphs')) {
    if (/graph and types|representation|connected components|bfs|dfs$/.test(p)) return 'Learning';
    if (/province|rotten|flood|cycle|matrix|surrounded|enclave|word ladder|island|bipartite/.test(p)) return 'Problems on BFS/DFS';
    if (/topo|kahn|course schedule|safe states|alien/.test(p)) return 'Topo Sort and Problems';
    if (/shortest|dijkstra|bellman|floyd|cheapest|network delay|minimum effort|binary maze|ways to arrive|multiplication/.test(p)) return 'Shortest Path Algorithms and Problems';
    if (/spanning|prim|disjoint|kruskal|network connected|stones|accounts|island ii|large island|swim/.test(p)) return 'Minimum Spanning Tree / Disjoint Set and Problems';
    return 'Other Algorithms';
  }
  if (t.includes('dynamic programming')) {
    if (/introduction/.test(p)) return 'Introduction to DP';
    if (/climbing|frog jump|non-adjacent|house robber/.test(p)) return '1D DP';
    if (/ninja|grid|falling path/.test(p)) return '2D/3D DP and DP on Grids';
    if (/subset|partition|knapsack|minimum coins|target sum|coin change|rod cutting/.test(p)) return 'DP on Subsequences';
    if (/common subsequence|common substring|palindromic|insertions|supersequence|distinct subsequences|edit distance|wildcard/.test(p)) return 'DP on Strings';
    if (/buy and sell|stock/.test(p)) return 'DP on Stocks';
    if (/increasing subsequence|divisible subset|string chain|bitonic|longest increasing/.test(p)) return 'DP on LIS';
    if (/matrix chain|cut the stick|burst balloons|boolean|partition array|palindrome partition/.test(p)) return 'MCM DP / Partition DP';
    if (/rectangle|square/.test(p)) return 'DP on Squares';
    return 'Dynamic Programming';
  }
  if (t.includes('tries')) return /implement trie|prerequisite/.test(p) ? 'Theory' : 'Problems';
  if (t.includes('advanced')) return 'Hard Problems';
  return 'General';
}

export async function fetchStriverProblems(): Promise<Problem[]> {
  const response = await fetch(DATA_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to download Striver A2Z dataset (${response.status})`);
  const data = await response.json() as SourceProblem[];
  return data.map(item => ({
    id: `striver-a2z-${item.id}`,
    sourceId: String(item.id),
    source: 'striver-a2z',
    title: item.problem_name.trim(),
    isSolved: false,
    difficulty: item.difficulty,
    topic: item.topic,
    subtopic: inferSubtopic(item.topic, item.problem_name, item.difficulty),
    link: item.leetcode_url || undefined,
  }));
}
