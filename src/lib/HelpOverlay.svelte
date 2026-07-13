<script lang="ts">
  export let visible: boolean;
  export let onClose: () => void;
</script>

{#if visible}
  <div
    class="help-overlay"
    role="dialog"
    aria-modal="true"
    tabindex="0"
    on:click={onClose}
    on:keydown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }}
  >
    <div class="help-card" role="presentation" on:click|stopPropagation>
      <div class="editor-header">
        <h2>Keyboard & controls</h2>
        <button on:click={onClose}>Close</button>
      </div>
      <div class="help-content">
        <p>
          <strong>Navigation</strong> — Arrow keys move through the graph; Ctrl/Shift
          speed up movement.
        </p>
        <p>
          <strong>World mode</strong> — Press G to pan freely in world space.
        </p>
        <p><strong>Zoom</strong> — Use + / - or the mouse wheel.</p>
        <p>
          <strong>Search</strong> — Press Ctrl+F to focus the search box, then Enter
          to jump to a matching node.
        </p>
        <p>
          <strong>Hierarchy focus</strong> — Press H to toggle a focused hierarchy
          view.
        </p>
        <p>
          <strong>Editor</strong> — Press E to open the markdown editor; Esc closes
          it.
        </p>
        <p><strong>Reset</strong> — Press R to center and reset the view.</p>
        <p><strong>Help</strong> — Press Ctrl+H to reopen this overlay.</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .help-overlay {
    position: absolute;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(2, 8, 23, 0.78);
    backdrop-filter: blur(22px);
  }

  .help-card {
    width: min(920px, 100%);
    height: min(760px, 100%);
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(148, 163, 184, 0.42);
    border-radius: 24px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 24px 90px rgba(2, 8, 23, 0.4);
  }

  .help-content {
    display: grid;
    gap: 8px;
    color: #e2e8f0;
    line-height: 1.5;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h2 {
    margin: 0;
    color: #f8fafc;
  }

  button {
    border: 1px solid rgba(125, 211, 252, 0.42);
    border-radius: 999px;
    background: rgba(8, 47, 73, 0.75);
    color: #f8fafc;
    padding: 8px 12px;
    cursor: pointer;
  }
</style>
