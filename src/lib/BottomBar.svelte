<script lang="ts">
  export let worldMode: boolean;
  export let hideUnrelated: boolean;
  export let onZoomIn: () => void;
  export let onZoomOut: () => void;
  export let onToggleWorldMode: () => void;
  export let onToggleHierarchyFocus: () => void;
  export let onResetView: () => void;
  export let onToggleHelp: () => void;
</script>

<div class="bottombar">
  <button on:click={onZoomIn}>+</button>
  <button on:click={onZoomOut}>-</button>
  <button on:click={onToggleWorldMode}>
    {worldMode ? "World mode on" : "World mode off"}
  </button>
  <button on:click={onToggleHierarchyFocus}>
    {hideUnrelated ? "Show full graph" : "Focus hierarchy"}
  </button>
  <button on:click={onResetView}>Reset</button>
  <button class="help-button" on:click={onToggleHelp}>Help</button>
</div>

<style>
  .bottombar {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 16px;
    height: 58px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border-radius: 999px;
    padding: 0 13px;
    z-index: 30;
    backdrop-filter: blur(16px);
    background: rgba(2, 6, 23, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.38);
    box-shadow: 0 20px 80px rgba(2, 8, 23, 0.35);
  }

  .help-button {
    margin-left: auto;
  }

  button {
    border: 1px solid rgba(125, 211, 252, 0.42);
    border-radius: 999px;
    background: rgba(8, 47, 73, 0.75);
    color: #f8fafc;
    padding: 8px 12px;
    cursor: pointer;
    transition:
      transform 0.16s ease,
      background 0.16s ease;
  }

  button:hover {
    transform: translateY(-1px);
    background: rgba(14, 116, 144, 0.9);
  }
</style>
