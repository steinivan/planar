<script lang="ts">
  import type { FileDiff } from "../types";

  interface Props {
    files: FileDiff[];
    selectedFile: string | null;
    commentCounts: Record<string, number>;
    onSelect: (path: string) => void;
  }

  let { files, selectedFile, commentCounts, onSelect }: Props = $props();

  // U7: filter the file list by path substring. U4: track which files the user
  // has marked "viewed" (in-memory for this one-shot review).
  let filter = $state("");
  let viewed = $state(new Set<string>());

  function toggleViewed(path: string) {
    const next = new Set(viewed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    viewed = next;
  }

  let filteredFiles = $derived(
    filter.trim()
      ? files.filter((f) =>
          filePath(f).toLowerCase().includes(filter.trim().toLowerCase()),
        )
      : files,
  );

  const statusLabel: Record<string, string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    renamed: "R",
  };

  const statusClass: Record<string, string> = {
    modified: "status-modified",
    added: "status-added",
    deleted: "status-deleted",
    renamed: "status-renamed",
  };

  function filePath(f: FileDiff): string {
    return f.status === "deleted" ? f.oldPath : f.newPath;
  }

  function fileName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1];
  }

  function fileDir(path: string): string {
    const parts = path.split("/");
    if (parts.length <= 1) return "";
    return parts.slice(0, -1).join("/") + "/";
  }

  let lineCountsMap = $derived.by(() => {
    const map: Record<string, { add: number; remove: number }> = {};
    for (const f of files) {
      let add = 0;
      let remove = 0;
      for (const hunk of f.hunks) {
        for (const line of hunk.lines) {
          if (line.type === "add") add++;
          else if (line.type === "remove") remove++;
        }
      }
      map[filePath(f)] = { add, remove };
    }
    return map;
  });
</script>

<div class="file-list">
  <div class="file-list-header">
    Files changed
    <span class="file-count"
      >{filteredFiles.length === files.length
        ? files.length
        : `${filteredFiles.length}/${files.length}`}</span
    >
  </div>
  <div class="file-filter">
    <input
      class="file-filter-input"
      type="text"
      placeholder="Filter files…"
      bind:value={filter}
      aria-label="Filter files"
    />
    {#if filter}
      <button
        class="file-filter-clear"
        onclick={() => (filter = "")}
        aria-label="Clear filter">✕</button
      >
    {/if}
  </div>
  <div class="file-items">
    {#each filteredFiles as file (filePath(file))}
      {@const path = filePath(file)}
      {@const counts = lineCountsMap[path]}
      {@const comments = commentCounts[path] ?? 0}
      {@const isViewed = viewed.has(path)}
      <div class="file-row" class:viewed={isViewed}>
        <button
          class="file-item"
          class:selected={selectedFile === path}
          onclick={() => onSelect(path)}
        >
          <span class="file-status {statusClass[file.status]}"
            >{statusLabel[file.status]}</span
          >
          <span class="file-name">
            <span class="file-dir">{fileDir(path)}</span>{fileName(path)}
          </span>
          <span class="file-stats">
            {#if counts.add > 0}
              <span class="stat-add">+{counts.add}</span>
            {/if}
            {#if counts.remove > 0}
              <span class="stat-remove">-{counts.remove}</span>
            {/if}
          </span>
          {#if comments > 0}
            <span class="comment-badge">{comments}</span>
          {/if}
        </button>
        <button
          class="viewed-toggle"
          class:on={isViewed}
          onclick={() => toggleViewed(path)}
          title={isViewed ? "Mark as not viewed" : "Mark as viewed"}
          aria-label={isViewed ? "Mark as not viewed" : "Mark as viewed"}
          aria-pressed={isViewed}>✓</button
        >
      </div>
    {/each}
    {#if filteredFiles.length === 0}
      <div class="file-empty">No files match “{filter}”.</div>
    {/if}
  </div>
</div>

<style>
  .file-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-subtle);
    border-right: 1px solid var(--color-border);
  }
  .file-list-header {
    padding: 12px 16px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-emphasis);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .file-count {
    background: var(--color-bg-overlay);
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }
  .file-filter {
    position: relative;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
  }
  .file-filter-input {
    width: 100%;
    padding: 5px 24px 5px 9px;
    font-size: 0.78rem;
    color: var(--color-text-default);
    background: var(--color-bg-page);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    outline: none;
  }
  .file-filter-input:focus {
    border-color: var(--color-brand);
  }
  .file-filter-clear {
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    cursor: pointer;
    padding: 2px;
  }
  .file-empty {
    padding: 16px;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
  .file-items {
    overflow-y: auto;
    flex: 1;
  }
  .file-row {
    display: flex;
    align-items: center;
  }
  .file-row.viewed .file-item {
    opacity: 0.5;
  }
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding: 6px 8px 6px 16px;
    border: none;
    background: transparent;
    color: var(--color-text-default);
    font-size: 0.8rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .file-item:hover {
    background: var(--color-bg-overlay);
  }
  .viewed-toggle {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    margin-right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: transparent;
    font-size: 0.7rem;
    cursor: pointer;
    transition:
      color 0.1s,
      border-color 0.1s,
      background 0.1s;
  }
  .file-row:hover .viewed-toggle {
    color: var(--color-text-muted);
  }
  .viewed-toggle.on {
    color: #fff;
    background: var(--color-approve-bg);
    border-color: var(--color-approve-border);
  }
  .file-item.selected {
    background: var(--color-bg-inset);
    border-left: 2px solid var(--color-accent);
  }
  .file-status {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }
  .status-modified {
    color: #d29922;
  }
  .status-added {
    color: #3fb950;
  }
  .status-deleted {
    color: #f85149;
  }
  .status-renamed {
    color: #a371f7;
  }
  .file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .file-dir {
    color: var(--color-text-muted);
  }
  .file-stats {
    display: flex;
    gap: 4px;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    flex-shrink: 0;
  }
  .stat-add {
    color: #3fb950;
  }
  .stat-remove {
    color: #f85149;
  }
  .comment-badge {
    background: var(--color-accent);
    color: #fff;
    font-size: 0.65rem;
    padding: 0 5px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
    flex-shrink: 0;
  }
</style>
