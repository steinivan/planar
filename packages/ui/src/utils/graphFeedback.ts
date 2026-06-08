import type { GraphAnnotation } from "../types";

/**
 * Formats graph node/edge comments into the same markdown shape as
 * `formatFeedback`/`formatDiffFeedback`, so graph review folds into the
 * existing approve/deny feedback string.
 */
export function formatGraphFeedback(
  annotations: GraphAnnotation[],
  generalComment?: string,
): string {
  const parts: string[] = [];

  const trimmedComment = generalComment?.trim();
  if (trimmedComment) {
    parts.push("General feedback:");
    parts.push(`> ${trimmedComment}`);
  }

  const withComments = annotations.filter((a) => a.comment.trim());
  if (withComments.length > 0) {
    parts.push("Graph feedback:");
    for (let i = 0; i < withComments.length; i++) {
      const ann = withComments[i];
      const target = ann.targetType === "edge" ? "connection" : "node";
      parts.push(`## ${i + 1}. Feedback on ${target}: "${ann.targetLabel}"`);
      parts.push(`> ${ann.comment}`);
    }
  }

  if (parts.length === 0) return "";

  parts.push("---");
  return parts.join("\n");
}
