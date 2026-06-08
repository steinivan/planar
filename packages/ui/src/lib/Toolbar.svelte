<script lang="ts">
  import type { SessionSummary } from "../types";
  import ReviewDropdown from "./ReviewDropdown.svelte";

  interface Props {
    title: string;
    version?: string;
    latestVersion?: string;
    commentCounts: Record<string, number>;
    activeCommentCount: number;
    versionCount: number;
    theme: "dark" | "light";
    sessions: SessionSummary[];
    activeSessionId: string | null;
    onSelect: (sessionId: string) => void;
    onToggleTheme: () => void;
    onCompare: () => void;
    diffOnly: boolean;
    onToggleDiffOnly: () => void;
    hasGraph: boolean;
    viewMode: "document" | "graph";
    onToggleView: () => void;
    submitting: boolean;
    generalComment: string;
    onCommentChange: (comment: string) => void;
    onSubmit: (
      action: "approve" | "deny",
      generalComment: string,
      acceptMode?: "normal" | "auto-approve",
    ) => void;
    onShowShortcuts: () => void;
  }

  let {
    title,
    version = "",
    latestVersion = "",
    commentCounts,
    activeCommentCount,
    versionCount,
    theme,
    sessions,
    activeSessionId,
    onSelect,
    onToggleTheme,
    onCompare,
    diffOnly,
    onToggleDiffOnly,
    hasGraph,
    viewMode,
    onToggleView,
    submitting,
    generalComment,
    onCommentChange,
    onSubmit,
    onShowShortcuts,
  }: Props = $props();

  let multiSession = $derived(sessions.length > 1);

  let reviewDropdownRef = $state<ReviewDropdown>();

  export function openAndFocusComment() {
    reviewDropdownRef?.openAndFocusComment();
  }

  export function openForDeny() {
    reviewDropdownRef?.openForDeny();
  }

  let upgrading = $state(false);
  let upgradeResult = $state<"success" | "error" | "">("");

  async function handleUpgrade() {
    upgrading = true;
    upgradeResult = "";
    try {
      const res = await fetch("/api/upgrade", { method: "POST" });
      const data = await res.json();
      upgradeResult = data.ok ? "success" : "error";
    } catch {
      upgradeResult = "error";
    } finally {
      upgrading = false;
    }
  }
</script>

