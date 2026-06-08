<script lang="ts">
  import type { NodeProps } from "@xyflow/svelte";
  import type { GraphRole } from "../types";

  interface RoleData {
    role: GraphRole;
    label: string;
    icon: string;
    [key: string]: unknown;
  }

  let { data }: NodeProps = $props();
  let d = $derived(data as unknown as RoleData);
</script>

<!-- Non-interactive swimlane drawn behind the entity nodes to group a role. -->
<div class="role-band band-{d.role}">
  <span class="role-label"
    ><span class="role-icon">{d.icon}</span> {d.label}</span
  >
</div>

<style>
  .role-band {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-subtle);
    /* Let clicks fall through to the canvas / entity nodes on top. */
    pointer-events: none;
    opacity: 0.85;
  }
  .band-problem {
    border-color: var(--color-diff-remove-text);
    background: var(--color-diff-remove-bg);
  }
  .band-cause {
    border-color: var(--color-accent);
    background: var(--color-annotated-bg);
  }
  .band-fix {
    border-color: var(--color-diff-add-text);
    background: var(--color-diff-add-bg);
  }
  .band-outcome {
    border-color: var(--color-diff-hunk);
    background: color-mix(in srgb, var(--color-diff-hunk) 14%, transparent);
  }
  .band-context {
    border-color: var(--color-border);
    background: var(--color-bg-subtle);
  }
  .role-label {
    position: absolute;
    top: 7px;
    left: 14px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-default);
  }
  .role-icon {
    font-size: 0.85rem;
  }
</style>
