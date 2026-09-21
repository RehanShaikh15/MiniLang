"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

function StateNode({ data }) {
  return (
    <div className={`graph-node ${data.start ? "start" : ""} ${data.accept ? "accept" : ""}`}>
      <Handle type="target" position={Position.Left} />

      <div className="graph-node-top">
        <b>{data.label}</b>
        {data.start && <span className="node-badge">START</span>}
        {data.accept && <span className="node-badge accept-badge">ACCEPT</span>}
      </div>

      <small>{data.desc}</small>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { state: StateNode };

export default function AutomataGraph({ mode = "Lexer DFA", data = null }) {
  const isLexer = mode === "Lexer DFA";
  
  let nodes = [];
  let edges = [];

  if (isLexer) {
    const dfaList = data?.dfa || [];
    dfaList.forEach((pattern, dfaIndex) => {
      const startY = dfaIndex * 150;
      pattern.states.forEach((state, stateIndex) => {
        nodes.push({
          id: `${pattern.name}-${state.id}`,
          type: "state",
          position: {
            x: stateIndex * 165,
            y: startY + (stateIndex % 2 === 0 ? 0 : 40),
          },
          data: {
            label: `${pattern.name} ${state.id}`,
            desc: state.label,
            start: state.label === 'Start',
            accept: state.accepting,
          },
        });
      });

      pattern.transitions.forEach((t, tIndex) => {
        edges.push({
          id: `edge-${pattern.name}-${t.from}-${t.to}-${tIndex}`,
          source: `${pattern.name}-${t.from}`,
          target: `${pattern.name}-${t.to}`,
          label: t.label,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 1.5 },
          labelStyle: {
            fontSize: 10,
            fontFamily: "DM Mono, monospace",
          },
        });
      });
    });
  } else {
    const cfg = data?.cfg || { nodes: [], edges: [] };
    cfg.nodes.forEach((node, index) => {
      nodes.push({
        id: node.id,
        type: "state",
        position: {
          x: index * 200,
          y: index % 2 === 0 ? 70 : 180,
        },
        data: {
          label: node.label,
          desc: node.instructions?.length > 0 ? node.instructions[0].slice(0, 15) : "Empty block",
          start: node.id === 'entry',
          accept: false, // CFG might not have explicit accept node
        },
      });
    });

    cfg.edges.forEach((edge, index) => {
      edges.push({
        id: `edge-${edge.from}-${edge.to}-${index}`,
        source: edge.from,
        target: edge.to,
        label: edge.label,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 1.5 },
        labelStyle: {
          fontSize: 10,
          fontFamily: "DM Mono, monospace",
        },
      });
    });
  }

  return (
    <div className="graph-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.7, maxZoom: 1.5 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        zoomOnScroll
        panOnDrag
        zoomOnPinch
        attributionPosition="bottom-left"
      >
        <Background gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.start) return "#4de1ff";
            if (node.data?.accept) return "#48e0a4";
            return "#263b56";
          }}
          maskColor="rgba(6, 10, 18, 0.72)"
        />
      </ReactFlow>
    </div>
  );
}
