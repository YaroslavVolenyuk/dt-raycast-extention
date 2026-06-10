// src/lib/utils/formatLogContent.ts

/**
 * Wraps untrusted content in a fenced code block whose fence is longer than
 * the longest backtick run in the content, preventing injection breakout.
 * (CommonMark spec: a longer fence always closes the block.)
 */
function fenceRaw(s: string, lang = ""): string {
  const longestRun = Math.max(0, ...(s.match(/`+/g) ?? []).map((m) => m.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${lang}\n${s}\n${fence}`;
}

/**
 * Formats log content for display in Raycast Detail view.
 * ALL content is fenced to prevent markdown injection (images, links) from
 * untrusted log data triggering zero-click beacon requests.
 */
export function formatLogContent(content: string | null): string | null {
  if (!content) return content;

  // Try parsing as JSON
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);
    return fenceRaw(formatted, "json");
  } catch {
    // Not JSON, continue
  }

  // Check if it's a stack trace
  if (isStackTrace(content)) {
    return fenceRaw(content);
  }

  // Fence plain text to prevent markdown injection
  return fenceRaw(content);
}

function isStackTrace(content: string): boolean {
  const patterns = [
    /^\s*(Error|Exception|Throwable):/m,
    /\s+at\s+\w+\./m,
    /at\s+.*\.\w+\s*\(\s*\w+\.java:\d+\)/m,
    /File\s+".*",\s+line\s+\d+/m,
    /at\s+\w+\s+\(.*:\d+:\d+\)/m,
  ];
  return patterns.some((pattern) => pattern.test(content));
}

/**
 * Extracts the first line of a stack trace (the error message)
 */
export function extractErrorMessage(content: string): string | null {
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.match(/^\s*(Error|Exception|Throwable|Caused by):/)) {
      return line.trim();
    }
  }
  return null;
}
