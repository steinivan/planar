import { describe, test, expect } from "bun:test";
import { layoutGraph } from "../../packages/ui/src/utils/graphLayout";
import type { PlanGraph } from "../../packages/ui/src/types";

const graph: PlanGraph = {
  nodes: [
    { id: "a", repo: "web", label: "A" },
    { id: "b", repo: "web", label: "B" },
    { id: "c", repo: "backend", label: "C" },
    { id: "loose", label: "Loose" },
  ],
  edges: [
    { from: "a", to: "c" },
    { from: "b", to: "c" },
  ],
};

describe("layoutGraph", () => {
  test("positions every node", () => {
    const { nodes } = layoutGraph(graph);
    expect(nodes.size).toBe(4);
    for (const id of ["a", "b", "c", "loose"]) {
      const n = nodes.get(id);
      expect(n).toBeDefined();
      expect(Number.isFinite(n!.x)).toBe(true);
      expect(Number.isFinite(n!.y)).toBe(true);
    }
  });

  test("does not collapse all nodes onto the same point", () => {
    const { nodes } = layoutGraph(graph);
    const positions = new Set(
      [...nodes.values()].map((n) => `${Math.round(n.x)},${Math.round(n.y)}`),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  test("creates one container per repo", () => {
    const { containers } = layoutGraph(graph);
    const repos = containers.map((c) => c.repo).sort();
    expect(repos).toEqual(["backend", "web"]);
  });

  test("a repo container encloses its member nodes", () => {
    const { nodes, containers } = layoutGraph(graph);
    const web = containers.find((c) => c.repo === "web")!;
    for (const id of ["a", "b"]) {
      const n = nodes.get(id)!;
      expect(n.x).toBeGreaterThanOrEqual(web.x);
      expect(n.y).toBeGreaterThanOrEqual(web.y);
      expect(n.x + n.width).toBeLessThanOrEqual(web.x + web.width);
      expect(n.y + n.height).toBeLessThanOrEqual(web.y + web.height);
    }
  });

  test("nodes without a repo do not create containers", () => {
    const { containers } = layoutGraph(graph);
    expect(containers.find((c) => c.repo === undefined)).toBeUndefined();
    expect(containers).toHaveLength(2);
  });

  test("a graph with no roles uses repo mode", () => {
    const { mode, bands } = layoutGraph(graph);
    expect(mode).toBe("repo");
    expect(bands).toHaveLength(0);
  });
});

const roleGraph: PlanGraph = {
  nodes: [
    { id: "sym", role: "problem", label: "Symptom" },
    { id: "c1", role: "cause", label: "Cause 1", repo: "web" },
    { id: "c2", role: "cause", label: "Cause 2", repo: "web" },
    { id: "fix", role: "fix", label: "Fix" },
    { id: "ctx", label: "Context (no role)" }, // missing role → context column
  ],
  edges: [
    { from: "sym", to: "c1" },
    { from: "c1", to: "fix" },
  ],
};

describe("layoutGraph (role mode)", () => {
  test("switches to role mode when any node has a role", () => {
    const { mode, containers } = layoutGraph(roleGraph);
    expect(mode).toBe("role");
    expect(containers).toHaveLength(0);
  });

  test("positions every node", () => {
    const { nodes } = layoutGraph(roleGraph);
    expect(nodes.size).toBe(5);
    for (const id of ["sym", "c1", "c2", "fix", "ctx"]) {
      expect(nodes.get(id)).toBeDefined();
    }
  });

  test("creates one band per present role, in problem→cause→fix→context order", () => {
    const { bands } = layoutGraph(roleGraph);
    expect(bands.map((b) => b.role)).toEqual([
      "problem",
      "cause",
      "fix",
      "context",
    ]);
  });

  test("orders columns left-to-right by role", () => {
    const { nodes } = layoutGraph(roleGraph);
    const problemX = nodes.get("sym")!.x;
    const causeX = nodes.get("c1")!.x;
    const fixX = nodes.get("fix")!.x;
    const contextX = nodes.get("ctx")!.x;
    expect(problemX).toBeLessThan(causeX);
    expect(causeX).toBeLessThan(fixX);
    expect(fixX).toBeLessThan(contextX);
  });

  test("stacks multiple nodes in the same role column vertically", () => {
    const { nodes } = layoutGraph(roleGraph);
    const a = nodes.get("c1")!;
    const b = nodes.get("c2")!;
    expect(a.x).toBe(b.x);
    expect(a.y).not.toBe(b.y);
  });

  test("a node without a role falls into the context column", () => {
    const { nodes, bands } = layoutGraph(roleGraph);
    const ctx = nodes.get("ctx")!;
    const contextBand = bands.find((b) => b.role === "context")!;
    expect(ctx.x).toBeGreaterThanOrEqual(contextBand.x);
    expect(ctx.x + ctx.width).toBeLessThanOrEqual(
      contextBand.x + contextBand.width,
    );
  });

  test("bands share a common height (aligned swimlanes)", () => {
    const { bands } = layoutGraph(roleGraph);
    const heights = new Set(bands.map((b) => b.height));
    expect(heights.size).toBe(1);
  });
});
