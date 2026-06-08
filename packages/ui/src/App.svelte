<script lang="ts">
  import { onMount } from "svelte";
  import type {
    UnitAnnotation,
    AnnotatableUnit,
    PlanVersion,
    SessionSummary,
    PlanGraph,
    GraphAnnotation,
  } from "./types";
  import { renderPlan } from "./utils/markedRenderer";
  import { parseGraph } from "./utils/parseGraph";
  import { formatFeedback } from "./utils/feedback";
  import { formatGraphFeedback } from "./utils/graphFeedback";
  import { computeDiff, collapseDiffContext } from "./utils/diff";
  import type { CollapsedDiffItem } from "./utils/diff";
  import Toolbar from "./lib/Toolbar.svelte";
  import PlanViewer from "./lib/PlanViewer.svelte";
  import GraphReviewApp from "./lib/GraphReviewApp.svelte";
  import DiffOverlay from "./lib/DiffOverlay.svelte";
  import DiffReviewApp from "./lib/DiffReviewApp.svelte";
  import KeyboardShortcutsOverlay from "./lib/KeyboardShortcutsOverlay.svelte";
  import { isEditableTarget } from "./utils/keyboard";

  interface SessionUIState {
    annotations: UnitAnnotation[];
    generalComment: string;
    html: string;
    units: AnnotatableUnit[];
    title: string;
    codeBlockMap: Map<string, string>;
    graph: PlanGraph | null;
    graphAnnotations: GraphAnnotation[];
  }

  let sessions = $state<SessionSummary[]>([]);
  let activeSessionId = $state<string | null>(null);
  const sessionUIStates = new Map<string, SessionUIState>();

  // Active session's direct state (for reactivity)
  let html = $state("");
  let units = $state<AnnotatableUnit[]>([]);
  let codeBlockMap = $state<Map<string, string>>(new Map());
  let sessionTitle = $state("Plan Review");
  let annotations = $state<UnitAnnotation[]>([]);
  let generalComment = $state("");
  let graph = $state<PlanGraph | null>(null);
  let graphAnnotations = $state<GraphAnnotation[]>([]);
  let viewMode = $state<"document" | "graph">("document");

  let version = $state("");
  let latestVersion = $state("");
  let showDiff = $state(false);
  let diffOnly = $state(false);
  let showShortcutsHelp = $state(false);
  // One-time onboarding hint, dismissed permanently via localStorage.
  let showHint = $state(false);
  try {
    showHint = !localStorage.getItem("planar-hint-seen");
  } catch {
    showHint = false;
  }
  function dismissHint() {
    showHint = false;
    try {
      localStorage.setItem("planar-hint-seen", "1");
    } catch {
      // ignore storage failures
    }
  }
  let toolbarRef = $state<Toolbar>();
  let loading = $state(true);
  let loadError = $state("");
  let error = $state("");
  let submitting = $state(false);
  let theme = $state<"dark" | "light">(
    (localStorage.getItem("planar-theme") as "dark" | "light") ?? "dark",
  );

  $effect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("planar-theme", theme);
  });

  $effect(() => {
    if (activeSessionId) {
      saveDraft(activeSessionId, annotations, generalComment, graphAnnotations);
    }
  });

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
  }

  function saveDraft(
    sessionId: string,
    ann: UnitAnnotation[],
    comment: string,
    graphAnn: GraphAnnotation[],
  ) {
    localStorage.setItem(
      `planar-draft-${sessionId}`,
      JSON.stringify({
        annotations: ann,
        generalComment: comment,
        graphAnnotations: graphAnn,
      }),
    );
  }

  function loadDraft(sessionId: string): {
    annotations: UnitAnnotation[];
    generalComment: string;
    graphAnnotations?: GraphAnnotation[];
  } | null {
    const raw = localStorage.getItem(`planar-draft-${sessionId}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // Discard old LineAnnotation drafts (they have startLine/endLine instead of startUnitId/endUnitId)
      if (
        parsed.annotations?.length > 0 &&
        "startLine" in parsed.annotations[0]
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function clearDraft(sessionId: string) {
    localStorage.removeItem(`planar-draft-${sessionId}`);
  }

  function saveActiveState() {
    if (activeSessionId) {
      const state = sessionUIStates.get(activeSessionId);
      if (state) {
        state.annotations = annotations;
        state.generalComment = generalComment;
        state.graphAnnotations = graphAnnotations;
      }
      saveDraft(activeSessionId, annotations, generalComment, graphAnnotations);
    }
  }

  function loadSessionState(sessionId: string) {
    const state = sessionUIStates.get(sessionId);
    if (state) {
      html = state.html;
      units = state.units;
      codeBlockMap = state.codeBlockMap;
      sessionTitle = state.title;
      annotations = state.annotations;
      generalComment = state.generalComment;
      graph = state.graph;
      graphAnnotations = state.graphAnnotations;
      // Honor the user's last-chosen view when this session has a graph;
      // otherwise the document view is the only option.
      viewMode = state.graph
        ? ((localStorage.getItem("planar-view-mode") as "document" | "graph") ??
          "document")
        : "document";
    }
  }

  function switchSession(sessionId: string) {
    if (sessionId === activeSessionId) return;
    saveActiveState();
    activeSessionId = sessionId;
    viewMode = "document";
    loadSessionState(sessionId);
    showDiff = false;
  }

  function addSessionToUI(s: SessionSummary) {
    const saved = loadDraft(s.sessionId);
    const paths = new Set(s.fileSnippets?.map((f) => f.path) ?? []);
    // Strip the planar-graph block (if any) before rendering the document view.
    const { graph: parsedGraph, planWithoutGraph } = parseGraph(s.plan);
    let result: ReturnType<typeof renderPlan>;
    try {
      result = renderPlan(planWithoutGraph, paths);
    } catch (err) {
      console.error("renderPlan failed, using fallback:", err);
      result = {
        html: `<pre>${planWithoutGraph.replace(/</g, "&lt;")}</pre>`,
        units: [],
        title: "Plan Review",
        codeBlockMap: new Map(),
      };
    }
    sessions = [...sessions, s];
    sessionUIStates.set(s.sessionId, {
      annotations: saved?.annotations ?? [],
      generalComment: saved?.generalComment ?? "",
      html: result.html,
      units: result.units,
      title: result.title,
      codeBlockMap: result.codeBlockMap,
      graph: parsedGraph,
      graphAnnotations: saved?.graphAnnotations ?? [],
    });
    if (!activeSessionId) {
      activeSessionId = s.sessionId;
      loadSessionState(s.sessionId);
    }
  }

  function removeSessionFromUI(sessionId: string) {
    if (!sessions.find((s) => s.sessionId === sessionId)) return;
    sessions = sessions.filter((s) => s.sessionId !== sessionId);
    sessionUIStates.delete(sessionId);
    clearDraft(sessionId);
    submitting = false;
    if (activeSessionId === sessionId) {
      if (sessions.length > 0) {
        activeSessionId = sessions[0].sessionId;
        loadSessionState(activeSessionId);
      } else {
        activeSessionId = null;
        html = "";
        units = [];
        sessionTitle = "Plan Review";
        annotations = [];
        generalComment = "";
        graph = null;
        graphAnnotations = [];
        viewMode = "document";
        window.close();
      }
    }
  }

  onMount(() => {
    let es: EventSource | undefined;

    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { version?: string; latestVersion?: string }) => {
        version = data.version || "";
        latestVersion = data.latestVersion || "";
      })
      .catch(() => {});

    async function loadSessions(retries = 3): Promise<void> {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const r = await fetch("/api/sessions");
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const list: SessionSummary[] = await r.json();
          for (const s of list) {
            addSessionToUI(s);
          }
          loading = false;

          es = new EventSource("/api/events");
          es.addEventListener("session-added", (e) => {
            const s = JSON.parse(e.data) as SessionSummary;
            if (!sessions.find((x) => x.sessionId === s.sessionId)) {
              addSessionToUI(s);
            }
          });
          es.addEventListener("session-removed", (e) => {
            const { sessionId } = JSON.parse(e.data) as { sessionId: string };
            removeSessionFromUI(sessionId);
          });
          return;
        } catch (err) {
          console.error(
            `Failed to load sessions (attempt ${attempt}/${retries}):`,
            err,
          );
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }
      loadError = "Failed to load sessions. Please refresh.";
      loading = false;
    }
    loadSessions();

    return () => {
      es?.close();
    };
  });

  let activeSession = $derived(
    sessions.find((s) => s.sessionId === activeSessionId) ?? null,
  );
  let isDiffReview = $derived(activeSession?.mode === "diff-review");
  let versions = $derived(activeSession?.previousPlans ?? []);

  let inlineDiffLines = $derived.by<CollapsedDiffItem[] | null>(() => {
    if (!diffOnly || !activeSession) return null;
    const prevPlans = activeSession.previousPlans ?? [];
    if (prevPlans.length === 0) return null;
    const previousPlan = prevPlans[prevPlans.length - 1].plan;
    const raw = computeDiff(previousPlan, activeSession.plan);
    return collapseDiffContext(raw);
  });

  let commentCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.sessionId === activeSessionId) {
        counts[s.sessionId] = annotations.length + graphAnnotations.length;
      } else {
        const st = sessionUIStates.get(s.sessionId);
        counts[s.sessionId] =
          (st?.annotations.length ?? 0) + (st?.graphAnnotations.length ?? 0);
      }
    }
    return counts;
  });

  let activeCommentCount = $derived(
    annotations.filter((a) => a.comment.trim()).length +
      graphAnnotations.filter((a) => a.comment.trim()).length +
      (generalComment.trim() ? 1 : 0),
  );

  function addAnnotation(annotation: UnitAnnotation) {
    annotations = [...annotations, annotation];
  }

  function removeAnnotation(id: string) {
    annotations = annotations.filter((a) => a.id !== id);
  }

  function updateAnnotation(id: string, comment: string) {
    annotations = annotations.map((a) => (a.id === id ? { ...a, comment } : a));
  }

  function addGraphAnnotation(annotation: GraphAnnotation) {
    graphAnnotations = [...graphAnnotations, annotation];
  }

  function removeGraphAnnotation(id: string) {
    graphAnnotations = graphAnnotations.filter((a) => a.id !== id);
  }

  function updateGraphAnnotation(id: string, comment: string) {
    graphAnnotations = graphAnnotations.map((a) =>
      a.id === id ? { ...a, comment } : a,
    );
  }

  function toggleViewMode() {
    if (!graph) return;
    viewMode = viewMode === "document" ? "graph" : "document";
    // Remember the preference so graph-bearing plans reopen in the same view.
    localStorage.setItem("planar-view-mode", viewMode);
  }

  // At-a-glance plan stats shown above the document view.
  let planStats = $derived.by(() => {
    const files = new Set(
      (activeSession?.fileSnippets ?? []).map((f) => f.path),
    );
    const repos = new Set(
      (graph?.nodes ?? [])
        .map((n) => n.repo)
        .filter((r): r is string => Boolean(r)),
    );
    return { blocks: units.length, files: files.size, repos: repos.size };
  });

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (isDiffReview) return; // DiffReviewApp handles its own shortcuts

    if (
      e.key === "Tab" &&
      e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      if (submitting || showDiff || showShortcutsHelp) return;
      e.preventDefault();
      submitDecision("approve", "auto-approve");
      return;
    }

    if (isEditableTarget()) return;

    if (e.key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (showDiff || showShortcutsHelp) return;
      e.preventDefault();
      toolbarRef?.openAndFocusComment();
      return;
    }

    if (e.key === "x" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (submitting || showDiff || showShortcutsHelp) return;
      e.preventDefault();
      toolbarRef?.openForDeny();
      return;
    }

    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      showShortcutsHelp = !showShortcutsHelp;
      return;
    }

    if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!graph || showDiff || showShortcutsHelp) return;
      e.preventDefault();
      toggleViewMode();
      return;
    }

    // Block navigation (j/k) and comment navigation (n/p) in the document view.
    if (
      (e.key === "j" || e.key === "k" || e.key === "n" || e.key === "p") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      if (showDiff || showShortcutsHelp || viewMode === "graph") return;
      const isComment = e.key === "n" || e.key === "p";
      const forward = e.key === "j" || e.key === "n";
      const moved = navigateElements(
        isComment ? ".inline-comment" : "main [data-unit-id]",
        forward,
      );
      if (moved) e.preventDefault();
      return;
    }
  }

  // Scrolls to the next/previous matching element and briefly highlights it.
  // navCursor tracks position separately for blocks vs comments.
  let navCursor: { selector: string; index: number } = {
    selector: "",
    index: -1,
  };
  function navigateElements(selector: string, forward: boolean): boolean {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (els.length === 0) return false;
    let index = navCursor.selector === selector ? navCursor.index : -1;
    index = forward
      ? Math.min(els.length - 1, index + 1)
      : Math.max(0, index - 1);
    navCursor = { selector, index };
    const el = els[index];
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("nav-focus");
    window.setTimeout(() => el.classList.remove("nav-focus"), 900);
    return true;
  }

  async function submitDecision(
    action: "approve" | "deny",
    acceptMode?: "normal" | "auto-approve",
  ) {
    if (!activeSessionId || submitting) return;
    submitting = true;
    const sid = activeSessionId;
    const nonEmpty = annotations.filter((a) => a.comment.trim());
    // Combine document feedback (which carries the general comment) with graph
    // feedback. Graph feedback omits the general comment to avoid duplication.
    const docFeedback = formatFeedback(nonEmpty, generalComment);
    const graphFeedback = formatGraphFeedback(graphAnnotations);
    const feedback = [docFeedback, graphFeedback]
      .filter((part) => part)
      .join("\n\n");
    const body: Record<string, unknown> = { feedback };
    if (action === "approve" && acceptMode) {
      body.acceptMode = acceptMode;
    }
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(sid)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        error = `Failed to submit: ${res.status}`;
        submitting = false;
        return;
      }
      clearDraft(sid);
      removeSessionFromUI(sid);
    } catch {
      error = "Network error. Please try again.";
      submitting = false;
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

{#if showShortcutsHelp}
  <KeyboardShortcutsOverlay onClose={() => (showShortcutsHelp = false)} />
{/if}

{#if showHint && activeSession && !isDiffReview}
  <div class="first-run-hint" role="note">
    <span>
      Tip: press <kbd>g</kbd> for the graph view, hover a block and click
      <kbd>+</kbd> to comment, <kbd>?</kbd> for all shortcuts.
    </span>
    <button class="hint-dismiss" onclick={dismissHint} aria-label="Dismiss tip"
      >✕</button
    >
  </div>
{/if}

{#if loading}
  <div class="loading">
    <span class="spinner" aria-hidden="true"></span> Loading plan…
  </div>
{:else if loadError}
  <div class="loading error-state">{loadError}</div>
{:else if submitting}
  <div class="loading">
    <span class="spinner" aria-hidden="true"></span> Submitting…
  </div>
{:else if !activeSession}
  <div class="empty-state">
    <svg
      width="40"
      height="40"
      viewBox="0 0 20 20"
      aria-hidden="true"
      class="empty-mark"
    >
      <line
        x1="4"
        y1="10"
        x2="15.5"
        y2="5.5"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
      />
      <line
        x1="4"
        y1="10"
        x2="15.5"
        y2="14.5"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
      />
      <circle cx="4" cy="10" r="2.6" fill="currentColor" />
      <circle cx="15.5" cy="5.5" r="2.3" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r="2.3" fill="currentColor" />
    </svg>
    <p class="empty-title">No pending plans</p>
    <span class="empty-hint"
      >Planar opens automatically when Claude Code finishes a plan.</span
    >
  </div>
{:else if isDiffReview}
  <DiffReviewApp session={activeSession} {theme} onToggleTheme={toggleTheme} />
{:else}
  {#if error}
    <div class="error-banner" role="alert">
      <span>{error}</span>
      <button class="error-dismiss" onclick={() => (error = "")}>Dismiss</button
      >
    </div>
  {/if}
  {#if showDiff}
    <DiffOverlay
      currentPlan={activeSession.plan}
      {versions}
      onClose={() => (showDiff = false)}
    />
  {/if}
  <Toolbar
    bind:this={toolbarRef}
    title={sessionTitle}
    {version}
    {latestVersion}
    {commentCounts}
    {activeCommentCount}
    versionCount={versions.length + 1}
    {theme}
    {submitting}
    {sessions}
    {activeSessionId}
    onSelect={switchSession}
    onToggleTheme={toggleTheme}
    onCompare={() => (showDiff = true)}
    {diffOnly}
    onToggleDiffOnly={() => (diffOnly = !diffOnly)}
    hasGraph={graph !== null}
    {viewMode}
    onToggleView={toggleViewMode}
    {generalComment}
    onCommentChange={(c) => {
      generalComment = c;
    }}
    onSubmit={(action, comment, acceptMode) => {
      generalComment = comment;
      submitDecision(action, acceptMode);
    }}
    onShowShortcuts={() => (showShortcutsHelp = true)}
  />
  {#if viewMode === "graph" && graph}
    <div class="graph-main">
      <GraphReviewApp
        {graph}
        annotations={graphAnnotations}
        {theme}
        onAddAnnotation={addGraphAnnotation}
        onRemoveAnnotation={removeGraphAnnotation}
        onUpdateAnnotation={updateGraphAnnotation}
      />
    </div>
  {:else}
    <main class="main">
      {#if planStats.blocks > 0}
        <div class="plan-stats">
          <span class="stat"><strong>{planStats.blocks}</strong> blocks</span>
          {#if planStats.files > 0}
            <span class="stat"
              ><strong>{planStats.files}</strong> file{planStats.files !== 1
                ? "s"
                : ""}</span
            >
          {/if}
          {#if planStats.repos > 0}
            <span class="stat"
              ><strong>{planStats.repos}</strong> repo{planStats.repos !== 1
                ? "s"
                : ""}</span
            >
          {/if}
        </div>
      {/if}
      <PlanViewer
        {html}
        {units}
        {codeBlockMap}
        {annotations}
        fileSnippets={activeSession?.fileSnippets}
        diffLines={inlineDiffLines}
        {theme}
        onAddAnnotation={addAnnotation}
        onRemoveAnnotation={removeAnnotation}
        onUpdateAnnotation={updateAnnotation}
      />
    </main>
  {/if}
{/if}

<style>
  :global(:root) {
    --color-bg-page: #0d1117;
    --color-bg-subtle: #161b22;
    --color-bg-inset: #1c2128;
    --color-bg-overlay: #21262d;
    --color-border: #30363d;
    --color-border-muted: #21262d;
    --color-text-default: #c9d1d9;
    --color-text-emphasis: #e6edf3;
    --color-text-muted: #8b949e;
    /* Brand: teal / emerald — replaces the GitHub-blue accent. */
    --color-link: #2dd4bf;
    --color-accent: #14b8a6;
    --color-accent-hover: #5eead4;
    --color-brand: #14b8a6;
    --color-brand-soft: rgba(20, 184, 166, 0.15);
    --color-approve-bg: #0f9d76;
    --color-approve-border: #10b981;
    --color-approve-hover: #10b981;
    --color-deny-text: #e4e4df;
    --color-deny-hover-bg: rgba(27, 26, 25, 0.1);
    --color-delete-text: #f85149;
    --color-delete-hover-bg: rgba(248, 81, 73, 0.1);
    --color-annotated-border: #14b8a6;
    --color-annotated-bg: rgba(20, 184, 166, 0.15);
    --color-diff-add-bg: rgba(16, 185, 129, 0.2);
    --color-diff-add-text: #6ee7b7;
    --color-diff-remove-bg: rgba(248, 81, 73, 0.2);
    --color-diff-remove-text: #ffa198;
    --color-diff-hunk: #bc8cff;
    --color-shadow: rgba(0, 0, 0, 0.4);
    /* Design tokens (shared across themes; light overrides elevation below). */
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3);
    --elevation-2: 0 4px 12px rgba(0, 0, 0, 0.35);
    --elevation-3: 0 12px 32px rgba(0, 0, 0, 0.45);
    --font-mono:
      "SF Mono", "Fira Code", "JetBrains Mono", "Fira Mono", Menlo, Consolas,
      monospace;
  }

  :global([data-theme="light"]) {
    --color-bg-page: #ffffff;
    --color-bg-subtle: #f6f8fa;
    --color-bg-inset: #f6f8fa;
    --color-bg-overlay: #eaeef2;
    --color-border: #d0d7de;
    --color-border-muted: #d0d7de;
    --color-text-default: #1f2328;
    --color-text-emphasis: #1f2328;
    --color-text-muted: #656d76;
    --color-link: #0d9488;
    --color-accent: #0d9488;
    --color-accent-hover: #0f766e;
    --color-brand: #0d9488;
    --color-brand-soft: rgba(13, 148, 136, 0.12);
    --color-approve-bg: #047857;
    --color-approve-border: #047857;
    --color-approve-hover: #059669;
    --color-deny-text: #141413;
    --color-deny-hover-bg: rgba(27, 26, 25, 0.1);
    --color-delete-text: #cf222e;
    --color-delete-hover-bg: rgba(207, 34, 46, 0.1);
    --color-annotated-border: #0d9488;
    --color-annotated-bg: rgba(13, 148, 136, 0.12);
    --color-diff-add-bg: rgba(5, 150, 105, 0.15);
    --color-diff-add-text: #047857;
    --color-diff-remove-bg: rgba(207, 34, 46, 0.15);
    --color-diff-remove-text: #82071e;
    --color-diff-hunk: #6639ba;
    --color-shadow: rgba(0, 0, 0, 0.15);
    /* Softer, neutral-tinted elevation for the light theme. */
    --elevation-1: 0 1px 2px rgba(31, 35, 40, 0.08);
    --elevation-2: 0 4px 12px rgba(31, 35, 40, 0.12);
    --elevation-3: 0 12px 32px rgba(31, 35, 40, 0.18);
  }

  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :global(body) {
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
      sans-serif;
    background: var(--color-bg-page);
    color: var(--color-text-default);
    line-height: 1.6;
  }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100vh;
    font-size: 1.1rem;
    color: var(--color-text-muted);
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-brand);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2s;
    }
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100vh;
    padding: 24px;
    text-align: center;
  }
  .empty-mark {
    color: var(--color-brand);
    opacity: 0.9;
    margin-bottom: 4px;
  }
  .empty-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--color-text-emphasis);
  }
  .empty-hint {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    max-width: 320px;
  }
  .first-run-hint {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: min(92vw, 640px);
    padding: 9px 12px 9px 16px;
    font-size: 0.82rem;
    color: var(--color-text-default);
    background: var(--color-bg-overlay);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-brand);
    border-radius: var(--radius-md);
    box-shadow: var(--elevation-2);
  }
  .first-run-hint kbd {
    display: inline-block;
    padding: 1px 5px;
    background: var(--color-bg-page);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-text-emphasis);
  }
  .hint-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
    padding: 2px 4px;
  }
  .hint-dismiss:hover {
    color: var(--color-text-default);
  }
  .error-banner {
    position: fixed;
    top: 49px;
    left: 0;
    right: 0;
    z-index: 101;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px 16px;
    background: var(--color-delete-hover-bg);
    border-bottom: 1px solid var(--color-delete-text);
    color: var(--color-delete-text);
    font-size: 0.875rem;
  }
  .error-dismiss {
    background: none;
    border: 1px solid var(--color-delete-text);
    border-radius: 4px;
    color: var(--color-delete-text);
    padding: 2px 8px;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .main {
    max-width: 860px;
    margin: 0 auto;
    padding: 80px 24px 48px;
  }
  .plan-stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    padding-bottom: 12px;
    margin-bottom: 20px;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border-muted);
  }
  .plan-stats .stat strong {
    color: var(--color-text-emphasis);
    font-weight: 600;
  }
  /* Transient highlight applied to the block/comment jumped to via j/k/n/p. */
  :global(.nav-focus) {
    border-radius: var(--radius-sm);
    animation: nav-pulse 0.9s ease-out;
  }
  @keyframes nav-pulse {
    0% {
      box-shadow: 0 0 0 2px var(--color-brand);
    }
    100% {
      box-shadow: 0 0 0 2px transparent;
    }
  }
  .graph-main {
    position: fixed;
    top: 49px;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
