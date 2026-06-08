<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";
  import type { GraphNode, GraphChange } from "../types";

  // Data injected by GraphReviewApp when building the xyflow node.
  interface NodeData {
    node: GraphNode;
    hasComment: boolean;
    hasDetail: boolean;
    roleMode: boolean;
    onDetails: (id: string) => void;
    onComment: (id: string) => void;
    [key: string]: unknown;
  }

  let { data }: NodeProps = $props();
  let d = $derived(data as unknown as NodeData);
  let node = $derived(d.node);
  let change = $derived<GraphChange>(node.change ?? "unchanged");
</script>

<div
  class="graph-node change-{change}"
  class:commented={d.hasComment}
  class:role-mode={d.roleMode}
>
  <Handle type="target" position={Position.Left} />

  <div class="gn-header">
    <span class="gn-label">{node.label}</span>
    {#if change !== "unchanged"}
      <span class="gn-change change-{change}">{change}</span>
    {/if}
  </div>
  {#if d.roleMode && node.repo}
    <span class="gn-repo">{node.repo}</span>
  {/if}
  {#if node.summary}
    <p class="gn-summary">{node.summary}</p>
  {/if}

  <div class="gn-actions">
    {#if d.hasDetail}
      <button
        class="gn-btn"
        onclick={(e) => {
          e.stopPropagation();
          d.onDetails(node.id);
        }}>More details</button
      >
    {/if}
    <button
      class="gn-btn"
      class:active={d.hasComment}
      onclick={(e) => {
        e.stopPropagation();
        d.onComment(node.id);
      }}
      title="Comment on this node"
      aria-label="Comment on this node">{d.hasComment ? "💬 1" : "💬"}</button
    >
  </div>

  <Handle type="source" position={Position.Right} />
</div>

<style>
  .graph-node {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-bg-overlay);
    color: var(--color-text-default);
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--elevation-1);
    transition:
      box-shadow 0.15s ease,
      transform 0.15s ease,
      border-color 0.15s ease;
  }
  .graph-node:hover {
    box-shadow: var(--elevation-2);
    transform: translateY(-1px);
  }
  /* Fixed height so the layout's vertical pitch matches the rendered card
     exactly (keep in sync with ROLE_CARD_HEIGHT in graphLayout.ts). */
  .graph-node.role-mode {
    height: 180px;
    overflow: hidden;
  }
  .graph-node.change-added {
    border-color: var(--color-diff-add-text);
    background: var(--color-diff-add-bg);
  }
  .graph-node.change-modified {
    border-color: var(--color-accent);
  }
  .graph-node.change-removed {
    border-color: var(--color-diff-remove-text);
    background: var(--color-diff-remove-bg);
  }
  .graph-node.commented {
    box-shadow: 0 0 0 2px var(--color-annotated-border);
  }
  .gn-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .gn-label {
    font-weight: 600;
    color: var(--color-text-emphasis);
    line-height: 1.2;
  }
  .gn-change {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 1px 5px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .gn-change.change-added {
    color: var(--color-diff-add-text);
    background: var(--color-diff-add-bg);
  }
  .gn-change.change-modified {
    color: var(--color-accent);
    background: var(--color-annotated-bg);
  }
  .gn-change.change-removed {
    color: var(--color-diff-remove-text);
    background: var(--color-diff-remove-bg);
  }
  .gn-repo {
    align-self: flex-start;
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-text-muted);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0 6px;
    line-height: 1.5;
  }
  .gn-summary {
    margin: 0;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    line-height: 1.3;
  }
  /* Clamp the summary so a fixed-height role card never overflows; the full
     text stays available via the "More details" side panel. */
  .role-mode .gn-summary {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .gn-actions {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }
  /* Keep the actions pinned to the bottom of the fixed-height card. */
  .role-mode .gn-actions {
    margin-top: auto;
  }
  .gn-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    padding: 2px 7px;
    font-size: 0.68rem;
    cursor: pointer;
    line-height: 1.4;
  }
  .gn-btn:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text-default);
  }
  .gn-btn.active {
    color: var(--color-link);
    border-color: var(--color-annotated-border);
  }
</style>
