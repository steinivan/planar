import { describe, test, expect } from "bun:test";
import { parseGraph } from "../../packages/ui/src/utils/parseGraph";

const VALID_BLOCK = `# My plan

Some intro text.

\`\`\`planar-graph
{
  "nodes": [
    { "id": "a", "repo": "web", "label": "A", "change": "modified", "files": ["src/a.ts"] },
    { "id": "b", "repo": "backend", "label": "B", "change": "added" }
  ],
  "edges": [
    { "from": "a", "to": "b", "label": "calls" }
  ]
}
\`\`\`

## After

Trailing text.`;

describe("parseGraph", () => {
  test("returns null graph and untouched plan when no block present", () => {
    const plan = "# Plain plan\n\nNo graph here.";
    const result = parseGraph(plan);
    expect(result.graph).toBeNull();
    expect(result.planWithoutGraph).toBe(plan);
    expect(result.error).toBeUndefined();
  });

  test("parses a valid block", () => {
    const result = parseGraph(VALID_BLOCK);
    expect(result.error).toBeUndefined();
    expect(result.graph).not.toBeNull();
    expect(result.graph!.nodes).toHaveLength(2);
    expect(result.graph!.edges).toHaveLength(1);
    const a = result.graph!.nodes[0];
    expect(a.id).toBe("a");
    expect(a.repo).toBe("web");
    expect(a.change).toBe("modified");
    expect(a.files).toEqual(["src/a.ts"]);
    expect(result.graph!.edges[0]).toMatchObject({
      from: "a",
      to: "b",
      label: "calls",
    });
  });

  test("strips the block from the document text", () => {
    const result = parseGraph(VALID_BLOCK);
    expect(result.planWithoutGraph).not.toContain("planar-graph");
    expect(result.planWithoutGraph).not.toContain('"nodes"');
    expect(result.planWithoutGraph).toContain("# My plan");
    expect(result.planWithoutGraph).toContain("## After");
  });

  test("malformed JSON yields error and leaves plan text intact", () => {
    const plan = "# Plan\n\n```planar-graph\n{ nodes: [ }\n```";
    const result = parseGraph(plan);
    expect(result.graph).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.planWithoutGraph).not.toContain("planar-graph");
  });

  test("rejects duplicate node ids", () => {
    const plan =
      '# P\n\n```planar-graph\n{"nodes":[{"id":"x"},{"id":"x"}],"edges":[]}\n```';
    const result = parseGraph(plan);
    expect(result.graph).toBeNull();
    expect(result.error).toContain("Duplicate");
  });

  test("rejects edges referencing unknown nodes", () => {
    const plan =
      '# P\n\n```planar-graph\n{"nodes":[{"id":"x"}],"edges":[{"from":"x","to":"y"}]}\n```';
    const result = parseGraph(plan);
    expect(result.graph).toBeNull();
    expect(result.error).toContain("unknown node");
  });

  test("defaults label to id and omits invalid change", () => {
    const plan =
      '# P\n\n```planar-graph\n{"nodes":[{"id":"x","change":"bogus"}],"edges":[]}\n```';
    const result = parseGraph(plan);
    expect(result.graph).not.toBeNull();
    expect(result.graph!.nodes[0].label).toBe("x");
    expect(result.graph!.nodes[0].change).toBeUndefined();
  });

  test("parses a valid role and omits an invalid one", () => {
    const plan =
      '# P\n\n```planar-graph\n{"nodes":[{"id":"a","role":"problem"},{"id":"b","role":"bogus"}],"edges":[]}\n```';
    const result = parseGraph(plan);
    expect(result.graph).not.toBeNull();
    expect(result.graph!.nodes[0].role).toBe("problem");
    expect(result.graph!.nodes[1].role).toBeUndefined();
  });
});
