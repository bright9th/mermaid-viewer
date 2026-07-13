<script lang="ts">
  export let visible: boolean;
  export let draftMarkdown: string;
  export let onDraftChange: (value: string) => void;
  export let onApply: () => void;
</script>

{#if visible}
  <div class="editor-overlay">
    <div class="editor-card">
      <div class="editor-header">
        <h2>Mermaid markdown</h2>
        <button on:click={onApply}>Apply and close</button>
      </div>
      <textarea
        id="editor-input"
        value={draftMarkdown}
        on:input={(event) => onDraftChange(event.currentTarget.value)}
        spellcheck="false"
      ></textarea>
    </div>
  </div>
{/if}

<style>
  .editor-overlay {
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

  .editor-card {
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

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h2 {
    margin: 0;
    color: #f8fafc;
  }

  textarea {
    flex: 1;
    width: 100%;
    resize: none;
    border: 1px solid rgba(148, 163, 184, 0.42);
    border-radius: 16px;
    padding: 14px;
    background: rgba(2, 6, 23, 0.85);
    color: #f8fafc;
    font: inherit;
    line-height: 1.5;
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
