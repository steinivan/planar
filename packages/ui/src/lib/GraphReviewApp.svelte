<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    MarkerType,
    type Node,
    type Edge,
    type NodeTypes,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { toPng } from "html-to-image";
  import type { PlanGraph, GraphAnnotation } from "../types";
  import { layoutGraph, NODE_WIDTH, ROLE_META } from "../utils/graphLayout";
  import GraphNodeComponent from "./GraphNode.svelte";
  import RepoGroupNode from "./RepoGroupNode.svelte";
  import RoleBandNode from "./RoleBandNode.svelte";
  import GraphNodeDetailPanel from "./GraphNodeDetailPanel.svelte";
  import GraphCommentPopover from "./GraphCommentPopover.svelte";

  interface Props {
    graph: PlanGraph;
    annotations: GraphAnnotation[];
    theme: "dark" | "light";
    onAddAnnotation: (a: GraphAnnotation) => void;
    onRemoveAnnotation: (id: string) => void;
    onUpdateAnnotation: (id: string, comment: string) => void;
  }

  let {
    graph,
    annotations,
    theme,
    onAddAnnotation,
    onRemoveAnnotation,
    onUpdateAnnotation,
  }: Props = $props();

  const nodeTypes: NodeTypes = {
    entity: GraphNodeComponent as NodeTypes[string],
    repoGroup: RepoGroupNode as NodeTypes[string],
    roleBand: RoleBandNode as NodeTypes[string],
  };

  let selectedNodeId = $state<string | null>(null);
  let commentTarget = $state<{
    kind: "node" | "edge";
    targetId: string;
    label: string;
  } | null>(null);

  let layout = $derived(layoutGraph(graph));
  let labelById = $derived(
    new Map(graph.nodes.map((n) => [n.id, n.label] as const)),
  );
  let annByTarget = $derived(
    new Map(annotations.map((a) => [a.targetId, a] as const)),
  );

  function openNodeComment(id: string) {
    commentTarget = {
      kind: "node",
      targetId: id,
      label: labelById.get(id) ?? id,
    };
  }

  function openEdgeComment(from: string, to: string) {
    const targetId = `${from}->${to}`;
    const label = `${labelById.get(from) ?? from} → ${labelById.get(to) ?? to}`;
    commentTarget = { kind: "edge", targetId, label };
  }

  function saveComment(text: string) {
    if (!commentTarget) return;
    const existing = annByTarget.get(commentTarget.targetId);
    if (existing) {
      onUpdateAnnotation(existing.id, text);
    } else {
      onAddAnnotation({
        id: crypto.randomUUID(),
        targetType: commentTarget.kind,
        targetId: commentTarget.targetId,
        targetLabel: commentTarget.label,
        comment: text,
      });
    }
    commentTarget = null;
  }

  function deleteComment() {
    if (!commentTarget) return;
    const existing = annByTarget.get(commentTarget.targetId);
    if (existing) onRemoveAnnotation(existing.id);
    commentTarget = null;
  }

  let nodes = $derived.by<Node[]>(() => {
    const result: Node[] = [];

    // Group containers first so they render behind the entity nodes.
    for (const c of layout.containers) {
      result.push({
        id: `repo:${c.repo}`,
        type: "repoGroup",
        position: { x: c.x, y: c.y },
        data: { repo: c.repo },
        style: `width: ${c.width}px; height: ${c.height}px;`,
        selectable: false,
        draggable: false,
        connectable: false,
        zIndex: 0,
      });
    }

    // Role swimlanes (narrative mode) — also drawn behind the entity nodes.
    for (const b of layout.bands) {
      result.push({
        id: `band:${b.role}`,
        type: "roleBand",
        position: { x: b.x, y: b.y },
        data: {
          role: b.role,
          label: ROLE_META[b.role].label,
          icon: ROLE_META[b.role].icon,
        },
        style: `width: ${b.width}px; height: ${b.height}px;`,
        selectable: false,
        draggable: false,
        connectable: false,
        zIndex: 0,
      });
    }

    for (const node of graph.nodes) {
      const laid = layout.nodes.get(node.id);
      if (!laid) continue;
      result.push({
        id: node.id,
        type: "entity",
        position: { x: laid.x, y: laid.y },
        style: `width: ${NODE_WIDTH}px;`,
        selectable: false,
        draggable: false,
        connectable: false,
        zIndex: 1,
        data: {
          node,
          hasComment: annByTarget.has(node.id),
          hasDetail:
            layout.mode === "role" ||
            Boolean(node.files?.length || node.functions?.length),
          roleMode: layout.mode === "role",
          onDetails: (id: string) => (selectedNodeId = id),
          onComment: openNodeComment,
        },
      });
    }

    return result;
  });

  let edges = $derived.by<Edge[]>(() =>
    graph.edges.map((e) => {
      const targetId = `${e.from}->${e.to}`;
      return {
        id: targetId,
        source: e.from,
        target: e.to,
        label: e.label,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        class: annByTarget.has(targetId) ? "edge-commented" : undefined,
        data: { from: e.from, to: e.to },
      } as Edge;
    }),
  );

  let selectedNode = $derived(
    selectedNodeId
      ? (graph.nodes.find((n) => n.id === selectedNodeId) ?? null)
      : null,
  );

  let wrapperEl = $state<HTMLDivElement>();
  let exporting = $state(false);

  // Export the current graph view as a PNG. Captures the wrapper but filters
  // out the overlay chrome (controls, minimap, export button) so the image is
  // just the graph on a solid theme background.
  async function exportPng() {
    if (!wrapperEl || exporting) return;
    exporting = true;
    try {
      const bg = theme === "dark" ? "#0d1117" : "#ffffff";
      const dataUrl = await toPng(wrapperEl, {
        backgroundColor: bg,
        pixelRatio: 2,
        filter: (n) => {
          const cl = (n as HTMLElement).classList;
          if (!cl) return true;
          return !(
            cl.contains("graph-toolbar") ||
            cl.contains("svelte-flow__controls") ||
            cl.contains("svelte-flow__minimap")
          );
        },
      });
      const a = document.createElement("a");
      a.download = "planar-graph.png";
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error("Planar: graph PNG export failed", e);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="graph-wrapper" bind:this={wrapperEl}>
  <div class="graph-toolbar">
    <button
      class="graph-export-btn"
      onclick={exportPng}
      disabled={exporting}
      title="Export the graph as a PNG image"
    >
      {exporting ? "Exporting…" : "⤓ PNG"}
    </button>
  </div>
  <SvelteFlow
    {nodes}
    {edges}
    {nodeTypes}
    colorMode={theme}
    fitView
    nodesDraggable={false}
    nodesConnectable={false}
    elementsSelectable={true}
    onedgeclick={({ edge }) => {
      const d = edge.data as { from: string; to: string } | undefined;
      if (d) openEdgeComment(d.from, d.to);
    }}
  >
    <Background />
    <Controls showLock={false} />
    <MiniMap pannable zoomable />
  </SvelteFlow>

  {#if selectedNode}
    <GraphNodeDetailPanel
      node={selectedNode}
      onClose={() => (selectedNodeId = null)}
    />
  {/if}

  {#if commentTarget}
    {#key commentTarget.targetId}
      <GraphCommentPopover
        targetLabel={commentTarget.label}
        targetKind={commentTarget.kind}
        initial={annByTarget.get(commentTarget.targetId)?.comment ?? ""}
        onSave={saveComment}
        onDelete={deleteComment}
        onClose={() => (commentTarget = null)}
      />
    {/key}
  {/if}
</div>

<style>
  .graph-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }
  /* Highlight commented connections. */
  .graph-wrapper
    :global(.svelte-flow__edge.edge-commented .svelte-flow__edge-path) {
    stroke: var(--color-annotated-border);
    stroke-width: 2.5;
  }
  .graph-wrapper :global(.svelte-flow__edge) {
    cursor: pointer;
  }
  .graph-wrapper :global(.svelte-flow__edge .svelte-flow__edge-path) {
    stroke-width: 1.75;
  }
  /* Match xyflow surface to the app theme. */
  .graph-wrapper :global(.svelte-flow) {
    background: var(--color-bg-page);
  }
  .graph-toolbar {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 6;
  }
  .graph-export-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 11px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-text-default);
    background: var(--color-bg-overlay);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--elevation-1);
    cursor: pointer;
    transition:
      border-color 0.12s ease,
      color 0.12s ease;
  }
  .graph-export-btn:hover:not(:disabled) {
    border-color: var(--color-brand);
    color: var(--color-text-emphasis);
  }
  .graph-export-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  /* Theme the minimap to the brand. */
  .graph-wrapper :global(.svelte-flow__minimap) {
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }
</style>
