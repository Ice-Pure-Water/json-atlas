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

export function nearestContainerPath(node, targetPath, currentPath = '$', nearestPath = '$') {
  if (currentPath === targetPath) {
    return ['object', 'array'].includes(node.type) ? currentPath : nearestPath;
  }
  const containerPath = ['object', 'array'].includes(node.type) ? currentPath : nearestPath;
  for (const [key, child] of children(node)) {
    const childPath = node.type === 'array' ? `${currentPath}[${key}]` : `${currentPath}.${key}`;
    if (
      targetPath === childPath ||
      targetPath.startsWith(`${childPath}.`) ||
      targetPath.startsWith(`${childPath}[`)
    ) {
      return nearestContainerPath(child, targetPath, childPath, containerPath);
    }
  }
  return containerPath;
}

export function replacePath(node, targetPath, replacement, currentPath = '$') {
  if (currentPath === targetPath) return replacement;
  if (node.type === 'object') {
    let changed = false;
    const entries = node.entries.map(({ key, value }) => {
      const childPath = `${currentPath}.${key}`;
      const nextValue = replacePath(value, targetPath, replacement, childPath);
      changed ||= nextValue !== value;
      return nextValue === value ? { key, value } : { key, value: nextValue };
    });
    return changed ? { ...node, entries } : node;
  }
  if (node.type === 'array') {
    let changed = false;
    const items = node.items.map((value, index) => {
      const nextValue = replacePath(value, targetPath, replacement, `${currentPath}[${index}]`);
      changed ||= nextValue !== value;
      return nextValue;
    });
    return changed ? { ...node, items } : node;
  }
  return node;
}

export function renamePathKey(root, targetPath, nextKey) {
  const separator = targetPath.lastIndexOf('.');
  if (separator < 0) return root;
  const parentPath = separator === 0 ? '$' : targetPath.slice(0, separator);
  const oldKey = targetPath.slice(separator + 1);
  const parent = findPath(root, parentPath);
  if (!parent || parent.type !== 'object' || !parent.entries.some(({ key }) => key === oldKey))
    return root;
  if (parent.entries.some(({ key }) => key === nextKey && key !== oldKey)) {
    throw new Error(`字段“${nextKey}”已存在。`);
  }
  const updatedParent = {
    ...parent,
    entries: parent.entries.map((entry) =>
      entry.key === oldKey ? { ...entry, key: nextKey } : entry,
    ),
  };
  return replacePath(root, parentPath, updatedParent);
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
      const keyControl =
        cursor.type === 'object'
          ? `<input class="path-key-input" data-path="${escapeHtml(childPath)}" data-original-key="${escapeHtml(key)}" value="${escapeHtml(key)}" aria-label="字段名" spellcheck="false"/>`
          : `<span class="path-array-index">${escapeHtml(key)}</span>`;
      let valueControl;
      if (child.type === 'object' || child.type === 'array') {
        valueControl = `<button class="path-drill" data-path="${escapeHtml(childPath)}" type="button" aria-label="浏览 ${escapeHtml(key)}">${escapeHtml(summary)} <b>›</b></button>`;
      } else if (child.type === 'boolean') {
        valueControl = `<select class="path-value-input" data-path="${escapeHtml(childPath)}" data-value-type="boolean" aria-label="${escapeHtml(key)} 的值"><option value="true" ${child.value ? 'selected' : ''}>true</option><option value="false" ${child.value ? '' : 'selected'}>false</option></select>`;
      } else if (child.type === 'null') {
        valueControl = `<input class="path-value-input" data-path="${escapeHtml(childPath)}" data-value-type="null" value="null" aria-label="${escapeHtml(key)} 的值" spellcheck="false"/>`;
      } else {
        const value = child.type === 'number' ? child.raw : child.value;
        valueControl = `<input class="path-value-input" data-path="${escapeHtml(childPath)}" data-value-type="${child.type}" value="${escapeHtml(value)}" aria-label="${escapeHtml(key)} 的值" spellcheck="false"/>`;
      }
      return `<div class="path-item ${active ? 'selected' : ''}" data-selected-path="${escapeHtml(childPath)}"><div class="path-key-cell">${keyControl}</div><div class="path-value-cell">${valueControl}</div></div>`;
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
