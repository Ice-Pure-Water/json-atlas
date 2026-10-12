import React, { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph.css';

const h = React.createElement;
const NODE_WIDTH = 350;
const typeName = (node) =>
  ({
    object: '对象',
    array: '数组',
    null: 'null',
    number: '数字',
    boolean: '布尔值',
    string: '字符串',
  })[node.type];
const valueText = (node) =>
  node.type === 'string'
    ? JSON.stringify(node.value)
    : node.type === 'number'
      ? node.raw
      : node.type === 'null'
        ? 'null'
        : String(node.value);
const childEntries = (node) =>
  node.type === 'object'
    ? node.entries.map(({ key, value }) => [key, value])
    : node.type === 'array'
      ? node.items.map((value, index) => [String(index), value])
      : [];
const preview = (node) => {
  const count = childEntries(node).length;
  return count ? `${node.type === 'object' ? '{}' : '[]'} · ${count}` : valueText(node);
};
const valueMatches = (node, key, path, query) =>
  !query ||
  `${key} ${path} ${typeName(node)} ${preview(node)}`.toLowerCase().includes(query.toLowerCase());

function createGraph(rootNode, selectedPath, query, direction = 'LR') {
  const nodes = [];
  const edges = [];
  const addNode = (node, path, label, parentPath = null) => {
    const isObject = node.type === 'object';
    const rawEntries = childEntries(node);
    const ownMatch = valueMatches(node, label, path, query);
    let rows = [];
    let columns = [];
    const childNodes = [];

    if (isObject || !rawEntries.length) {
      rows = rawEntries
        .map(([key, value]) => {
          const childPath = `${path}.${key}`;
          const container = value.type === 'object' || value.type === 'array';
          const match = ownMatch || valueMatches(value, key, childPath, query);
          if (container) {
            const childIncluded = addNode(value, childPath, key, path);
            if (childIncluded) childNodes.push({ path: childPath, handle: childPath });
            return {
              key,
              value: preview(value),
              handle: childIncluded ? childPath : null,
              targetPath: childIncluded ? childPath : null,
              include: ownMatch || childIncluded,
            };
          }
          return { key, value: valueText(value), handle: null, include: match };
        })
        .filter((row) => !query || row.include);
    } else {
      const objectItems = node.items.filter((item) => item.type === 'object');
      columns = [...new Set(objectItems.flatMap((item) => item.entries.map(({ key }) => key)))];
      if (node.items.some((item) => item.type !== 'object'))
        columns = [...new Set([...columns, '值'])];
      if (!columns.length) columns = ['值'];
      rows = node.items
        .map((item, index) => {
          const itemPath = `${path}[${index}]`;
          const cells = [];
          if (item.type === 'object') {
            item.entries.forEach(({ key, value }) => {
              const childPath = `${itemPath}.${key}`;
              if (value.type === 'object' || value.type === 'array') {
                const childIncluded = addNode(value, childPath, key, path);
                const handle = `cell-${index}-${key}`;
                if (childIncluded) childNodes.push({ path: childPath, handle });
                cells.push({
                  key,
                  value: preview(value),
                  container: true,
                  targetPath: childIncluded ? childPath : null,
                  handle: childIncluded ? handle : null,
                });
              } else cells.push({ key, value: valueText(value), container: false });
            });
          } else {
            cells.push({
              key: '值',
              value: item.type === 'array' ? preview(item) : valueText(item),
              container: item.type === 'array',
            });
            if (item.type === 'array') {
              const childIncluded = addNode(item, itemPath, String(index), path);
              const handle = `cell-${index}-value`;
              if (childIncluded) {
                childNodes.push({ path: itemPath, handle });
                cells[0].targetPath = itemPath;
                cells[0].handle = handle;
              }
            }
          }
          const match =
            !query ||
            valueMatches(item, String(index), itemPath, query) ||
            cells.some((cell) =>
              `${cell.key} ${cell.value}`.toLowerCase().includes(query.toLowerCase()),
            ) ||
            childNodes.some((entry) => entry.handle === `row-${index}`);
          return {
            key: String(index),
            cells,
            handle: childNodes.some((entry) => entry.handle.startsWith(`cell-${index}-`))
              ? `row-${index}`
              : null,
            include: ownMatch || match,
          };
        })
        .filter((row) => !query || row.include);
    }

    const included = !query || ownMatch || rows.length > 0 || childNodes.length > 0;
    if (!included) return false;
    const height =
      isObject || !columns.length
        ? 55 + Math.max(rows.length, 1) * 32
        : 72 + Math.max(rows.length, 1) * 34;
    nodes.push({
      id: path,
      type: 'jsonCard',
      position: { x: 0, y: 0 },
      selected: selectedPath === path,
      data: {
        label,
        kind: typeName(node),
        path,
        parentPath,
        rows,
        columns,
        isArray: node.type === 'array',
        empty: !rows.length,
        height,
      },
    });
    const edgeColors = ['#84a96f', '#5599b8', '#c39355', '#9277b1', '#cf796d', '#58a297'];
    childNodes.forEach(({ path: childPath, handle }, index) =>
      edges.push({
        id: `${path}->${childPath}`,
        source: path,
        sourceHandle: handle,
        target: childPath,
        type: 'default',
        animated: false,
        style: { stroke: edgeColors[index % edgeColors.length], strokeWidth: 2 },
        interactionWidth: 18,
      }),
    );
    return true;
  };

  addNode(rootNode, '$', '$');
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map();
  edges.forEach((edge) => {
    if (!children.has(edge.source)) children.set(edge.source, []);
    children.get(edge.source).push(edge.target);
  });
  const levels = [];
  const visited = new Set();
  const collect = (id, depth) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeById.get(id);
    if (!node) return;
    (levels[depth] ??= []).push(node);
    (children.get(id) ?? []).forEach((childId) => collect(childId, depth + 1));
  };
  collect('$', 0);
  const levelGap = 120;
  if (direction === 'LR') {
    const gap = 68;
    const heights = levels.map(
      (level) =>
        level.reduce((sum, node) => sum + node.data.height, 0) +
        Math.max(0, level.length - 1) * gap,
    );
    const canvasHeight = Math.max(...heights, 0);
    levels.forEach((level, depth) => {
      let top = (canvasHeight - heights[depth]) / 2;
      level.forEach((node) => {
        node.position = { x: 40 + depth * (NODE_WIDTH + levelGap), y: top };
        top += node.data.height + gap;
      });
    });
  } else {
    const gap = 68;
    const widths = levels.map(
      (level) => level.length * NODE_WIDTH + Math.max(0, level.length - 1) * gap,
    );
    const canvasWidth = Math.max(...widths, 0);
    let top = 36;
    levels.forEach((level, depth) => {
      let left = (canvasWidth - widths[depth]) / 2;
      const levelHeight = Math.max(0, ...level.map((node) => node.data.height));
      level.forEach((node) => {
        node.position = { x: left, y: top + (levelHeight - node.data.height) / 2 };
        left += NODE_WIDTH + gap;
      });
      top += levelHeight + levelGap;
    });
  }
  return { nodes, edges };
}

