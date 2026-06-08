import type {
  PlanGraph,
  GraphNode,
  GraphEdge,
  GraphChange,
  GraphRole,
} from "../types";

export interface ParseGraphResult {
  /** Parsed graph, or null if no (valid) ```planar-graph block was present. */
  graph: PlanGraph | null;
  /** The plan markdown with the ```planar-graph block removed. */
  planWithoutGraph: string;
  /** Set when an ```planar-graph block was found but could not be parsed. */
  error?: string;
}

// Matches a fenced ```planar-graph ... ``` block. Tolerates leading whitespace
// and an optional trailing newline before the closing fence.
const GRAPH_BLOCK_RE =
  /^[ \t]*```planar-graph[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/m;

const VALID_CHANGES: GraphChange[] = [
  "added",
  "modified",
  "removed",
  "unchanged",
];

function isValidChange(value: unknown): value is GraphChange {
  return (
    typeof value === "string" && VALID_CHANGES.includes(value as GraphChange)
  );
}

const VALID_ROLES: GraphRole[] = [
  "problem",
  "cause",
  "fix",
  "outcome",
  "context",
];

function isValidRole(value: unknown): value is GraphRole {
  return typeof value === "string" && VALID_ROLES.includes(value as GraphRole);
}

/**
 * Extracts and parses the first `planar-graph` fenced block from a plan.
 *
 * Returns the parsed graph plus the plan with that block stripped (so the
 * document view never renders the raw JSON). Parsing and validation are
 * tolerant: malformed JSON or an invalid shape yields `{ graph: null, error }`
 * while leaving the plan text untouched.
 */
export function parseGraph(plan: string): ParseGraphResult {
  const match = plan.match(GRAPH_BLOCK_RE);
  if (!match) {
    return { graph: null, planWithoutGraph: plan };
  }

  const planWithoutGraph = stripBlock(plan, match[0]);
  const raw = match[1];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { graph: null, planWithoutGraph, error: `Invalid JSON: ${message}` };
  }

  const validated = validateGraph(parsed);
  if ("error" in validated) {
    return { graph: null, planWithoutGraph, error: validated.error };
  }

  return { graph: validated.graph, planWithoutGraph };
}

function stripBlock(plan: string, block: string): string {
  // Remove the block, then collapse the blank lines it leaves behind so the
  // document view stays tidy.
  return plan
    .replace(block, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ValidationResult = { graph: PlanGraph } | { error: string };

function validateGraph(parsed: unknown): ValidationResult {
  if (typeof parsed !== "object" || parsed === null) {
    return { error: "Graph must be a JSON object" };
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.nodes)) {
    return { error: "Graph must have a `nodes` array" };
  }
  const edgesRaw = obj.edges ?? [];
  if (!Array.isArray(edgesRaw)) {
    return { error: "`edges` must be an array" };
  }

  const nodes: GraphNode[] = [];
  const ids = new Set<string>();
  for (const n of obj.nodes) {
    if (typeof n !== "object" || n === null) {
      return { error: "Each node must be an object" };
    }
    const node = n as Record<string, unknown>;
    if (typeof node.id !== "string" || node.id === "") {
      return { error: "Each node needs a non-empty string `id`" };
    }
    if (ids.has(node.id)) {
      return { error: `Duplicate node id: ${node.id}` };
    }
    ids.add(node.id);
    nodes.push({
      id: node.id,
      label: typeof node.label === "string" ? node.label : node.id,
      repo: typeof node.repo === "string" ? node.repo : undefined,
      change: isValidChange(node.change) ? node.change : undefined,
      role: isValidRole(node.role) ? node.role : undefined,
      summary: typeof node.summary === "string" ? node.summary : undefined,
      files: toStringArray(node.files),
      functions: toStringArray(node.functions),
    });
  }

  const edges: GraphEdge[] = [];
  for (const e of edgesRaw) {
    if (typeof e !== "object" || e === null) {
      return { error: "Each edge must be an object" };
    }
    const edge = e as Record<string, unknown>;
    if (typeof edge.from !== "string" || typeof edge.to !== "string") {
      return { error: "Each edge needs string `from` and `to`" };
    }
    if (!ids.has(edge.from)) {
      return { error: `Edge references unknown node: ${edge.from}` };
    }
    if (!ids.has(edge.to)) {
      return { error: `Edge references unknown node: ${edge.to}` };
    }
    edges.push({
      from: edge.from,
      to: edge.to,
      label: typeof edge.label === "string" ? edge.label : undefined,
      kind: typeof edge.kind === "string" ? edge.kind : undefined,
    });
  }

  return { graph: { nodes, edges } };
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value.filter((v): v is string => typeof v === "string");
  return arr.length > 0 ? arr : undefined;
}
