import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diffNodes,
  expandNested,
  flatten,
  parseInput,
  parseJson,
  serializeNode,
  stringify,
  toPlain,
} from '../src/core.js';

test('lossless JSON preserves integers outside the JavaScript safe range', () => {
  const root = parseJson('{"id":8000000000000000001}').root;
  assert.equal(stringify(root), '{\n  "id": 8000000000000000001\n}');
  assert.equal(flatten(root)[0].value, '8000000000000000001');
  assert.equal(toPlain(root).id, 8000000000000000001n);
});

test('nested expansion only parses complete JSON object and array strings', () => {
  const root = parseJson(
    JSON.stringify({
      config: JSON.stringify({ preferences: JSON.stringify({ color: 'blue', notices: true }) }),
      note: 'ordinary text { keep this }',
      partial: '{"valid":true} trailing text',
    }),
  ).root;
  const expanded = expandNested(root);
  assert.deepEqual(toPlain(expanded), {
    config: { preferences: { color: 'blue', notices: true } },
    note: 'ordinary text { keep this }',
    partial: '{"valid":true} trailing text',
  });
});

test('nested expansion obeys the configured depth limit', () => {
  const root = parseJson(
    JSON.stringify({ outer: JSON.stringify({ inner: JSON.stringify({ leaf: 1 }) }) }),
  ).root;
  assert.equal(expandNested(root, 1).entries[0].value.entries[0].value.type, 'string');
  assert.deepEqual(toPlain(expandNested(root, 2)), { outer: { inner: { leaf: 1 } } });
});

test('JSONL and NDJSON parse each non-empty line and report line numbers', () => {
  assert.deepEqual(toPlain(parseInput('{"a":1}\n\n{"b":2}', 'jsonl')), [{ a: 1 }, { b: 2 }]);
  assert.deepEqual(toPlain(parseInput('[1,2]\n{"ok":true}', 'ndjson')), [[1, 2], { ok: true }]);
  assert.throws(() => parseInput('{"a":1}\nnot-json', 'jsonl'), /第 2 行/);
});

test('log extraction ignores ordinary braces and extracts complete JSON values', () => {
  const root = parseInput(
    'start {not json} event {"id":8000000000000000001} list [1,true] end',
    'log',
  );
  assert.equal(root.items.length, 2);
  assert.equal(root.items[0].entries[0].value.raw, '24');
  assert.equal(root.items[0].entries[1].value.entries[0].value.raw, '8000000000000000001');
  assert.equal(root.items[1].entries[1].value.type, 'array');
  assert.throws(() => parseInput('no structured values here', 'log'), /没有找到/);
});

test('YAML, TOML, and CSV inputs produce the internal node model', () => {
  assert.deepEqual(toPlain(parseInput('id: 9007199254740993\nactive: true', 'yaml')), {
    id: 9007199254740993n,
    active: true,
  });
  assert.deepEqual(toPlain(parseInput('name = "Atlas"\ncount = 3', 'toml')), {
    name: 'Atlas',
    count: 3,
  });
  assert.deepEqual(toPlain(parseInput('name,count\nAtlas,3', 'csv')), [
    { name: 'Atlas', count: '3' },
  ]);
});

test('stringify preserves scalar types and supports compact output', () => {
  const root = parseJson('{"a":null,"b":false,"c":[1,"x"]}').root;
  const compact = stringify(root, 0);
  assert.equal(compact, '{"a":null,"b":false,"c":[1,"x"]}');
  assert.deepEqual(toPlain(parseJson(compact).root), { a: null, b: false, c: [1, 'x'] });
});

test('serialization emits JSON, YAML, TOML, JSONL, and CSV without losing large integer text', () => {
  const object = parseJson('{"id":8000000000000000001,"name":"Atlas"}').root;
  const json = serializeNode(object, 'json');
  assert.match(json, /8000000000000000001/);
  assert.equal(
    parseInput(serializeNode(object, 'yaml'), 'yaml').entries[0].value.raw,
    '8000000000000000001',
  );
  assert.equal(
    parseInput(serializeNode(object, 'toml'), 'toml').entries[0].value.raw,
    '8000000000000000001',
  );
  assert.equal(serializeNode(object, 'jsonl'), '{"id":8000000000000000001,"name":"Atlas"}');

  const records = parseJson('[{"name":"Atlas","count":2},{"name":"Field","count":3}]').root;
  const csv = serializeNode(records, 'csv');
  assert.deepEqual(toPlain(parseInput(csv, 'csv')), [
    { name: 'Atlas', count: '2' },
    { name: 'Field', count: '3' },
  ]);
});

test('TOML serialization rejects JSON values it cannot represent instead of dropping them', () => {
  assert.throws(
    () => serializeNode(parseJson('{"settings":{"value":null}}').root, 'toml'),
    /TOML 不支持 null：\$\.settings\.value/,
  );
  assert.throws(() => serializeNode(parseJson('[1,2]').root, 'toml'), /对象根节点/);
  assert.throws(() => parseJson('{broken'), /Quoted object key expected/);
});

test('diff reports additions, removals, type changes, and exact number changes', () => {
  const before = parseJson('{"keep":1,"remove":true,"nested":{"v":8000000000000000001}}').root;
  const after = parseJson('{"keep":1,"add":null,"nested":{"v":8000000000000000002}}').root;
  assert.deepEqual(
    diffNodes(before, after).map(({ path, kind }) => [path, kind]),
    [
      ['$.remove', '删除'],
      ['$.nested.v', '修改'],
      ['$.add', '新增'],
    ],
  );
});

test('flatten emits stable JSON paths for objects and arrays', () => {
  const root = parseJson('{"users":[{"id":1},null]}').root;
  assert.deepEqual(
    flatten(root).map(({ path, value }) => [path, value]),
    [
      ['$.users[0].id', '1'],
      ['$.users[1]', null],
    ],
  );
});
