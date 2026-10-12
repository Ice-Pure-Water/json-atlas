import YAML from 'yaml';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import Papa from 'papaparse';
import { parse as parseLossless, isLosslessNumber } from 'lossless-json';

export function fromJs(value) {
  if (value === null) return { type: 'null', value: null };
  if (isLosslessNumber(value)) return { type: 'number', raw: value.toString() };
  if (typeof value === 'bigint') return { type: 'number', raw: value.toString() };
  if (value instanceof Date) return { type: 'string', value: value.toISOString() };
  if (Array.isArray(value)) return { type: 'array', items: value.map(fromJs) };
  if (typeof value === 'object')
    return {
      type: 'object',
      entries: Object.entries(value).map(([key, item]) => ({ key, value: fromJs(item) })),
    };
  if (typeof value === 'number') return { type: 'number', raw: String(value) };
  if (typeof value === 'boolean') return { type: 'boolean', value };
  return { type: 'string', value: String(value) };
}

export function parseJson(text) {
  const parsed = parseLossless(text);
  return { root: fromJs(parsed), end: text.length };
}

function findJsonEnd(text, start) {
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      const open = stack.pop();
      if ((char === '}' && open !== '{') || (char === ']' && open !== '[')) return -1;
      if (!stack.length) return index + 1;
    }
  }
  return -1;
}

export function expandNested(node, depthLimit = 25, depth = 0) {
  if (node.type === 'object')
    return {
      ...node,
      entries: node.entries.map(({ key, value }) => ({
        key,
        value: expandNested(value, depthLimit, depth),
      })),
    };
  if (node.type === 'array')
    return { ...node, items: node.items.map((item) => expandNested(item, depthLimit, depth)) };
  if (node.type !== 'string' || depth >= depthLimit) return node;
  const candidate = node.value.trim();
  if (!(candidate.startsWith('{') || candidate.startsWith('['))) return node;
  try {
    const parsed = parseJson(candidate);
    if (parsed.end !== candidate.length || !['object', 'array'].includes(parsed.root.type))
      return node;
    return expandNested(parsed.root, depthLimit, depth + 1);
  } catch {
    return node;
  }
}

export function parseInput(text, format = 'json') {
  if (format === 'json') {
    const parsed = parseJson(text);
    return parsed.root;
  }
  if (format === 'yaml') return fromJs(YAML.parse(text, { intAsBigInt: true }));
  if (format === 'toml') return fromJs(parseToml(text, { integersAsBigInt: 'asNeeded' }));
  if (format === 'csv') {
    const rows = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    }).data;
    return fromJs(rows);
  }
  if (format === 'jsonl' || format === 'ndjson') {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    return {
      type: 'array',
      items: lines.map((line, index) => {
        try {
          return parseJson(line).root;
        } catch (error) {
          throw new SyntaxError(`第 ${index + 1} 行：${error.message}`);
        }
      }),
    };
  }
  if (format === 'log') {
    const found = [];
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] !== '{' && text[i] !== '[') continue;
      try {
        const end = findJsonEnd(text, i);
        if (end < 0) continue;
        const { root } = parseJson(text.slice(i, end));
        found.push({
          type: 'object',
          entries: [
            { key: '原文起始位置', value: { type: 'number', raw: String(i + 1) } },
            { key: 'payload', value: root },
          ],
        });
        i = end - 1;
      } catch {
        /* Ignore braces that are ordinary log text. */
      }
    }
    if (!found.length) throw new SyntaxError('没有找到完整的 JSON 对象或数组');
    return { type: 'array', items: found };
  }
  throw new Error('不支持的格式');
}

export function stringify(node, indent = 2, depth = 0) {
  if (indent === 0) {
    if (node.type === 'string') return JSON.stringify(node.value);
    if (node.type === 'number') return node.raw;
    if (node.type === 'boolean') return String(node.value);
    if (node.type === 'null') return 'null';
    if (node.type === 'object')
      return `{${node.entries.map(({ key, value }) => `${JSON.stringify(key)}:${stringify(value, 0)}`).join(',')}}`;
    return `[${node.items.map((value) => stringify(value, 0)).join(',')}]`;
  }
  const pad = (level) => ' '.repeat(level * indent);
  if (node.type === 'string') return JSON.stringify(node.value);
  if (node.type === 'number') return node.raw;
  if (node.type === 'boolean') return String(node.value);
  if (node.type === 'null') return 'null';
  const children =
    node.type === 'object'
      ? node.entries.map(
          ({ key, value }) =>
            `${pad(depth + 1)}${JSON.stringify(key)}: ${stringify(value, indent, depth + 1)}`,
        )
      : node.items.map((item) => `${pad(depth + 1)}${stringify(item, indent, depth + 1)}`);
  if (!children.length) return node.type === 'object' ? '{}' : '[]';
  return `${node.type === 'object' ? '{' : '['}\n${children.join(',\n')}\n${pad(depth)}${node.type === 'object' ? '}' : ']'}`;
}

