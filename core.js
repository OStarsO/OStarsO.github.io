/* ============================================================
   core.js — 纯函数集合（无 DOM / 无全局 state 依赖）
   供 app.js 与 Node 回归测试（test/regression.test.js）共用；
   通过 window.__core__ / globalThis.__core__ 暴露，
   并在 app.js 内挂到 window.__test__ 供浏览器控制台调试。
   ============================================================ */
(function () {
  'use strict';

  var api = {};

  /* ---------- 概率 ---------- */
  function clamp100(v) {
    v = Math.round(Number(v) || 0);
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
  }
  function normalizeStars(o) {
    var out = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (o && typeof o === 'object') {
      for (var k = 5; k >= 1; k--) out[k] = clamp100(o[k]);
    } else {
      out = { 5: 2, 4: 8, 3: 20, 2: 30, 1: 40 };
    }
    return out;
  }
  function defaultStars() { return { 5: 2, 4: 8, 3: 20, 2: 30, 1: 40 }; }
  function starsTotal(stars) {
    var s = 0, st = normalizeStars(stars);
    for (var k = 5; k >= 1; k--) s += st[k];
    return s;
  }
  /* 把权重换算为 1–5★ 百分比（保留 4 位小数），空权重返回全 0 */
  function percentOf(weights) {
    var w = normalizeStars(weights), total = starsTotal(w), out = {};
    for (var k = 5; k >= 1; k--) out[k] = total > 0 ? Number((w[k] / total * 100).toFixed(4)) : 0;
    return out;
  }

  /* ---------- 保底 / 幸运值 ---------- */
  /* 五星保底：c5 为当前未出 5★ 计数；返回 {c5: 新计数, forced: 是否触发 50 抽保底} */
  function applyPity(c5, star, fiftyFive) {
    c5 = Math.max(0, Math.min(999, Math.round(Number(c5) || 0)));
    if (!fiftyFive) return { c5: c5, forced: false };
    if (c5 >= 49) return { c5: 0, forced: true };
    if (star === 5) return { c5: 0, forced: false };
    return { c5: Math.min(999, c5 + 1), forced: false };
  }
  /* 幸运值加成：每连续未出 5★ 一抽，5★ 权重 +luckyStep，封顶 60 */
  function luckBonus(c5, lucky, step) {
    if (!lucky || !(step > 0)) return 0;
    return Math.min(60, step * Math.max(0, Number(c5) || 0));
  }

  /* ---------- 种子随机（mulberry32，与 app.js startSeed/seedRng 完全一致） ---------- */
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  function createRng(seed) {
    var state = parseInt(hashStr(seed), 16) >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* 便捷：给定种子生成 n 个随机数（复现验证用） */
  function seedSeq(seed, n) {
    var rng = createRng(seed), out = [];
    for (var i = 0; i < n; i++) out.push(rng());
    return out;
  }

  /* ---------- 积分汇总 ---------- */
  /* log: [{uid, delta, ...}]；返回 {byUid:{uid:{pos,neg,posN,negN,n}}, net:{uid:净值}, pos, neg} */
  function aggregatePoints(log) {
    var byUid = {}, net = {}, pos = 0, neg = 0;
    (log || []).forEach(function (r) {
      if (!r || !r.uid) return;
      var d = Math.round(Number(r.delta) || 0);
      if (!d) return;
      var a = byUid[r.uid] || (byUid[r.uid] = { pos: 0, neg: 0, posN: 0, negN: 0, n: 0 });
      a.n++;
      if (d > 0) { a.pos += d; a.posN++; pos += d; }
      else { a.neg += d; a.negN++; neg += d; }
      net[r.uid] = (net[r.uid] || 0) + d;
    });
    return { byUid: byUid, net: net, pos: pos, neg: neg };
  }

  /* ---------- 名单导入解析（CSV / TSV / 空格分隔，纯文本） ---------- */
  function cleanCell(s) {
    var t = String(s == null ? '' : s).trim();
    t = t.replace(/^[\s"'“”‘’「」『』]+/, '').replace(/[\s"'“”‘’「」『』]+$/, '');
    return t.trim();
  }
  var HEAD_WORDS = /^(姓名|名字|学生|学生姓名|学号|编号|序号|班级|分组|组别|备注|name|names|student|students|id|ids|no|no\.|number|group|class|team)$/i;
  function isHeaderRow(parts) {
    var filled = parts.filter(function (x) { return String(x || '').trim() !== ''; });
    if (!filled.length) return false;
    return filled.every(function (x) { return HEAD_WORDS.test(String(x).trim()); });
  }
  function parseImportLines(text, existingIds, existingNames) {
    var rows = [], dupeIds = [], dupeNames = [], bad = [], blank = 0;
    var seen = {}, nameCount = {};
    (existingIds || []).forEach(function (id) { if (id) seen[String(id).toLowerCase()] = 1; });
    (existingNames || []).forEach(function (nm) {
      var k = String(nm || '').trim();
      if (k) nameCount[k] = (nameCount[k] || 0) + 1;
    });
    String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .split(/\r?\n/)
      .forEach(function (line, li) {
        var raw = line.trim();
        if (!raw) { blank++; return; }
        var s = raw.replace(/[,，;；、\t]+$/, '');
        var parts;
        if (/\t/.test(s)) {
          parts = s.split('\t').map(function (x) { return x.trim(); });
        } else {
          parts = s.split(/[,，;；、]+/);
          if (parts.length <= 1) {
            var t2 = s.trim();
            if (/\s{2,}/.test(t2)) {
              parts = t2.split(/\s{2,}/);
            } else {
              var sp = t2.split(/\s+/);
              if (sp.length >= 2 && /^\d{2,}$/.test(sp[1])) parts = [sp[0], sp[1], sp.slice(2).join(' ')];
              else if (sp.length === 3) parts = sp;
            }
          }
        }
        if (isHeaderRow(parts)) return;
        var name = cleanCell(parts[0] || '');
        var id = cleanCell(parts[1] || '');
        var group = cleanCell(parts[2] || '');
        if (!name) { bad.push({ line: li + 1, raw: raw }); return; }
        if (name.length > 20) name = name.slice(0, 20);
        if (id) {
          var key = id.toLowerCase();
          if (seen[key]) { dupeIds.push({ line: li + 1, name: name, id: id }); return; }
          seen[key] = 1;
        }
        if (nameCount[name]) dupeNames.push({ line: li + 1, name: name });
        nameCount[name] = (nameCount[name] || 0) + 1;
        if (group.length > 12) group = group.slice(0, 12);
        rows.push({ name: name, id: id, group: group });
      });
    return { rows: rows, dupeIds: dupeIds, dupeNames: dupeNames, bad: bad, blank: blank };
  }

  /* ---------- 按学号更新（三种模式：空学号追加 / 已存在更新 / 新学号追加） ---------- */
  function planBySidUpdate(rows, participants) {
    var byId = {}, nameMap = {};
    (participants || []).forEach(function (p) {
      if (p.id) byId[String(p.id).toLowerCase()] = p;
      (nameMap[p.name] = nameMap[p.name] || []).push(p);
    });
    var updates = [], adds = [], dupNames = [];
    (rows || []).forEach(function (row) {
      var hit = row.id ? byId[String(row.id).toLowerCase()] : null;
      if (hit) {
        updates.push({ uid: hit.uid, sid: hit.id || '', name: row.name || '', group: row.group || '' });
        return;
      }
      adds.push({ name: row.name || '', id: row.id || '', group: row.group || '' });
      var list = nameMap[row.name] || [];
      var dup = list.some(function (x) {
        return !row.id || String(x.id || '').toLowerCase() !== String(row.id).toLowerCase();
      });
      if (dup) dupNames.push(row.name);
    });
    return { updates: updates, adds: adds, dupNames: dupNames };
  }

  api.clamp100 = clamp100;
  api.normalizeStars = normalizeStars;
  api.defaultStars = defaultStars;
  api.starsTotal = starsTotal;
  api.percentOf = percentOf;
  api.applyPity = applyPity;
  api.luckBonus = luckBonus;
  api.hashStr = hashStr;
  api.createRng = createRng;
  api.seedSeq = seedSeq;
  api.aggregatePoints = aggregatePoints;
  api.cleanCell = cleanCell;
  api.isHeaderRow = isHeaderRow;
  api.parseImportLines = parseImportLines;
  api.planBySidUpdate = planBySidUpdate;

  var g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  g.__core__ = api;
})();
