function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
}

export function typeName(node) {
  return node.type === 'object'
    ? '对象'
    : node.type === 'array'
      ? '数组'
      : node.type === 'null'
        ? 'null'
        : node.type === 'number'
          ? '数字'
          : node.type === 'boolean'
            ? '布尔值'
            : '字符串';
}

export function valueText(node) {
  if (node.type === 'string') return JSON.stringify(node.value);
  if (node.type === 'number') return node.raw;
  if (node.type === 'null') return 'null';
  return String(node.value);
}

export function children(node) {
  return node.type === 'object'
    ? node.entries.map(({ key, value }) => [key, value])
    : node.type === 'array'
      ? node.items.map((value, index) => [String(index), value])
      : [];
}

export function countNodes(node) {
  return 1 + children(node).reduce((sum, [, child]) => sum + countNodes(child), 0);
}

export function findPath(node, path, current = '$') {
  if (current === path) return node;
  for (const [key, child] of children(node)) {
    const next = node.type === 'array' ? `${current}[${key}]` : `${current}.${key}`;
    const found = findPath(child, path, next);
    if (found) return found;
  }
  return null;
}

export function matchesQuery(node, path, label, query) {
  return (
    `${label} ${valueText(node)} ${path}`.toLowerCase().includes(query.toLowerCase()) ||
    children(node).some(([key, child]) =>
      matchesQuery(child, node.type === 'array' ? `${path}[${key}]` : `${path}.${key}`, key, query),
    )
  );
}

export function renderColumns(root, path = '$', query = '') {
  const chain =
    path === '$'
      ? []
      : path
          .replace(/^\$\.?/, '')
          .replace(/\[(\d+)\]/g, '.$1')
          .split('.');
  let cursor = root;
  let current = '$';
  const columns = [];

  for (let level = 0; level <= chain.length; level += 1) {
    const entries = children(cursor).filter(([key, child]) => {
      const childPath = cursor.type === 'array' ? `${current}[${key}]` : `${current}.${key}`;
      return !query || matchesQuery(child, childPath, key, query);
    });
    const items = entries.map(([key, child]) => {
      const childPath = cursor.type === 'array' ? `${current}[${key}]` : `${current}.${key}`;
      const active = childPath === path;
      const childCount = children(child).length;
      const summary =
        child.type === 'object'
          ? `{${childCount}}`
          : child.type === 'array'
            ? `[${childCount}]`
            : valueText(child);
      return `<button class="path-item ${active ? 'selected' : ''}" data-path="${escapeHtml(childPath)}"><span>${escapeHtml(key)}</span><small>${escapeHtml(summary)}</small>${childCount ? '<b>›</b>' : ''}</button>`;
    });
    columns.push(
      `<div class="path-column">${items.join('') || '<span class="column-empty">没有子字段</span>'}</div>`,
    );
    const next = entries.find(([key]) => key === chain[level]);
    if (!next) break;
    current = cursor.type === 'array' ? `${current}[${next[0]}]` : `${current}.${next[0]}`;
    cursor = next[1];
  }
  return `<div class="columns-view">${columns.join('')}</div>`;
}

export function toTableRows(node, path = '$', label = '$', query = '') {
  const entries = children(node);
  const value = entries.length
    ? `${node.type === 'object' ? '对象' : '数组'} · ${entries.length} 项`
    : valueText(node);
  const ownMatch =
    !query ||
    `${label} ${path} ${typeName(node)} ${value}`.toLowerCase().includes(query.toLowerCase());
  const nested = entries
    .map(([key, child]) =>
      toTableRows(child, node.type === 'array' ? `${path}[${key}]` : `${path}.${key}`, key, query),
    )
    .filter(Boolean);
  if (!ownMatch && !nested.length) return null;
  return { path, field: label, kind: typeName(node), value, _children: nested };
}