export function toPlain(node) {
  if (node.type === 'object')
    return Object.fromEntries(node.entries.map(({ key, value }) => [key, toPlain(value)]));
  if (node.type === 'array') return node.items.map(toPlain);
  if (node.type === 'number') {
    if (/^-?(?:0|[1-9]\d*)$/.test(node.raw)) {
      const asNumber = Number(node.raw);
      return Number.isSafeInteger(asNumber) ? asNumber : BigInt(node.raw);
    }
    return Number(node.raw);
  }
  return node.value;
}

export function serializeNode(node, format = 'json') {
  const plain = toPlain(node);
  if (format === 'yaml') return YAML.stringify(plain, { indent: 2 });
  if (format === 'toml') {
    if (node.type !== 'object') throw new TypeError('TOML 只能导出对象根节点');
    const nullPath = findNullPath(node);
    if (nullPath) throw new TypeError(`TOML 不支持 null：${nullPath}`);
    return stringifyToml(plain);
  }
  if (format === 'jsonl' || format === 'ndjson') {
    const rows = node.type === 'array' ? node.items : [node];
    return rows.map((item) => stringify(item, 0)).join('\n');
  }
  if (format === 'csv') return Papa.unparse(Array.isArray(plain) ? plain : flatten(node));
  if (format === 'log') return stringify(node, 2);
  if (format === 'json') return stringify(node, 2);
  throw new Error(`不支持导出格式：${format}`);
}

function findNullPath(node, path = '$') {
  if (node.type === 'null') return path;
  if (node.type === 'object') {
    for (const { key, value } of node.entries) {
      const found = findNullPath(value, `${path}.${key}`);
      if (found) return found;
    }
  }
  if (node.type === 'array') {
    for (let index = 0; index < node.items.length; index += 1) {
      const found = findNullPath(node.items[index], `${path}[${index}]`);
      if (found) return found;
    }
  }
  return null;
}

export function flatten(node, prefix = '$', rows = []) {
  if (node.type === 'object')
    node.entries.forEach(({ key, value }) => flatten(value, `${prefix}.${key}`, rows));
  else if (node.type === 'array')
    node.items.forEach((value, index) => flatten(value, `${prefix}[${index}]`, rows));
  else rows.push({ path: prefix, value: node.type === 'number' ? node.raw : node.value });
  return rows;
}

export function diffNodes(a, b, path = '$', changes = []) {
  if (a.type !== b.type) {
    changes.push({ path, kind: '修改', before: stringify(a, 0), after: stringify(b, 0) });
    return changes;
  }
  if (a.type === 'object') {
    const left = new Map(a.entries.map((entry) => [entry.key, entry.value]));
    const right = new Map(b.entries.map((entry) => [entry.key, entry.value]));
    for (const [key, value] of left) {
      if (!right.has(key))
        changes.push({
          path: `${path}.${key}`,
          kind: '删除',
          before: stringify(value, 0),
          after: '—',
        });
      else diffNodes(value, right.get(key), `${path}.${key}`, changes);
    }
    for (const [key, value] of right)
      if (!left.has(key))
        changes.push({
          path: `${path}.${key}`,
          kind: '新增',
          before: '—',
          after: stringify(value, 0),
        });
  } else if (a.type === 'array') {
    const max = Math.max(a.items.length, b.items.length);
    for (let index = 0; index < max; index += 1) {
      if (!a.items[index])
        changes.push({
          path: `${path}[${index}]`,
          kind: '新增',
          before: '—',
          after: stringify(b.items[index], 0),
        });
      else if (!b.items[index])
        changes.push({
          path: `${path}[${index}]`,
          kind: '删除',
          before: stringify(a.items[index], 0),
          after: '—',
        });
      else diffNodes(a.items[index], b.items[index], `${path}[${index}]`, changes);
    }
  } else if ((a.type === 'number' ? a.raw : a.value) !== (b.type === 'number' ? b.raw : b.value)) {
    changes.push({
      path,
      kind: '修改',
      before: a.type === 'number' ? a.raw : String(a.value),
      after: b.type === 'number' ? b.raw : String(b.value),
    });
  }
  return changes;
}
