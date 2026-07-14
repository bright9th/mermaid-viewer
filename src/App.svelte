<script lang="ts">
  import { onMount } from "svelte";
  import BottomBar from "./lib/BottomBar.svelte";
  import EditorOverlay from "./lib/EditorOverlay.svelte";
  import GraphCanvas from "./lib/GraphCanvas.svelte";
  import HelpOverlay from "./lib/HelpOverlay.svelte";
  import TopBar from "./lib/TopBar.svelte";
  import type { EdgeRecord, GraphData, NodeRecord } from "./lib/types";
  import dagre from "@dagrejs/dagre";

  const initialMarkdown = `flowchart LR
    A[Start] --> B[Plan]
    B --> C[Build]
    C --> D[Review]
    D --> E[Ship]
    B --> F[Prototype]
    F --> C
`;

  let markdown = initialMarkdown;
  let draftMarkdown = initialMarkdown;
  let isEditing = false;
  let searchQuery = "";
  let currentNodeId = "";
  let hideUnrelated = false;
  let worldMode = false;
  let statusText =
    "Use arrows to move, G for world mode, H for hierarchy focus, Ctrl+F for search.";
  let overlayInfo = "Ready to explore";
  let showHelp = false;
  let graph: GraphData = { nodes: [], edges: [] };
  let parserError = "";

  let view = { x: 0, y: 0, scale: 1 };
  let viewTarget = { x: 0, y: 0, scale: 1 };
  let animationFrame = 0;
  let heldDirections = new Map<string, number>();
  let heldZoomKeys = new Set<string>();
  let heldLoopFrame = 0;
  let dragState: {
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;

  const fieldSize = { width: 1400, height: 900 };
  const moveScale = 140;

  function extractMermaidSource(source: string): string | null {
    const normalized = source.replace(/\r\n/g, "\n");

    const fencedMatches = Array.from(
      normalized.matchAll(/```(?:mermaid|mmd|mermaidjs)?\s*([\s\S]*?)```/gi),
    );
    if (fencedMatches.length) {
      const blocks = fencedMatches
        .map((match) => match[1]?.trim())
        .filter((block): block is string => !!block);
      if (blocks.length) {
        return blocks.join("\n");
      }
    }

    const tildeMatches = Array.from(
      normalized.matchAll(/~~~(?:mermaid|mmd|mermaidjs)?\s*([\s\S]*?)~~~/gi),
    );
    if (tildeMatches.length) {
      const blocks = tildeMatches
        .map((match) => match[1]?.trim())
        .filter((block): block is string => !!block);
      if (blocks.length) {
        return blocks.join("\n");
      }
    }

    const hasMermaidSyntax =
      /\b(flowchart|graph|classDiagram|sequenceDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart)\b/i.test(
        normalized,
      );
    return hasMermaidSyntax ? normalized : null;
  }

  function parseMermaid(source: string): GraphData {
    const nodes = new Map<string, NodeRecord>();
    const edges: EdgeRecord[] = [];
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("%%"));

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (
        !line ||
        line.startsWith("flowchart") ||
        line.startsWith("graph") ||
        line.startsWith("class ")
      ) {
        continue;
      }

      const cleaned = line.replace(/\|[^|]+\|/g, "").trim();
      const edgeParts = cleaned.split(/\s*-->/).map((part) => part.trim());

      if (edgeParts.length > 1) {
        const parsedParts = edgeParts
          .map((token) => parseNodeToken(token))
          .filter((entry): entry is { id: string; label: string } => !!entry);

        for (let index = 0; index < parsedParts.length - 1; index += 1) {
          const from = parsedParts[index];
          const to = parsedParts[index + 1];
          ensureNode(nodes, from.id, from.label);
          ensureNode(nodes, to.id, to.label);
          edges.push({ from: from.id, to: to.id });
        }
        continue;
      }

      const single = parseNodeToken(cleaned);
      if (single) {
        ensureNode(nodes, single.id, single.label);
      }
    }

    const nodeList = Array.from(nodes.values());
    const nodeIds = new Set(nodeList.map((node) => node.id));
    const childrenMap = new Map<string, string[]>();
    const incomingMap = new Map<string, string[]>();

    for (const node of nodeList) {
      childrenMap.set(node.id, []);
      incomingMap.set(node.id, []);
    }

    for (const edge of edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        continue;
      }
      childrenMap.get(edge.from)?.push(edge.to);
      incomingMap.get(edge.to)?.push(edge.from);
    }

    for (const node of nodeList) {
      node.children = childrenMap.get(node.id) ?? [];
      node.neighbors = [
        ...new Set([...(incomingMap.get(node.id) ?? []), ...node.children]),
      ];
      const incoming = incomingMap.get(node.id) ?? [];
      node.parentId = incoming[0];
    }

    const directionMatch = source.match(/(?:flowchart|graph)\s+(LR|RL|TB|BT)/i);

    const direction = directionMatch?.[1] ?? "TB";

    layoutGraph(nodeList, edges, direction);
    return { nodes: nodeList, edges };
  }

  function parseNodeToken(token: string): { id: string; label: string } | null {
    const cleaned = token.replace(/^\s+|\s+$/g, "").replace(/\|[^|]+\|/g, "");
    if (!cleaned) {
      return null;
    }

    const match = cleaned.match(
      /^([A-Za-z0-9_.:/-]+)(?:\[(.*?)\]|\((.*?)\)|\{(.*?)\})?$/,
    );
    if (!match) {
      const fallback = cleaned.match(/^([^\s\[\]\(\)\{\}]+)$/);
      if (!fallback) {
        return null;
      }
      const id = fallback[1];
      return { id, label: id };
    }

    const id = match[1];
    const label = (match[2] ?? match[3] ?? match[4] ?? id).trim();
    return { id, label };
  }

  function ensureNode(
    nodes: Map<string, NodeRecord>,
    id: string,
    label: string,
  ) {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label, x: 0, y: 0, children: [], neighbors: [] });
    }
  }

  function layoutGraph(
    nodes: NodeRecord[],
    edges: EdgeRecord[],
    direction: string,
  ) {
    const g = new dagre.graphlib.Graph();

    g.setGraph({
      rankdir: direction,
      ranksep: 120,
      nodesep: 60,
      marginx: 80,
      marginy: 80,
    });

    g.setDefaultEdgeLabel(() => ({}));

    for (const node of nodes) {
      g.setNode(node.id, {
        width: 148,
        height: 68,
      });
    }

    for (const edge of edges) {
      g.setEdge(edge.from, edge.to);
    }

    dagre.layout(g);

    for (const node of nodes) {
      const pos = g.node(node.id);

      if (!pos) continue;

      node.x = pos.x;
      node.y = pos.y;
    }
  }

  function getVisibleNodeIds(): string[] {
    if (!hideUnrelated || !currentNodeId) {
      return graph.nodes.map((node) => node.id);
    }

    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    const visible = new Set<string>([currentNodeId]);
    const ancestors = new Set<string>();
    const descendants = new Set<string>();

    let current = nodeMap.get(currentNodeId);
    while (current?.parentId) {
      ancestors.add(current.parentId);
      current = nodeMap.get(current.parentId);
    }

    const frontier = [currentNodeId];
    while (frontier.length) {
      const id = frontier.pop();
      const node = id ? nodeMap.get(id) : undefined;
      if (!node) {
        continue;
      }

      for (const childId of node.children) {
        if (!visible.has(childId)) {
          visible.add(childId);
          descendants.add(childId);
          frontier.push(childId);
        }
      }
    }

    for (const ancestorId of ancestors) {
      visible.add(ancestorId);
    }
    for (const descendantId of descendants) {
      visible.add(descendantId);
    }

    return Array.from(visible);
  }

  function getVisibleGraph(): GraphData {
    if (!hideUnrelated) {
      return graph;
    }

    const visibleIds = new Set(getVisibleNodeIds());
    return {
      nodes: graph.nodes.filter((node) => visibleIds.has(node.id)),
      edges: graph.edges.filter(
        (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
      ),
    };
  }

  function buildGraph(source: string) {
    const previousGraph = graph;
    const mermaidSource = extractMermaidSource(source);
    if (!mermaidSource) {
      if (source.trim()) {
        parserError = "No Mermaid diagram found in the current content.";
      } else {
        graph = { nodes: [], edges: [] };
        parserError = "";
      }
      return;
    }

    try {
      const parsed = parseMermaid(mermaidSource);
      if (
        !parsed.nodes.length &&
        !parsed.edges.length &&
        previousGraph.nodes.length
      ) {
        parserError = "The current draft did not produce any graph elements.";
        return;
      }

      graph = parsed;
      parserError = "";

      if (!currentNodeId && graph.nodes.length) {
        currentNodeId = graph.nodes[0].id;
        startViewAtNode(graph.nodes[0].id);
      } else if (
        currentNodeId &&
        !graph.nodes.some((node) => node.id === currentNodeId)
      ) {
        currentNodeId = graph.nodes[0]?.id ?? "";
        if (currentNodeId) {
          startViewAtNode(currentNodeId);
        }
      }
    } catch (error) {
      parserError =
        error instanceof Error
          ? error.message
          : "Unable to parse Mermaid input.";
      if (!previousGraph.nodes.length) {
        graph = { nodes: [], edges: [] };
      }
    }
  }

  function startViewAtNode(nodeId: string, scale = 1.06) {
    const node = graph.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return;
    }

    viewTarget = {
      x: fieldSize.width / 2 - node.x * scale,
      y: fieldSize.height / 2 - node.y * scale,
      scale,
    };
    view = { ...viewTarget };
  }

  function animateView() {
    const damping = 0.16;
    view.x += (viewTarget.x - view.x) * damping;
    view.y += (viewTarget.y - view.y) * damping;
    view.scale += (viewTarget.scale - view.scale) * damping;

    if (
      Math.abs(viewTarget.x - view.x) < 0.01 &&
      Math.abs(viewTarget.y - view.y) < 0.01 &&
      Math.abs(viewTarget.scale - view.scale) < 0.001
    ) {
      view = { ...viewTarget };
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      return;
    }

    animationFrame = requestAnimationFrame(animateView);
  }

  function beginAnimation() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    animationFrame = requestAnimationFrame(animateView);
  }

  function focusNode(nodeId: string, animate = true) {
    if (!nodeId) {
      return;
    }
    currentNodeId = nodeId;
    const node = graph.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return;
    }

    viewTarget = {
      x: fieldSize.width / 2 - node.x * viewTarget.scale,
      y: fieldSize.height / 2 - node.y * viewTarget.scale,
      scale: viewTarget.scale,
    };

    if (animate) {
      beginAnimation();
    } else {
      view = { ...viewTarget };
    }
    overlayInfo = `Focused ${node.label}`;
  }

  function resetView() {
    const node =
      graph.nodes.find((entry) => entry.id === currentNodeId) ?? graph.nodes[0];
    if (!node) {
      viewTarget = { x: 0, y: 0, scale: 1 };
      beginAnimation();
      overlayInfo = "Reset view";
      return;
    }

    currentNodeId = node.id;
    viewTarget = {
      x: fieldSize.width / 2 - node.x,
      y: fieldSize.height / 2 - node.y,
      scale: 1,
    };
    beginAnimation();
    overlayInfo = `Reset to ${node.label}`;
  }

  function moveByDirection(
    direction: "up" | "down" | "left" | "right",
    speed = 1,
  ) {
    const node = graph.nodes.find((entry) => entry.id === currentNodeId);
    if (!node) {
      return;
    }

    if (worldMode) {
      const stride = moveScale * (speed === 10 ? 3 : speed === 5 ? 2 : 1);
      const delta =
        direction === "left" ? -stride : direction === "right" ? stride : 0;
      const verticalDelta =
        direction === "up" ? -stride : direction === "down" ? stride : 0;
      viewTarget = {
        x: viewTarget.x + delta,
        y: viewTarget.y + verticalDelta,
        scale: viewTarget.scale,
      };
      beginAnimation();
      return;
    }

    const candidateIds = node.neighbors.length ? node.neighbors : [node.id];
    if (direction === "left" && node.parentId) {
      focusNode(node.parentId);
      statusText = `Moved to parent ${node.parentId}`;
      return;
    }

    if (direction === "right" && node.children.length) {
      focusNode(node.children[0]);
      statusText = `Moved to child ${node.children[0]}`;
      return;
    }

    const currentIndex = candidateIds.indexOf(currentNodeId);
    const step = speed;
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex = safeIndex;
    if (direction === "up") {
      nextIndex =
        (safeIndex - step + candidateIds.length) % candidateIds.length;
    } else if (direction === "down") {
      nextIndex = (safeIndex + step) % candidateIds.length;
    }

    const nextNodeId = candidateIds[nextIndex] ?? node.id;
    if (nextNodeId && nextNodeId !== currentNodeId) {
      focusNode(nextNodeId);
      statusText = `Moved to neighbor ${nextNodeId}`;
    }
  }

  function zoomBy(delta: number) {
    const nextScale = Math.min(2.6, Math.max(0.6, viewTarget.scale + delta));
    viewTarget = { ...viewTarget, scale: nextScale };
    beginAnimation();
  }

  function startHeldLoop() {
    if (heldLoopFrame) {
      return;
    }
    heldLoopFrame = requestAnimationFrame(tickHeldLoop);
  }

  function tickHeldLoop() {
    if (heldDirections.size) {
      for (const [direction, speed] of heldDirections) {
        moveByDirection(direction as "up" | "down" | "left" | "right", speed);
      }
    }

    if (heldZoomKeys.has("+")) {
      zoomBy(0.08);
    }
    if (heldZoomKeys.has("-")) {
      zoomBy(-0.08);
    }

    if (heldDirections.size || heldZoomKeys.size) {
      heldLoopFrame = requestAnimationFrame(tickHeldLoop);
    } else {
      heldLoopFrame = 0;
    }
  }

  function jumpToSearch() {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      statusText = "Enter a node label to search.";
      return;
    }

    const match = graph.nodes.find(
      (node) =>
        node.label.toLowerCase().includes(trimmed.toLowerCase()) ||
        node.id.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!match) {
      statusText = `No node matched “${trimmed}”.`;
      return;
    }

    currentNodeId = match.id;
    focusNode(match.id);
    statusText = `Jumped to ${match.label}`;
  }

  function toggleHierarchyFocus() {
    hideUnrelated = !hideUnrelated;
    if (!hideUnrelated) {
      overlayInfo = "Hierarchy focus disabled";
    } else if (currentNodeId) {
      overlayInfo = `Hierarchy focus: ${currentNodeId}`;
    }
    statusText = hideUnrelated
      ? "Hierarchy focus enabled."
      : "Hierarchy focus disabled.";
  }

  function toggleHelp() {
    showHelp = !showHelp;
    overlayInfo = showHelp ? "Help overlay open" : "Help overlay closed";
  }

  function toggleWorldMode() {
    worldMode = !worldMode;
    overlayInfo = worldMode ? "World mode enabled" : "World mode disabled";
    statusText = worldMode
      ? "Free world mode enabled."
      : "Free world mode disabled.";
  }

  function applyEditor() {
    markdown = draftMarkdown;
    buildGraph(markdown);
    isEditing = false;
    overlayInfo = "Diagram rebuilt from the editor";
    statusText = "Diagram rebuilt from the editor.";
  }

  function beginEditing() {
    draftMarkdown = markdown;
    isEditing = true;
    buildGraph(draftMarkdown);
    setTimeout(() => {
      const editor = document.getElementById(
        "editor-input",
      ) as HTMLTextAreaElement | null;
      editor?.focus();
      editor?.setSelectionRange(editor.value.length, editor.value.length);
    }, 0);
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const isTypingInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement;
    const hasModifier = event.ctrlKey || event.metaKey || event.altKey;

    if (isEditing) {
      if (event.key === "Escape") {
        event.preventDefault();
        applyEditor();
      }
      return;
    }

    if (showHelp && event.key === "Escape") {
      event.preventDefault();
      showHelp = false;
      overlayInfo = "Help overlay closed";
      return;
    }

    if (
      event.key === "Escape" &&
      target instanceof HTMLInputElement &&
      target.id === "search-input"
    ) {
      event.preventDefault();
      target.blur();
      overlayInfo = "Search cleared";
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      overlayInfo = "Graph ready";
      return;
    }

    if (event.key.toLowerCase() === "e" && !hasModifier && !isTypingInput) {
      event.preventDefault();
      beginEditing();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      const input = document.getElementById(
        "search-input",
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "h") {
      event.preventDefault();
      toggleHelp();
      return;
    }

    if (!isTypingInput && !hasModifier && event.key.toLowerCase() === "r") {
      event.preventDefault();
      resetView();
      return;
    }

    if (!isTypingInput && !hasModifier && event.key.toLowerCase() === "g") {
      event.preventDefault();
      toggleWorldMode();
      return;
    }

    if (!isTypingInput && !hasModifier && event.key.toLowerCase() === "h") {
      event.preventDefault();
      toggleHierarchyFocus();
      return;
    }

    if (!isTypingInput && !hasModifier && event.key === "+") {
      event.preventDefault();
      heldZoomKeys.add("+");
      zoomBy(0.16);
      startHeldLoop();
      return;
    }

    if (!isTypingInput && !hasModifier && event.key === "-") {
      event.preventDefault();
      heldZoomKeys.add("-");
      zoomBy(-0.16);
      startHeldLoop();
      return;
    }

    if (
      !isTypingInput &&
      !hasModifier &&
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      event.preventDefault();
      const speed = event.shiftKey
        ? 10
        : event.ctrlKey || event.metaKey
          ? 5
          : 1;
      const direction =
        event.key === "ArrowUp"
          ? "up"
          : event.key === "ArrowDown"
            ? "down"
            : event.key === "ArrowLeft"
              ? "left"
              : "right";
      if (worldMode) {
        heldDirections.set(direction, speed);
        moveByDirection(direction, speed);
        startHeldLoop();
      } else {
        moveByDirection(direction, speed);
      }
    }
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    if (event.shiftKey) {
      viewTarget = {
        x: viewTarget.x - event.deltaY * 0.45,
        y: viewTarget.y + event.deltaX * 0.45,
        scale: viewTarget.scale,
      };
    } else {
      zoomBy(event.deltaY > 0 ? -0.08 : 0.08);
    }
    beginAnimation();
  }

  function startDrag(event: PointerEvent) {
    if (isEditing) {
      return;
    }
    dragState = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewTarget.x,
      originY: viewTarget.y,
    };
  }

  function handlePointerMove(event: PointerEvent) {
    if (!dragState?.active) {
      return;
    }
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    viewTarget = {
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
      scale: viewTarget.scale,
    };
    beginAnimation();
  }

  function stopDrag() {
    dragState = null;
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key === "+") {
      heldZoomKeys.delete("+");
    } else if (event.key === "-") {
      heldZoomKeys.delete("-");
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      const direction =
        event.key === "ArrowUp"
          ? "up"
          : event.key === "ArrowDown"
            ? "down"
            : event.key === "ArrowLeft"
              ? "left"
              : "right";
      heldDirections.delete(direction);
    }
  }

  function handleNodeClick(nodeId: string) {
    if (isEditing) {
      return;
    }
    focusNode(nodeId);
    overlayInfo = `Clicked ${nodeId}`;
  }

  onMount(() => {
    buildGraph(markdown);
    window.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });
</script>

<svelte:head>
  <title>Mermaid Viewer</title>
</svelte:head>

<div class="app-shell">
  <TopBar
    {searchQuery}
    onSearchInput={(value) => {
      searchQuery = value;
    }}
    onSearchKeydown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpToSearch();
      }
    }}
    onEditClick={beginEditing}
  />

  <div class="overlay-status">{parserError || overlayInfo}</div>

  <GraphCanvas
    {graph}
    visibleGraph={getVisibleGraph()}
    {currentNodeId}
    {view}
    {fieldSize}
    dragging={dragState?.active ?? false}
    onNodeClick={handleNodeClick}
    onViewportPointerDown={startDrag}
    onViewportPointerMove={handlePointerMove}
    onViewportPointerUp={stopDrag}
    onViewportPointerLeave={stopDrag}
    onWheel={handleWheel}
  />

  <BottomBar
    {worldMode}
    {hideUnrelated}
    onZoomIn={() => zoomBy(0.16)}
    onZoomOut={() => zoomBy(-0.16)}
    onToggleWorldMode={toggleWorldMode}
    onToggleHierarchyFocus={toggleHierarchyFocus}
    onResetView={resetView}
    onToggleHelp={toggleHelp}
  />

  <HelpOverlay
    visible={showHelp}
    onClose={() => {
      showHelp = false;
      overlayInfo = "Help overlay closed";
    }}
  />

  <EditorOverlay
    visible={isEditing}
    {draftMarkdown}
    onDraftChange={(value) => {
      draftMarkdown = value;
      buildGraph(draftMarkdown);
    }}
    onApply={applyEditor}
  />
</div>

<style>
  .app-shell {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    background: linear-gradient(135deg, #020617, #0f172a);
  }

  .overlay-status {
    position: absolute;
    top: 92px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    padding: 8px 14px;
    border-radius: 999px;
    color: #cbd5e1;
    font-size: 0.92rem;
    white-space: nowrap;
    user-select: none;
    backdrop-filter: blur(16px);
    background: rgba(2, 6, 23, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.38);
    box-shadow: 0 20px 80px rgba(2, 8, 23, 0.35);
  }
</style>