<header class="toolbar">
  <div class="toolbar-left" class:tabs-mode={multiSession}>
    <span class="brand" title="Planar">
      <svg
        class="brand-mark"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <line
          x1="4"
          y1="10"
          x2="15.5"
          y2="5.5"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <line
          x1="4"
          y1="10"
          x2="15.5"
          y2="14.5"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <circle cx="4" cy="10" r="2.7" fill="currentColor" />
        <circle cx="15.5" cy="5.5" r="2.4" fill="currentColor" />
        <circle cx="15.5" cy="14.5" r="2.4" fill="currentColor" />
      </svg>
      <span class="brand-name">Planar</span>
    </span>
    {#if multiSession}
      {#each sessions as session (session.sessionId)}
        <button
          class="session-tab"
          class:active={session.sessionId === activeSessionId}
          onclick={() => onSelect(session.sessionId)}
        >
          {session.title}
          {#if commentCounts[session.sessionId] > 0}
            <span class="tab-badge">{commentCounts[session.sessionId]}</span>
          {/if}
        </button>
      {/each}
    {:else}
      <span class="toolbar-title">{title}</span>
      {#if version && version !== "dev"}
        <span class="version">{version}</span>
      {/if}
      {#if activeSessionId && commentCounts[activeSessionId] > 0}
        <span class="badge"
          >{commentCounts[activeSessionId]} comment{commentCounts[
            activeSessionId
          ] !== 1
            ? "s"
            : ""}</span
        >
      {/if}
    {/if}
    {#if latestVersion && latestVersion !== version}
      {#if upgradeResult === "success"}
        <span class="upgrade-success"
          >Updated! Restart Planar to use {latestVersion}</span
        >
      {:else}
        <button
          class="btn-upgrade"
          onclick={handleUpgrade}
          disabled={upgrading}
        >
          {#if upgrading}
            Upgrading...
          {:else}
            Upgrade to {latestVersion}
          {/if}
        </button>
      {/if}
    {/if}
  </div>
  <div class="toolbar-right">
    {#if hasGraph}
      <div class="view-toggle" role="group" aria-label="View mode">
        <button
          class="view-btn"
          class:active={viewMode === "document"}
          onclick={() => viewMode !== "document" && onToggleView()}
          >Document</button
        >
        <button
          class="view-btn"
          class:active={viewMode === "graph"}
          onclick={() => viewMode !== "graph" && onToggleView()}>Graph</button
        >
      </div>
    {/if}
    <button
      class="btn btn-icon"
      onclick={onShowShortcuts}
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts">?</button
    >
    <button
      class="btn btn-secondary"
      onclick={onToggleTheme}
      aria-label="Toggle theme"
    >
      {#if theme === "dark"}
        ☀
      {:else}
        ☾
      {/if}
    </button>
    {#if versionCount > 1}
      <button
        class="btn btn-diff-toggle"
        class:active={diffOnly}
        onclick={onToggleDiffOnly}>Diff</button
      >
      <button class="btn btn-compare" onclick={onCompare}>Compare</button>
    {/if}
    <ReviewDropdown
      bind:this={reviewDropdownRef}
      {generalComment}
      {activeCommentCount}
      {submitting}
      {onSubmit}
      {onCommentChange}
    />
  </div>
</header>

<style>
  .toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
    min-height: 49px;
  }
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 12px 0;
  }
  .toolbar-left.tabs-mode {
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
    gap: 0;
    padding: 0;
    margin-right: 16px;
  }
  .toolbar-left.tabs-mode::-webkit-scrollbar {
    display: none;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    padding-right: 4px;
    user-select: none;
  }
  .toolbar-left.tabs-mode .brand {
    padding-right: 12px;
  }
  .brand-mark {
    color: var(--color-brand);
    flex-shrink: 0;
  }
  .brand-name {
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: 0.2px;
    color: var(--color-text-emphasis);
  }
  @media (max-width: 560px) {
    .brand-name {
      display: none;
    }
  }
  .toolbar-title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-text-emphasis);
  }
  .version {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-weight: 400;
  }
  .btn-upgrade {
    background: var(--color-accent);
    color: #fff;
    border: none;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-upgrade:hover {
    background: var(--color-accent-hover);
  }
  .btn-upgrade:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .upgrade-success {
    font-size: 0.75rem;
    color: var(--color-approve-bg);
    font-weight: 500;
  }
  .badge {
    background: var(--color-border);
    color: var(--color-text-muted);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.75rem;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tab-badge {
    background: var(--color-border);
    color: var(--color-text-muted);
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 0.7rem;
    margin-left: 6px;
    line-height: 1.4;
  }
  .session-tab {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .session-tab:hover {
    color: var(--color-text-default);
  }
  .session-tab.active {
    color: var(--color-text-emphasis);
    border-bottom-color: var(--color-accent);
  }
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .view-toggle {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
  }
  .view-btn {
    padding: 5px 12px;
    background: transparent;
    border: none;
    border-right: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .view-btn:last-child {
    border-right: none;
  }
  .view-btn:hover:not(.active) {
    background: var(--color-bg-overlay);
    color: var(--color-text-default);
  }
  .view-btn.active {
    background: var(--color-accent);
    color: #fff;
  }
  .btn {
    padding: 6px 16px;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-icon {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.8rem;
    padding: 6px 10px;
    font-weight: 600;
  }
  .btn-icon:hover {
    background: var(--color-bg-overlay);
    color: var(--color-text-default);
  }
  .btn-secondary {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }
  .btn-secondary:hover {
    background: var(--color-bg-overlay);
    color: var(--color-text-default);
  }
  .btn-diff-toggle {
    background: transparent;
    border: 1px solid var(--color-text-muted);
    color: var(--color-text-default);
  }
  .btn-diff-toggle:hover {
    background: var(--color-bg-overlay);
    color: var(--color-text-emphasis);
  }
  .btn-diff-toggle.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: #fff;
  }
  .btn-diff-toggle.active:hover {
    background: var(--color-accent-hover);
  }
  .btn-compare {
    background: transparent;
    border: 1px solid var(--color-text-muted);
    color: var(--color-text-default);
  }
  .btn-compare:hover {
    background: var(--color-bg-overlay);
    color: var(--color-text-emphasis);
  }
</style>
