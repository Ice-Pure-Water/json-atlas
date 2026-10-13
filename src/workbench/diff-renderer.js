import YAML from 'yaml';
import { stringify, toPlain } from '../core.js';

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

function renderMergedDiff(left, right, path = '$', key = null, depth = 0, comma = false) {
  const indent = depth * 16;
  const field =
    key === null ? '' : `<span class="merged-key">${escapeHtml(JSON.stringify(key))}: </span>`;
  const suffix = comma ? ',' : '';
  const line = (content, kind = '', rowPath = path) =>
    `<div class="merged-line ${kind}" data-path="${escapeHtml(rowPath)}" style="--indent:${indent}px">${content}</div>`;
  const pretty = (node) => stringify(node, 2);
  if (!left)
    return line(`${field}<pre>${escapeHtml(pretty(right))}</pre>${suffix}`, 'merged-added', path);
  if (!right)
    return line(`${field}<pre>${escapeHtml(pretty(left))}</pre>${suffix}`, 'merged-deleted', path);
  if (left.type !== right.type) {
    return line(
      `${field}<span class="merged-before">${escapeHtml(stringify(left, 0))}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(stringify(right, 0))}</span>${suffix}`,
      'merged-changed',
      path,
    );
  }
  if (left.type === 'object' || left.type === 'array') {
    const isObject = left.type === 'object';
    const leftChildren = isObject
      ? left.entries.map(({ key: childKey, value }) => [childKey, value])
      : left.items.map((value, index) => [String(index), value]);
    const rightChildren = isObject
      ? right.entries.map(({ key: childKey, value }) => [childKey, value])
      : right.items.map((value, index) => [String(index), value]);
    const leftMap = new Map(leftChildren);
    const rightMap = new Map(rightChildren);
    const keys = [
      ...leftChildren.map(([childKey]) => childKey),
      ...rightChildren.map(([childKey]) => childKey).filter((childKey) => !leftMap.has(childKey)),
    ];
    const open = isObject ? '{' : '[';
    const close = isObject ? '}' : ']';
    if (!keys.length) return line(`${field}${open}${close}${suffix}`, '', path);
    let html = line(`${field}${open}`, '', path);
    keys.forEach((childKey, index) => {
      const childPath = isObject ? `${path}.${childKey}` : `${path}[${childKey}]`;
      html += renderMergedDiff(
        leftMap.get(childKey),
        rightMap.get(childKey),
        childPath,
        isObject ? childKey : null,
        depth + 1,
        index < keys.length - 1,
      );
    });
    html += `<div class="merged-line" style="--indent:${indent}px">${close}${suffix}</div>`;
    return html;
  }
  const same = left.type === 'number' ? left.raw === right.raw : left.value === right.value;
  const value = stringify(left, 0);
  if (same) return line(`${field}<span>${escapeHtml(value)}</span>${suffix}`, '', path);
  return line(
    `${field}<span class="merged-before">${escapeHtml(value)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(stringify(right, 0))}</span>${suffix}`,
    'merged-changed',
    path,
  );
}
export function renderDiffByFormat(left, right, format) {
  if (format === 'toml') return renderTomlDiff(left, right);
  if (format === 'csv') return renderCsvDiff(left, right);
  if (format === 'jsonl' || format === 'ndjson') {
    const before = left.type === 'array' ? left.items : [left];
    const after = right.type === 'array' ? right.items : [right];
    const lines = [];
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      const a = before[index];
      const b = after[index];
      const oldText = a ? stringify(a, 0) : null;
      const newText = b ? stringify(b, 0) : null;
      const value =
        oldText === null
          ? `<span class="merged-added">${escapeHtml(newText)}</span>`
          : newText === null
            ? `<span class="merged-deleted">${escapeHtml(oldText)}</span>`
            : oldText === newText
              ? escapeHtml(oldText)
              : `<span class="merged-before">${escapeHtml(oldText)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(newText)}</span>`;
      lines.push(
        `<div class="merged-line ${oldText === null ? 'merged-added' : newText === null ? 'merged-deleted' : oldText === newText ? '' : 'merged-changed'}" data-path="$[${index}]"><pre>${value}</pre></div>`,
      );
    }
    return lines.join('');
  }
  if (format !== 'yaml') return renderMergedDiff(left, right);
  const rows = [];
  const scalar = (node) =>
    node.type === 'object'
      ? '{}'
      : node.type === 'array'
        ? '[]'
        : YAML.stringify(toPlain(node)).trim();
  const safeKey = (key) =>
    /^[\w-]+$/.test(String(key)) ? String(key) : JSON.stringify(String(key));
  const add = (text, path, depth, kind = '') =>
    rows.push(
      `<div class="merged-line ${kind}" data-path="${escapeHtml(path)}" style="--indent:${depth * 16}px"><pre>${text}</pre></div>`,
    );
  const walk = (a, b, path, key, depth, forced = '') => {
    const prefix = `${key === null ? '- ' : key === undefined ? '' : `${safeKey(key)}: `}`;
    if (!a || !b) {
      const node = a ?? b;
      const kind = a ? 'merged-deleted' : 'merged-added';
      if (node.type === 'object' || node.type === 'array') {
        const pairs =
          node.type === 'object'
            ? node.entries.map(({ key: k, value }) => [k, value])
            : node.items.map((value, i) => [String(i), value]);
        if (key !== undefined) add(escapeHtml(prefix.trimEnd()), path, depth, kind);
        if (!pairs.length)
          add(`${escapeHtml(prefix)}${node.type === 'object' ? '{}' : '[]'}`, path, depth, kind);
        pairs.forEach(([childKey, child]) =>
          walk(
            a ? child : undefined,
            b ? child : undefined,
            node.type === 'array' ? `${path}[${childKey}]` : `${path}.${childKey}`,
            node.type === 'array' ? null : childKey,
            depth + 1,
            kind,
          ),
        );
        return;
      }
    }
    if (!a || !b || a.type !== b.type || !['object', 'array'].includes(a.type)) {
      const before = a ? scalar(a) : null;
      const after = b ? scalar(b) : null;
      const same =
        a &&
        b &&
        a.type === b.type &&
        (a.type === 'number' ? a.raw === b.raw : a.value === b.value);
      const value = same
        ? escapeHtml(before)
        : before === null
          ? `<span class="merged-added">${escapeHtml(after)}</span>`
          : after === null
            ? `<span class="merged-deleted">${escapeHtml(before)}</span>`
            : `<span class="merged-before">${escapeHtml(before)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(after)}</span>`;
      add(
        `${escapeHtml(prefix)}${value}`,
        path,
        depth,
        same
          ? forced
          : before === null
            ? 'merged-added'
            : after === null
              ? 'merged-deleted'
              : 'merged-changed',
      );
      return;
    }
    const items = (n) =>
      n.type === 'object'
        ? n.entries.map(({ key: k, value }) => [k, value])
        : n.items.map((value, i) => [String(i), value]);
    const am = new Map(items(a));
    const bm = new Map(items(b));
    const keys = [...am.keys(), ...[...bm.keys()].filter((k) => !am.has(k))];
    if (key !== undefined) add(escapeHtml(prefix.trimEnd()), path, depth, forced);
    if (!keys.length)
      add(`${escapeHtml(prefix)}${a.type === 'object' ? '{}' : '[]'}`, path, depth, forced);
    keys.forEach((childKey) =>
      walk(
        am.get(childKey),
        bm.get(childKey),
        a.type === 'array' ? `${path}[${childKey}]` : `${path}.${childKey}`,
        a.type === 'array' ? null : childKey,
        depth + 1,
        !am.has(childKey) ? 'merged-added' : !bm.has(childKey) ? 'merged-deleted' : forced,
      ),
    );
  };
  walk(left, right, '$', undefined, 0);
  return rows.join('');
}
function tomlValue(node) {
  if (node.type === 'string') return JSON.stringify(node.value);
  if (node.type === 'number') return node.raw;
  if (node.type === 'boolean') return String(node.value);
  if (node.type === 'null') return '"null"';
  if (node.type === 'array') return `[${node.items.map(tomlValue).join(', ')}]`;
  return `{ ${node.entries.map(({ key, value }) => `${/^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key)} = ${tomlValue(value)}`).join(', ')} }`;
}
function renderTomlDiff(left, right) {
  const rows = [];
  const keyText = (key) =>
    /^[A-Za-z0-9_-]+$/.test(String(key)) ? String(key) : JSON.stringify(String(key));
  const add = (text, path, depth, kind = '') =>
    rows.push(
      `<div class="merged-line ${kind}" data-path="${escapeHtml(path)}" style="--indent:${depth * 16}px"><pre>${text}</pre></div>`,
    );
  const walk = (a, b, path, key, depth, forced = '') => {
    const prefix = key === undefined ? '' : `${keyText(key)} = `;
    if (
      !a ||
      !b ||
      a.type !== b.type ||
      !['object', 'array'].includes(a.type) ||
      a.type === 'array'
    ) {
      const before = a ? tomlValue(a) : null;
      const after = b ? tomlValue(b) : null;
      const same =
        a &&
        b &&
        a.type === b.type &&
        (a.type === 'number' ? a.raw === b.raw : a.value === b.value);
      const value = same
        ? escapeHtml(before)
        : before === null
          ? `<span class="merged-added">${escapeHtml(after)}</span>`
          : after === null
            ? `<span class="merged-deleted">${escapeHtml(before)}</span>`
            : `<span class="merged-before">${escapeHtml(before)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(after)}</span>`;
      add(
        `${escapeHtml(prefix)}${value}`,
        path,
        depth,
        same
          ? forced
          : before === null
            ? 'merged-added'
            : after === null
              ? 'merged-deleted'
              : 'merged-changed',
      );
      return;
    }
    const pairs = (n) => n.entries.map(({ key: k, value }) => [k, value]);
    const am = new Map(pairs(a));
    const bm = new Map(pairs(b));
    const keys = [...am.keys(), ...[...bm.keys()].filter((k) => !am.has(k))];
    if (key !== undefined) add(`[${path.slice(2)}]`, path, depth, forced);
    keys.forEach((childKey) =>
      walk(
        am.get(childKey),
        bm.get(childKey),
        `${path}.${childKey}`,
        childKey,
        depth + 1,
        !am.has(childKey) ? 'merged-added' : !bm.has(childKey) ? 'merged-deleted' : forced,
      ),
    );
  };
  walk(left, right, '$', undefined, 0);
  return rows.join('');
}
function renderCsvDiff(left, right) {
  const asRows = (node) => (node.type === 'array' ? node.items : [node]);
  const rowsA = asRows(left);
  const rowsB = asRows(right);
  const columns = [
    ...new Set(
      [...rowsA, ...rowsB].flatMap((row) =>
        row.type === 'object' ? row.entries.map(({ key }) => key) : ['值'],
      ),
    ),
  ];
  const fields = (row) =>
    row?.type === 'object'
      ? new Map(row.entries.map(({ key, value }) => [key, value]))
      : new Map(row ? [['值', row]] : []);
  const cell = (node) =>
    node
      ? node.type === 'string'
        ? node.value
        : node.type === 'number'
          ? node.raw
          : stringify(node, 0)
      : '';
  const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const line = (content, path, kind = '') =>
    `<div class="merged-line ${kind}" data-path="${escapeHtml(path)}"><pre>${content}</pre></div>`;
  const output = [line(columns.map(quote).join(','), '$')];
  for (let index = 0; index < Math.max(rowsA.length, rowsB.length); index += 1) {
    const a = fields(rowsA[index]);
    const b = fields(rowsB[index]);
    const values = columns.map((column) => {
      const before = a.get(column);
      const after = b.get(column);
      if (!before) return `<span class="merged-added">${escapeHtml(quote(cell(after)))}</span>`;
      if (!after) return `<span class="merged-deleted">${escapeHtml(quote(cell(before)))}</span>`;
      if (cell(before) === cell(after)) return escapeHtml(quote(cell(before)));
      return `<span class="merged-before">${escapeHtml(quote(cell(before)))}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(quote(cell(after)))}</span>`;
    });
    output.push(
      line(
        values.join(','),
        `$[${index}]`,
        index >= rowsA.length ? 'merged-added' : index >= rowsB.length ? 'merged-deleted' : '',
      ),
    );
  }
  return output.join('');
}
