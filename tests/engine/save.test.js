import test from 'node:test';
import assert from 'node:assert/strict';
import { mk, mem } from './helpers.js';
import { deserialize, serialize, SaveError, createSaveManager, SAVE_KEY } from '../../src/save/save.js';

test('roundtrip via storage', () => {
  const st = mem();
  const g = mk(5, { storage: st });
  g.advance(1234);
  assert.ok(g.save().ok);
  assert.ok(st.getItem(SAVE_KEY));
  const h = mk(99, { storage: st });
  assert.equal(h.load(), true);
  assert.deepEqual(h.state, g.state);
});
test('corrupt saves throw SaveError, load returns false', () => {
  assert.throws(() => deserialize('{bad'), SaveError);
  assert.throws(() => deserialize(JSON.stringify({ v: 1, state: { player: {} } })), SaveError);
  const st = mem(); st.setItem(SAVE_KEY, 'xx');
  assert.equal(mk(1, { storage: st }).load(), false);
  assert.equal(mk(1, { storage: mem() }).load(), false);
});
test('export/import with chinese name', () => {
  const g = mk();
  g.newGame({ seed: 4, name: '云梦子' });
  const s = g.exportSave();
  const h = mk(8);
  assert.ok(h.importSave(s).ok);
  assert.equal(h.state.player.name, '云梦子');
  assert.equal(h.importSave('garbage').ok, false);
  assert.throws(() => createSaveManager(mem()).importString('x'), SaveError);
});
test('serialize drops nothing', () => {
  const g = mk();
  assert.deepEqual(deserialize(serialize(g.state)), g.state);
});
