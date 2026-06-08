import dagre from "@dagrejs/dagre";
import type { PlanGraph, GraphNode, GraphRole } from "../types";

export interface LaidOutNode {
  id: string;
  /** Top-left position (xyflow convention). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RepoContainer {
  repo: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoleBand {
  role: GraphRole;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaidOutGraph {
  nodes: Map<string, LaidOutNode>;
  /** Repo bounding boxes — populated in "repo" mode, empty in "role" mode. */
  containers: RepoContainer[];
  /** Role swimlane columns — populated in "role" mode, empty in "repo" mode. */
  bands: RoleBand[];
  mode: "repo" | "role";
}

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 90;

// Repo-mode container spacing.
const REPO_PADDING = 18;
const REPO_HEADER = 22;

// Role-mode swimlane spacing.
const BAND_PADDING = 18;
const BAND_HEADER = 30;
const BAND_GAP = 70;
// Role-mode cards are given a FIXED height in CSS (`.graph-node.role-mode`),
// with the summary clamped and the full text available via "More details".
// Because the height is fixed, this estimate matches the rendered card exactly,
// so the vertical pitch below never lets stacked cards overlap. Keep this value
// in sync with the `height` of `.graph-node.role-mode`.
const ROLE_CARD_HEIGHT = 180;
const ROLE_ROW_GAP = 32;

/** Left-to-right column order for role mode. */
export const ROLE_ORDER: GraphRole[] = [
  "problem",
  "cause",
  "fix",
  "outcome",
  "context",
];

/** Display label + icon per role (used by the band header). */
export const ROLE_META: Record<GraphRole, { label: string; icon: string }> = {
  problem: { label: "Problem", icon: "⚠" },
  cause: { label: "Cause", icon: "🔧" },
  fix: { label: "Fix", icon: "✅" },
  outcome: { label: "Outcome", icon: "🎯" },
  context: { label: "Context", icon: "📎" },
};

/**
 * Positions a plan graph.
 *
 * If any node declares a `role`, the graph is laid out as a left-to-right
 * narrative: one swimlane column per role (problem → cause → fix → outcome →
 * context), with `repo` demoted to a tag on each node. Otherwise it falls back to the
 * dagre repo-grouped layout (one bounding-box container per repository).
 *
 * Pure / framework-free so it can be unit-tested without xyflow.
 */
export function layoutGraph(graph: PlanGraph): LaidOutGraph {
  const hasRoles = graph.nodes.some((n) => n.role);
  return hasRoles ? layoutByRole(graph) : layoutByRepo(graph);
}

/**
 * Narrative layout: nodes are bucketed into columns by `role` (missing role →
 * `context`), columns are ordered by ROLE_ORDER, and nodes stack vertically
 * within their column. xyflow draws the edges between the resulting positions,
 * so a problem→cause→fix edge chain reads naturally left-to-right.
 */
function layoutByRole(graph: PlanGraph): LaidOutGraph {
  const byRole = new Map<GraphRole, GraphNode[]>();
  for (const node of graph.nodes) {
    const role: GraphRole = node.role ?? "context";
    const list = byRole.get(role) ?? [];
    list.push(node);
    byRole.set(role, list);
  }

  const columns = ROLE_ORDER.filter((r) => byRole.has(r));

  // Content height of each column, and the tallest one — used so all bands share
  // a height and each column's nodes are centered vertically within it (avoids
  // lopsided empty space when one column has many more nodes than the others).
  const columnHeight = (role: GraphRole) => {
    const n = byRole.get(role)!.length;
    return n * ROLE_CARD_HEIGHT + Math.max(0, n - 1) * ROLE_ROW_GAP;
  };
  const rowPitch = ROLE_CARD_HEIGHT + ROLE_ROW_GAP;
  const contentTop = BAND_HEADER + BAND_PADDING;
  const maxInner = columns.reduce((h, r) => Math.max(h, columnHeight(r)), 0);
  const bandHeight = contentTop + maxInner + BAND_PADDING;

  const nodes = new Map<string, LaidOutNode>();
  const bands: RoleBand[] = [];
  let bandX = 0;

  for (const role of columns) {
    const members = byRole.get(role)!;
    const nodeX = bandX + BAND_PADDING;
    // Center this column's stack within the shared content area.
    let y = contentTop + (maxInner - columnHeight(role)) / 2;
    for (const m of members) {
      nodes.set(m.id, {
        id: m.id,
        x: nodeX,
        y,
        width: NODE_WIDTH,
        height: ROLE_CARD_HEIGHT,
      });
      y += rowPitch;
    }
    bands.push({
      role,
      x: bandX,
      y: 0,
      width: NODE_WIDTH + BAND_PADDING * 2,
      height: bandHeight,
    });
    bandX += NODE_WIDTH + BAND_PADDING * 2 + BAND_GAP;
  }

  return { nodes, containers: [], bands, mode: "role" };
}

/**
 * Repo layout (the original): dagre left-to-right with one bounding-box
 * container per `repo`.
 */
function layoutByRepo(graph: PlanGraph): LaidOutGraph {
  // `compound` lets us group nodes into per-repo clusters so dagre keeps each
  // repository contiguous and separated, instead of interleaving nodes from
  // different repos in the same column (which made their containers overlap).
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: "LR",
    // Generous separation so per-repo clusters keep clear gaps between them.
    nodesep: 90,
    ranksep: 110,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // One cluster node per repo; real nodes become its children via setParent.
  const repos = new Set<string>();
  for (const node of graph.nodes) {
    if (node.repo) repos.add(node.repo);
  }
  for (const repo of repos) {
    g.setNode(`cluster:${repo}`, {});
  }

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    if (node.repo) g.setParent(node.id, `cluster:${node.repo}`);
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const nodes = new Map<string, LaidOutNode>();
  for (const node of graph.nodes) {
    const pos = g.node(node.id);
    // dagre returns the node center; xyflow positions by top-left.
    nodes.set(node.id, {
      id: node.id,
      x: pos.x - NODE_WIDTH / 2,
      y: pos.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  const containers = buildRepoContainers(graph, nodes);
  return { nodes, containers, bands: [], mode: "repo" };
}

function buildRepoContainers(
  graph: PlanGraph,
  nodes: Map<string, LaidOutNode>,
): RepoContainer[] {
  const byRepo = new Map<string, LaidOutNode[]>();
  for (const node of graph.nodes) {
    if (!node.repo) continue;
    const laid = nodes.get(node.id);
    if (!laid) continue;
    const list = byRepo.get(node.repo) ?? [];
    list.push(laid);
    byRepo.set(node.repo, list);
  }

  const containers: RepoContainer[] = [];
  for (const [repo, members] of byRepo) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const m of members) {
      minX = Math.min(minX, m.x);
      minY = Math.min(minY, m.y);
      maxX = Math.max(maxX, m.x + m.width);
      maxY = Math.max(maxY, m.y + m.height);
    }
    containers.push({
      repo,
      x: minX - REPO_PADDING,
      y: minY - REPO_PADDING - REPO_HEADER,
      width: maxX - minX + REPO_PADDING * 2,
      height: maxY - minY + REPO_PADDING * 2 + REPO_HEADER,
    });
  }
  return containers;
}
