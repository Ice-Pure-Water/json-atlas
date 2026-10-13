import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../src/core.js';
import {
  nearestContainerPath,
  renamePathKey,
  renderColumns,
  replacePath,
} from '../src/workbench/data-views.js';

test('path columns retain the full ancestry and mark the selected node', () => {
  const source = parseInput(
    JSON.stringify({
      level1: { level2: { level3: { level4: { level5: { value: true } } } } },
    }),
    'json',
  );
  const selectedPath = '$.level1.level2.level3.level4.level5';
  const html = renderColumns(source, selectedPath, '', selectedPath);

  assert.equal((html.match(/class="path-column"/g) ?? []).length, 6);
  assert.ok(html.includes(`class="path-item selected" data-selected-path="${selectedPath}"`));
});

test('replacePath immutably updates object and array values by JSON path', () => {
  const source = {
    type: 'object',
    entries: [
      {
        key: 'items',
        value: {
          type: 'array',
          items: [
            {
              type: 'object',
              entries: [{ key: 'enabled', value: { type: 'boolean', value: false } }],
            },
          ],
        },
      },
    ],
  };
  const replacement = { type: 'boolean', value: true };

  const result = replacePath(source, '$.items[0].enabled', replacement);

  assert.notEqual(result, source);
  assert.equal(result.entries[0].value.items[0].entries[0].value, replacement);
  assert.equal(source.entries[0].value.items[0].entries[0].value.value, false);
});

test('replacePath returns the original tree when the path does not exist', () => {
  const source = {
    type: 'object',
    entries: [{ key: 'value', value: { type: 'number', raw: '1' } }],
  };
  assert.equal(replacePath(source, '$.missing', { type: 'null' }), source);
});

test('renamePathKey immutably renames an object field and rejects duplicates', () => {
  const source = {
    type: 'object',
    entries: [
      { key: 'oldName', value: { type: 'string', value: 'value' } },
      { key: 'existing', value: { type: 'boolean', value: true } },
    ],
  };
  const renamed = renamePathKey(source, '$.oldName', 'newName');
  assert.deepEqual(
    renamed.entries.map(({ key }) => key),
    ['newName', 'existing'],
  );
  assert.deepEqual(
    source.entries.map(({ key }) => key),
    ['oldName', 'existing'],
  );
  assert.throws(() => renamePathKey(source, '$.oldName', 'existing'), /已存在/);
});

test('nearestContainerPath maps primitive paths to the closest graph card', () => {
  const source = {
    type: 'object',
    entries: [
      {
        key: 'config',
        value: {
          type: 'object',
          entries: [{ key: 'enabled', value: { type: 'boolean', value: true } }],
        },
      },
    ],
  };
  assert.equal(nearestContainerPath(source, '$.config.enabled'), '$.config');
  assert.equal(nearestContainerPath(source, '$.config'), '$.config');
});
