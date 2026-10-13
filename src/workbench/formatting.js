import { expandNested, parseInput, serializeNode, stringify } from '../core.js';

export function formatFromName(name) {
  const ext = name.split('.').pop().toLowerCase();
  return (
    {
      jsonl: 'jsonl',
      ndjson: 'jsonl',
      yml: 'yaml',
      yaml: 'yaml',
      toml: 'toml',
      csv: 'csv',
      log: 'log',
      txt: 'log',
    }[ext] ?? 'json'
  );
}
export function formattedName(name, suffix = '.formatted.json') {
  const base = name.replace(/\.[^.]+$/, '').replace(/\.formatted$/, '');
  return `${base}${suffix}`;
}
export function formatEditorToJson(editor, format, depthLimit = 25) {
  return stringify(expandNested(parseInput(editor.value, format), depthLimit), 2);
}
export function convertEditorFormat(editor, oldFormat, nextFormat, depthLimit = 25) {
  if (!editor.value.trim()) return;
  editor.value = convertTextFormat(editor.value, oldFormat, nextFormat, depthLimit);
}
export function convertTextFormat(text, oldFormat, nextFormat, depthLimit = 25) {
  if (!text.trim()) return text;
  const parsed = expandNested(parseInput(text, oldFormat), depthLimit);
  return serializeNode(parsed, nextFormat);
}
export function extensionForFormat(format) {
  return (
    { jsonl: 'jsonl', ndjson: 'ndjson', log: 'log', yaml: 'yaml', toml: 'toml', csv: 'csv' }[
      format
    ] ?? 'json'
  );
}
export function autoFormatEditor(editor, format, depthLimit = 25) {
  if (!editor.value.trim()) return;
  const parsed = expandNested(parseInput(editor.value, format), depthLimit);
  editor.value = serializeNode(parsed, format);
}
