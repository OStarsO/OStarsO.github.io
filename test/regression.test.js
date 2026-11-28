#!/usr/bin/env node
/* ============================================================
   regression.test.js — 核心纯函数回归测试（Node 直接运行）
   运行方式：node test/regression.test.js
   覆盖：概率合计、保底计数、幸运值、种子复现一致性、
        积分汇总、名单导入解析、按学号更新三模式。
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'core.js' });
const T = ctx.__core__;
if (!T) { console.error('FAIL: core.js 未挂载 __core__'); process.exit(1); }

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.error('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

console.log('== 概率 ==');
const d = T.defaultStars();
eq('默认概率合计 100', T.starsTotal(d), 100);
eq('负值钳制为 0', T.normalizeStars({ 5: -5, 4: 8, 3: 20, 2: 30, 1: 40 })[5], 0);
eq('超过 100 钳制为 100', T.normalizeStars({ 5: 250, 4: 8, 3: 20, 2: 30, 1: 40 })[5], 100);
eq('小数四舍五入', T.normalizeStars({ 5: 2.4, 4: 8, 3: 20, 2: 30, 1: 39.6 })[5], 2);
const pct = T.percentOf({ 5: 5, 4: 4, 3: 3, 2: 2, 1: 1 });
const pctSum = [5, 4, 3, 2, 1].reduce(function (a, k) { return a + pct[k]; }, 0);
ok('权重换算百分比合计 100（±0.001）', Math.abs(pctSum - 100) < 0.001, pctSum);
eq('权重 5★ 百分比', pct[5], 33.3333);
eq('空权重百分比全 0', T.percentOf({}), { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });

console.log('== 保底计数 ==');
eq('未达 49 抽、未出 5★ → 计数 +1', T.applyPity(10, 3, true).c5, 11);
eq('抽出 5★ → 计数清零', T.applyPity(10, 5, true).c5, 0);
eq('49 抽未出 5★ → 下一抽强制 5★', T.applyPity(49, 3, true), { c5: 0, forced: true });
eq('强制后计数归零', T.applyPity(49, 5, true).c5, 0);
eq('关闭保底 → 计数不变', T.applyPity(10, 3, false), { c5: 10, forced: false });
/* 模拟 55 连抽全 3★：第 50 抽（c5=49）强制 5★ 并清零 */
let c5 = 0, forcedAt = -1;
for (let i = 0; i < 55; i++) {
  const r = T.applyPity(c5, 3, true);
  c5 = r.c5;
  if (r.forced) forcedAt = i + 1;
}
ok('55 连 3★ 时第 50 抽触发强制', forcedAt === 50, { forcedAt });
eq('触发后重新计数', c5, 5);

console.log('== 幸运值 ==');
eq('未开启 → 0', T.luckBonus(30, false, 1), 0);
eq('步长 0 → 0', T.luckBonus(30, true, 0), 0);
eq('按未出 5★ 计数累加', T.luckBonus(30, true, 1), 30);
eq('封顶 60', T.luckBonus(80, true, 1), 60);

console.log('== 种子复现一致性 ==');
const a1 = T.seedSeq('class-2026', 8), a2 = T.seedSeq('class-2026', 8);
eq('相同种子两次序列完全一致', a1, a2);
const b = T.seedSeq('another-seed', 8);
ok('不同种子序列不同', JSON.stringify(a1) !== JSON.stringify(b));
ok('哈希稳定（FNV-1a 32 位）', /^[0-9a-f]{8}$/.test(T.hashStr('class-2026')));
eq('哈希值可复现', T.hashStr('class-2026'), T.hashStr('class-2026'));
ok('随机数落在 [0,1)', a1.every(function (x) { return x >= 0 && x < 1; }));

