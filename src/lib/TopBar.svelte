<script lang="ts">
  export let searchQuery: string;
  export let onSearchInput: (value: string) => void;
  export let onSearchKeydown: (event: KeyboardEvent) => void;
  export let onEditClick: () => void;
</script>

<header class="topbar">
  <div class="topbar-title">
    <h1>Mermaid navigator</h1>
  </div>
  <label class="search-box">
    <input
      id="search-input"
      value={searchQuery}
      on:input={(event) => onSearchInput(event.currentTarget.value)}
      on:keydown={onSearchKeydown}
      placeholder="Search nodes"
    />
  </label>
  <button class="edit-button" on:click={onEditClick}>Edit markdown</button>
</header>

<style>
  .topbar {
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    height: 70px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 999px;
    z-index: 30;
    backdrop-filter: blur(16px);
    background: rgba(2, 6, 23, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.38);
    box-shadow: 0 20px 80px rgba(2, 8, 23, 0.35);
  }

  .topbar-title {
    flex: 1;
    font-size: small;
    user-select: none;
  }

  h1 {
    margin: 0;
    color: #f8fafc;
  }

  .search-box {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, 52vw);
  }

  .search-box input {
    width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.42);
    border-radius: 999px;
    padding: 10px 14px;
    background: rgba(15, 23, 42, 0.72);
    color: #f8fafc;
    font: inherit;
  }

  .edit-button {
    margin-left: auto;
    user-select: none;
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
