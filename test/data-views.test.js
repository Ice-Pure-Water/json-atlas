import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestContainerPath, replacePath } from '../src/workbench/data-views.js';

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
