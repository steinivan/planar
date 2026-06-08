export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function truncateText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
}

export function isDiffContent(lang: string, codeLines: string[]): boolean {
  if (lang === "diff") return true;
  let diffLineCount = 0;
  for (const line of codeLines) {
    if (/^[+-][^+-]/.test(line) || line === "+" || line === "-") {
      diffLineCount++;
    }
  }
  return diffLineCount >= 2;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const n = oldLines.length;
  const m = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "context", content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "add", content: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "remove", content: oldLines[i - 1] });
      i--;
    }
  }

  return result.reverse();
}

export interface WordSegment {
  text: string;
  changed: boolean;
}

function tokenizeWords(s: string): string[] {
  // Word runs, whitespace runs, and punctuation runs as separate tokens so the
  // word-level LCS aligns on natural boundaries.
  return s.match(/\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]+/g) ?? [];
}

function mergeSegments(segs: WordSegment[]): WordSegment[] {
  const out: WordSegment[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.changed === s.changed) last.text += s.text;
    else out.push({ text: s.text, changed: s.changed });
  }
  return out;
}

// Word-level diff between a removed line and its paired added line, used to
// highlight only the tokens that actually changed within otherwise-similar
// lines. Pure LCS over tokens — keep dependency-free.
export function computeWordDiff(
  oldStr: string,
  newStr: string,
): { oldSegments: WordSegment[]; newSegments: WordSegment[] } {
  const a = tokenizeWords(oldStr);
  const b = tokenizeWords(newStr);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const oldRev: WordSegment[] = [];
  const newRev: WordSegment[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      oldRev.push({ text: a[i - 1], changed: false });
      newRev.push({ text: b[j - 1], changed: false });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newRev.push({ text: b[j - 1], changed: true });
      j--;
    } else {
      oldRev.push({ text: a[i - 1], changed: true });
      i--;
    }
  }
  return {
    oldSegments: mergeSegments(oldRev.reverse()),
    newSegments: mergeSegments(newRev.reverse()),
  };
}

// Fraction of characters that are unchanged, relative to the longer line.
// Used to skip word-highlighting on lines too dissimilar to pair meaningfully.
export function unchangedRatio(
  segments: WordSegment[],
  otherLen: number,
): number {
  let unchanged = 0;
  let total = 0;
  for (const s of segments) {
    total += s.text.length;
    if (!s.changed) unchanged += s.text.length;
  }
  return unchanged / Math.max(total, otherLen, 1);
}

export type CollapsedDiffItem = DiffLine | { type: "fold"; count: number };

export function collapseDiffContext(
  lines: DiffLine[],
  context: number = 10,
): CollapsedDiffItem[] {
  // Find indices of changed lines
  const changed = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== "context") changed.add(i);
  }

  // Mark which lines to keep (within ±context of a change)
  const keep = new Set<number>();
  for (const idx of changed) {
    for (
      let j = Math.max(0, idx - context);
      j <= Math.min(lines.length - 1, idx + context);
      j++
    ) {
      keep.add(j);
    }
  }

  const result: CollapsedDiffItem[] = [];
  let i = 0;
  while (i < lines.length) {
    if (keep.has(i)) {
      result.push(lines[i]);
      i++;
    } else {
      // Count consecutive hidden lines
      let count = 0;
      while (i < lines.length && !keep.has(i)) {
        count++;
        i++;
      }
      result.push({ type: "fold", count });
    }
  }

  return result;
}
