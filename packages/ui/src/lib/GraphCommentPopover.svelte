<script lang="ts">
  interface Props {
    targetLabel: string;
    targetKind: "node" | "edge";
    /** Existing comment text, if editing an existing annotation. */
    initial: string;
    onSave: (comment: string) => void;
    onDelete: () => void;
    onClose: () => void;
  }

  let { targetLabel, targetKind, initial, onSave, onDelete, onClose }: Props =
    $props();

  // Seeded once per mount; GraphReviewApp keys this component by target so a
  // fresh instance (and fresh seed) is created when the target changes.
  // svelte-ignore state_referenced_locally
  let draft = $state(initial);

  function handleSave() {
    if (draft.trim()) onSave(draft.trim());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === "Escape") onClose();
  }
</script>

<div class="comment-popover">
  <div class="cp-header">
    <span class="cp-kind">{targetKind === "edge" ? "Connection" : "Node"}</span>
    <span class="cp-target">{targetLabel}</span>
    <button class="cp-close" onclick={onClose} aria-label="Close">✕</button>
  </div>
  <!-- svelte-ignore a11y_autofocus -->
  <textarea
    class="cp-input"
    bind:value={draft}
    onkeydown={handleKeydown}
    autofocus
    placeholder="Comment on this element… (⌘/Ctrl+Enter to save)"
  ></textarea>
  <div class="cp-actions">
    {#if initial}
      <button class="cp-btn delete" onclick={onDelete}>Delete</button>
    {/if}
    <button class="cp-btn cancel" onclick={onClose}>Cancel</button>
    <button class="cp-btn save" onclick={handleSave} disabled={!draft.trim()}
      >Save</button
    >
  </div>
</div>

<style>
  .comment-popover {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 300px;
    z-index: 20;
    background: var(--color-bg-overlay);
    border: 1px solid var(--color-annotated-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px var(--color-shadow);
    overflow: hidden;
  }
  .cp-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: var(--color-bg-inset);
    border-bottom: 1px solid var(--color-border);
  }
  .cp-kind {
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
  }
  .cp-target {
    flex: 1;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--color-text-emphasis);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cp-close {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    line-height: 1;
  }
  .cp-input {
    width: 100%;
    min-height: 90px;
    padding: 10px;
    background: transparent;
    border: none;
    color: var(--color-text-default);
    font-family: inherit;
    font-size: 0.85rem;
    resize: vertical;
    outline: none;
  }
  .cp-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 10px;
    border-top: 1px solid var(--color-border);
  }
  .cp-btn {
    padding: 4px 12px;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .cp-btn.save {
    background: var(--color-approve-bg);
    color: #fff;
  }
  .cp-btn.save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .cp-btn.cancel {
    background: transparent;
    color: var(--color-text-muted);
    border-color: var(--color-border);
  }
  .cp-btn.cancel:hover {
    background: var(--color-bg-subtle);
  }
  .cp-btn.delete {
    background: transparent;
    color: var(--color-delete-text);
    border-color: var(--color-delete-text);
    margin-right: auto;
  }
  .cp-btn.delete:hover {
    background: var(--color-delete-hover-bg);
  }
</style>
