# Format behavior

All formats are parsed into the tagged data model described in [ARCHITECTURE.md](ARCHITECTURE.md). Format conversion is a data conversion: target formats may not represent every source type.

## JSON

JSON parsing uses `lossless-json`. Integer and decimal tokens are retained as their original text, so JSON formatting and compact output do not round large values. When converting to formats that use JavaScript values, integers outside the safe range are represented internally as `BigInt` where supported by the target library.

## Nested JSON strings

Expansion walks objects and arrays and examines string values. A trimmed string expands only if it parses completely as a JSON object or array. For example:

```json
{ "config": "{\"city\":\"Suzhou\"}", "note": "text { not JSON }" }
```

becomes an object under `config`; `note` remains an ordinary string. A scalar string such as `"42"` is not expanded. The depth setting limits recursive expansion.

## JSONL and NDJSON

Each non-empty input line must be one valid JSON value. Blank lines are ignored. Errors report a one-based line number. When serializing an array, each item is emitted on its own line; a non-array root is emitted as one line.

## YAML

YAML uses the `yaml` package with `intAsBigInt` enabled. YAML has tags, aliases, and scalar rules that differ from JSON. Conversion to/from the internal JSON-like model does not preserve YAML comments, anchors, or tag syntax.

## TOML

TOML uses `smol-toml`. TOML does not support `null`, and its allowed root/table/value shapes differ from JSON. Export requires an object root and rejects `null` with its JSON path instead of silently omitting the field. Other unsupported values are reported by the TOML serializer.

## CSV

CSV is parsed with a header row and `dynamicTyping: false`, so imported cells are strings. Empty lines are skipped. Export of arrays of objects creates tabular records; nested values cannot be represented as native CSV structures and are converted to cell text. A non-tabular node is flattened into path/value rows.

## Mixed logs

The log parser scans for balanced JSON object and array candidates while respecting quoted strings and escapes. Invalid brace groups are skipped. Each result contains `原文起始位置` (one-based character offset) and `payload`. Offsets count JavaScript string positions, not UTF-8 bytes.

## Diff semantics

Diff compares node types, object keys, array indexes, and scalar values. Object order does not affect the structural diff. Arrays are compared positionally; inserts or removals can therefore appear as changes at following indexes. Number tokens are compared by their original spelling, so `1` and `1.0` are treated as distinct values.
