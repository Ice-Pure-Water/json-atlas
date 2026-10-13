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

function treeValueControl(node, path) {
  if (node.type === 'boolean') {
    return `<select class="path-value-input tree-value-input" data-path="${escapeHtml(path)}" data-value-type="boolean" aria-label="值" title="布尔值"><option value="true" ${node.value ? 'selected' : ''}>true</option><option value="false" ${node.value ? '' : 'selected'}>false</option></select>`;
  }
  const value = node.type === 'number' ? node.raw : node.type === 'null' ? 'null' : node.value;
  return `<input class="path-value-input tree-value-input" data-path="${escapeHtml(path)}" data-value-type="${node.type}" value="${escapeHtml(value)}" aria-label="值" spellcheck="false"/>`;
}

function treeNode(node, path, label, depth, selectedPath, query, collapsedPaths, expandedPaths) {
  const entries = children(node);
  const hasChildren = entries.length > 0;
  const ownMatch =
    !query ||
    `${label} ${path} ${typeName(node)} ${valueText(node)}`
      .toLowerCase()
      .includes(query.toLowerCase());
  const visibleEntries = query
    ? entries.filter(([key, child]) => {
        const childPath = node.type === 'array' ? `${path}[${key}]` : `${path}.${key}`;
        return matchesQuery(child, childPath, key, query);
      })
    : entries;
  const defaultCollapsed = depth >= 3;
  const collapsed =
    hasChildren &&
    !query &&
    (collapsedPaths.has(path) || (!expandedPaths.has(path) && defaultCollapsed));
  if (!ownMatch && !visibleEntries.length) return '';
  const type = node.type === 'object' ? '对象' : node.type === 'array' ? '数组' : typeName(node);
  const field =
    path === '$'
      ? '<span class="tree-root-label">$</span>'
      : node.type === 'array'
        ? `<span class="tree-array-index">${escapeHtml(label)}</span>`
        : `<input class="path-key-input tree-key-input" data-path="${escapeHtml(path)}" data-original-key="${escapeHtml(label)}" value="${escapeHtml(label)}" aria-label="字段名" spellcheck="false"/>`;
  const value = hasChildren
    ? `<span class="tree-children-count">${node.type === 'array' ? '[' : '{'}${entries.length}${node.type === 'array' ? ']' : '}'}</span>`
    : treeValueControl(node, path);
  const toggle = hasChildren
    ? `<button class="tree-disclosure" type="button" data-tree-toggle="${escapeHtml(path)}" data-collapsed="${collapsed}" aria-label="${collapsed ? '展开' : '折叠'} ${escapeHtml(label)}" aria-expanded="${!collapsed}">${collapsed ? '›' : '⌄'}</button>`
    : '<span class="tree-disclosure-spacer"></span>';
  const row = `<div class="json-tree-row ${path === selectedPath ? 'selected' : ''} ${path === '$' ? 'root-row' : ''}" role="treeitem" data-path="${escapeHtml(path)}" aria-expanded="${hasChildren ? !collapsed : 'false'}" style="--tree-depth:${depth}">${toggle}<div class="json-tree-field">${field}</div><span class="json-tree-type type-${node.type}">${type}</span><div class="json-tree-value">${value}</div></div>`;
  const childrenHtml =
    hasChildren && !collapsed
      ? `<div class="json-tree-children" role="group">${visibleEntries
          .map(([key, child]) => {
            const childPath = node.type === 'array' ? `${path}[${key}]` : `${path}.${key}`;
            return treeNode(
              child,
              childPath,
              key,
              depth + 1,
              selectedPath,
              query,
              collapsedPaths,
              expandedPaths,
            );
          })
          .join('')}</div>`
      : '';
  return `<div class="json-tree-branch">${row}${childrenHtml}</div>`;
}

export function renderTree(
  root,
  selectedPath = '$',
  query = '',
  collapsedPaths = new Set(),
  expandedPaths = new Set(),
) {
  return `<div class="json-tree" role="tree" aria-label="JSON 树形视图">${treeNode(root, '$', '$', 0, selectedPath, query.trim(), collapsedPaths, expandedPaths)}</div>`;
}

function tableRows(node, path = '$', label = '$', depth = 0, query = '', rows = []) {
  const entries = children(node);
  const value = entries.length
    ? `${node.type === 'object' ? '对象' : '数组'} · ${entries.length} 项`
    : valueText(node);
  const searchText = `${label} ${path} ${typeName(node)} ${value}`.toLowerCase();
  if (!query || searchText.includes(query.toLowerCase())) {
    rows.push({ path, field: label, kind: typeName(node), value, depth });
  }
  for (const [key, child] of entries) {
    const childPath = node.type === 'array' ? `${path}[${key}]` : `${path}.${key}`;
    tableRows(child, childPath, key, depth + 1, query, rows);
  }
  return rows;
}

export function renderTable(
  root,
  selectedPath = '$',
  query = '',
  sort = { key: 'path', direction: 'asc' },
) {
  const rows = tableRows(root, '$', '$', 0, query.trim());
  const direction = sort.direction === 'desc' ? -1 : 1;
  rows.sort(
    (left, right) =>
      String(left[sort.key]).localeCompare(String(right[sort.key]), undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * direction,
  );
  const columns = [
    ['path', '路径'],
    ['field', '字段'],
    ['kind', '类型'],
    ['value', '值 / 子项'],
  ];
  const headings = columns
    .map(([key, title]) => {
      const active = sort.key === key;
      const indicator = active ? (sort.direction === 'desc' ? '↓' : '↑') : '';
      return `<th scope="col" aria-sort="${active ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}"><button type="button" class="data-table-sort ${active ? 'active' : ''}" data-table-sort="${key}">${title}<span aria-hidden="true">${indicator}</span></button></th>`;
    })
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr class="${row.path === selectedPath ? 'selected' : ''}" data-path="${escapeHtml(row.path)}"><td class="data-table-path">${escapeHtml(row.path)}</td><td class="data-table-field" style="--row-depth:${row.depth}">${escapeHtml(row.field)}</td><td><span class="data-table-type type-${row.kind}">${escapeHtml(row.kind)}</span></td><td class="data-table-value">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr>${headings}</tr></thead><tbody>${body || '<tr><td class="data-table-empty" colspan="4">没有匹配的字段</td></tr>'}</tbody></table></div>`;
}
