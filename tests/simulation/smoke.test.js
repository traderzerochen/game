// 骨架冒烟测试（lead）。正式的整体模拟测试见 sim.test.js（阶段 1 结束后加入）。
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../../src/data/index.js';
import { createRng } from '../../src/core/rng.js';

test('data loads and realms have 15 stages', () => {
  assert.equal(DATA.realms.length, 15);
  DATA.realms.forEach((r, i) => assert.equal(r.stage, i));
});

test('rng is deterministic', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const r = createRng('seed');
  for (let i = 0; i < 1000; i++) { const x = r.int(1, 6); assert.ok(x >= 1 && x <= 6); }
});
