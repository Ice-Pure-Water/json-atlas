import test from 'node:test';
import assert from 'node:assert/strict';
import { locateJsonPath, pathAtJsonPosition } from '../src/workbench/path-locations.js';

test('JSON source locations follow nested object and array paths', () => {
  const source = '{\n  "config": {\n    "items": [\n      { "color": "blue" }\n    ]\n  }\n}';
  const color = locateJsonPath(source, '$.config.items[0].color');
  assert.equal(source.slice(color.from, color.to), '"color"');
  assert.equal(pathAtJsonPosition(source, color.from + 2), '$.config.items[0].color');
});

test('nested JSON encoded as a string falls back to the visible source parent', () => {
  const source = '{\n  "config": "{\\"color\\":\\"blue\\"}"\n}';
  const location = locateJsonPath(source, '$.config.color');
  assert.equal(location.path, '$.config');
  assert.equal(source.slice(location.from, location.to), '"config"');
});

test('JSON source navigation handles escaped property names', () => {
  const source = '{\n  "user\\\"name": {\n    "enabled": true\n  }\n}';
  const location = locateJsonPath(source, '$.user"name.enabled');
  assert.equal(source.slice(location.from, location.to), '"enabled"');
});
