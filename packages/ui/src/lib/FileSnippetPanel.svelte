<script lang="ts">
  import type { FileSnippet } from "../types";
  import { highlightCode, langFromPath } from "../utils/highlight";

  interface Props {
    snippet: FileSnippet;
    theme: "dark" | "light";
    onClose: () => void;
  }

  let { snippet, theme, onClose }: Props = $props();

  let highlightedHtml = $state("");
  let startNum = $derived(snippet.startLine ?? 1);
  let lineCount = $derived(snippet.content.split("\n").length);

  // Shiki highlighting
  $effect(() => {
    const lang = langFromPath(snippet.path);
    const code = snippet.content;
    const t = theme;
    highlightedHtml = "";
    highlightCode(code, lang, t).then((html) => {
      highlightedHtml = html;
    });
  });

  // Line numbers as an array
  let lineNums = $derived(
    Array.from({ length: lineCount }, (_, i) => startNum + i),
  );

  // Resize state. Width persists across sessions so the drawer reopens at the
  // size the user last dragged it to (clamped to the current viewport).
  const DRAWER_WIDTH_KEY = "planar-drawer-width";
  function initialPanelWidth(): number {
    const saved = Number(localStorage.getItem(DRAWER_WIDTH_KEY));
    const base = saved > 0 ? saved : window.innerWidth * 0.5;
    return Math.max(300, Math.min(base, window.innerWidth * 0.9, 700));
  }
  let panelWidth = $state(initialPanelWidth());
  let resizing = $state(false);

  function onResizeStart(e: MouseEvent) {
    e.preventDefault();
    resizing = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    function onMove(e: MouseEvent) {
      const delta = startX - e.clientX;
      panelWidth = Math.max(
        300,
        Math.min(startWidth + delta, window.innerWidth * 0.8),
      );
    }

    function onUp() {
      resizing = false;
      localStorage.setItem(DRAWER_WIDTH_KEY, String(Math.round(panelWidth)));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<div
  class="file-snippet-panel"
  class:resizing
  style="width: {panelWidth}px;"
  role="complementary"
  aria-label="File preview: {snippet.path}"
  onclick={(e) => e.stopPropagation()}
>
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <div class="resize-handle" onmousedown={onResizeStart}></div>
  <div class="snippet-header">
    <span class="snippet-path">{snippet.path}</span>
    {#if snippet.startLine}
      <span class="snippet-lines">
        :{snippet.startLine}{snippet.endLine &&
        snippet.endLine !== snippet.startLine
          ? `-${snippet.endLine}`
          : ""}
      </span>
    {/if}
    {#if snippet.error}
      <span class="snippet-badge">{snippet.error}</span>
    {/if}
    <button class="snippet-close" onclick={onClose} aria-label="Close snippet"
      >&times;</button
    >
  </div>
  {#if snippet.content}
    <div class="snippet-code">
      <div class="line-gutter">
        {#each lineNums as num}
          <div class="line-num">{num}</div>
        {/each}
      </div>
      <div class="code-area">
        {#if highlightedHtml}
          {@html highlightedHtml}
        {:else}
          <pre><code>{snippet.content}</code></pre>
        {/if}
      </div>
    </div>
  {:else}
    <div class="snippet-empty">{snippet.error || "No content"}</div>
  {/if}
</div>

<style>
  .file-snippet-panel {
    position: fixed;
    z-index: 200;
    top: 0;
    right: 0;
    height: 100vh;
    /* The width is set inline in px from drag-resize; never let it spill past
       the viewport on a narrow window. */
    max-width: 100vw;
    background: var(--color-bg-subtle);
    border-left: 1px solid var(--color-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 16px var(--color-shadow);
    animation: slide-in 0.15s ease-out;
  }
  /* On phones the drawer takes the full screen and the (mouse-only) resize
     handle is hidden — the inline px width is overridden here. */
  @media (max-width: 640px) {
    .file-snippet-panel {
      width: 100vw !important;
    }
    .resize-handle {
      display: none;
    }
  }
  .file-snippet-panel.resizing {
    user-select: none;
    transition: none;
  }
  @keyframes slide-in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    width: 5px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
    background: transparent;
    transition: background 0.1s;
  }
  .resize-handle:hover,
  .file-snippet-panel.resizing .resize-handle {
    background: var(--color-accent);
  }
  .snippet-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--color-bg-overlay);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.8rem;
    min-height: 36px;
    flex-shrink: 0;
  }
  .snippet-path {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--color-link);
  }
  .snippet-lines {
    font-family: var(--font-mono);
    color: var(--color-text-muted);
  }
  .snippet-badge {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }
  .snippet-close {
    margin-left: 8px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    flex-shrink: 0;
  }
  .snippet-close:hover {
    color: var(--color-text-default);
  }
  .snippet-code {
    display: flex;
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  .line-gutter {
    flex-shrink: 0;
    padding: 12px 0;
    text-align: right;
    user-select: none;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-overlay);
    position: sticky;
    left: 0;
    z-index: 1;
  }
  .line-gutter .line-num {
    padding: 0 12px 0 8px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--color-text-muted);
    opacity: 0.6;
  }
  .code-area {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }
  .code-area :global(pre) {
    margin: 0;
    padding: 12px 16px;
    background: transparent !important;
    border: none;
    border-radius: 0;
  }
  .code-area :global(code) {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .code-area :global(.shiki) {
    background: transparent !important;
  }
  .snippet-empty {
    padding: 16px;
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 0.85rem;
  }
</style>
