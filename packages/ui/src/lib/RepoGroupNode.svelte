<script lang="ts">
  import type { NodeProps } from "@xyflow/svelte";

  interface RepoData {
    repo: string;
    [key: string]: unknown;
  }

  let { data }: NodeProps = $props();
  let d = $derived(data as unknown as RepoData);
</script>

<!-- Non-interactive container drawn behind the entity nodes to group a repo. -->
<div class="repo-group">
  <span class="repo-label">{d.repo}</span>
</div>

<style>
  .repo-group {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 1px dashed var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-subtle);
    /* Let clicks fall through to the canvas / entity nodes on top. */
    pointer-events: none;
    opacity: 0.6;
  }
  .repo-label {
    position: absolute;
    top: 6px;
    left: 12px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }
</style>
