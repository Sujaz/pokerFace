const test = require('node:test');
const assert = require('node:assert/strict');

const { generateId } = require('../utils/ids');

test('generateId prefixes the identifier', () => {
  const id = generateId('session');
  assert.ok(id.startsWith('session-'));
});

test('generateId produces reasonably unique values', () => {
  const ids = new Set(Array.from({ length: 100 }, () => generateId('player')));
  assert.equal(ids.size, 100);
});
