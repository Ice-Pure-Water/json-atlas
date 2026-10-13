function parentPath(path) {
  if (path === '$') return null;
  const separator = Math.max(path.lastIndexOf('.'), path.lastIndexOf('['));
  return separator > 0 ? path.slice(0, separator) : '$';
}

export function scanJsonPathLocations(text) {
  const locations = new Map();
  let index = 0;
  const skipWhitespace = () => {
    while (/\s/.test(text[index] ?? '')) index += 1;
  };
  const readString = () => {
    const start = index;
    if (text[index] !== '"') throw new SyntaxError('Expected a JSON string');
    index += 1;
    while (index < text.length) {
      if (text[index] === '\\') {
        index += 2;
        continue;
      }
      if (text[index++] === '"')
        return { value: JSON.parse(text.slice(start, index)), start, end: index };
    }
    throw new SyntaxError('Unterminated JSON string');
  };
  const readValue = (path, keyLocation = null) => {
    skipWhitespace();
    const start = index;
    if (text[index] === '{') {
      index += 1;
      skipWhitespace();
      while (text[index] !== '}' && index < text.length) {
        const key = readString();
        skipWhitespace();
        if (text[index++] !== ':') throw new SyntaxError('Expected a colon');
        readValue(`${path}.${key.value}`, { from: key.start, to: key.end });
        skipWhitespace();
        if (text[index] === ',') {
          index += 1;
          skipWhitespace();
        } else if (text[index] !== '}') throw new SyntaxError('Expected a comma or closing brace');
      }
      if (text[index++] !== '}') throw new SyntaxError('Expected a closing brace');
    } else if (text[index] === '[') {
      index += 1;
      skipWhitespace();
      let item = 0;
      while (text[index] !== ']' && index < text.length) {
        readValue(`${path}[${item++}]`);
        skipWhitespace();
        if (text[index] === ',') {
          index += 1;
          skipWhitespace();
        } else if (text[index] !== ']')
          throw new SyntaxError('Expected a comma or closing bracket');
      }
      if (text[index++] !== ']') throw new SyntaxError('Expected a closing bracket');
    } else if (text[index] === '"') {
      readString();
    } else {
      while (index < text.length && !/[\s,}\]]/.test(text[index])) index += 1;
      if (index === start) throw new SyntaxError('Expected a JSON value');
    }
    locations.set(path, {
      from: keyLocation?.from ?? start,
      to: keyLocation?.to ?? Math.min(index, start + 1),
    });
  };

  try {
    skipWhitespace();
    readValue('$');
  } catch {
    // Keep locations found before an incomplete edit so cursor navigation still works.
  }
  return locations;
}

export function locateJsonPath(text, path) {
  const locations = scanJsonPathLocations(text);
  let candidate = path;
  while (candidate && !locations.has(candidate)) candidate = parentPath(candidate);
  return candidate ? { path: candidate, ...locations.get(candidate) } : null;
}

export function pathAtJsonPosition(text, position) {
  const locations = scanJsonPathLocations(text);
  const entries = [...locations.entries()];
  const direct = entries
    .filter(([, location]) => position >= location.from && position <= location.to)
    .sort((left, right) => left[1].to - left[1].from - (right[1].to - right[1].from));
  if (direct.length) return direct[0][0];

  const lineStart = text.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const lineEndIndex = text.indexOf('\n', position);
  const lineEnd = lineEndIndex < 0 ? text.length : lineEndIndex;
  const onLine = entries
    .filter(([, location]) => location.from >= lineStart && location.from <= lineEnd)
    .sort((left, right) => Math.abs(left[1].from - position) - Math.abs(right[1].from - position));
  return onLine[0]?.[0] ?? null;
}