console.log('== 积分汇总 ==');
const log = [
  { uid: 'p1', delta: 3 },
  { uid: 'p1', delta: -1 },
  { uid: 'p4', delta: 2 },
  { uid: 'p9', delta: 0 },          // 0 分应忽略
  { uid: '', delta: 5 },            // 无 uid 应忽略
  { uid: 'p4', delta: -2 }
];
const agg = T.aggregatePoints(log);
eq('p1 净分 +2', agg.net.p1, 2);
eq('p4 净分 0', agg.net.p4, 0);
eq('p1 加分合计 3', agg.byUid.p1.pos, 3);
eq('p1 扣分合计 -1', agg.byUid.p1.neg, -1);
eq('p1 加分次数 1', agg.byUid.p1.posN, 1);
eq('p1 扣分次数 1', agg.byUid.p1.negN, 1);
eq('总加分 5', agg.pos, 5);
eq('总扣分 -3', agg.neg, -3);
const empty = T.aggregatePoints([]);
eq('空流水 → 空汇总', empty.net, {});

console.log('== 导入解析 ==');
const text = [
  '姓名,学号,分组',
  '张三,2024001,一班',
  '李四，2024002，二班',
  '',
  '王五 2024003 三班',
  '张三,2024001,一班',            // 文件内学号重复 → 跳过
  '赵六,2024009,C',               // 新学号 → 追加
  '2024004',                      // 仅一个词 → 视为姓名（与 app 行为一致）
  '   '                           // 空白行
].join('\n');
const parsed = T.parseImportLines(text, [], []);
eq('有效行数 5', parsed.rows.length, 5);
eq('文件内学号重复跳过 1', parsed.dupeIds.length, 1);
eq('无姓名行 0（单词行视为姓名）', parsed.bad.length, 0);
eq('空行 2（空串与纯空白）', parsed.blank, 2);
eq('首行姓名', parsed.rows[0].name, '张三');
eq('中文逗号分隔', parsed.rows[1].name, '李四');
eq('空格分隔三列', parsed.rows[2].name, '王五');
eq('新学号行分组', parsed.rows[3].group, 'C');
eq('单词行视为姓名', parsed.rows[4].name, '2024004');

console.log('== 按学号更新（三模式） ==');
const roster = [
  { uid: 'p1', name: '张三旧', id: '2024001', group: '旧组', order: 1 },
  { uid: 'p2', name: '李四', id: '2024002', group: 'A', order: 2 }
];
const rows = [
  { name: '张三新', id: '2024001', group: '新组' },   // 模式 1：学号已存在 → 更新
  { name: '王五', id: '2024009', group: 'B' },        // 模式 2：新学号 → 追加
  { name: '李四', id: '' },                           // 模式 3：空学号 → 追加（且与名单同名 → 重名提示）
  { name: '李四', id: '2024002' }                     // 同名同学号 → 更新（不算重名）
];
const plan = T.planBySidUpdate(rows, roster);
eq('更新 2 条', plan.updates.length, 2);
eq('追加 2 条', plan.adds.length, 2);
eq('重名提示 1（李四空学号且同名已存在）', plan.dupNames.length, 1);
eq('更新目标 uid', plan.updates[0].uid, 'p1');
eq('更新姓名', plan.updates[0].name, '张三新');
eq('更新分组', plan.updates[0].group, '新组');
eq('追加保留学号', plan.adds[0].id, '2024009');
eq('空学号追加为空', plan.adds[1].id, '');
eq('空学号追加姓名', plan.adds[1].name, '李四');
/* 应用计划，验证与 handler 行为一致 */
const after = roster.map(function (p) { return Object.assign({}, p); });
plan.updates.forEach(function (u) {
  const p = after.find(function (x) { return x.uid === u.uid; });
  if (u.name) p.name = u.name;
  if (u.group) p.group = u.group;
});
plan.adds.forEach(function (a2) {
  after.push({ uid: 'new' + after.length, name: a2.name, id: a2.id, group: a2.group, drawn: false, count: 0, order: after.length + 1 });
});
eq('应用后人数 4', after.length, 4);
eq('应用后张三姓名', after[0].name, '张三新');
eq('应用后张三分组', after[0].group, '新组');
eq('新增王五在末尾', after[2].name, '王五');
eq('新增李四无学号', after[3].id, '');
eq('新增李四姓名', after[3].name, '李四');

console.log('');
console.log('结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
