<script lang="ts">
  import type { GraphNode, GraphChange } from "../types";

  interface Props {
    node: GraphNode;
    onClose: () => void;
  }

  let { node, onClose }: Props = $props();
  let change = $derived<GraphChange>(node.change ?? "unchanged");
</script>

<aside class="detail-panel">
  <div class="dp-header">
    <span class="dp-title">{node.label}</span>
    <button class="dp-close" onclick={onClose} aria-label="Close">✕</button>
  </div>

  <dl class="dp-meta">
    {#if node.role}
      <dt>Role</dt>
      <dd>{node.role}</dd>
    {/if}
    {#if node.repo}
      <dt>Repo</dt>
      <dd>{node.repo}</dd>
    {/if}
    <dt>Change</dt>
    <dd class="change-{change}">{change}</dd>
  </dl>

  {#if node.summary}
    <p class="dp-summary">{node.summary}</p>
  {/if}

  {#if node.files?.length}
    <section class="dp-section">
      <h4>Files</h4>
      <ul>
        {#each node.files as f}
          <li><code>{f}</code></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if node.functions?.length}
    <section class="dp-section">
      <h4>Functions</h4>
      <ul>
        {#each node.functions as fn}
          <li><code>{fn}</code></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if !node.files?.length && !node.functions?.length}
    <p class="dp-empty">No technical detail for this node.</p>
  {/if}
</aside>

<style>
  .detail-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 280px;
    max-height: calc(100% - 24px);
    overflow: auto;
    z-index: 10;
    background: var(--color-bg-overlay);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px var(--color-shadow);
    padding: 12px 14px;
    font-size: 0.82rem;
  }
  .dp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .dp-title {
    font-weight: 700;
    color: var(--color-text-emphasis);
  }
  .dp-close {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
  }
  .dp-close:hover {
    color: var(--color-text-default);
  }
  .dp-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0 0 8px;
  }
  .dp-meta dt {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .dp-meta dd {
    margin: 0;
    color: var(--color-text-default);
  }
  .dp-meta dd.change-added {
    color: var(--color-diff-add-text);
  }
  .dp-meta dd.change-modified {
    color: var(--color-accent);
  }
  .dp-meta dd.change-removed {
    color: var(--color-diff-remove-text);
  }
  .dp-summary {
    margin: 0 0 10px;
    color: var(--color-text-default);
    line-height: 1.4;
  }
  .dp-section {
    margin-top: 10px;
  }
  .dp-section h4 {
    margin: 0 0 4px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-text-muted);
  }
  .dp-section ul {
    margin: 0;
    padding-left: 16px;
  }
  .dp-section li {
    margin: 2px 0;
  }
  .dp-section code {
    font-size: 0.75rem;
    color: var(--color-text-default);
    word-break: break-all;
  }
  .dp-empty {
    margin: 8px 0 0;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