function JsonCard({ data }) {
  const rows = data.rows;
  const parentHeaderProps = data.parentPath
    ? {
        className: 'json-card-head json-card-head-parent',
        role: 'button',
        tabIndex: 0,
        title: '返回父节点',
        onClick: (event) => {
          event.stopPropagation();
          data.onNavigate?.(data.parentPath);
        },
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            data.onNavigate?.(data.parentPath);
          }
        },
      }
    : { className: 'json-card-head' };
  return h(
    'article',
    {
      className: `json-card ${data.isArray ? 'json-card-array' : ''} ${data.path === '$' ? 'json-card-root' : ''}`,
    },
    h(Handle, {
      type: 'target',
      position: Position.Left,
      className: 'json-handle json-handle-target',
    }),
    data.isArray
      ? h(
          React.Fragment,
          null,
          h(
            'header',
            parentHeaderProps,
            h('span', { className: 'json-card-kind' }, '数组'),
            h('strong', null, data.label),
            h('small', null, `[${rows.length}]`),
          ),
          h(
            'div',
            { className: 'json-array-scroll' },
            h(
              'table',
              { className: 'json-array-table' },
              h(
                'thead',
                null,
                h(
                  'tr',
                  null,
                  h('th', null, '#'),
                  ...data.columns.map((column) => h('th', { key: column }, column)),
                ),
              ),
              h(
                'tbody',
                null,
                ...rows.map((row) =>
                  h(
                    'tr',
                    { key: row.key },
                    h('td', { className: 'json-array-index' }, row.key),
                    ...data.columns.map((column) => {
                      const cell = row.cells.find((item) => item.key === column);
                      return h(
                        'td',
                        {
                          key: column,
                          className: `${cell?.container ? 'json-cell-container' : ''} ${cell?.targetPath ? 'json-cell-navigate' : ''}`,
                          role: cell?.targetPath ? 'button' : undefined,
                          tabIndex: cell?.targetPath ? 0 : undefined,
                          onClick: cell?.targetPath
                            ? (event) => {
                                event.stopPropagation();
                                data.onNavigate?.(cell.targetPath);
                              }
                            : undefined,
                          onKeyDown: cell?.targetPath
                            ? (event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  data.onNavigate?.(cell.targetPath);
                                }
                              }
                            : undefined,
                        },
                        cell?.value ?? '',
                        cell?.handle
                          ? h(Handle, {
                              id: cell.handle,
                              type: 'source',
                              position: Position.Right,
                              className: 'json-handle json-row-handle',
                            })
                          : null,
                      );
                    }),
                  ),
                ),
              ),
            ),
          ),
        )
      : h(
          React.Fragment,
          null,
          h(
            'header',
            parentHeaderProps,
            h('span', { className: 'json-card-kind' }, data.kind),
            h('strong', null, data.label),
            h('small', null, `{${rows.length}}`),
          ),
          h(
            'div',
            { className: 'json-object-rows' },
            ...(rows.length
              ? rows.map((row) =>
                  h(
                    'div',
                    {
                      key: row.key,
                      className: `json-object-row ${row.handle ? 'has-child json-row-navigate' : ''}`,
                      role: row.targetPath ? 'button' : undefined,
                      tabIndex: row.targetPath ? 0 : undefined,
                      onClick: row.targetPath
                        ? (event) => {
                            event.stopPropagation();
                            data.onNavigate?.(row.targetPath);
                          }
                        : undefined,
                      onKeyDown: row.targetPath
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              data.onNavigate?.(row.targetPath);
                            }
                          }
                        : undefined,
                    },
                    h('span', { className: 'json-row-key' }, row.key),
                    h(
                      'span',
                      { className: `json-row-value ${row.handle ? 'json-value-container' : ''}` },
                      row.value,
                    ),
                    row.targetPath
                      ? h('span', { className: 'json-row-jump', 'aria-hidden': true }, '↗')
                      : null,
                    row.handle
                      ? h(Handle, {
                          id: row.handle,
                          type: 'source',
                          position: Position.Right,
                          className: 'json-handle json-object-handle',
                        })
                      : null,
                  ),
                )
              : h('div', { className: 'json-object-empty' }, data.kind === '对象' ? '空对象' : '')),
          ),
        ),
  );
}

