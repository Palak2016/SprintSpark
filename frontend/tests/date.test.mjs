import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const dateUtilityUrl = new URL('../src/utils/date.ts', import.meta.url);
const dateUtilitySource = await readFile(dateUtilityUrl, 'utf8');
const { outputText } = ts.transpileModule(dateUtilitySource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const dateUtility = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('parses UTC and explicit offsets as the same instant', () => {
  const utc = dateUtility.parseIndianDateTime('2026-10-17T12:57:00Z');
  const indiaOffset = dateUtility.parseIndianDateTime(
    '2026-10-17T18:27:00+05:30'
  );
  const numericOffset = dateUtility.parseIndianDateTime(
    '2026-10-17T08:57:00-04:00'
  );

  assert.equal(utc?.toISOString(), '2026-10-17T12:57:00.000Z');
  assert.equal(indiaOffset?.getTime(), utc?.getTime());
  assert.equal(numericOffset?.getTime(), utc?.getTime());
});

test('interprets legacy timezone-naive API timestamps as UTC', () => {
  const parsed = dateUtility.parseIndianDateTime('2026-10-17T12:57:00');

  assert.equal(parsed?.toISOString(), '2026-10-17T12:57:00.000Z');
  assert.equal(dateUtility.formatIndianTime('2026-10-17T12:57:00'), '06:27 pm');
  assert.equal(dateUtility.formatIndianTime('2026-10-17T16:58:00Z'), '10:28 pm');
});

test('formats notification and activity timestamps in IST', () => {
  const value = '2026-10-17T12:57:00+00:00';

  assert.equal(dateUtility.formatIndianTime(value), '06:27 pm');
  assert.match(dateUtility.formatIndianDateTime(value), /06:27 pm$/);
});

test('keeps date-only values on their original calendar day', () => {
  const parsed = dateUtility.parseIndianDateTime('2026-10-17');

  assert.equal(parsed?.toISOString(), '2026-10-17T06:30:00.000Z');
  assert.equal(dateUtility.formatIndianDate('2026-10-17'), '17 Oct 2026');
});

test('returns null and the display placeholder for empty or invalid values', () => {
  for (const value of [null, undefined, '', 'not-a-date', '2026-02-30']) {
    assert.equal(dateUtility.parseIndianDateTime(value), null);
    assert.equal(dateUtility.formatIndianDate(value), '—');
  }
});
