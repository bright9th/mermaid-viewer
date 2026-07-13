<script lang="ts">
  import type { GraphData } from "./types";

  export let graph: GraphData;
  export let visibleGraph: GraphData;
  export let currentNodeId: string;
  export let view: { x: number; y: number; scale: number };
  export let fieldSize: { width: number; height: number };
  export let dragging = false;
  export let onNodeClick: (nodeId: string) => void;
  export let onViewportPointerDown: (event: PointerEvent) => void;
  export let onViewportPointerMove: (event: PointerEvent) => void;
  export let onViewportPointerUp: () => void;
  export let onViewportPointerLeave: () => void;
  export let onWheel: (event: WheelEvent) => void;
</script>

<div
  class:dragging
  class="viewport"
  role="application"
  aria-label="Mermaid graph canvas"
  on:pointerdown={(event) => onViewportPointerDown(event)}
  on:pointermove={(event) => onViewportPointerMove(event)}
  on:pointerup={onViewportPointerUp}
  on:pointerleave={onViewportPointerLeave}
  on:wheel={(event) => onWheel(event)}
>
  <svg viewBox={`0 0 ${fieldSize.width} ${fieldSize.height}`} class="graph-svg">
    <rect
      x="0"
      y="0"
      width={fieldSize.width}
      height={fieldSize.height}
      fill="rgba(2, 8, 23, 0.96)"
    />
    <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
      {#each visibleGraph.edges as edge (edge.from + "-" + edge.to)}
        {@const fromNode = graph.nodes.find((entry) => entry.id === edge.from)}
        {@const toNode = graph.nodes.find((entry) => entry.id === edge.to)}
        {#if fromNode && toNode}
          <line
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            class="edge"
          />
          <circle
            cx={(fromNode.x + toNode.x) / 2}
            cy={(fromNode.y + toNode.y) / 2}
            r="5"
            fill="#7dd3fc"
          />
        {/if}
      {/each}

      {#each visibleGraph.nodes as node (node.id)}
        <g
          class:active={node.id === currentNodeId}
          role="button"
          tabindex="0"
          on:click={() => onNodeClick(node.id)}
          on:keydown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onNodeClick(node.id);
            }
          }}
        >
          <rect
            x={node.x - 74}
            y={node.y - 34}
            width="148"
            height="68"
            rx="18"
            class={node.id === currentNodeId ? "node node-active" : "node"}
          />
          <text
            x={node.x}
            y={node.y + 6}
            text-anchor="middle"
            class="node-label">{node.label}</text
          >
          <text x={node.x} y={node.y + 28} text-anchor="middle" class="node-id"
            >{node.id}</text
          >
        </g>
      {/each}
    </g>
  </svg>
</div>

<style>
  .viewport {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    touch-action: none;
    cursor: grab;
  }

  .viewport.dragging {
    cursor: grabbing;
  }

  .graph-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .edge {
    stroke: #38bdf8;
    stroke-width: 3;
    stroke-linecap: round;
    marker-end: url(#arrowhead);
  }

  .node {
    fill: rgba(15, 23, 42, 0.85);
    stroke: rgba(125, 211, 252, 0.45);
    stroke-width: 2.2;
  }

  .node-active {
    fill: rgba(14, 116, 144, 0.9);
    stroke: #f8fafc;
    stroke-width: 3;
  }

  .node-label {
    fill: #f8fafc;
    font-size: 16px;
    font-weight: 600;
  }

  .node-id {
    fill: #bae6fd;
    font-size: 12px;
  }
</style>