const nodeTypes = { jsonCard: JsonCard };
function FlowCanvas({ graph, onSelect }) {
  const flow = useReactFlow();
  const [nodes, setNodes] = useState(graph.nodes);
  const [edges, setEdges] = useState(graph.edges);
  const onNodesChange = (changes) => setNodes((current) => applyNodeChanges(changes, current));
  const onEdgesChange = (changes) => setEdges((current) => applyEdgeChanges(changes, current));
  const onNodeClick = (_event, node) => {
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })));
    onSelect(node.id);
  };
  const onNavigate = useCallback(
    (path) => {
      if (!graph.nodes.some((node) => node.id === path)) return;
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === path })));
      onSelect(path);
      requestAnimationFrame(() =>
        flow.fitView({
          nodes: [{ id: path }],
          padding: 0.28,
          minZoom: 0.55,
          maxZoom: 1.4,
          duration: 320,
        }),
      );
    },
    [flow, graph.nodes, onSelect],
  );
  const renderedNodes = useMemo(
    () => nodes.map((node) => ({ ...node, data: { ...node.data, onNavigate } })),
    [nodes, onNavigate],
  );
  const onInit = (instance) =>
    requestAnimationFrame(() =>
      instance.fitView({
        nodes: [
          { id: '$' },
          ...graph.edges.filter((edge) => edge.source === '$').map((edge) => ({ id: edge.target })),
        ],
        padding: 0.12,
        maxZoom: 1,
        duration: 180,
      }),
    );
  return h(
    ReactFlow,
    {
      nodes: renderedNodes,
      edges,
      nodeTypes,
      onNodesChange,
      onEdgesChange,
      onNodeClick,
      onInit,
      minZoom: 0.18,
      maxZoom: 1.7,
      proOptions: { hideAttribution: false },
      nodesDraggable: true,
      nodesConnectable: false,
      elementsSelectable: true,
      panOnScroll: true,
      zoomOnDoubleClick: false,
      defaultEdgeOptions: { type: 'default' },
    },
    h(Background, { variant: 'lines', gap: 20, size: 1, color: '#e8eee5' }),
    h(Controls, { position: 'top-right', showInteractive: false }),
    h(MiniMap, {
      position: 'bottom-right',
      pannable: true,
      zoomable: true,
      nodeColor: (node) => (node.selected ? '#b7d58d' : '#edf3e8'),
      maskColor: 'rgba(247, 249, 245, 0.62)',
    }),
  );
}

function GraphApp({ node, selectedPath, query, onSelect, direction }) {
  const graph = useMemo(
    () => createGraph(node, selectedPath, query, direction),
    [node, selectedPath, query, direction],
  );
  return h(ReactFlowProvider, null, h(FlowCanvas, { graph, onSelect }));
}

export function mountGraph(element, node, selectedPath, query, onSelect, direction = 'LR') {
  const root = createRoot(element);
  root.render(h(GraphApp, { node, selectedPath, query, onSelect, direction }));
  return () => root.unmount();
}
