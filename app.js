
/* ============================================================
   点名 · 抽卡系统 v3
   持久化 / 概率 / 保底 / 音效 / 快捷键 / 历史分组 / 统计导出
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     关于信息（设置 → 关于）
     profile 留空时显示占位链接；填上作者 GitHub 主页地址后自动生效
     ============================================================ */
  var ABOUT = {
    repo: 'https://github.com/OStarsO/CAS',
    blog: 'https://ostarso.github.io',
    profile: 'https://github.com/OStarsO'
  };

  /* ============================================================
     全局错误兜底（P0）：运行时异常 / 未处理 Promise rejection
     → 友好 Toast + 最近 50 条写入 localStorage，可在设置导出
     ============================================================ */
  var ERRKEY = 'lottery_errlog_v1';
  var lastErrToast = 0;
  function pushErrLog(err) {
    try {
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem(ERRKEY) || '[]') || []; } catch (_) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr.push({
        t: Date.now(),
        msg: String((err && err.message) || err || 'unknown').slice(0, 300),
        stack: String((err && err.stack) || '').slice(0, 1500),
        url: String(location.href).slice(0, 200)
      });
      while (arr.length > 50) arr.shift();
      localStorage.setItem(ERRKEY, JSON.stringify(arr));
    } catch (_) { /* 日志失败时静默，避免二次报错 */ }
  }
  function friendlyError(err) {
    try { pushErrLog(err); } catch (_) { }
    var now = Date.now();
    if (now - lastErrToast > 5000) {
      lastErrToast = now;
      try {
        toast(lang() === 'en'
          ? 'Something went wrong. It has been logged (Settings → export error log).'
          : '发生了一个错误，已记录日志（设置 → 导出错误日志）。', 'err');
      } catch (_) { }
    }
  }
  window.addEventListener('error', function (ev) {
    if (ev && (ev.error || ev.message)) friendlyError(ev.error || { message: ev.message });
  });
  window.addEventListener('unhandledrejection', function (ev) {
    friendlyError((ev && ev.reason) || { message: 'unhandled rejection' });
  });

  /* ============================================================
     低配设备检测（P1）：≤4GB 内存或 ≤4 核时自动精简特效
     ============================================================ */
  var LOW_END = false;
  try {
    var _mem = navigator.deviceMemory || 0, _cores = navigator.hardwareConcurrency || 0;
    LOW_END = (_mem > 0 && _mem <= 4) || (_cores > 0 && _cores <= 4);
  } catch (_) { LOW_END = false; }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var KEY = 'lottery_state_v3';
  var STAR_COLORS = { 5: '#ffd700', 4: '#c77dff', 3: '#6ee7ff', 2: '#8affc1', 1: '#9aa5c4' };
  var STAR_GLOW = {
    5: 'rgba(255,215,0,.55)', 4: 'rgba(199,125,255,.5)', 3: 'rgba(110,231,255,.45)',
    2: 'rgba(138,255,193,.4)', 1: 'rgba(154,165,196,.3)'
  };
  var ANIMS = {
    classic: '🌊 经典', thunder: '⚡ 雷霆', meteor: '☄️ 流星', spin: '🌀 旋涡',
    pulse: '💫 脉冲', glitch: '🔮 幻象', starlight: '✨ 星河', sakura: '🌸 樱花'
  };
  var PRESETS = {
    standard: { zh: '标准', en: 'Standard', stars: { 5: 2, 4: 8, 3: 20, 2: 30, 1: 40 } },
    lucky: { zh: '欧皇', en: 'Lucky', stars: { 5: 10, 4: 20, 3: 30, 2: 25, 1: 15 } },
    unlucky: { zh: '非酋', en: 'Unlucky', stars: { 5: 0, 4: 2, 3: 8, 2: 30, 1: 60 } },
    allfive: { zh: '全员五星', en: 'All 5★', stars: { 5: 100, 4: 0, 3: 0, 2: 0, 1: 0 } }
  };
  var SKINS = [
    { id: 'liquid', zh: '液态玻璃', en: 'Liquid glass' },
    { id: 'nebula', zh: '深空星云', en: 'Nebula' },
    { id: 'aurora', zh: '极光', en: 'Aurora' },
    { id: 'gold', zh: '鎏金', en: 'Gold' }
  ];
  var SPEEDS = ['0.5', '1', '1.5'];
  // 可重绑的快捷键动作（id 与 settings.shortcuts.keys 对应）
  var ACTIONS = [
    { id: 'single', zh: '单抽', en: 'Single draw', def: ' ' },
    { id: 'ten', zh: '十连', en: 'Ten pull', def: 'shift+ ' },
    { id: 'import', zh: '导入名单', en: 'Import roster', def: 'e' },
    { id: 'history', zh: '抽取历史', en: 'History', def: 'h' },
    { id: 'stats', zh: '统计面板', en: 'Stats', def: 'i' },
    { id: 'settings', zh: '打开设置', en: 'Settings', def: 's' },
    { id: 'pk', zh: '分组 PK', en: 'Group PK', def: 'p' },
    { id: 'reset', zh: '重置系统', en: 'Reset', def: 'r' }
  ];
  // 称号：按次数 / 星级授予
  var TITLES = [
    { id: 'rookie', zh: '初出茅庐', en: 'Rookie', ico: '🌱', test: function (s) { return s.total >= 1; } },
    { id: 'lucky', zh: '欧气初现', en: 'Lucky one', ico: '🍀', test: function (s) { return s.c5 >= 1; } },
    { id: 'collector', zh: '五星收藏家', en: 'Star collector', ico: '👑', test: function (s) { return s.c5 >= 5; } },
    { id: 'zealot', zh: '十连狂人', en: 'Ten-pull zealot', ico: '🔥', test: function (s) { return s.tenBatches >= 10; } },
    { id: 'favorite', zh: '天选之子', en: "Teacher's pet", ico: '💫', test: function (s) { return s.maxCount >= 5; } },
    { id: 'sweeper', zh: '全员制霸', en: 'Full sweep', ico: '🏆', test: function (s) { return s.roster > 0 && s.left === 0; } }
  ];

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function n(v) { v = Math.round(Number(v) || 0); return v < 0 ? 0 : (v > 100 ? 100 : v); }
  function stars(nn) { var s = ''; for (var i = 0; i < nn; i++) s += '★'; return s; }
  function hhmmss(d) { return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (x) { return x < 10 ? '0' + x : '' + x; }).join(':'); }
  function fmtDate(ts) {
    var d = new Date(ts); if (isNaN(d.getTime())) return '—';
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '_' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2);
  }

  /* ---------------- 音效（Web Audio，预合成） ---------------- */
  var Sfx = {
    ctx: null, master: null, bufs: {}, on: true, vol: 0.6, failed: false,
    ensure: function () {
      if (this.ctx || this.failed) return this.ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = true; return null; }
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.build();
      } catch (e) { this.failed = true; this.ctx = null; }
      return this.ctx;
    },
    build: function () {
      var ctx = this.ctx, sr = ctx.sampleRate;
      var mk = function (dur, fn) {
        var len = Math.max(1, Math.floor(sr * dur));
        var buf = ctx.createBuffer(1, len, sr);
        fn(buf.getChannelData(0), sr);
        return buf;
      };
      this.bufs.click = mk(0.06, function (d, sr) {
        for (var i = 0; i < d.length; i++) { var t = i / sr; d[i] = Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 70) * 0.4; }
      });
      this.bufs.tick = mk(0.05, function (d, sr) {
        for (var i = 0; i < d.length; i++) { var t = i / sr; d[i] = Math.sin(2 * Math.PI * (880 + 1400 * t) * t) * Math.exp(-t * 62) * 0.3; }
      });
      this.bufs.roll = mk(0.55, function (d, sr) {
        var lp = 0;
        for (var i = 0; i < d.length; i++) {
          var t = i / sr, nz = Math.random() * 2 - 1;
          lp += (nz - lp) * 0.22;
          var sweep = Math.sin(2 * Math.PI * (220 + 620 * t) * t);
          d[i] = (lp * 0.65 + sweep * 0.35) * Math.min(1, t * 9) * Math.exp(-t * 3.1) * 0.26;
        }
      });
      this.bufs.result = mk(0.6, function (d, sr) {
        var notes = [659.25, 987.77];
        for (var k = 0; k < notes.length; k++) {
          var st = k * 0.085;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr; if (t < st) continue;
            var tt = t - st;
            d[i] += Math.sin(2 * Math.PI * notes[k] * tt) * Math.exp(-tt * 7.5) * 0.22;
          }
        }
      });
      this.bufs.five = mk(1.5, function (d, sr) {
        var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        for (var k = 0; k < notes.length; k++) {
          var st = k * 0.1;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr; if (t < st) continue;
            var tt = t - st;
            var env = Math.exp(-tt * 3.6) * Math.min(1, tt * 120);
            d[i] += (Math.sin(2 * Math.PI * notes[k] * tt) * 0.5 + Math.sin(2 * Math.PI * notes[k] * 2 * tt) * 0.14) * env * 0.22;
          }
        }
      });
      this.bufs.ten = mk(0.95, function (d, sr) {
        var lp = 0;
        for (var i = 0; i < d.length; i++) {
          var t = i / sr, nz = Math.random() * 2 - 1;
          lp += (nz - lp) * 0.15;
          var sweep = Math.sin(2 * Math.PI * (160 + 700 * t) * t);
          d[i] = (lp * 0.55 + sweep * 0.35) * Math.min(1, t * 6) * Math.exp(-t * 2.3) * 0.28;
        }
      });

      /* --- 追加音效（共 12+ 种，全部手工合成，无外部文件） --- */
      this.bufs.hover = mk(0.05, function (d, sr) {
        for (var i = 0; i < d.length; i++) { var t = i / sr; d[i] = Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 90) * 0.22; }
      });
      this.bufs.open = mk(0.3, function (d, sr) {
        for (var i = 0; i < d.length; i++) {
          var t = i / sr, f = 420 + 900 * t;
          d[i] = Math.sin(2 * Math.PI * f * t) * Math.min(1, t * 8) * Math.exp(-t * 5.2) * 0.24;
        }
      });
      this.bufs.close = mk(0.24, function (d, sr) {
        for (var i = 0; i < d.length; i++) {
          var t = i / sr, f = 900 - 620 * t;
          d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 7) * 0.2;
        }
      });
      this.bufs.error = mk(0.34, function (d, sr) {
        for (var i = 0; i < d.length; i++) {
          var t = i / sr;
          d[i] = (Math.sin(2 * Math.PI * 150 * t) * 0.6 + Math.sin(2 * Math.PI * 146 * t) * 0.4) * Math.exp(-t * 8) * 0.26;
        }
      });
      this.bufs.success = mk(0.55, function (d, sr) {
        var notes = [587.33, 880];
        for (var k = 0; k < notes.length; k++) {
          var st = k * 0.09;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr; if (t < st) continue;
            var tt = t - st;
            d[i] += Math.sin(2 * Math.PI * notes[k] * tt) * Math.exp(-tt * 9) * 0.24;
          }
        }
      });
      this.bufs.achv = mk(1.25, function (d, sr) {
        var notes = [1046.5, 1318.5, 1567.98, 2093];
        for (var k = 0; k < notes.length; k++) {
          var st = k * 0.075;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr; if (t < st) continue;
            var tt = t - st;
            var env = Math.exp(-tt * 3.1) * Math.min(1, tt * 200);
            d[i] += (Math.sin(2 * Math.PI * notes[k] * tt) * 0.5 + Math.sin(2 * Math.PI * notes[k] * 2.01 * tt) * 0.18) * env * 0.2;
          }
        }
      });
      this.bufs.coin = mk(0.2, function (d, sr) {
        for (var i = 0; i < d.length; i++) {
          var t = i / sr, f = t < 0.05 ? 1568 : 2093;
          d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 16) * 0.2;
        }
      });
      this.bufs.whoosh = mk(0.36, function (d, sr) {
        var lp = 0;
        for (var i = 0; i < d.length; i++) {
          var t = i / sr, nz = Math.random() * 2 - 1;
          lp += (nz - lp) * (0.06 + 0.3 * t);
          d[i] = lp * Math.min(1, t * 5) * Math.exp(-t * 4.4) * 0.3;
        }
      });
      this.bufs.epic = mk(1.7, function (d, sr) {
        var notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99];
        for (var k = 0; k < notes.length; k++) {
          var st = k * 0.13;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr; if (t < st) continue;
            var tt = t - st;
            d[i] += (Math.sin(2 * Math.PI * notes[k] * tt) + Math.sin(2 * Math.PI * notes[k] * 1.5 * tt) * 0.3) * Math.exp(-tt * 2.4) * 0.12;
          }
        }
      });
      this.bufs.win = mk(0.9, function (d, sr) {
        var notes = [523.25, 659.25, 783.99, 1046.5];
        for (var k = 0; k < notes.length; k++) {
          var st = k * 0.1;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr; if (t < st) continue;
            var tt = t - st;
            d[i] += Math.sin(2 * Math.PI * notes[k] * tt) * Math.exp(-tt * 6.5) * 0.2;
          }
        }
      });
      this.bufs.lose = mk(0.8, function (d, sr) {
        var notes = [392, 311.13, 233.08];
        for (var k = 0; k < notes.length; k++) {
          var st = k * 0.14;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr; if (t < st) continue;
            var tt = t - st;
            d[i] += Math.sin(2 * Math.PI * notes[k] * tt) * Math.exp(-tt * 5.4) * 0.22;
          }
        }
      });
    },
    sync: function () {
      var s = state.settings.sound;
      var master = s.master == null ? 100 : Number(s.master);
      this.on = !!s.enabled;
      this.vol = Math.max(0, Math.min(100, Number(s.volume) || 0)) / 100 * 0.85 * (master / 100);
    },
    play: function (name, mul) {
      if (!this.on || this.vol <= 0.001) return;
      var ctx = this.ensure(); if (!ctx) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
      var buf = this.bufs[name]; if (!buf) return;
      try {
        var src = ctx.createBufferSource(); src.buffer = buf;
        var g = ctx.createGain(); g.gain.value = (mul == null ? 1 : mul) * this.vol;
        src.connect(g); g.connect(this.master); src.start();
      } catch (e) { }
    }
  };

  var tickTimer = null;
  function startTicks(gap) {
    stopTicks();
    Sfx.play('roll', 0.9);
    tickTimer = setInterval(function () { Sfx.play('tick', 0.62); }, gap || 82);
  }
  function stopTicks() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

  /* ---------------- 背景音乐（默认关闭，2 首循环，独立音量通道） ---------------- */
  var Bgm = {
    ctx: null, gain: null, src: null, track: null, bufs: {},
    TRACKS: [
      { id: 'calm', zh: '静谧星海', en: 'Calm sea' },
      { id: 'focus', zh: '专注课堂', en: 'Focus' },
      { id: 'epic', zh: '史诗抽卡', en: 'Epic' }
    ],
    volume: function () {
      var s = state.settings.sound;
      var master = s.master == null ? 100 : Number(s.master);
      return Math.max(0, Math.min(100, Number(s.bgmVolume) || 0)) / 100 * 0.5 * (master / 100);
    },
    enabled: function () { return (Number(state.settings.sound.bgmVolume) || 0) > 0; },
    ensure: function () {
      if (this.ctx) return this.ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = this.volume();
        this.gain.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
      return this.ctx;
    },
    /* 生成 8 秒循环：正弦铺底 + 缓慢琶音 */
    makeBuffer: function (id) {
      if (this.bufs[id]) return this.bufs[id];
      var ctx = this.ensure(); if (!ctx) return null;
      var sr = ctx.sampleRate, dur = 8;
      var len = Math.floor(sr * dur);
      var buf = ctx.createBuffer(1, len, sr);
      var d = buf.getChannelData(0);
      var conf = {
        calm: { root: 196, notes: [293.66, 349.23, 440, 523.25], step: 2.0, pad: 0.16, arp: 0.05 },
        focus: { root: 220, notes: [329.63, 415.30, 493.88, 659.25], step: 1.6, pad: 0.13, arp: 0.06 },
        epic: { root: 146.83, notes: [220, 293.66, 349.23, 440], step: 2.4, pad: 0.2, arp: 0.055 }
      }[id] || { root: 196, notes: [293.66, 349.23, 440, 523.25], step: 2, pad: 0.15, arp: 0.05 };
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        var pad = Math.sin(2 * Math.PI * conf.root * t) * 0.5 + Math.sin(2 * Math.PI * conf.root * 1.5 * t) * 0.22;
        var lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.06 * t);
        var v = pad * conf.pad * lfo;
        var step = Math.floor(t / (conf.step / conf.notes.length));
        var note = conf.notes[step % conf.notes.length];
        var local = t % (conf.step / conf.notes.length);
        v += Math.sin(2 * Math.PI * note * t) * Math.exp(-local * 3.4) * conf.arp;
        d[i] = Math.max(-1, Math.min(1, v));
      }
      this.bufs[id] = buf;
      return buf;
    },
    start: function () {
      var id = state.settings.sound.bgmTrack || 'calm';
      if (!this.enabled()) { this.stop(); return; }
      var ctx = this.ensure(); if (!ctx) return;
      var buf = this.makeBuffer(id);
      if (!buf) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
      this.stop(true);
      this.src = ctx.createBufferSource();
      this.src.buffer = buf; this.src.loop = true;
      this.src.connect(this.gain);
      this.src.start();
      this.track = id;
    },
    stop: function (keepGain) {
      if (this.src) { try { this.src.stop(); } catch (e) { } try { this.src.disconnect(); } catch (e) { } this.src = null; }
      this.track = null;
      if (!keepGain && this.gain) this.gain.gain.value = 0;
    },
    sync: function () {
      if (!this.enabled()) { this.stop(); return; }
      if (this.gain) this.gain.gain.value = this.volume();
      var want = state.settings.sound.bgmTrack || 'calm';
      if (!this.src || this.track !== want) this.start();
    }
  };

  /* ---------------- 语音播报（系统 speechSynthesis，可选） ---------------- */
  var Speech = {
    supported: !!(window.speechSynthesis && window.SpeechSynthesisUtterance),
    voices: [],
    cfg: function () {
      return (state.settings && state.settings.speech) || { enabled: false, rate: 1, pitch: 1, voice: '' };
    },
    loadVoices: function () {
      if (!this.supported) return;
      try { this.voices = window.speechSynthesis.getVoices() || []; } catch (e) { this.voices = []; }
      this.buildSelect();
    },
    buildSelect: function () {
      var sel = $('#speechVoice'); if (!sel) return;
      var L = lang(), cur = this.cfg().voice;
      var html = '<option value="">' + (L === 'en' ? 'Auto (follow page language)' : '自动（跟随界面语言）') + '</option>';
      this.voices.forEach(function (v) {
        var name = v.name + ' · ' + (v.lang || '');
        html += '<option value="' + esc(v.voiceURI || v.name) + '"' + (cur && cur === (v.voiceURI || v.name) ? ' selected' : '') + '>' + esc(name) + '</option>';
      });
      sel.innerHTML = html;
    },
    speak: function (text) {
      var cfg = this.cfg();
      if (!this.supported || !cfg.enabled || !text) return;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(String(text).slice(0, 180));
        u.rate = Math.max(0.6, Math.min(1.6, Number(cfg.rate) || 1));
        u.pitch = Math.max(0.6, Math.min(1.6, Number(cfg.pitch) || 1));
        u.lang = lang() === 'en' ? 'en-US' : 'zh-CN';
        if (cfg.voice) {
          var hit = this.voices.filter(function (v) { return (v.voiceURI || v.name) === cfg.voice; })[0];
          if (hit) { u.voice = hit; u.lang = hit.lang || u.lang; }
        }
        window.speechSynthesis.speak(u);
      } catch (e) { }
    },
    sample: function () {
      this.speak(lang() === 'en' ? 'Speech is ready.' : '语音播报已开启。');
    },
    announceSingle: function (p, star, src, seat, no) {
      if (!p) return;
      var L = lang();
      var text;
      if (src === 'number') {
        text = L === 'en'
          ? ('Number ' + (no || '') + ', ' + p.name + '.')
          : ('序号 ' + (no || '') + '，' + p.name + '。');
      } else if (src === 'id') {
        text = L === 'en'
          ? ('Student ID ' + (p.id || '') + ', ' + p.name + '.')
          : ('学号 ' + (p.id || '') + '，' + p.name + '。');
      } else if (src === 'seat') {
        text = L === 'en'
          ? ('Seat ' + seatLabel(seat) + ', ' + p.name + '.')
          : ('座位 ' + seatLabel(seat) + '，' + p.name + '。');
      } else {
        text = L === 'en' ? (p.name + ', ' + star + ' stars.') : ('抽中 ' + p.name + '，' + star + ' 星。');
      }
      this.speak(text);
    },
    announceTen: function (items) {
      if (!items || !items.length) return;
      var L = lang();
      var head = items.slice(0, 3).map(function (x) {
        var nm = x.name || (x.p && x.p.name) || '';
        return nm + (L === 'en' ? ' ' + x.star + '★' : ' ' + x.star + '星');
      }).join(L === 'en' ? ', ' : '、');
      var tail = items.length > 3 ? (L === 'en' ? ', and ' + (items.length - 3) + ' more.' : '，等 ' + (items.length - 3) + ' 人。') : (L === 'en' ? '.' : '。');
      this.speak((L === 'en' ? 'Ten-pull finished: ' : '十连结束：') + head + tail);
    }
  };
  if (Speech.supported) {
    try { window.speechSynthesis.addEventListener('voiceschanged', function () { Speech.loadVoices(); }); } catch (e) { }
  }

  /* ---------------- 状态 ---------------- */
  function defaultShortcutKeys() {
    var o = {};
    ACTIONS.forEach(function (a) { o[a.id] = a.def; });
    return o;
  }
  function defaultSettings() {
    return {
      theme: 'light', animation: 'classic', lang: 'zh', mode: 'unique', scope: 'all',
      stars: { 5: 2, 4: 8, 3: 20, 2: 30, 1: 40 }, preset: 'standard',
      weights: { enabled: false, mult: { 5: 5, 4: 4, 3: 3, 2: 2, 1: 1 } },
      pity: { enabled: false, tenFour: true, fiftyFive: true, c5: 0, lucky: false, luckyStep: 1 },
      sound: { enabled: true, volume: 60, master: 100, bgmVolume: 0, bgmTrack: 'calm' },
      speech: { enabled: false, rate: 1, pitch: 1, voice: '' },
      skin: 'liquid', sort: 'order', sortDir: 'asc', filter: 'all', group: 'all', search: '',
      groupColors: {},
      starFilter: 'all', countFilter: 'all', excludeFilter: 'all',
      pointScope: 'recent10', pointSort: 'points', pointLogUid: 'all', pointLogRange: 'all',
      seatFlat: null, drawMode: 'name',
      accent: '', bg: 'auto', bgImage: '',
      animSpeed: '1', title: 'auto',
      seed: '', pickCount: 10, balance: false, longPressMs: 480,
      shortcuts: { enabled: true, spaceDraw: true, keys: defaultShortcutKeys() },
      guideSeen: false
    };
  }
  function freshState() {
    return { version: 4, seq: 1, participants: [], history: [], drawIndex: 0, last: null, achv: {}, logs: [], archive: null, pointLog: [], points: {}, pointSeq: 1, seatmap: freshSeatmap(), settings: defaultSettings() };
  }
  var state = freshState();
  var storageBroken = false;
  var lastQuotaToast = 0;
  var SOFT_LIMIT = 5 * 1024 * 1024;   // 常见浏览器 localStorage 上限（约 5 MB）
  var WARN_RATIO = 0.8;               // 超过 80% 提前提示备份
  var storageWarned = false, histHinted = false;
  var UKEY = 'lottery_undo_v4';
  var LOG_CAP = 200, HIST_SOFT = 1000, UNDO_PERSIST = 10, POINT_LOG_CAP = 2000;
  /* ---------------- 座位表 v3（只存 uid；行/列/座位号动态） ---------------- */
  function freshSeatmap() {
    return { v: 3, rows: 1, cols: 1, grid: [null], numbers: {}, auto: true, n: 0 };
  }
  function nearSquare(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    if (n <= 1) return { rows: 1, cols: 1 };
    var cols = Math.ceil(Math.sqrt(n));
    var rows = Math.ceil(n / cols);
    return { rows: rows, cols: cols };
  }
  function normalizeSeatmap(raw, parts) {
    var sm = (raw && typeof raw === 'object') ? raw : {};
    var grid = Array.isArray(sm.grid) ? sm.grid.slice() : (Array.isArray(sm.seats) ? sm.seats.slice() : []);
    grid = grid.map(function (u) { return (u && typeof u === 'object') ? u.uid : u; });
    return {
      v: 3,
      rows: Math.max(1, Math.min(999, Math.min(parts ? parts.length || 1 : 999, Math.round(Number(sm.rows) || 0)))),
      cols: Math.max(1, Math.min(999, Math.min(parts ? parts.length || 1 : 999, Math.round(Number(sm.cols) || 0)))),
      grid: grid,
      numbers: (sm.numbers && typeof sm.numbers === 'object') ? sm.numbers : {},
      auto: sm.auto !== false,
      n: Math.max(0, Math.round(Number(sm.n) || 0))
    };
  }
  function seatOrder(byUid, oldGrid) {
    var pos = {};
    (oldGrid || []).forEach(function (u, i) { if (u && pos[u] == null) pos[u] = i; });
    return state.participants.slice().sort(function (a, b) {
      var na = Number(state.seatmap.numbers[a.uid]) || 0;
      var nb = Number(state.seatmap.numbers[b.uid]) || 0;
      if (na && nb && na !== nb) return na - nb;
      if (na && !nb) return -1;
      if (!na && nb) return 1;
      var pa = pos[a.uid] == null ? 1e9 : pos[a.uid];
      var pb = pos[b.uid] == null ? 1e9 : pos[b.uid];
      return pa - pb || a.order - b.order;
    });
  }
  /* 让网格始终恰好容纳 N 人；默认近方阵；手动布局保留已有位置、把新增的人补进空格 */
  function syncSeatmap(opts) {
    opts = opts || {};
    if (!state.seatmap || typeof state.seatmap !== 'object') state.seatmap = freshSeatmap();
    var sm = state.seatmap, N = state.participants.length;
    var valid = {}, byUid = {};
    state.participants.forEach(function (p) { valid[p.uid] = 1; byUid[p.uid] = p; });
    var rows = Math.max(1, Math.min(Math.max(1, N), Math.round(Number(sm.rows) || 0)));
    var cols = Math.max(1, Math.min(Math.max(1, N), Math.round(Number(sm.cols) || 0)));
    var auto = sm.auto !== false;
    var oldGrid = (Array.isArray(sm.grid) ? sm.grid : []).map(function (u) {
      return u ? String(u) : null;
    });
    var seen = {}, cleaned = [];
    oldGrid.forEach(function (u) {
      if (u && valid[u] && !seen[u]) { seen[u] = 1; cleaned.push(u); }
      else cleaned.push(null);
    });
    if (!N) { rows = 1; cols = 1; cleaned = []; }
    else if (!sm.rows || !sm.cols || (auto && (sm.n !== N || opts.force))) {
      var d = nearSquare(N);
      rows = d.rows; cols = d.cols;
      auto = true;
    }
    // 容量必须 ≥ 人数；按行优先扩大
    while (rows * cols < N) {
      if (cols <= rows) cols++; else rows++;
      if (rows > N) { rows = N; cols = Math.ceil(N / rows); break; }
    }
    // 自动模式：按座位号/旧位置排序后重新排成近方阵
    if (auto && (sm.n !== N || opts.force || !oldGrid.length)) {
      var ordered = seatOrder(byUid, oldGrid);
      cleaned = new Array(rows * cols).fill(null);
      ordered.forEach(function (p, i) { if (i < cleaned.length) cleaned[i] = p.uid; });
    }
    var grid = new Array(rows * cols).fill(null);
    for (var i = 0; i < Math.min(cleaned.length, grid.length); i++) grid[i] = cleaned[i];
    // 补入未入座的人（手动布局新增成员）
    var seated = {};
    grid.forEach(function (u) { if (u) seated[u] = 1; });
    var unseated = state.participants.filter(function (p) { return !seated[p.uid]; });
    var addCell = function () {
      var nulls = [];
      grid.forEach(function (u, idx) { if (!u) nulls.push(idx); });
      while (unseated.length > nulls.length) {
        var newCols = cols + 1;
        var expanded = new Array(rows * newCols).fill(null);
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) expanded[r * newCols + c] = grid[r * cols + c];
        }
        cols = newCols; grid = expanded;
        nulls = [];
        grid.forEach(function (u, idx) { if (!u) nulls.push(idx); });
      }
      return nulls;
    };
    if (unseated.length) {
      var nulls = addCell();
      unseated.forEach(function (p) { var idx = nulls.shift(); if (idx != null) grid[idx] = p.uid; });
    }
    // 座位号：唯一且 ≥1 即保留。删除同学后不重排、不清号（"已选号人员保持不变"）；
    // 只有在一个人都没有编号时，才按座位顺序自动编号。
    var numbers = {}, usedNo = {};
    state.participants.forEach(function (p) {
      var no = Math.round(Number(sm.numbers && sm.numbers[p.uid]));
      if (no >= 1 && no <= 9999 && !usedNo[no]) { numbers[p.uid] = no; usedNo[no] = 1; }
    });
    if (N > 0 && !Object.keys(numbers).length && opts.autoNumber !== false) {
      var no = 1;
      grid.forEach(function (uid) { if (uid && !numbers[uid]) numbers[uid] = no++; });
    }
    sm.v = 3; sm.rows = rows; sm.cols = cols; sm.grid = grid;
    sm.numbers = numbers; sm.auto = auto; sm.n = N;
  }
  function seatLabel(i) {
    var n = Number(i);
    var sm = state.seatmap || {};
    var cols = Math.max(1, Number(sm.cols) || 1);
    var cap = (Number(sm.rows) || 1) * cols;
    if (!(n >= 0 && n < cap)) return '';
    return (Math.floor(n / cols) + 1) + (lang() === 'en' ? '-' : '排') + (n % cols + 1) + (lang() === 'en' ? '' : '座');
  }
  function seatIndexOfUid(uid) {
    return state.seatmap && Array.isArray(state.seatmap.grid) ? state.seatmap.grid.indexOf(uid) : -1;
  }
  function seatNoOf(uid) {
    var n = Number(state.seatmap && state.seatmap.numbers && state.seatmap.numbers[uid]);
    return n >= 1 ? n : 0;
  }
  function unseatUids(set) {
    if (!state.seatmap || !Array.isArray(state.seatmap.grid)) return 0;
    var n = 0;
    state.seatmap.grid = state.seatmap.grid.map(function (uid) {
      if (uid && set[uid]) { n++; return null; }
      return uid;
    });
    return n;
  }

  function numStars(o) {
    var out = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (o && typeof o === 'object') { for (var k = 5; k >= 1; k--) out[k] = n(o[k]); }
    else { var d = PRESETS.standard.stars; for (var s = 5; s >= 1; s--) out[s] = n(d[s]); }
    return out;
  }
  function numMult(o) {
    var out = { 5: 5, 4: 4, 3: 3, 2: 2, 1: 1 };
    if (o && typeof o === 'object') {
      for (var k = 5; k >= 1; k--) {
        var v = Number(o[k]);
        out[k] = isNaN(v) ? out[k] : Math.max(0, Math.min(5, Math.round(v * 2) / 2));
      }
    }
    return out;
  }

  function loadState() {
    var raw = null;
    state = freshState();
    try { raw = localStorage.getItem(KEY); } catch (e) { storageBroken = true; }
    if (raw) {
      try {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          if (Array.isArray(p.participants)) {
            state.participants = p.participants.filter(function (x) { return x && x.name; }).map(function (x, i) {
              return {
                uid: x.uid || ('p' + (i + 1)), name: String(x.name).slice(0, 20),
                id: x.id ? String(x.id) : '', group: x.group ? String(x.group) : '',
                drawn: !!x.drawn, drawnAt: Number(x.drawnAt) || 0, order: Number(x.order) || (i + 1),
                excluded: !!x.excluded, count: Number(x.count) || 0
              };
            });
          }
          state.seatmap = normalizeSeatmap(p.seatmap, state.participants);
          syncSeatmap();
          if (Array.isArray(p.history)) {
            state.history = p.history.filter(function (h) { return h && h.name; }).map(function (h) {
              return {
                index: Number(h.index) || 0, uid: h.uid || '', name: String(h.name),
                id: h.id ? String(h.id) : '', group: h.group ? String(h.group) : '',
                star: Math.max(1, Math.min(5, Number(h.star) || 1)), ts: Number(h.ts) || Date.now(),
                time: h.time || '', batchId: h.batchId || ('legacy' + (h.ts || 0)), mode: h.mode || 'unique',
                seedHash: h.seedHash ? String(h.seedHash) : '',
                seedText: h.seedText ? String(h.seedText).slice(0, 40) : '',
                pity: h.pity ? String(h.pity) : '',
                source: h.source ? String(h.source) : 'roster',
                seat: (h.seat == null || isNaN(Number(h.seat)) ? null : Number(h.seat)),
                no: Number(h.no) || 0,
                seatLabel: h.seatLabel ? String(h.seatLabel) : ''
              };
            });
          }
          if (Array.isArray(p.pointLog)) {
            state.pointLog = p.pointLog.filter(function (r) {
              return r && (r.uid || r.name) && Number(r.delta);
            }).slice(-POINT_LOG_CAP).map(function (r, ri) {
              return {
                rid: r.rid ? String(r.rid) : ('pt' + (ri + 1)),
                uid: String(r.uid || ''), name: String(r.name || '').slice(0, 20),
                sid: r.sid ? String(r.sid) : '', group: r.group ? String(r.group).slice(0, 12) : '',
                delta: Math.max(-99, Math.min(99, Math.round(Number(r.delta) || 0))),
                reason: String(r.reason || '').slice(0, 40),
                ts: Number(r.ts) || Date.now(),
                batch: r.batch ? String(r.batch) : ''
              };
            });
            state.pointSeq = Math.max(1, Number(p.pointSeq) || (state.pointLog.length + 1));
          }
          state.seq = Number(p.seq) || (state.participants.length + 1);
          state.drawIndex = Number(p.drawIndex) || state.history.length;
          if (p.last && p.last.name) state.last = p.last;
          if (p.achv && typeof p.achv === 'object') { state.achv = p.achv; }
          if (p.archive && typeof p.archive === 'object' && !Array.isArray(p.archive)) {
            var AR = p.archive;
            state.archive = {
              count: Math.max(0, Number(AR.count) || 0),
              byStar: numStars(AR.byStar),
              byGroup: (AR.byGroup && typeof AR.byGroup === 'object') ? AR.byGroup : {},
              byDay: (AR.byDay && typeof AR.byDay === 'object') ? AR.byDay : {},
              files: Array.isArray(AR.files) ? AR.files.slice(-8) : []
            };
          }
          if (Array.isArray(p.logs)) {
            state.logs = p.logs.filter(function (l) { return l && l.t; }).slice(-500).map(function (l) {
              return { t: Number(l.t) || 0, kind: String(l.kind || 'misc'), text: String(l.text || '') };
            });
          }
          var S = p.settings || {};
          var scRaw = S.shortcuts || {};
          var keys = defaultShortcutKeys();
          if (scRaw.keys && typeof scRaw.keys === 'object') {
            for (var ak in keys) { if (typeof scRaw.keys[ak] === 'string') keys[ak] = scRaw.keys[ak]; }
          }
          var legacyScope = S.groupOnly ? 'group' : null;
          var lkStep = Number(S.pity && S.pity.luckyStep);
          state.settings = {
            theme: S.theme === 'dark' ? 'dark' : 'light',
            animation: ANIMS[S.animation] ? S.animation : 'classic',
            lang: S.lang === 'en' ? 'en' : 'zh',
            mode: S.mode === 'repeat' ? 'repeat' : 'unique',
            scope: (S.scope === 'group' || S.scope === 'all') ? S.scope : (legacyScope || 'all'),
            stars: numStars(S.stars),
            preset: PRESETS[S.preset] ? S.preset : 'custom',
            weights: {
              enabled: !!(S.weights && S.weights.enabled),
              mult: numMult(S.weights && S.weights.mult)
            },
            pity: {
              enabled: !!(S.pity && S.pity.enabled),
              tenFour: !(S.pity && S.pity.tenFour === false),
              fiftyFive: !(S.pity && S.pity.fiftyFive === false),
              c5: Math.max(0, Math.min(999, Number(S.pity && S.pity.c5) || 0)),
              lucky: !!(S.pity && S.pity.lucky),
              luckyStep: isNaN(lkStep) ? 1 : Math.max(0, Math.min(5, lkStep))
            },
            sound: {
              enabled: !(S.sound && S.sound.enabled === false),
              volume: S.sound && S.sound.volume != null ? Math.max(0, Math.min(100, Number(S.sound.volume))) : 60,
              master: S.sound && S.sound.master != null ? Math.max(0, Math.min(100, Number(S.sound.master))) : 100,
              bgmVolume: S.sound && S.sound.bgmVolume != null ? Math.max(0, Math.min(100, Number(S.sound.bgmVolume))) : 0,
              bgmTrack: ['calm', 'focus', 'epic'].indexOf(S.sound && S.sound.bgmTrack) >= 0 ? S.sound.bgmTrack : 'calm'
            },
            speech: (function () {
              var sp = S.speech || {};
              return {
                enabled: !!sp.enabled,
                rate: Math.max(0.6, Math.min(1.6, Number(sp.rate) || 1)),
                pitch: Math.max(0.6, Math.min(1.6, Number(sp.pitch) || 1)),
                voice: typeof sp.voice === 'string' ? sp.voice.slice(0, 120) : ''
              };
            })(),
            skin: SKINS.some(function (x) { return x.id === S.skin; }) ? S.skin : 'liquid',
            sort: ['order', 'name', 'pinyin', 'id', 'drawn', 'count'].indexOf(S.sort) >= 0 ? S.sort : 'order',
            sortDir: S.sortDir === 'desc' ? 'desc' : 'asc',
            title: typeof S.title === 'string' ? S.title : 'auto',
            seed: typeof S.seed === 'string' ? S.seed.slice(0, 40) : '',
            pickCount: Math.max(1, Math.min(50, Number(S.pickCount) || 10)),
            balance: !!S.balance,
            longPressMs: Math.max(200, Math.min(1200, Number(S.longPressMs) || 480)),
            filter: ['all', 'undrawn', 'drawn'].indexOf(S.filter) >= 0 ? S.filter : 'all',
            starFilter: ['all', 'none', '5', '4', '3', '2', '1'].indexOf(String(S.starFilter)) >= 0 ? String(S.starFilter) : 'all',
            countFilter: ['all', '0', '1', '3', '5'].indexOf(String(S.countFilter)) >= 0 ? String(S.countFilter) : 'all',
            excludeFilter: ['all', 'only', 'off'].indexOf(S.excludeFilter) >= 0 ? S.excludeFilter : 'all',
            pointScope: ['recent1', 'recent10', 'recent20', 'all'].indexOf(S.pointScope) >= 0 ? S.pointScope : 'recent10',
            pointSort: ['points', 'plus', 'minus', 'recent'].indexOf(S.pointSort) >= 0 ? S.pointSort : 'points',
            pointLogUid: typeof S.pointLogUid === 'string' ? S.pointLogUid : 'all',
            pointLogRange: ['all', 'today', '7', '30'].indexOf(S.pointLogRange) >= 0 ? S.pointLogRange : 'all',
            seatFlat: (S.seatFlat === true || S.seatFlat === false) ? S.seatFlat : null,
            drawMode: ['number', 'seat', 'name'].indexOf(S.drawMode) >= 0 ? S.drawMode : 'name',
            accent: typeof S.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(S.accent) ? S.accent : '',
            bg: ['auto', 'aurora', 'sunset', 'forest', 'mono'].indexOf(S.bg) >= 0 ? S.bg : 'auto',
            bgImage: typeof S.bgImage === 'string' && S.bgImage.slice(0, 11) === 'data:image/' ? S.bgImage : '',
            groupColors: (function () {
              var src = S.groupColors, out = {};
              if (src && typeof src === 'object') {
                Object.keys(src).forEach(function (k) {
                  if (typeof src[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(src[k])) out[k] = src[k];
                });
              }
              return out;
            })(),
            group: typeof S.group === 'string' ? S.group : 'all',
            search: typeof S.search === 'string' ? S.search : '',
            animSpeed: SPEEDS.indexOf(String(S.animSpeed)) >= 0 ? String(S.animSpeed) : '1',
            shortcuts: {
              enabled: !(scRaw.enabled === false),
              spaceDraw: !(scRaw.spaceDraw === false),
              keys: keys
            },
            guideSeen: !!S.guideSeen
          };
          // 范围与分组保持一致：分组为「全部」时范围必然是全部名单
          if (state.settings.group === 'all') state.settings.scope = 'all';
          else if (state.settings.scope !== 'group') state.settings.scope = 'group';
        }
      } catch (e) {
        state = freshState();
        setTimeout(function () { toast('本地数据读取失败，已从空名单开始', 'err'); }, 500);
      }
    }
    // 抽中次数以历史为准重建，避免旧数据缺字段
    recount();
    // 座位表迁移/自动编号后落盘一次（防抖），确保 state.seatmap 持久化
    save();
    // 兼容旧版本主题 / 动画键
    try {
      var la = localStorage.getItem('lottery_anim_v2');
      if (la && ANIMS[la] && !state.settings.animation) state.settings.animation = la;
      var lt = localStorage.getItem('lottery_theme_v2');
      if (lt === 'light' || lt === 'dark') { /* 新键优先，旧键只做兜底 */ }
    } catch (e) { }
    Sfx.sync();
  }

  function recount() {
    var map = {};
    state.history.forEach(function (h) { var k = h.uid || ('name:' + h.name); map[k] = (map[k] || 0) + 1; });
    state.participants.forEach(function (p) {
      var c = map[p.uid] || map['name:' + p.name] || 0;
      p.count = Math.max(Number(p.count) || 0, c);
      if (typeof p.excluded !== 'boolean') p.excluded = false;
    });
    recountPoints();
  }

  /* ---------------- 积分：以 pointLog 为准，points 为实时汇总 ---------------- */
  function recountPoints() {
    state.points = Object.assign({}, __core__.aggregatePoints(state.pointLog || []).net);
  }
  function pointsOf(uid) {
    return Number(state.points && state.points[uid]) || 0;
  }
  function participantsByUid() {
    var m = {};
    state.participants.forEach(function (p) { m[p.uid] = p; });
    return m;
  }
  function fmtSigned(v) { return (v > 0 ? '+' : '') + v; }

  function logAction(kind, text) {
    state.logs.push({ t: Date.now(), kind: kind, text: String(text || '') });
    if (state.logs.length > LOG_CAP) state.logs = state.logs.slice(-LOG_CAP);
  }

  /* ---------------- 存储容量 / 未保存提示 ---------------- */
  function bytesOf(s) {
    try { return new Blob([s]).size; } catch (e) { return String(s || '').length * 2; }
  }
  /* 保存防抖：150–300ms 合并写入；flushSave() 用于关页/切库等必须立即落盘的场景 */
  var SAVE_DELAY = 220;
  var saveTimer = 0, savePending = false, lastSerialized = '';

  function stateBytes() {
    // 优先复用本次写入的序列化结果，避免同一轮 save 里重复 JSON.stringify
    var raw = lastSerialized;
    if (!raw) { try { raw = localStorage.getItem(KEY) || ''; } catch (e) { } }
    if (!raw) { try { raw = JSON.stringify(state); } catch (e) { raw = ''; } }
    return bytesOf(raw);
  }
  function storageRatio() { return stateBytes() / SOFT_LIMIT; }

  function showUnsavedBanner() {
    var bar = $('#unsavedBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'unsavedBar';
      bar.className = 'unsaved-bar';
      bar.innerHTML = '<b>⚠ 改动未保存</b><span>本地存储写入失败，刷新或关闭页面后当前改动会丢失。</span>' +
        '<button type="button" class="mini-btn" id="unsavedExport">立即导出备份</button>' +
        '<button type="button" class="mini-btn" id="unsavedClose">知道了</button>';
      document.body.appendChild(bar);
      var ex = bar.querySelector('#unsavedExport');
      if (ex) ex.addEventListener('click', function () { exportJson(); });
      var cl = bar.querySelector('#unsavedClose');
      if (cl) cl.addEventListener('click', function () { bar.classList.remove('on'); });
    }
    requestAnimationFrame(function () { bar.classList.add('on'); });
  }
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('beforeunload', flushSave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushSave();
  });

  function hideUnsavedBanner() {
    var bar = $('#unsavedBar');
    if (bar) bar.classList.remove('on');
  }

  function serializeState() {
    try { return JSON.stringify(state); } catch (e) { return ''; }
  }
  function save() {
    savePending = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = 0; writeNow(); }, SAVE_DELAY);
  }
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    if (savePending) writeNow();
  }
  function writeNow() {
    savePending = false;
    var payload = serializeState();
    if (!payload) return;
    lastSerialized = payload;
    try {
      localStorage.setItem(KEY, payload);
      storageBroken = false;
      try { localStorage.setItem('lottery_theme_v2', state.settings.theme); localStorage.setItem('lottery_anim_v2', state.settings.animation); } catch (e2) { }
      updateStorageInfo();
      hideUnsavedBanner();
      persistUndo();
      afterSaveCapacity();
    } catch (err) {
      var quota = err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
      var now = Date.now();
      if (now - lastQuotaToast > 4000) {
        lastQuotaToast = now;
        if (quota) toast('本地存储已满（浏览器上限约 5 MB），本次改动没有保存。请到「设置 → 导出备份 JSON」后清理历史。', 'err');
        else toast('本地保存失败：' + ((err && err.message) || '未知错误'), 'err');
      }
      storageBroken = true;
      updateStorageInfo(true);
      showUnsavedBanner();
    }
  }

  // 超过 80% 提前提示一次（每次会话只提示一次）
  function afterSaveCapacity() {
    var bytes = stateBytes(), ratio = bytes / SOFT_LIMIT;
    if (ratio < WARN_RATIO - 0.06) { storageWarned = false; return; }   // 清理后回落，下次越线再提醒
    if (storageWarned || ratio < WARN_RATIO) return;
    storageWarned = true;
    toast('本地存储已用 ' + Math.round(ratio * 100) + '%（' + (bytes / 1024 / 1024).toFixed(2) + ' MB / 约 5 MB）。建议到「设置 → 导出备份 JSON」备份，并归档或清理历史。', 'err');
  }

  function updateStorageInfo(failed) {
    var el = $('#storageSize'); if (!el) return;
    var bytes = stateBytes();
    var kb = bytes / 1024;
    var pct = Math.round(Math.min(100, bytes / SOFT_LIMIT * 100));
    var size = kb < 1024 ? kb.toFixed(1) + ' KB' : (kb / 1024).toFixed(2) + ' MB';
    el.textContent = size + ' / 约 5 MB（' + pct + '%）' + (failed ? ' · 写入失败' : '');
    el.style.color = failed ? '#ffb3c4' : (pct >= 80 ? '#ffd479' : '');
  }

  /* ---------------- 历史归档（超 1000 条提示） ---------------- */
  function maybeHistoryHint() {
    if (histHinted || state.history.length <= HIST_SOFT) return;
    histHinted = true;
    toast('抽取历史已超过 ' + HIST_SOFT + ' 条（当前 ' + state.history.length + ' 条），建议到「设置 → 归档历史」导出并清理，避免占满本地存储。', 'err');
  }
  function archiveHistory() {
    if (!state.history.length) { toast('没有可归档的历史', 'err'); return; }
    var sum = summarizeHistory(state.history);
    var keep = Math.min(100, state.history.length);
    var removed = state.history.length - keep;
    var archivedSum = removed > 0 ? summarizeHistory(state.history.slice(0, removed)) : null;
    var pack = {
      exportedAt: new Date().toISOString(), version: state.version,
      participants: state.participants.map(function (p) { return { uid: p.uid, name: p.name, id: p.id, group: p.group }; }),
      history: state.history,
      summary: sum
    };
    download('点名历史归档_' + stamp() + '.json', JSON.stringify(pack, null, 2), 'application/json');
    pushUndo();
    state.history = state.history.slice(-keep);
    // 归档摘要：只累计被清掉的那部分，避免与保留下来的 100 条重复计数
    var A = state.archive && typeof state.archive === 'object' ? state.archive : { count: 0, byStar: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, byGroup: {}, byDay: {}, files: [] };
    A.count = (A.count || 0) + removed;
    if (archivedSum) {
      [5, 4, 3, 2, 1].forEach(function (s) {
        A.byStar = A.byStar || {};
        A.byStar[s] = (A.byStar[s] || 0) + (archivedSum.byStar[s] || 0);
      });
      Object.keys(archivedSum.byGroup).forEach(function (g) { A.byGroup[g] = (A.byGroup[g] || 0) + archivedSum.byGroup[g]; });
      Object.keys(archivedSum.byDay).forEach(function (d) { A.byDay[d] = (A.byDay[d] || 0) + archivedSum.byDay[d]; });
    }
    A.files = (A.files || []).concat([{ at: Date.now(), removed: removed, keep: keep }]).slice(-8);
    state.archive = A;
    logAction('archive', '归档历史 ' + removed + ' 条，保留最近 ' + keep + ' 条');
    save(); renderAll(); renderHistory(); renderSettings();
    toast('已导出归档并清理 ' + removed + ' 条历史（仅保留最近 ' + keep + ' 条 + 摘要）', 'ok');
  }

  /* 历史摘要：星级 / 分组 / 日期分布，用于归档后保留概览 */
  function summarizeHistory(list) {
    var byStar = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, byGroup = {}, byDay = {}, first = 0, last = 0;
    (list || []).forEach(function (h) {
      var s = Math.max(1, Math.min(5, Number(h.star) || 1));
      byStar[s] = (byStar[s] || 0) + 1;
      var g = h.group || '__none';
      byGroup[g] = (byGroup[g] || 0) + 1;
      var d = new Date(h.ts || 0);
      var key = isNaN(d.getTime()) ? '—' : d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      byDay[key] = (byDay[key] || 0) + 1;
      if (!first || (h.ts && h.ts < first)) first = h.ts || first;
      if ((h.ts || 0) > last) last = h.ts || 0;
    });
    return { count: (list || []).length, byStar: byStar, byGroup: byGroup, byDay: byDay, first: first, last: last };
  }

  /* ---------------- 多套名单库（独立名单 / 历史 / 保底） ---------------- */
  var LIBKEY = 'lottery_libs_v1';
  var libs = { current: '', list: [] };

  function libKey(id) { return 'lottery_lib_' + id; }
  function saveLibs() { try { localStorage.setItem(LIBKEY, JSON.stringify(libs)); } catch (e) { } }
  function loadLibs() {
    libs = { current: '', list: [] };
    try {
      var raw = localStorage.getItem(LIBKEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.list)) {
          libs.list = p.list.filter(function (x) { return x && x.id && x.name; }).map(function (x) {
            return { id: String(x.id), name: String(x.name).slice(0, 20), created: Number(x.created) || 0 };
          });
          libs.current = p.current || (libs.list[0] && libs.list[0].id) || '';
        }
      }
    } catch (e) { libs = { current: '', list: [] }; }
    if (!libs.list.length) {
      var id = 'lib' + Date.now().toString(36);
      libs.list = [{ id: id, name: '默认名单库', created: Date.now() }];
      libs.current = id;
      saveLibs();
    }
    if (!libs.list.some(function (x) { return x.id === libs.current; })) libs.current = libs.list[0].id;
  }
  function libSnapshot() {
    return JSON.stringify({
      version: state.version, seq: state.seq, participants: state.participants, history: state.history,
      drawIndex: state.drawIndex, last: state.last, achv: state.achv, logs: (state.logs || []).slice(-60),
      archive: state.archive, pointLog: state.pointLog, pointSeq: state.pointSeq, seatmap: state.seatmap,
      settings: { groupColors: state.settings.groupColors, pity: state.settings.pity }
    });
  }
  function libStore(id) {
    if (!id) return true;
    try { localStorage.setItem(libKey(id), libSnapshot()); return true; }
    catch (e) {
      toast(lang() === 'en' ? 'Could not save this library — storage is full' : '名单库保存失败：本地存储已满，请先导出备份', 'err');
      return false;
    }
  }
  function libCount(id) {
    try {
      var raw = id === libs.current ? localStorage.getItem(KEY) : localStorage.getItem(libKey(id));
      if (!raw) return 0;
      var p = JSON.parse(raw);
      return Array.isArray(p.participants) ? p.participants.length : 0;
    } catch (e) { return 0; }
  }
  function buildLibList() {
    var box = $('#libList'); if (!box) return;
    var L = lang();
    box.innerHTML = libs.list.map(function (l) {
      var on = l.id === libs.current;
      return '<div class="lib-row' + (on ? ' on' : '') + '">' +
        '<div class="lib-main"><b class="lib-name">' + esc(l.name) + '</b>' +
        '<span class="lib-meta">' + libCount(l.id) + (L === 'en' ? ' people' : ' 人') + (on ? (L === 'en' ? ' · current' : ' · 当前') : '') + '</span></div>' +
        (on
          ? '<button type="button" class="mini-btn" disabled>' + (L === 'en' ? 'In use' : '使用中') + '</button>'
          : '<button type="button" class="mini-btn" data-libswitch="' + l.id + '">' + (L === 'en' ? 'Switch' : '切换') + '</button>') +
        '<button type="button" class="mini-btn" data-librename="' + l.id + '">' + (L === 'en' ? 'Rename' : '重命名') + '</button>' +
        '<button type="button" class="mini-btn" data-libcopy="' + l.id + '">' + (L === 'en' ? 'Copy' : '复制') + '</button>' +
        '<button type="button" class="mini-btn del" data-libdel="' + l.id + '">' + (L === 'en' ? 'Delete' : '删除') + '</button>' +
        '</div>';
    }).join('');
    var st = $('#libStatus');
    if (st) st.textContent = (L === 'en'
      ? (libs.list.length + ' libraries · each keeps its own roster, history and pity counter')
      : (libs.list.length + ' 套名单库 · 各自独立保存名单、历史与保底进度'));
  }
  var libLoadingEl = null;
  function showLibLoading(text) {
    if (!libLoadingEl) {
      libLoadingEl = document.createElement('div');
      libLoadingEl.className = 'lib-loading';
      libLoadingEl.innerHTML = '<span class="lib-spinner"></span><span class="lib-loading-text"></span>';
      document.body.appendChild(libLoadingEl);
    }
    libLoadingEl.querySelector('.lib-loading-text').textContent = text || '';
    libLoadingEl.classList.add('on');
    clearTimeout(libLoadingEl._t);
    libLoadingEl._t = setTimeout(function () { libLoadingEl.classList.remove('on'); }, 4000);
  }
  function hideLibLoading() { if (libLoadingEl) libLoadingEl.classList.remove('on'); }

  async function copyLib(id) {
    var L = lang();
    var src = libs.list.filter(function (x) { return x.id === id; })[0];
    if (!src) return;
    var name = await askText({
      title: L === 'en' ? 'Copy library' : '复制名单库',
      msg: (L === 'en'
        ? ('Copy <b>' + esc(src.name) + '</b> with its roster, history, pity and points? The copy is independent.')
        : ('复制 <b>' + esc(src.name) + '</b>？会同时复制名单、历史、保底与积分，副本与原库互不影响。')),
      value: (L === 'en' ? src.name + ' copy' : src.name + ' 副本'),
      max: 20, ok: L === 'en' ? 'Copy' : '复制'
    });
    if (!name) return;
    flushSave();
    if (!libStore(libs.current)) return;
    showLibLoading(L === 'en' ? 'Copying library…' : '正在复制名单库…');
    await new Promise(function (r) { setTimeout(r, 180); });
    try {
      var raw = null;
      try { raw = id === libs.current ? localStorage.getItem(KEY) : localStorage.getItem(libKey(id)); } catch (e) { }
      if (!raw) { toast(L === 'en' ? 'Source library is empty' : '源名单库为空，无法复制', 'err'); return; }
      var newId = 'lib' + Date.now().toString(36);
      try { localStorage.setItem(libKey(newId), raw); } catch (e) {
        toast(L === 'en' ? 'Copy failed: storage full' : '复制失败：本地存储已满', 'err');
        return;
      }
      libs.list.push({ id: newId, name: String(name).slice(0, 20), created: Date.now() });
      saveLibs(); buildLibList(); renderSettings();
      toast(L === 'en' ? ('Copied as ' + name) : ('已复制为「' + name + '」'), 'ok');
    } finally { hideLibLoading(); }
  }

  async function switchLib(id) {
    if (!id || id === libs.current) return;
    var target = libs.list.filter(function (x) { return x.id === id; })[0];
    if (!target) return;
    var ok = await ask({
      title: lang() === 'en' ? 'Switch library' : '切换名单库',
      msg: (lang() === 'en'
        ? ('Switch to <b>' + esc(target.name) + '</b>? The current library is saved automatically first.')
        : ('切换到 <b>' + esc(target.name) + '</b>？当前名单库会先自动保存。')),
      ok: lang() === 'en' ? 'Switch' : '切换'
    });
    if (!ok) return;
    flushSave();   // 切换前强制落盘，避免防抖窗口内丢改动
    showLibLoading(lang() === 'en' ? ('Loading ' + target.name + '…') : ('正在加载「' + target.name + '」…'));
    await new Promise(function (r) { setTimeout(r, 180); });
    if (!libStore(libs.current)) { hideLibLoading(); return; }
    var raw = null;
    try { raw = localStorage.getItem(libKey(id)); } catch (e) { }
    var prevSettings = state.settings;
    try { localStorage.setItem(KEY, raw || JSON.stringify(freshState())); } catch (e) {
      toast(lang() === 'en' ? 'Switch failed: storage full' : '切换失败：本地存储已满', 'err');
      return;
    }
    libs.current = id; saveLibs();
    loadState();
    // 主题 / 概率 / 音效等属于全局设置；分组配色与保底进度跟随名单库
    var libPity = state.settings.pity, libColors = state.settings.groupColors;
    state.settings = prevSettings;
    if (libPity) state.settings.pity = libPity;
    if (libColors) state.settings.groupColors = libColors;
    selected = {}; editingUid = null; vsStep = 0;
    save();
    applyTheme(); applyAccent(); applyBg(); applySkin(); applySoundBtn(); applyLang();
    renderAll(); renderSettings(); buildLibList();
    Sfx.play('success', 0.7);
    logAction('lib', (lang() === 'en' ? 'Switched library: ' : '切换名单库：') + target.name);
    hideLibLoading();
    toast(lang() === 'en' ? ('Now on ' + target.name) : ('已切换到「' + target.name + '」'), 'ok');
  }
  async function newLib() {
    var name = await askText({
      title: lang() === 'en' ? 'New library' : '新建名单库',
      msg: lang() === 'en' ? 'Name this library. It starts with an empty roster.' : '给新名单库取个名字，会从空名单开始。',
      ph: lang() === 'en' ? 'e.g. Class 3' : '例如 高一(3)班',
      value: (lang() === 'en' ? 'Library ' : '名单库 ') + (libs.list.length + 1), max: 20
    });
    if (!name) return;
    flushSave();
    if (!libStore(libs.current)) return;
    var id = 'lib' + Date.now().toString(36);
    libs.list.push({ id: id, name: String(name).slice(0, 20), created: Date.now() });
    libs.current = id;
    saveLibs();
    var prevSettings = state.settings;
    var fresh = freshState();
    // 全局设置沿用，但新名单库的分组配色与保底计数从零开始
    var kept = {};
    for (var k in prevSettings) { if (k !== 'groupColors' && k !== 'pity') kept[k] = prevSettings[k]; }
    kept.groupColors = {};
    kept.pity = {};
    for (var pk in prevSettings.pity) kept.pity[pk] = prevSettings.pity[pk];
    kept.pity.c5 = 0;
    fresh.settings = kept;
    state = fresh;
    try { localStorage.removeItem(libKey(id)); } catch (e) { }
    selected = {}; editingUid = null; vsStep = 0;
    save();
    applyLang();
    syncDrawModeUI(); renderAll(); renderSettings(); buildLibList();
    toast(lang() === 'en' ? ('Created ' + name) : ('已新建名单库「' + name + '」'), 'ok');
  }
  async function renameLib(id) {
    var target = libs.list.filter(function (x) { return x.id === id; })[0];
    if (!target) return;
    var name = await askText({
      title: lang() === 'en' ? 'Rename library' : '重命名名单库',
      msg: lang() === 'en' ? 'New name:' : '新的名字：',
      value: target.name, max: 20
    });
    if (!name) return;
    target.name = String(name).slice(0, 20);
    saveLibs(); buildLibList(); renderSettings();
    logAction('lib', (lang() === 'en' ? 'Renamed library to ' : '名单库重命名为 ') + target.name);
    toast(lang() === 'en' ? 'Renamed' : '已重命名', 'ok');
  }
  async function delLib(id) {
    if (libs.list.length <= 1) {
      toast(lang() === 'en' ? 'Keep at least one library' : '至少要保留一套名单库', 'err');
      return;
    }
    var target = libs.list.filter(function (x) { return x.id === id; })[0];
    if (!target) return;
    var ok = await ask({
      title: lang() === 'en' ? 'Delete library' : '删除名单库',
      msg: (lang() === 'en'
        ? ('Delete <b>' + esc(target.name) + '</b> and everything stored in it? This cannot be undone.')
        : ('确定删除 <b>' + esc(target.name) + '</b> 及其名单与历史吗？此操作不可撤销。')),
      ok: lang() === 'en' ? 'Delete' : '删除', danger: true
    });
    if (!ok) return;
    var wasCurrent = id === libs.current;
    try { localStorage.removeItem(libKey(id)); } catch (e) { }
    libs.list = libs.list.filter(function (x) { return x.id !== id; });
    if (wasCurrent) {
      libs.current = libs.list[0].id;
      var raw = null;
      try { raw = localStorage.getItem(libKey(libs.current)); } catch (e) { }
      var prev = state.settings;
      try { localStorage.setItem(KEY, raw || JSON.stringify(freshState())); } catch (e) { }
      saveLibs(); loadState();
      var p2 = state.settings.pity, c2 = state.settings.groupColors;
      state.settings = prev;
      if (p2) state.settings.pity = p2;
      if (c2) state.settings.groupColors = c2;
      selected = {}; editingUid = null; save();
      applyLang(); renderAll();
    }
    saveLibs(); buildLibList(); renderSettings();
    toast(lang() === 'en' ? ('Deleted ' + target.name) : ('已删除「' + target.name + '」'), 'ok');
  }

  /* ---------------- 撤销 / 重做（50 步，覆盖设置类操作） ---------------- */
  var undoStack = [], redoStack = [], MAX_UNDO = 50;
  function snapshot() {
    return JSON.stringify({
      participants: state.participants, history: state.history, seq: state.seq,
      drawIndex: state.drawIndex, last: state.last,
      settings: state.settings, achv: state.achv, logs: state.logs.slice(-60), archive: state.archive,
      pointLog: state.pointLog, pointSeq: state.pointSeq, seatmap: state.seatmap
    });
  }
  function applySnap(json) {
    var o = JSON.parse(json);
    state.participants = o.participants || [];
    state.history = o.history || [];
    state.seq = o.seq || 1;
    state.drawIndex = o.drawIndex || 0;
    state.last = o.last || null;
    if (o.settings && typeof o.settings === 'object') {
      var merged = defaultSettings(), S = o.settings;
      for (var k in merged) { if (k in S) merged[k] = S[k]; }
      merged.pity = { enabled: !!(S.pity && S.pity.enabled), tenFour: !(S.pity && S.pity.tenFour === false), fiftyFive: !(S.pity && S.pity.fiftyFive === false), c5: Number(S.pity && S.pity.c5) || 0, lucky: !!(S.pity && S.pity.lucky), luckyStep: Number(S.pity && S.pity.luckyStep) || 1 };
      merged.sound = { enabled: !(S.sound && S.sound.enabled === false), volume: Number(S.sound && S.sound.volume) || 0 };
      merged.stars = numStars(S.stars);
      merged.weights = { enabled: !!(S.weights && S.weights.enabled), mult: numMult(S.weights && S.weights.mult) };
      merged.shortcuts = { enabled: !(S.shortcuts && S.shortcuts.enabled === false), spaceDraw: !(S.shortcuts && S.shortcuts.spaceDraw === false), keys: (S.shortcuts && S.shortcuts.keys) || defaultShortcutKeys() };
      state.settings = merged;
    }
    if (o.achv && typeof o.achv === 'object') state.achv = o.achv;
    state.archive = o.archive || null;
    state.pointLog = Array.isArray(o.pointLog) ? o.pointLog : [];
    state.pointSeq = Number(o.pointSeq) || (state.pointLog.length + 1);
    state.seatmap = normalizeSeatmap(o.seatmap, state.participants);
    syncSeatmap();
    recountPoints();
    if (Array.isArray(o.logs)) state.logs = o.logs;
  }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    syncUndoBtns();
    persistUndo();
  }
  function undo() {
    if (!undoStack.length) { toast('没有可撤销的操作', 'err'); return; }
    redoStack.push(snapshot());
    applySnap(undoStack.pop());
    afterStateReplace();
    persistUndo();
    toast('已撤销', 'ok');
  }
  function redo() {
    if (!redoStack.length) { toast('没有可重做的操作', 'err'); return; }
    undoStack.push(snapshot());
    applySnap(redoStack.pop());
    afterStateReplace();
    persistUndo();
    toast('已重做', 'ok');
  }

  /* 撤销栈持久化：只保留最近 10 步，刷新/重开页面仍可撤销 */
  function persistUndo() {
    try {
      var payload = JSON.stringify({ u: undoStack.slice(-UNDO_PERSIST), r: redoStack.slice(-UNDO_PERSIST) });
      // 快照很大时不再写盘（避免把 5 MB 配额吃满）
      if (bytesOf(payload) > 900 * 1024) {
        localStorage.removeItem(UKEY);
        return;
      }
      localStorage.setItem(UKEY, payload);
    } catch (e) {
      try { localStorage.removeItem(UKEY); } catch (e2) { }
    }
  }
  function restoreUndo() {
    undoStack = []; redoStack = [];
    try {
      var raw = localStorage.getItem(UKEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.u)) undoStack = p.u.slice(-UNDO_PERSIST);
        if (p && Array.isArray(p.r)) redoStack = p.r.slice(-UNDO_PERSIST);
      }
    } catch (e) { undoStack = []; redoStack = []; }
    // 校验快照可解析，损坏的直接丢弃
    undoStack = undoStack.filter(function (s) { try { JSON.parse(s); return true; } catch (e) { return false; } });
    redoStack = redoStack.filter(function (s) { try { JSON.parse(s); return true; } catch (e) { return false; } });
    syncUndoBtns();
  }
  function afterStateReplace() {
    save();
    applyTheme(); applyAccent(); applyBg(); applySkin(); applySoundBtn(); applyLang();
    buildStarConfig(); buildWeightGrid(); buildKbList();
    renderAll(); renderSettings(); syncUndoBtns();
    if ($('#pointsModal') && $('#pointsModal').classList.contains('active')) renderPoints();
  }
  function syncUndoBtns() {
    var u = $('#undoBtn'), r = $('#redoBtn');
    if (u) { u.disabled = !undoStack.length; u.style.opacity = undoStack.length ? '' : '.4'; }
    if (r) { r.disabled = !redoStack.length; r.style.opacity = redoStack.length ? '' : '.4'; }
    // 两颗都不可用时整条 dock 进入 idle：视觉淡出且不拦截点击（避免小屏幕上挡住舞台按钮）
    var dock = $('#dock');
    if (dock) dock.classList.toggle('idle', !undoStack.length && !redoStack.length);
  }

  /* ---------------- 滚动锁定 + 弹窗 ---------------- */
  var lockCount = 0;
  var openLayers = [];
  function lockScroll() {
    lockCount++;
    if (lockCount === 1) document.body.classList.add('locked');
  }
  function unlockScroll() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.classList.remove('locked');
  }
  function markOpen(el) {
    if (openLayers.indexOf(el) < 0) { openLayers.push(el); lockScroll(); }
  }
  function markClosed(el) {
    var i = openLayers.indexOf(el);
    if (i >= 0) { openLayers.splice(i, 1); unlockScroll(); }
  }
  /* ---------------- 模态可访问性（P0）：焦点还原 / 初始聚焦 / Tab 循环 ---------------- */
  var modalReturnFocus = {};
  function focusables(root) {
    return $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', root)
      .filter(function (x) { return x.offsetWidth > 0 || x.offsetHeight > 0 || x.getClientRects().length; });
  }
  function focusFirstIn(el) {
    if (!el) return;
    var auto = el.querySelector('[autofocus]');
    /* 默认聚焦弹窗容器：不受子元素 visibility 过渡影响，读屏器会播报 aria-labelledby；
       需要输入的场景（导入、确认框、命名框）随后会自行把焦点移到输入框/主按钮。 */
    var target = auto || el.querySelector('.modal-card');
    if (target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    if (target) {
      if (!target.hasAttribute('tabindex') && target.classList.contains('modal-card')) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) { } }
    }
  }
  function openModal(el) {
    if (!el) return;
    if (!el.classList.contains('active')) modalReturnFocus[el.id] = document.activeElement;
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
    markOpen(el);
    var body = el.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
    if (el.id === 'settingsModal') { renderSettings(); var nv = $('#setNav'); if (nv) $$('[data-target]', nv).forEach(function (b, i) { b.classList.toggle('active', i === 0); }); }
    if (el.id === 'historyModal') renderHistory();
    if (el.id === 'statsModal') renderStats();
    if (el.id === 'pointsModal') { pointSel = {}; renderPoints(); }
    if (el.id === 'seatModal') { seatEdit = false; seatSel = null; renderSeatMap(); }
    if (el.id === 'importModal') {
      renderImportPreview();
      var focusImport = function () { var t = $('#importText'); if (t && el.classList.contains('active')) { try { t.focus(); } catch (e) { } } };
      setTimeout(focusImport, 60);
      setTimeout(focusImport, 360);
    }
    setTimeout(function () {
      if (el.classList.contains('active') && !el.contains(document.activeElement)) focusFirstIn(el);
    }, 45);
    Sfx.play('click', 0.5);
  }
  function closeEl(el) {
    if (!el) return;
    if (el.id === 'confirmModal') { settleConfirm(false); return; }
    if (el.id === 'tenOverlay') { hideTenOverlay(); return; }
    if (el.id === 'drawOverlay') { hideDrawOverlay(); return; }
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
    markClosed(el);
    if (el.classList.contains('modal')) {
      var rf = modalReturnFocus[el.id];
      delete modalReturnFocus[el.id];
      if (rf && document.contains(rf)) {
        try { rf.focus({ preventScroll: true }); } catch (e) { try { rf.focus(); } catch (e2) { } }
      }
    }
  }
  function anyLayerOpen() { return openLayers.length > 0; }
  function closeTop() {
    if (!openLayers.length) return;
    closeEl(openLayers[openLayers.length - 1]);
  }

  /* Tab / Shift+Tab 在顶层模态内循环，防止焦点跑到背景 */
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var top = openLayers[openLayers.length - 1];
    if (!top || !top.classList || !top.classList.contains('modal') || !top.classList.contains('active')) return;
    var f = focusables(top);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], act = document.activeElement;
    if (e.shiftKey) {
      if (act === first || !top.contains(act)) { e.preventDefault(); try { last.focus(); } catch (err) { } }
    } else if (act === last || !top.contains(act)) {
      e.preventDefault(); try { first.focus(); } catch (err) { }
    }
  }, true);

  /* ---------------- 确认弹窗 ---------------- */
  var confirmResolve = null;
  function settleConfirm(v) {
    var m = $('#confirmModal');
    var r = confirmResolve; confirmResolve = null;
    if (m) {
      m.classList.remove('active');
      m.setAttribute('aria-hidden', 'true');
      markClosed(m);
    }
    var rf = modalReturnFocus['confirmModal'];
    delete modalReturnFocus['confirmModal'];
    if (rf && document.contains(rf)) {
      try { rf.focus({ preventScroll: true }); } catch (e) { try { rf.focus(); } catch (e2) { } }
    }
    if (r) r(v);
  }
  function ask(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = $('#confirmModal'); if (!m) { resolve(false); return; }
      var Lc = lang();
      $('#confirmTitle').textContent = opts.title || (Lc === 'en' ? 'Confirm' : '确认');
      $('#confirmMsg').innerHTML = opts.msg || '';
      var ok = $('#confirmOk'), cancel = $('#confirmCancel');
      ok.textContent = opts.ok || (Lc === 'en' ? 'OK' : '确定');
      cancel.textContent = opts.cancel || (Lc === 'en' ? 'Cancel' : '取消');
      ok.classList.toggle('danger-fill', !!opts.danger);
      // 三选一：额外按钮（按顺序插到脚部最左侧）
      var foot = m.querySelector('.modal-foot');
      if (foot) {
        $$('.extra-btn', foot).forEach(function (b) { b.parentNode.removeChild(b); });
        if (Array.isArray(opts.extra)) {
          opts.extra.forEach(function (x) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'extra-btn' + (x.danger ? ' danger' : '');
            b.textContent = x.label;
            b.addEventListener('click', function () { settleConfirm(x.value); });
            foot.insertBefore(b, foot.firstChild);
          });
        }
      }
      confirmResolve = resolve;
      openModal(m);
      setTimeout(function () { try { ok.focus(); } catch (e) { } }, 50);
      setTimeout(function () { if (m.classList.contains('active')) { try { ok.focus(); } catch (e) { } } }, 360);
    });
  }

  /* 文本输入确认框（用于分组重命名 / 批量移动 / 名单库命名） */
  function askText(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = $('#confirmModal'); if (!m) { resolve(null); return; }
      var Lt = lang();
      $('#confirmTitle').textContent = opts.title || (Lt === 'en' ? 'Input' : '输入');
      var hint = opts.hint ? '<p style="margin-top:6px;opacity:.7;font-size:12px;line-height:1.6">' + opts.hint + '</p>' : '';
      $('#confirmMsg').innerHTML = '<p style="line-height:1.7;margin-bottom:8px">' + (opts.msg || '') + '</p>' +
        '<input id="askTextInput" class="ctl-text" style="width:100%" maxlength="' + (opts.max || 20) + '" ' +
        'value="' + esc(opts.value || '') + '" placeholder="' + esc(opts.ph || '') + '">' + hint;
      var ok = $('#confirmOk'), cancel = $('#confirmCancel');
      ok.textContent = opts.ok || (Lt === 'en' ? 'OK' : '确定');
      cancel.textContent = opts.cancel || (Lt === 'en' ? 'Cancel' : '取消');
      ok.classList.remove('danger-fill');
      var foot = m.querySelector('.modal-foot');
      if (foot) $$('.extra-btn', foot).forEach(function (b) { b.parentNode.removeChild(b); });
      confirmResolve = function (v) {
        var input = $('#askTextInput');
        resolve(v === true && input ? input.value.trim() : null);
      };
      openModal(m);
      var focusAsk = function () {
        var input = $('#askTextInput');
        if (!input || !m.classList.contains('active')) return;
        input.focus(); try { input.select(); } catch (e) { }
      };
      setTimeout(focusAsk, 360);
      setTimeout(function () {
        var input = $('#askTextInput');
        if (!input) return;
        input.focus(); try { input.select(); } catch (e) { }
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); var ok2 = $('#confirmOk'); if (ok2) ok2.click(); }
        });
      }, 80);
    });
  }


  function toast(msg, kind) {
    var box = $('#toastBox'); if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2600);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
    while (box.children.length > 4) box.removeChild(box.firstChild);
  }

  /* ---------------- 名单 ---------------- */
  function starSum() { return __core__.starsTotal(state.settings.stars); }
  function oddsOk() { return state.settings.weights.enabled ? true : starSum() === 100; }
  function drawnCount() { return state.participants.filter(function (p) { return p.drawn; }).length; }
  function excludedCount() { return state.participants.filter(function (p) { return p.excluded; }).length; }
  function luckBonus() {
    var P = state.settings.pity;
    return __core__.luckBonus(P.c5, P.lucky, P.luckyStep);
  }
  function starWeights() {
    var w = {}, k;
    if (state.settings.weights.enabled) {
      for (k = 5; k >= 1; k--) w[k] = Math.max(0, Number(state.settings.weights.mult[k]) || 0);
    } else {
      var norm = __core__.normalizeStars(state.settings.stars);
      for (k = 5; k >= 1; k--) w[k] = norm[k];
    }
    if (w[5] > 0) w[5] = w[5] + luckBonus();
    return w;
  }
  function weightPercent() {
    return __core__.percentOf(starWeights());
  }
  function groups() {
    var set = {}, list = [];
    state.participants.forEach(function (p) { if (p.group && !set[p.group]) { set[p.group] = 1; list.push(p.group); } });
    return list.sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
  }
  function hasNoGroup() { return state.participants.some(function (p) { return !p.group; }); }

  var GROUP_PALETTE = ['#6ee7ff', '#c77dff', '#8affc1', '#ffd700', '#ff9db1', '#9db4ff', '#7ef0d8', '#ffb066'];
  function groupColor(g) {
    if (!g) return '';
    var m = state.settings.groupColors || {};
    if (m[g]) return m[g];
    var h = 0;
    for (var i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) % 9973;
    return GROUP_PALETTE[h % GROUP_PALETTE.length];
  }
  function renameGroup(from, to) {
    if (!from || !to || from === to) return false;
    if (groups().indexOf(to) >= 0) return false;
    var n = 0;
    state.participants.forEach(function (p) { if (p.group === from) { p.group = to; n++; } });
    var m = state.settings.groupColors || {};
    if (m[from]) { m[to] = m[from]; delete m[from]; }
    if (state.settings.group === from) state.settings.group = to;
    return n;
  }
  function dissolveGroup(g) {
    var n = 0;
    state.participants.forEach(function (p) { if (p.group === g) { p.group = ''; n++; } });
    var m = state.settings.groupColors || {};
    delete m[g];
    if (state.settings.group === g) { state.settings.group = 'all'; state.settings.scope = 'all'; }
    return n;
  }

  function nextUid() { return 'p' + (state.seq++); }
  function nextOrder() {
    var m = 0;
    state.participants.forEach(function (p) { if (p.order > m) m = p.order; });
    return m + 1;
  }
  function pool() {
    var arr = state.participants.slice();
    if (state.settings.mode === 'unique') arr = arr.filter(function (p) { return !p.drawn; });
    arr = arr.filter(function (p) { return !p.excluded; });
    if (state.settings.scope === 'group' && state.settings.group !== 'all') {
      var g = state.settings.group;
      arr = arr.filter(function (p) { return g === '__none' ? !p.group : p.group === g; });
    }
    return arr;
  }

  /* 三个独立候选池：名单抽 pool()；学号抽 poolIds()；座位抽 poolSeats() */
  function poolIds() {
    return state.participants.filter(function (p) { return p.id && !p.excluded; });
  }
  function poolSeats() {
    var by = participantsByUid(), out = [];
    (state.seatmap && Array.isArray(state.seatmap.grid) ? state.seatmap.grid : []).forEach(function (uid, i) {
      var p = uid ? by[uid] : null;
      if (p) out.push({ p: p, seat: i, no: Number(state.seatmap.numbers[uid]) || 0 });
    });
    return out;
  }
  function poolNumbers() {
    var out = [];
    state.participants.forEach(function (p) {
      var no = seatNoOf(p.uid);
      if (no >= 1) out.push({ p: p, no: no, seat: seatIndexOfUid(p.uid) });
    });
    return out;
  }

  var selected = {};
  function selectedUids() { return Object.keys(selected).filter(function (k) { return selected[k]; }); }

  /* 常见多音姓氏首字母（避免 Intl 按常用读音给出错误首字母） */
  var SURNAME_PY = {
    '曾': 'Z', '解': 'X', '单': 'S', '仇': 'Q', '区': 'O', '查': 'Z', '繁': 'P', '员': 'Y',
    '燕': 'Y', '任': 'R', '折': 'S', '乐': 'Y', '覃': 'Q', '朴': 'P', '尉': 'Y', '盖': 'G',
    '缪': 'M', '句': 'G', '秘': 'B', '种': 'C', '褚': 'C', '靳': 'J', '阚': 'K', '翟': 'Z',
    '祭': 'Z', '莘': 'S', '澹': 'T', '长': 'C', '重': 'C', '隗': 'W', '钭': 'T', '过': 'G'
  };
  var PY_BOUND = [['A', '阿'], ['B', '八'], ['C', '擦'], ['D', '搭'], ['E', '蛾'], ['F', '发'], ['G', '旮'], ['H', '哈'],
    ['J', '击'], ['K', '咔'], ['L', '拉'], ['M', '妈'], ['N', '拿'], ['O', '噢'], ['P', '啪'], ['Q', '期'],
    ['R', '然'], ['S', '撒'], ['T', '塌'], ['W', '挖'], ['X', '昔'], ['Y', '压'], ['Z', '匝']];
  var pyColl = null;
  function pyCollator() {
    if (pyColl) return pyColl;
    try { pyColl = new Intl.Collator('zh-Hans-u-co-pinyin'); } catch (e) { pyColl = new Intl.Collator('zh-Hans-CN'); }
    return pyColl;
  }
  /* 取首字拼音首字母（a-z），非中文按原字符大写 */
  function pyOf(text) {
    var ch = String(text || '').charAt(0);
    if (!ch) return '';
    if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
    if (/[0-9]/.test(ch)) return '0';
    if (SURNAME_PY[ch]) return SURNAME_PY[ch];
    var col = pyCollator(), res = '~';
    for (var i = 0; i < PY_BOUND.length; i++) {
      if (col.compare(ch, PY_BOUND[i][1]) >= 0) res = PY_BOUND[i][0]; else break;
    }
    return res;
  }

  function bestStarMap() {
    var m = {};
    state.history.forEach(function (h) {
      var k = h.uid || ('name:' + h.name);
      var s = Math.max(1, Math.min(5, Number(h.star) || 1));
      if (!m[k] || s > m[k]) m[k] = s;
    });
    return m;
  }

  function visibleParticipants() {
    var q = (state.settings.search || '').trim().toLowerCase();
    var f = state.settings.filter, g = state.settings.group, s = state.settings.sort;
    var sf = state.settings.starFilter, cf = state.settings.countFilter, ef = state.settings.excludeFilter;
    var desc = state.settings.sortDir === 'desc';
    var bestStars = (sf === 'all' && cf === 'all') ? null : bestStarMap();
    var list = state.participants.filter(function (p) {
      if (f === 'drawn' && !p.drawn) return false;
      if (f === 'undrawn' && p.drawn) return false;
      if (ef === 'only' && !p.excluded) return false;
      if (ef === 'off' && p.excluded) return false;
      if (g !== 'all') { if (g === '__none') { if (p.group) return false; } else if (p.group !== g) return false; }
      if (cf !== 'all' && (Number(p.count) || 0) < Number(cf)) return false;
      if (sf !== 'all') {
        var b = (bestStars && (bestStars[p.uid] || bestStars['name:' + p.name])) || 0;
        if (sf === 'none') { if (b) return false; }
        else if (b !== Number(sf)) return false;
      }
      if (q) {
        var hay = (p.name + ' ' + (p.id || '') + ' ' + (p.group || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    list.sort(function (a, b) {
      var c = 0;
      if (s === 'name') c = a.name.localeCompare(b.name, 'zh-Hans-CN');
      else if (s === 'pinyin') {
        var pa = pyOf(a.name), pb = pyOf(b.name);
        c = pa === pb ? a.name.localeCompare(b.name, 'zh-Hans-CN') : (pa < pb ? -1 : 1);
      } else if (s === 'id') c = String(a.id || '').localeCompare(String(b.id || ''), 'zh-Hans-CN', { numeric: true });
      else if (s === 'drawn') {
        if (a.drawn !== b.drawn) c = a.drawn ? -1 : 1;
        else if (a.drawn) c = (b.drawnAt || 0) - (a.drawnAt || 0);
        else c = a.order - b.order;
      } else if (s === 'count') {
        var ca = Number(a.count) || 0, cb = Number(b.count) || 0;
        c = ca !== cb ? cb - ca : a.order - b.order;
      } else {
        c = a.order - b.order;
      }
      if (!c) c = a.order - b.order;
      return desc ? -c : c;
    });
    return list;
  }

  var VS_LIMIT = 200, VS_BUFFER = 10, ROW_H = 80;
  var vsRows = [], vsQ = '', vsActive = false, vsRaf = 0, vsKey = '', vsStep = 0;

  /* 行高按首次实测缓存，避免字体/缩放导致滚动位置漂移 */
  function vsRowStep() {
    if (vsStep) return vsStep;
    var list = $('#rosterList');
    var el = list ? list.querySelector('.p-row') : null;
    if (el) {
      var h = el.getBoundingClientRect().height;
      var gap = list ? (parseFloat(getComputedStyle(list).rowGap) || 8) : 8;
      if (h > 20) vsStep = Math.round(h + gap);
    }
    return vsStep || ROW_H;
  }

  /* 虚拟滚动：只在「可视窗口下标变化」时重绘，并用 rAF 合并滚动事件
     —— 滚动时不再每次全量拼 HTML，帧率明显更稳。 */
  function vsPaint() {
    var list = $('#rosterList'); if (!list || !vsActive) return;
    var step = vsRowStep();
    var h = list.clientHeight || 420, top = list.scrollTop || 0;
    var start = Math.max(0, Math.floor(top / step) - VS_BUFFER);
    var end = Math.min(vsRows.length, start + Math.ceil(h / step) + VS_BUFFER * 2);
    var key = start + ':' + end + ':' + vsRows.length + ':' + step + ':' +
      (vsRows[start] ? vsRows[start].uid : '') + ':' + (vsRows[end - 1] ? vsRows[end - 1].uid : '');
    if (key === vsKey) return;
    vsKey = key;
    var slice = vsRows.slice(start, end);
    list.innerHTML =
      (start ? '<div class="vs-spacer" style="height:' + (start * step) + 'px"></div>' : '') +
      slice.map(function (p) { return rosterRowHtml(p, vsQ); }).join('') +
      (end < vsRows.length ? '<div class="vs-spacer" style="height:' + ((vsRows.length - end) * step) + 'px"></div>' : '');
    renderSelectionBar();
  }
  function vsSchedule() {
    if (vsRaf) return;
    // 用 16ms 定时器节流：比 rAF 更稳（后台/无头环境不会停帧），滚动仍是 ~60fps
    vsRaf = setTimeout(function () { vsRaf = 0; vsPaint(); }, 16);
  }

  function hl(text, q) {
    var raw = String(text == null ? '' : text);
    if (!q) return esc(raw);
    var i = raw.toLowerCase().indexOf(String(q).toLowerCase());
    if (i < 0) return esc(raw);
    return esc(raw.slice(0, i)) + '<mark class="search-hl">' + esc(raw.slice(i, i + q.length)) + '</mark>' + esc(raw.slice(i + q.length));
  }

  function rosterRowHtml(p, q) {
    var L = lang();
    if (editingUid === p.uid) {
      return '<div class="p-row editing" data-uid="' + p.uid + '">' +
        '<input type="text" data-f="name" maxlength="20" value="' + esc(p.name) + '" placeholder="' + (L === 'en' ? 'Name' : '姓名') + '">' +
        '<input type="text" data-f="id" maxlength="30" value="' + esc(p.id) + '" placeholder="' + (L === 'en' ? 'Student ID' : '学号') + '">' +
        '<input type="text" data-f="group" maxlength="12" value="' + esc(p.group) + '" placeholder="' + (L === 'en' ? 'Group' : '分组') + '">' +
        '<div class="p-actions"><button type="button" class="mini-btn save" data-act="save">' + (L === 'en' ? 'Save' : '保存') + '</button>' +
        '<button type="button" class="mini-btn" data-act="cancel">' + (L === 'en' ? 'Cancel' : '取消') + '</button></div></div>';
    }
    var sel = !!selected[p.uid];
    var rep = state.settings.mode === 'repeat';
    var cnt = Number(p.count) || 0;
    var pts = pointsOf(p.uid);
    var lastTtl = (state.last && state.last.uid === p.uid) ? equippedTitle() : null;
    var gc = groupColor(p.group);
    return '<div class="p-row' + (p.drawn ? ' is-drawn' : '') + (p.excluded ? ' is-excluded' : '') + (sel ? ' selected' : '') + '" data-uid="' + p.uid + '"' +
      (gc ? ' style="--gcolor:' + gc + '"' : '') + '>' +
      '<label class="p-check"><input type="checkbox" data-role="sel"' + (sel ? ' checked' : '') + '></label>' +
      '<div class="p-avatar">' + (p.drawn && !rep ? '✓' : esc(firstChar(p.name))) + '</div>' +
      '<div class="p-info"><b>' + hl(p.name, q) + '</b><span class="' + (p.id ? '' : 'is-empty') + '">' +
      (p.id ? hl(p.id, q) : (L === 'en' ? 'NO ID' : '无学号')) +
      (lastTtl ? ' <em class="p-title-inline">' + lastTtl.ico + ' ' + esc(L === 'en' ? lastTtl.en : lastTtl.zh) + '</em>' : '') +
      '</span></div>' +
      (p.group ? '<span class="p-group">' + esc(p.group) + '</span>' : '') +
      '<span class="p-points' + (pts > 0 ? '' : (pts < 0 ? ' neg' : ' zero')) + '" data-points="' + p.uid + '" title="' + (L === 'en' ? 'Current points — click to edit' : '当前积分，点击可加减分') + '">' + fmtSigned(pts) + '</span>' +
      '<span class="p-count' + (cnt ? '' : ' zero') + '" title="' + (L === 'en' ? 'Times drawn' : '抽中次数') + '">×' + cnt + '</span>' +
      '<div class="p-actions">' +
      '<div class="p-quick">' +
      '<button type="button" class="mini-btn qplus" data-act="plus1" title="+1 ' + (L === 'en' ? 'point' : '分') + '">+1</button>' +
      '<button type="button" class="mini-btn qminus" data-act="minus1" title="-1 ' + (L === 'en' ? 'point' : '分') + '">−1</button>' +
      '</div>' +
      '<button type="button" class="mini-btn" data-act="edit">' + (L === 'en' ? 'Edit' : '改') + '</button>' +
      (p.excluded
        ? '<button type="button" class="mini-btn excl on" data-act="include">' + (L === 'en' ? 'Include' : '恢复') + '</button>'
        : '<button type="button" class="mini-btn excl" data-act="exclude">' + (L === 'en' ? 'Exclude' : '排除') + '</button>') +
      (p.drawn && !rep ? '<button type="button" class="mini-btn return" data-act="return">' + (L === 'en' ? 'Return' : '放回') + '</button>' : '') +
      '<button type="button" class="mini-btn del" data-act="del">' + (L === 'en' ? 'Del' : '删') + '</button>' +
      '</div></div>';
  }

  function resetListFilters() {
    state.settings.search = '';
    state.settings.filter = 'all';
    state.settings.starFilter = 'all';
    state.settings.countFilter = 'all';
    state.settings.excludeFilter = 'all';
    state.settings.group = 'all';
    var si = $('#searchInput'); if (si) si.value = '';
    var fs = $('#filterSelect'); if (fs) fs.value = 'all';
    save(); renderAll(); renderSettings();
    toast(lang() === 'en' ? 'Filters cleared' : '已清除筛选条件', 'ok');
  }

  function renderRoster() {
    var list = $('#rosterList'), empty = $('#rosterEmpty');
    if (!list || !empty) return;
    var rows = visibleParticipants();
    var total = state.participants.length;
    var q = (state.settings.search || '').trim();
    var L = lang();
    var emptyMsg;
    if (!total) {
      emptyMsg = '<b>' + (L === 'en' ? 'No participants yet' : '暂无参与者') + '</b><br>' +
        (L === 'en' ? 'Import a roster, or add one above.' : '请点击下方「导入」或在上方手动添加');
    } else if (!rows.length) {
      emptyMsg = (L === 'en' ? 'No match for the current filter / search' : '当前筛选或搜索没有匹配的人') +
        '<br><button type="button" class="mini-btn" data-resetfilters>' + (L === 'en' ? 'Clear filters' : '清除筛选') + '</button>';
    } else { emptyMsg = ''; }

    list.style.display = emptyMsg ? 'none' : 'flex';
    empty.style.display = emptyMsg ? 'block' : 'none';
    if (emptyMsg) { empty.innerHTML = emptyMsg; list.innerHTML = ''; vsActive = false; vsKey = ''; }
    if (!rows.length) { renderSelectionBar(); return; }

    var virtual = rows.length > VS_LIMIT && !editingUid;
    vsRows = rows; vsQ = q; vsActive = virtual;
    if (virtual) {
      if (vsRaf) { clearTimeout(vsRaf); vsRaf = 0; }
      vsKey = '';                 // 数据/筛选变化后强制重绘一次
      vsPaint();
      return;
    }
    vsKey = '';
    list.innerHTML = rows.map(function (p) { return rosterRowHtml(p, q); }).join('');
    renderSelectionBar();
  }

  function firstChar(s) { return String(s || '?').trim().charAt(0) || '?'; }

  var editingUid = null;

  function renderSelectionBar() {
    var bar = $('#batchBar'), cnt = $('#batchCount');
    var uids = selectedUids();
    if (bar) { bar.hidden = !uids.length; bar.style.display = uids.length ? 'flex' : 'none'; }
    if (cnt) cnt.textContent = (lang() === 'en' ? 'Selected ' : '已选 ') + uids.length + (lang() === 'en' ? '' : ' 人');
    var emptyEl = $('#rosterEmpty');
    if (emptyEl) emptyEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-resetfilters]') : null;
      if (b) resetListFilters();
    });

    var allBtn = $('#selectAllBtn');
    if (allBtn) {
      var vis = visibleParticipants();
      var allSel = vis.length > 0 && vis.every(function (p) { return selected[p.uid]; });
      allBtn.textContent = allSel
        ? (lang() === 'en' ? 'Select none' : '取消全选')
        : (lang() === 'en' ? 'Select all' : '全选');
    }
  }

  function renderGroups() {
    var sel = $('#groupSelect'); if (!sel) return;
    var gs = groups();
    var cur = state.settings.group;
    if (cur !== 'all' && cur !== '__none' && gs.indexOf(cur) < 0) cur = state.settings.group = 'all';
    if (cur === '__none' && !hasNoGroup()) cur = state.settings.group = 'all';
    var html = '<option value="all">' + (lang() === 'en' ? 'All groups' : '全部分组') + '</option>';
    if (hasNoGroup()) html += '<option value="__none">' + (lang() === 'en' ? 'Ungrouped' : '未分组') + '</option>';
    gs.forEach(function (g) { html += '<option value="' + esc(g) + '">' + esc(g) + '</option>'; });
    sel.innerHTML = html;
    sel.value = cur;
    renderScope();
  }

  /* 抽取范围：与分组选择严格同步（分组 = 全部 ⟺ 范围为全部名单） */
  function renderScope() {
    var L = lang();
    var isGroup = state.settings.group !== 'all';
    $$('#scopeSeg button').forEach(function (b) {
      var on = b.dataset.scope === (isGroup ? 'group' : 'all');
      b.classList.toggle('active', on);
      if (b.dataset.scope === 'group') b.disabled = !isGroup;
    });
    var name = $('#scopeName');
    if (name) {
      if (isGroup) {
        name.textContent = state.settings.group === '__none' ? (L === 'en' ? 'Ungrouped' : '未分组') : state.settings.group;
        name.classList.remove('off');
      } else {
        name.textContent = L === 'en' ? 'All' : '全部分组';
        name.classList.add('off');
      }
    }
    var sp = $('#speedChip');
    if (sp) sp.textContent = '⏩ ' + state.settings.animSpeed + 'x';
  }

  /* ---------------- 舞台 ---------------- */
  function renderStage() {
    var t = $('#statTotal'), d = $('#statDrawn'), l = $('#statLeft'), rc = $('#rosterCount');
    var dc = drawnCount(), total = state.participants.length;
    if (t) t.textContent = total;
    if (d) d.textContent = dc;
    if (l) l.textContent = state.settings.mode === 'repeat' ? total : (total - dc);
    if (rc) rc.textContent = total + (lang() === 'en' ? '' : ' 人');

    var badge = $('#stageBadge');
    if (badge) {
      var rep = state.settings.mode === 'repeat';
      if (!total) badge.textContent = lang() === 'en' ? 'Ready' : '待开始';
      else {
        var p = pool().length;
        badge.textContent = lang() === 'en'
          ? (p + ' available' + (rep ? ' · no marks' : ''))
          : ('可抽 ' + p + ' 人' + (rep ? ' · 全量不标记' : ''));
        badge.classList.toggle('is-repeat', rep);
      }
    }

    syncModeUI();
    renderLastCard();
    renderPity();
    var dtb = $('#drawTenBtn');
    if (dtb) {
      var n = Math.max(1, Math.min(50, Number(state.settings.pickCount) || 10));
      var lab = dtb.querySelector('span:last-child') || dtb;
      lab.textContent = lang() === 'en' ? ('Draw ' + n) : ('抽 ' + n);
      dtb.title = lang() === 'en' ? ('Batch draw ' + n + ' people (Shift+Space)') : ('批量抽取 ' + n + ' 人（Shift+空格）');
    }
    var lb = $('#lastCard');
    if (lb && state.last && state.last.seedHash) lb.dataset.seed = '#' + state.last.seedHash;
    renderStageNote();
  }

  var DRAW_MODES = ['number', 'seat', 'name'];
  function syncDrawModeUI() {
    var v = Math.max(0, DRAW_MODES.indexOf(state.settings.drawMode || 'name'));
    var range = $('#drawModeRange');
    if (range && Number(range.value) !== v) range.value = v;
    $$('.draw-mode-labels span').forEach(function (el) {
      el.classList.toggle('active', el.dataset.mode === DRAW_MODES[v]);
    });
  }

  /* 舞台常驻说明：把当前生效的模式 / 范围 / 批量 / 种子 / 保底写清楚 */
  function renderStageNote() {
    var el = $('#stageNote'); if (!el) return;
    var L = lang(), S = state.settings;
    var modeTxt = S.mode === 'repeat'
      ? (L === 'en' ? 'Repeatable — always draws from the full roster, nothing is marked' : '可重复 — 每次从全量名单抽，不标记已抽中')
      : (L === 'en' ? 'No-repeat — winners leave the pool and can be returned' : '不重复 — 抽中者移出候选池，可手动放回');
    var scopeTxt = S.group === 'all'
      ? (L === 'en' ? 'all groups' : '全部分组')
      : (S.group === '__none' ? (L === 'en' ? 'ungrouped' : '未分组') : S.group);
    var extra = [];
    if (Number(S.pickCount) !== 10) extra.push((L === 'en' ? 'batch ' : '批量 ') + S.pickCount + (L === 'en' ? ' people' : ' 人'));
    if (S.balance) extra.push(L === 'en' ? 'group-balanced' : '分组等比例');
    if (S.seed) extra.push((L === 'en' ? 'seed #' : '种子 #') + hashStr(String(S.seed)));
    if (S.pity.enabled) extra.push(L === 'en' ? 'pity on' : '保底开启');
    var drawModeTxt = S.drawMode === 'number' ? (L === 'en' ? 'draw: number' : '抽：序号')
      : (S.drawMode === 'seat' ? (L === 'en' ? 'draw: seat' : '抽：座位') : (L === 'en' ? 'draw: name' : '抽：名字'));
    el.innerHTML = '<span class="sn-ico">🧷</span><span class="sn-text">' +
      '<span class="sn-tag">' + (L === 'en' ? 'PERSISTENT' : '常驻') + '</span>' +
      '<b>' + modeTxt + '</b> · ' + drawModeTxt + ' · ' + (L === 'en' ? 'scope: ' : '范围：') + esc(scopeTxt) +
      (extra.length ? ' · ' + extra.join(' · ') : '') +
      '<br>' + (L === 'en'
        ? 'These settings stay in effect until you switch them above.'
        : '以上设置会一直生效，直到你在上方再次切换。') + '</span>';
  }

  function renderLastCard() {
    var L = lang();
    var card = $('#lastCard'), nm = $('#lastName'), idEl = $('#lastId'), st = $('#lastStar');
    var srcEl = $('#lastSource'), seatEl = $('#lastSeat'), noEl = $('#lastNo'), metaEl = $('#lastMeta');
    if (!card) return;
    var last = state.last;
    card.classList.remove('is-id', 'is-seat', 'is-number');
    if (!last) {
      card.classList.remove('has-data');
      if (nm) nm.textContent = '—';
      if (idEl) { idEl.textContent = L === 'en' ? 'Waiting' : '等待开始'; idEl.classList.add('is-empty'); }
      if (st) { st.textContent = ''; st.style.color = ''; }
      if (srcEl) { srcEl.textContent = ''; srcEl.style.display = 'none'; }
      if (seatEl) { seatEl.textContent = ''; seatEl.style.display = 'none'; }
      if (noEl) { noEl.textContent = ''; noEl.style.display = 'none'; }
      if (metaEl) { metaEl.textContent = ''; metaEl.style.display = 'none'; }
      card.style.removeProperty('--last-color');
      card.style.removeProperty('--last-glow');
      return;
    }
    card.classList.add('has-data');
    var src = last.source || 'roster';
    var curP = participantsByUid()[last.uid];
    var curSeat = seatIndexOfUid(last.uid);
    var curNo = seatNoOf(last.uid);
    if (src === 'id') card.classList.add('is-id');
    if (src === 'seat') card.classList.add('is-seat');
    if (src === 'number') card.classList.add('is-number');
    if (nm) nm.textContent = curP ? curP.name : last.name;
    if (srcEl) {
      srcEl.textContent = src === 'id' ? (L === 'en' ? 'ID DRAW' : '学号抽')
        : (src === 'seat' ? (L === 'en' ? 'SEAT' : '座位抽')
          : (src === 'number' ? (L === 'en' ? 'NUMBER' : '序号抽') : ''));
      srcEl.style.display = src === 'roster' ? 'none' : 'inline-flex';
    }
    if (seatEl) {
      if (src === 'seat' && curSeat >= 0) {
        seatEl.textContent = seatLabel(curSeat);
        seatEl.style.display = 'block';
      } else { seatEl.textContent = ''; seatEl.style.display = 'none'; }
    }
    if (noEl) {
      if (src === 'number') {
        noEl.textContent = curNo ? ('#' + curNo) : '';
        noEl.style.display = curNo ? 'block' : 'none';
      } else { noEl.textContent = ''; noEl.style.display = 'none'; }
    }
    if (idEl) {
      idEl.textContent = (curP ? curP.id : last.id) || (L === 'en' ? 'NO ID' : '无学号');
      idEl.classList.toggle('is-empty', !(curP ? curP.id : last.id));
    }
    if (metaEl) {
      var bits = [];
      bits.push(curNo ? ('#' + curNo) : (L === 'en' ? 'Unnumbered' : '未编号'));
      bits.push(curSeat >= 0 ? seatLabel(curSeat) : (L === 'en' ? 'No seat' : '未入座'));
      metaEl.textContent = bits.join(' · ');
      metaEl.style.display = 'block';
    }
    if (st) {
      st.textContent = stars(last.star);
      st.style.color = STAR_COLORS[last.star] || STAR_COLORS[1];
      st.style.textShadow = '0 0 18px ' + (STAR_GLOW[last.star] || 'transparent');
    }
    card.style.setProperty('--last-color', STAR_COLORS[last.star] || 'rgba(140,220,255,.45)');
    card.style.setProperty('--last-glow', STAR_GLOW[last.star] || 'rgba(110,231,255,.22)');
  }

  function renderPity() {
    var el = $('#pityHint');
    if (!el) return;
    var L = lang();
    var P = state.settings.pity;
    var parts = [];
    var bar = '';
    if (!P.enabled) {
      parts.push(L === 'en' ? 'Pity off' : '保底未开启');
      if (P.lucky && P.luckyStep > 0) parts.push((L === 'en' ? 'luck +' : '幸运值 +') + luckBonus().toFixed(1) + '%');
      parts.push(L === 'en' ? 'enable in Settings' : '可在设置中启用');
    } else {
      if (P.fiftyFive) {
        var left = Math.max(0, 50 - (P.c5 + 1));
        var pct = Math.max(0, Math.min(100, Math.round((P.c5 / 49) * 100)));
        var hot = left <= 5;
        parts.push((hot ? '<span class="pity-badge">' + (L === 'en' ? 'PITY NEAR' : '保底临近') + '</span>' : '') +
          (L === 'en' ? ('5★ guaranteed in ' + left + ' pulls') : ('再 <b>' + left + '</b> 抽必出 5★')));
        bar = '<span class="pity-bar' + (hot ? ' hot' : '') + '" title="' + (L === 'en' ? 'Progress to the 50-pull 5★' : '距离 50 抽保底') + '">' +
          '<i style="width:' + pct + '%"></i><em>' + (L === 'en' ? (P.c5 + '/49') : (P.c5 + '/49 抽')) + '</em></span>';
      }
      if (P.tenFour) parts.push(L === 'en' ? 'Ten-pull: ≥1 4★' : '十连至少 1 个 4★');
      if (P.lucky && P.luckyStep > 0) parts.push((L === 'en' ? 'luck +' : '幸运值 +') + luckBonus().toFixed(1) + '%');
    }
    if (excludedCount()) parts.push(L === 'en' ? (excludedCount() + ' excluded') : (excludedCount() + ' 人已排除'));
    var ttl = equippedTitle();
    if (ttl) parts.push((L === 'en' ? 'Title: ' : '称号 ') + (L === 'en' ? ttl.en : ttl.zh));
    el.innerHTML = bar + (bar ? '&nbsp;' : '') + '<span class="pity-text">' + parts.join(' · ') + '</span>';
  }

  function renderAll() {
    syncModeUI();
    syncAdvFilters();
    renderStage();
    renderRoster();
    renderGroups();
    var osb = $('#openSeatBtn');
    if (osb) {
      var stSeat = seatStats();
      osb.title = lang() === 'en'
        ? ('Seated ' + stSeat.seated + ' / ' + stSeat.total + ' · ' + stSeat.unseated + ' unseated')
        : ('已入座 ' + stSeat.seated + ' / 共 ' + stSeat.total + '，' + stSeat.unseated + ' 人未入座不参与座位抽');
    }
    syncDrawModeUI();
    if ($('#seatModal') && $('#seatModal').classList.contains('active')) renderSeatMap();
  }

  function syncAdvFilters() {
    [['#starFilter', 'starFilter'], ['#countFilter', 'countFilter'], ['#excludeFilter', 'excludeFilter']].forEach(function (p) {
      var el = $(p[0]);
      if (el && el.value !== state.settings[p[1]]) el.value = state.settings[p[1]];
    });
  }

  /* ---------------- 抽取 ---------------- */
  /* ---------------- 可复现随机（P2：种子 + 哈希校验） ---------------- */
  var seedState = 0, seedActive = false;
  function hashStr(s) { return __core__.hashStr(s); }
  function seedRng() { return coreRng(); }
  /* coreRng：由 core.js 的 createRng 生成，但与旧实现共享 seedState 变量（可复现） */
  var coreRngFn = null;
  function coreRng() {
    if (!coreRngFn) coreRngFn = __core__.createRng(String(state.settings.seed || ''));
    return coreRngFn();
  }
  function rnd() { return seedActive ? seedRng() : Math.random(); }
  function startSeed() {
    var s = String(state.settings.seed || '').trim();
    seedActive = !!s;
    coreRngFn = null;
    if (!seedActive) return '';
    seedState = parseInt(hashStr(s), 16) >>> 0;
    coreRngFn = __core__.createRng(s);
    return hashStr(s);
  }

  function pickStar() {
    var w = starWeights(), total = 0, k;
    for (k = 5; k >= 1; k--) total += w[k];
    if (total <= 0) return 1;
    var r = rnd() * total;
    for (k = 5; k >= 1; k--) {
      if (r < w[k]) return k;
      r -= w[k];
    }
    return 1;
  }
  var pityNotice = '';
  function rollStar() {
    var P = state.settings.pity;
    if (P.enabled && P.fiftyFive) {
      if (P.c5 >= 49) { P.c5 = 0; pityNotice = '50'; return 5; }
      var s = pickStar();
      var pr = __core__.applyPity(P.c5, s, true);
      P.c5 = pr.c5;
      if (pr.forced) { pityNotice = '50'; return 5; }
      return s;
    }
    return pickStar();
  }
  function flushPityNotice() {
    if (!pityNotice) return;
    var L = lang();
    toast(pityNotice === 'ten'
      ? (L === 'en' ? 'Pity triggered: ten-pull guarantees a 4★' : '保底触发：十连至少 1 个 4★')
      : (L === 'en' ? 'Pity triggered: 50-draw 5★' : '保底触发：50 抽必出 5★'), 'ok');
    // 音效 + 舞台金光 + 舞台徽标标注
    Sfx.play(pityNotice === 'ten' ? 'success' : 'five', 0.95);
    var panel = $('#stagePanel');
    if (panel) {
      panel.classList.remove('pity-flash');
      void panel.offsetWidth;
      panel.classList.add('pity-flash');
      setTimeout(function () { panel.classList.remove('pity-flash'); }, 1200);
    }
    var badge = $('#stageBadge');
    if (badge) {
      badge.classList.add('pity-badge');
      badge.textContent = L === 'en' ? '✦ PITY' : '✦ 保底触发';
      setTimeout(function () { badge.classList.remove('pity-badge'); renderStage(); }, 1800);
    }
    logAction('pity', (L === 'en' ? 'Pity triggered: ' : '保底触发：') + (pityNotice === 'ten' ? '4★' : '5★'));
    pityNotice = '';
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 分组等比例抽取：先按各组人数占比分配名额，再按轮转补齐 */
  function pickBalanced(cand, count) {
    var byG = {}, keys = [];
    cand.forEach(function (p) {
      var k = p.group || '__none';
      if (!byG[k]) { byG[k] = []; keys.push(k); }
      byG[k].push(p);
    });
    keys.forEach(function (k) { shuffle(byG[k]); });
    var total = cand.length, out = [], used = {};
    keys.forEach(function (k) {
      var quota = Math.floor(count * byG[k].length / total);
      if (quota < 0) quota = 0;
      used[k] = Math.min(quota, byG[k].length);
      for (var i = 0; i < used[k]; i++) out.push(byG[k][i]);
    });
    var guard = 0;
    while (out.length < count && guard++ < 4000) {
      var moved = false;
      for (var j = 0; j < keys.length && out.length < count; j++) {
        var k2 = keys[j];
        if (used[k2] < byG[k2].length) { out.push(byG[k2][used[k2]++]); moved = true; }
      }
      if (!moved) break;
    }
    return shuffle(out).slice(0, count);
  }

  var busy = false;
  var tenOpenedAt = 0;

  function animClass() { return 'anim-' + state.settings.animation; }

  /* 动画速度与「跳过」：所有等待都走 waitSkip，可被照遮罩上的跳过按钮/ Esc 提前结束 */
  function speedFactor() { var v = Number(state.settings.animSpeed); return v > 0 ? v : 1; }
  function spd(ms) { return Math.max(40, Math.round(ms / speedFactor())); }
  var skipWaiters = [];
  function waitSkip(ms) {
    return new Promise(function (resolve) {
      var done = false;
      var to = setTimeout(function () { if (done) return; done = true; resolve(false); }, ms);
      skipWaiters.push(function () { if (done) return; done = true; clearTimeout(to); resolve(true); });
    });
  }
  function doSkip() {
    if (!skipWaiters.length) return;
    var list = skipWaiters;
    skipWaiters = [];
    Sfx.play('click', 0.6);
    list.forEach(function (f) { f(); });
  }

  function showDrawOverlay() {
    var o = $('#drawOverlay'); if (!o) return;
    o.className = 'draw-overlay ' + animClass();
    void o.offsetWidth;
    o.classList.add('active');
    var sk = $('#skipDrawBtn'); if (sk) sk.classList.add('active');
    markOpen(o);
  }
  function hideDrawOverlay() {
    var o = $('#drawOverlay'); if (!o) return;
    o.classList.remove('active');
    var sk = $('#skipDrawBtn'); if (sk) sk.classList.remove('active');
    markClosed(o);
  }
  function updateTenTitle() {
    var sub = $('#tenTitleSub'); if (!sub) return;
    var tt = equippedTitle();
    if (tt) {
      sub.textContent = tt.ico + ' ' + (lang() === 'en' ? tt.en : tt.zh);
      sub.style.display = 'block';
    } else { sub.textContent = ''; sub.style.display = 'none'; }
  }
  function showTenOverlay() {
    var o = $('#tenOverlay'); if (!o) return;
    o.className = 'ten-overlay ' + animClass();
    void o.offsetWidth;
    o.classList.add('active');
    updateTenTitle();
    var sk = $('#skipTenBtn'); if (sk) sk.classList.add('active');
    markOpen(o);
    tenOpenedAt = Date.now();
  }
  function hideTenOverlay() {
    var o = $('#tenOverlay'); if (!o) return;
    o.classList.remove('active');
    var sk = $('#skipTenBtn'); if (sk) sk.classList.remove('active');
    tenState.open = false;
    busy = false;
    markClosed(o);
    if (!tenAnnounced && tenState.items.length && Speech) {
      tenAnnounced = true;
      Speech.announceTen(tenState.items);
    }
  }

  function precheck() {
    if (!state.participants.length) {
      toast(lang() === 'en' ? 'Roster is empty — import or add participants first' : '名单为空，请先导入或添加参与者', 'err');
      openModal($('#importModal'));
      return false;
    }
    if (!oddsOk()) {
      toast(lang() === 'en' ? 'Star odds must total exactly 100%' : '星级概率合计必须为 100%，请先在设置中调整', 'err');
      openModal($('#settingsModal'));
      return false;
    }
    return true;
  }

  async function drawSingle(source) {
    if (busy) return;
    var mode = source || state.settings.drawMode || 'name';
    if (mode === 'roster') mode = 'name';
    var src = mode === 'seat' ? 'seat' : (mode === 'number' ? 'number' : (mode === 'id' ? 'id' : 'roster'));
    if (!precheck()) return;
    var cand;
    if (src === 'number') cand = poolNumbers();
    else if (src === 'seat') cand = poolSeats();
    else if (src === 'id') cand = poolIds();
    else cand = pool();
    if (!cand.length) {
      if (src === 'id') toast(lang() === 'en' ? 'No participants with a student ID' : '没有带学号的学生可抽', 'err');
      else if (src === 'number') toast(lang() === 'en' ? 'No numbered seats yet — use “Auto number” in the seat editor' : '还没有座位号，请先在座位编辑模式点「按拼音自动编号」', 'err');
      else if (src === 'seat') toast(lang() === 'en' ? 'No seats yet — add participants or open the seat map' : '还没有座位，请先打开座位表', 'err');
      else toast(state.settings.mode === 'unique'
        ? (lang() === 'en' ? 'Pool is empty — return participants or switch to repeatable' : '候选池已抽完，可在名单中「放回」，或切换到可重复模式')
        : (lang() === 'en' ? 'No one in the selected group' : '当前分组没有可抽取的人'), 'err');
      return;
    }
    var entries = cand.map(function (x) { return x && x.p ? x : { p: x }; });
    Sfx.ensure();
    busy = true;
    pushUndo();
    startSeed();
    var star = rollStar();
    var pick = entries[Math.floor(rnd() * entries.length)];
    var winner = pick.p || pick;
    var seatIdx = pick.seat != null ? pick.seat : seatIndexOfUid(winner.uid);
    var seatNo = Number(pick.no) || seatNoOf(winner.uid);

    var card = $('#rollCard'), nm = $('#rollName'), idEl = $('#rollId'), stEl = $('#rollStar'), hint = $('#drawHint');
    var ttlEl = $('#rollTitle');
    showDrawOverlay();
    var ov = $('#drawOverlay');
    if (ov) {
      ov.classList.remove('source-id', 'source-seat', 'source-number');
      if (src !== 'roster') ov.classList.add('source-' + src);
    }
    if (card) { card.classList.remove('winner'); card.classList.add('rolling'); }
    if (stEl) stEl.textContent = '';
    if (ttlEl) { ttlEl.textContent = ''; ttlEl.classList.remove('on'); }
    if (hint) hint.textContent = src === 'id'
      ? (lang() === 'en' ? 'Drawing a student ID…' : '正在抽取学号…')
      : (src === 'number'
        ? (lang() === 'en' ? 'Drawing a seat number…' : '正在抽取序号…')
        : (src === 'seat' ? (lang() === 'en' ? 'Drawing a seat…' : '正在抽取座位…') : (lang() === 'en' ? 'Drawing…' : '正在抽选…')));
    startTicks(78);

    var i = 0;
    var cyc = setInterval(function () {
      var ent = entries[(i++) % entries.length];
      var p = ent.p;
      if (!nm) return;
      nm.textContent = p.name;
      if (idEl) {
        var tmp = src === 'id' ? (p.id || '—') : (src === 'number' ? ('#' + (ent.no || '—')) : '—');
        idEl.textContent = tmp;
        idEl.classList.toggle('is-empty', !tmp || tmp === '—');
      }
      nm.classList.remove('anim'); void nm.offsetWidth; nm.classList.add('anim');
    }, 72);

    var skipped = await waitSkip(spd(1000));
    clearInterval(cyc); stopTicks();
    if (card) { card.classList.remove('rolling'); card.classList.add('winner'); }
    if (nm) nm.textContent = winner.name;
    if (idEl) {
      if (src === 'id') idEl.textContent = winner.id || '—';
      else if (src === 'number') idEl.textContent = '#' + (seatNo || '—');
      else if (src === 'seat') idEl.textContent = seatLabel(seatIdx);
      else idEl.textContent = winner.id || '—';
      idEl.classList.toggle('is-empty', src === 'id' ? !winner.id : (src === 'number' ? !seatNo : (src === 'seat' ? false : !winner.id)));
    }
    if (stEl) {
      stEl.style.setProperty('--star-color', STAR_COLORS[star]);
      stEl.textContent = stars(star);
    }
    if (ttlEl) {
      var ttlNow = equippedTitle();
      ttlEl.textContent = ttlNow ? (ttlNow.ico + ' ' + (lang() === 'en' ? ttlNow.en : ttlNow.zh)) : '';
      ttlEl.classList.toggle('on', !!ttlNow);
    }
    if (hint) hint.textContent = src === 'id'
      ? (lang() === 'en' ? 'Student ID drawn' : '学号抽取完成')
      : (src === 'number'
        ? (lang() === 'en' ? 'Seat number drawn' : '序号抽取完成')
        : (src === 'seat'
          ? (lang() === 'en' ? 'Seat drawn' : '座位抽取完成')
          : (star === 5 ? (lang() === 'en' ? '★ FIVE STAR ★' : '★ 五星出货 ★') : (lang() === 'en' ? 'Done' : '抽选完成'))));
    // 稀有度演出：5★ 光柱/特写/压暗；4★ 紫色脉冲/轻微推镜；1–3★ 维持现状
    var drawOv = $('#drawOverlay');
    if (drawOv) {
      drawOv.classList.remove('rarity-5', 'rarity-4');
      if (star >= 4) drawOv.classList.add('rarity-' + star);
    }
    Sfx.play(star === 5 ? 'five' : (star === 4 ? 'success' : 'result'), star === 5 ? 1 : 0.9);
    await waitSkip(spd(skipped ? 160 : (star === 5 ? 1450 : 1150)));
    hideDrawOverlay();

    registerDraw([{ p: winner, star: star, source: src, seat: seatIdx, no: seatNo }], pityNotice);
    busy = false;
    flushPityNotice();
    if (Speech && Speech.announceSingle) Speech.announceSingle(winner, star, src, seatIdx, seatNo);
  }

  /* 十连展示：卡堆模式 —— 屏幕一次只显示一张牌；当前牌展示完成后移到堆尾，继续展示下一张未展示过的牌 */
  var tenState = { items: [], queue: [], shown: 0, open: false };
  var tenAnnounced = false;

  function tenCardHtml(it, idx, cls, extraStyle) {
    var nm = it.name || (it.p && it.p.name) || '';
    var nid = it.id || (it.p && it.p.id) || '';
    var sub = it.source === 'seat' && it.seat != null ? seatLabel(it.seat)
      : (it.source === 'number' && it.no ? '#' + it.no : (nid || (lang() === 'en' ? 'NO ID' : '无学号')));
    var sc = STAR_COLORS[it.star] || '#9aa5c4';
    var sg = STAR_GLOW[it.star] || 'rgba(154,165,196,.3)';
    var st = '--sc:' + sc + ';--sg:' + sg + (extraStyle ? ';' + extraStyle : '');
    return '<div class="ten-card ' + (cls || 'deck-front') + '" data-idx="' + idx + '" data-star="' + it.star + '" style="' + st + '">' +
      '<span class="tc-foil" aria-hidden="true"></span>' +
      '<span class="tc-sheen" aria-hidden="true"></span>' +
      '<span class="tc-corner" aria-hidden="true"></span>' +
      '<div class="ten-stars">' + stars(it.star) + '</div>' +
      '<div class="ten-name">' + esc(nm) + '</div>' +
      '<span class="tc-line" aria-hidden="true"></span>' +
      '<div class="ten-id' + (nid ? '' : ' is-empty') + '">' + esc(sub) + '</div>' +
      '</div>';
  }

  function tenSummary() {
    var cnt = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    tenState.items.forEach(function (i) { cnt[i.star] = (cnt[i.star] || 0) + 1; });
    var parts = [];
    for (var s = 5; s >= 1; s--) if (cnt[s]) parts.push(s + '★×' + cnt[s]);
    return parts.join(' · ');
  }

  function tenMetaHtml() {
    var total = tenState.items.length, shown = tenState.shown, L = lang();
    var left = Math.max(0, total - shown);
    var done = shown >= total;
    return '<div class="deck-meta">' +
      '<span class="deck-count">' + (done
        ? (L === 'en' ? 'All revealed' : '已全部展示')
        : (L === 'en' ? ('Deck ' + left) : ('卡堆 ' + left))) + '</span>' +
      '<span class="deck-pos">' + (L === 'en'
        ? ((done ? total : shown + 1) + ' / ' + total)
        : ('第 ' + (done ? total : shown + 1) + ' / ' + total + ' 张')) + '</span>' +
      '</div>' +
      (done ? '<div class="deck-sum">' + tenSummary() + '</div>' : '');
  }

  /* 全部展示完成（或跳过）后：把整副牌按原始抽取顺序平铺出来 */
  function renderTenFlat(instant) {
    var grid = $('#tenGrid'); if (!grid || !tenState.items.length) return;
    grid.classList.add('flat');
    var total = tenState.items.length;
    var vw = window.innerWidth || 1280;
    var cols = Math.min(total, vw <= 520 ? 2 : (vw <= 820 ? 3 : 5));
    grid.style.setProperty('--cols', String(Math.max(1, cols)));
    var order = tenState.queue.slice();
    var body = order.map(function (idx, i) {
      var it = tenState.items[idx];
      return tenCardHtml(it, idx, 'flat-card', instant ? '' : ('animation-delay:' + (i * 52) + 'ms'));
    }).join('');
    grid.innerHTML = body + tenMetaHtml();
    updateTenHint();
  }

  /* 只渲染堆顶（当前被展示）的那一张，其余牌只以卡堆厚度与计数体现 */
  function drawTenFront(instant) {
    var grid = $('#tenGrid'); if (!grid || !tenState.items.length) return;
    grid.classList.remove('flat');
    var idx = tenState.queue[0];
    var it = tenState.items[idx];
    grid.innerHTML = '<div class="deck-box">' +
      '<span class="deck-shadow s2"></span><span class="deck-shadow s1"></span>' +
      tenCardHtml(it, idx, 'deck-front') + '</div>' + tenMetaHtml();
    var card = grid.querySelector('.ten-card');
    if (card && !instant) { card.classList.add('revealed'); }
    updateTenHint();
  }

  function renderTenCards(items) {
    if (!$('#tenGrid')) return;
    tenState = {
      items: items.slice(),
      queue: items.map(function (_, i) { return i; }),
      shown: 0,
      open: false
    };
    drawTenFront(false);
  }

  function updateTenHint() {
    var hint = $('#tenHint'); if (!hint) return;
    var total = tenState.items.length, shown = tenState.shown, L = lang();
    if (!total) { hint.textContent = ''; return; }
    if (shown >= total) {
      hint.textContent = L === 'en'
        ? ('All ' + total + ' shown · click to close')
        : ('已全部展示 ' + total + ' 张 · 点击任意处关闭');
      return;
    }
    hint.textContent = L === 'en'
      ? ('Showing card ' + (shown + 1) + ' / ' + total + ' · click the card for the next (← → / Space / Enter)')
      : ('正在展示第 ' + (shown + 1) + ' / ' + total + ' 张 · 点击卡牌展示下一张（← → / 空格 / 回车）');
  }

  /* 当前牌展示完成：记为已展示 → 移到卡堆末尾 → 接着展示新的堆顶（下一张未展示的牌） */
  function tenAdvance() {
    if (!tenState.open) return;
    var total = tenState.items.length;
    if (tenState.shown >= total) return;
    var cur = tenState.queue.shift();
    if (cur === undefined) return;
    tenState.queue.push(cur);
    tenState.shown = Math.min(total, tenState.shown + 1);
    Sfx.ensure();
    var star = tenState.items[cur] ? tenState.items[cur].star : 1;
    if (star === 5) Sfx.play('five', 0.9); else Sfx.play('tick', 0.5);
    if (tenState.shown >= total) {
      /* 最后一张展示完成：整副牌平铺出来（顺序回到抽取顺序） */
      tenState.queue = tenState.items.map(function (_, i) { return i; });
      Sfx.play(star === 5 ? 'five' : 'result', 0.95);
      renderTenFlat(false);
      return;
    }
    var card = document.querySelector('#tenGrid .ten-card');
    if (card) card.classList.remove('revealed');
    setTimeout(function () { if (tenState.open) drawTenFront(false); }, 90);
    updateTenHint();
  }

  /* 跳过：一次性走完整个卡堆顺序，结束时停在最后一张，并给出星级汇总 */
  /* 跳过：直接平铺整副牌（与逐张展示完成后的终态完全一致） */
  function tenShowAll() {
    if (!tenState.open) return;
    var total = tenState.items.length;
    if (!total) return;
    var wasFlat = tenState.shown >= total && $('#tenGrid').classList.contains('flat');
    if (wasFlat) return;
    tenState.queue = tenState.items.map(function (_, i) { return i; });
    tenState.shown = total;
    Sfx.ensure();
    var five = tenState.items.filter(function (i) { return i.star === 5; }).length;
    Sfx.play(five ? 'five' : 'result', 1);
    renderTenFlat(true);
  }

  /* ← 键：退回上一张 */
  function tenBack() {
    if (!tenState.open) return;
    var total = tenState.items.length;
    if (!total) return;
    Sfx.ensure();
    if (tenState.shown >= total) {
      tenState.shown = total - 1;
      var last = total - 1;
      tenState.queue = [last].concat(tenState.items.map(function (_, i) { return i; }).filter(function (i) { return i !== last; }));
      Sfx.play('tick', 0.35);
      drawTenFront(true);
      updateTenHint();
      return;
    }
    if (tenState.shown <= 0) return;
    var tail = tenState.queue.pop();
    if (tail === undefined) return;
    tenState.queue.unshift(tail);
    tenState.shown = Math.max(0, tenState.shown - 1);
    Sfx.play('tick', 0.35);
    drawTenFront(true);
    updateTenHint();
  }

  async function drawTen() {
    if (busy) return;
    if (!precheck()) return;
    var mode = state.settings.drawMode || 'name';
    var src = mode === 'seat' ? 'seat' : (mode === 'number' ? 'number' : 'roster');
    var cand;
    if (src === 'seat') cand = poolSeats();
    else if (src === 'number') cand = poolNumbers();
    else cand = pool().map(function (p) { return { p: p, star: 0 }; });
    if (!cand.length) {
      if (src === 'seat') toast(lang() === 'en' ? 'No seats yet' : '还没有座位', 'err');
      else if (src === 'number') toast(lang() === 'en' ? 'No numbered seats yet — use Auto number' : '还没有座位号，请先在座位编辑模式自动编号', 'err');
      else toast(state.settings.mode === 'unique'
        ? (lang() === 'en' ? 'Pool is empty — return participants or switch to repeatable' : '候选池已抽完，可在名单中「放回」，或切换到可重复模式')
        : (lang() === 'en' ? 'No one in the selected group' : '当前分组没有可抽取的人'), 'err');
      return;
    }
    Sfx.ensure();
    busy = true;
    pushUndo();
    startSeed();
    var want = Math.max(1, Math.min(50, Number(state.settings.pickCount) || 10));
    var count = Math.min(want, cand.length);
    if (src === 'roster' && state.settings.mode === 'unique' && cand.length < want) {
      toast(lang() === 'en' ? ('Only ' + cand.length + ' left — drawing ' + count) : ('候选池只剩 ' + cand.length + ' 人，本次抽取 ' + count + ' 人'), 'ok');
    }
    var picks;
    if (src === 'roster') {
      var people = cand.map(function (x) { return x.p; });
      picks = state.settings.balance ? pickBalanced(people.slice(), count) : shuffle(people.slice()).slice(0, count);
      picks = picks.map(function (p) { return { p: p, source: 'roster' }; });
    } else {
      picks = shuffle(cand.slice()).slice(0, count);
    }
    var results = picks.map(function (x) { return { p: x.p, star: rollStar(), source: src, seat: x.seat, no: x.no }; });

    var P = state.settings.pity;
    if (P.enabled && P.tenFour) {
      var hasFour = results.some(function (r) { return r.star >= 4; });
      if (!hasFour && results.length) {
        var idx = results.length - 1;
        results[idx].star = 4;
        results[idx].pity = 'ten';
        if (!pityNotice) pityNotice = 'ten';
      }
    }

    renderTenCards(results);
    showTenOverlay();
    tenState.open = true;
    Sfx.play('ten', 1);
    registerDraw(results, pityNotice);
    busy = false;
    tenAnnounced = false;
    flushPityNotice();
  }

  function registerDraw(items, pityTag) {
    if (!items.length) return;
    var now = new Date();
    var batchId = 'b' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6);
    var mode = state.settings.mode;
    var seedTag = state.settings.seed ? hashStr(String(state.settings.seed)) : '';
    var seedRaw = state.settings.seed ? String(state.settings.seed).slice(0, 40) : '';
    items.forEach(function (it) {
      var p = it.p;
      var src = it.source || 'roster';
      state.drawIndex = (state.drawIndex || 0) + 1;
      p.count = (Number(p.count) || 0) + 1;
      // 只有名单抽会改变「已抽中」标记；学号抽/座位抽为独立候选池，不影响名单池
      if (mode === 'unique' && src === 'roster') { p.drawn = true; p.drawnAt = now.getTime(); }
      state.history.push({
        index: state.drawIndex, uid: p.uid, name: p.name, id: p.id || '', group: p.group || '',
        star: it.star, ts: now.getTime(), time: hhmmss(now), batchId: batchId, mode: mode,
        source: src, seat: (it.seat == null ? null : it.seat),
        no: (it.no ? Number(it.no) : seatNoOf(p.uid)) || 0,
        seatLabel: (it.seat == null ? '' : seatLabel(it.seat)),
        seedHash: seedTag, seedText: seedRaw, pity: it.pity || pityTag || ''
      });
    });
    var best = items[0];
    items.forEach(function (it) { if (it.star > best.star) best = it; });
    state.last = {
      name: best.p.name, id: best.p.id || '', star: best.star, uid: best.p.uid, group: best.p.group || '',
      ts: now.getTime(), seedHash: seedTag,
      source: best.source || 'roster', seat: (best.seat == null ? null : best.seat),
      no: (best.no ? Number(best.no) : seatNoOf(best.p.uid)) || 0,
      seatLabel: (best.seat == null ? '' : seatLabel(best.seat))
    };
    logAction('draw', ((items.length > 1 ? '批量(' + items.length + ')：' : '单抽：')) + items.map(function (it) { return it.p.name + ' ' + stars(it.star); }).join(' / '));
    save();
    renderAll();
    syncUndoBtns();
    checkAchievements();
    if ($('#tenOverlay') && $('#tenOverlay').classList.contains('active')) updateTenTitle();
  }

  /* ---------------- 成就 / 称号 ---------------- */
  /* ---------------- 成就 / 称号 ---------------- */
  var ACHV_CATS = [
    { id: 'novice', zh: '新手', en: 'Novice' },
    { id: 'growth', zh: '成长', en: 'Growth' },
    { id: 'collect', zh: '收集', en: 'Collection' },
    { id: 'lucky', zh: '欧皇', en: 'Lucky' },
    { id: 'unlucky', zh: '非酋', en: 'Unlucky' },
    { id: 'easter', zh: '彩蛋', en: 'Easter egg' }
  ];

  function achievementStats() {
    var total = state.history.length;
    var c5 = state.history.filter(function (h) { return h.star === 5; }).length;
    var batches = groupHistory();
    var tenBatches = batches.filter(function (g) { return g.items.length > 1; }).length;
    var maxCount = 0;
    state.participants.forEach(function (p) { maxCount = Math.max(maxCount, Number(p.count) || 0); });
    var roster = state.participants.length;
    var left = roster ? pool().length : 0;
    var bestStar = 0;
    state.history.forEach(function (h) { if (h.star > bestStar) bestStar = h.star; });
    var sumObj = {};
    for (var s = 1; s <= 5; s++) sumObj[s] = state.history.filter(function (h) { return h.star === s; }).length;
    var repeatDraws = state.history.filter(function (h) { return h.mode === 'repeat'; }).length;
    var uniq = {};
    state.history.forEach(function (h) { uniq[h.uid || h.name] = 1; });
    var maxFive = 0;
    batches.forEach(function (g) {
      var f = g.items.filter(function (i) { return i.star === 5; }).length;
      if (f > maxFive) maxFive = f;
    });
    var kinds = {};
    state.logs.forEach(function (l) { kinds[l.kind] = (kinds[l.kind] || 0) + 1; });
    return {
      total: total, c5: c5, c4: sumObj[4], tenBatches: tenBatches, batches: batches.length,
      maxCount: maxCount, roster: roster, left: left, bestStar: bestStar,
      starCounts: sumObj, repeatDraws: repeatDraws,
      unique: Object.keys(uniq).length, maxFive: maxFive,
      pkRuns: kinds.pk || 0, imports: kinds.import || 0, archives: kinds.archive || 0,
      modes: kinds.mode || 0, exclusions: kinds.exclude || 0, pk: kinds.pk || 0
    };
  }

  function currentTitle() {
    var st = achievementStats(), best = null;
    TITLES.forEach(function (t) { if (t.test(st)) best = t; });
    return best;
  }
  /* 佩戴的称号优先，未佩戴则用自动解锁的最高称号 */
  function equippedTitle() {
    var id = state.settings.title;
    if (id && id !== 'auto') {
      var hit = null;
      TITLES.forEach(function (t) { if (t.id === id) hit = t; });
      if (hit) return hit;
    }
    return currentTitle();
  }

  /* 成就解锁：弹窗 + 光效 + 音效 */
  function showAchvPop(a, delay) {
    setTimeout(function () {
      var L = lang();
      var pop = $('#achvPop');
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'achvPop';
        pop.className = 'achv-pop';
        pop.innerHTML = '<div class="achv-burst"></div>' +
          '<div class="achv-card"><div class="achv-ico"></div>' +
          '<div class="achv-txt"><b class="achv-name"></b><span class="achv-cat"></span></div></div>';
        document.body.appendChild(pop);
      }
      pop.querySelector('.achv-ico').textContent = a.ico;
      pop.querySelector('.achv-name').textContent = L === 'en' ? a.en : a.zh;
      var cat = ACHV_CATS.filter(function (c) { return c.id === a.cat; })[0];
      pop.querySelector('.achv-cat').textContent = (L === 'en' ? 'Achievement · ' : '成就解锁 · ') + (cat ? (L === 'en' ? cat.en : cat.zh) : '');
      pop.classList.remove('on');
      void pop.offsetWidth;
      pop.classList.add('on');
      Sfx.play('achv', 0.9);
      clearTimeout(pop._t);
      pop._t = setTimeout(function () { pop.classList.remove('on'); }, 2800);
    }, delay || 0);
  }

  function checkAchievements() {
    var st = achievementStats();
    var newly = [];
    ACHV.forEach(function (a) {
      var ok = false;
      try { ok = !!a.test(st); } catch (e) { ok = false; }
      if (ok && !state.achv[a.id]) { state.achv[a.id] = Date.now(); newly.push(a); }
    });
    if (!newly.length) return;
    save();
    newly.forEach(function (a, i) {
      showAchvPop(a, i * 700);
      setTimeout(function () {
        toast((lang() === 'en' ? '🏅 Achievement: ' : '🏅 成就解锁：') + (lang() === 'en' ? a.en : a.zh), 'achv');
      }, i * 700);
    });
    if (newly.length && $('#statsModal') && $('#statsModal').classList.contains('active')) renderStats();
  }

  /* ---------------- 历史 ---------------- */
  function groupHistory() {
    var map = {}, order = [];
    state.history.forEach(function (h) {
      if (!map[h.batchId]) { map[h.batchId] = { id: h.batchId, items: [] }; order.push(map[h.batchId]); }
      map[h.batchId].items.push(h);
    });
    order.sort(function (a, b) { return (b.items[0].ts || 0) - (a.items[0].ts || 0); });
    return order;
  }

  /* 归档摘要：清理历史后仍能看到星级 / 分组 / 日期分布 */
  function archiveBlockHtml() {
    var A = state.archive;
    if (!A || !A.count) return '';
    var L = lang(), parts = [];
    [5, 4, 3, 2, 1].forEach(function (s) { if (A.byStar && A.byStar[s]) parts.push(s + '★ ×' + A.byStar[s]); });
    var gsTxt = Object.keys(A.byGroup || {}).filter(function (k) { return A.byGroup[k]; })
      .sort(function (a, b) { return A.byGroup[b] - A.byGroup[a]; }).slice(0, 6)
      .map(function (k) { return (k === '__none' ? (L === 'en' ? 'Ungrouped' : '未分组') : k) + ' ' + A.byGroup[k]; }).join(' · ');
    var dayTxt = Object.keys(A.byDay || {}).sort().slice(-5).map(function (k) { return k + ' ' + A.byDay[k]; }).join(' · ');
    var lastAt = A.files && A.files.length ? fmtDate(A.files[A.files.length - 1].at) : '';
    return '<div class="hist-group arch-sum">' +
      '<div class="hist-group-head"><b>' + (L === 'en' ? ('Archived ' + A.count + ' records · summary') : ('已归档 ' + A.count + ' 条 · 摘要')) + '</b>' +
      (lastAt ? '<span class="hist-time">' + esc(lastAt) + '</span>' : '') + '</div>' +
      '<div class="set-desc" style="padding:4px 6px 10px;line-height:1.9">' +
      (parts.length ? (L === 'en' ? 'Stars: ' : '星级：') + esc(parts.join(' · ')) + '<br>' : '') +
      (gsTxt ? (L === 'en' ? 'Groups: ' : '分组：') + esc(gsTxt) + '<br>' : '') +
      (dayTxt ? (L === 'en' ? 'By day: ' : '按日期：') + esc(dayTxt) : '') +
      '</div></div>';
  }

  function renderHistory() {
    var body = $('#historyBody'); if (!body) return;
    var gs = groupHistory();
    var arch = archiveBlockHtml();
    if (!gs.length) {
      body.innerHTML = arch + '<div class="empty">' + (lang() === 'en' ? 'No draws yet<br>Try one!' : '暂无抽取记录<br>抽一次试试吧') + '</div>';
      return;
    }
    body.innerHTML = arch + gs.map(function (g, gi) {
      var head = g.items[0];
      var kind = g.items.length > 1 ? (lang() === 'en' ? 'Ten pull' : '十连') : (lang() === 'en' ? 'Single' : '单抽');
      var meta = kind + ' · ' + g.items.length + (lang() === 'en' ? ' entries · ' : ' 人 · ') +
        fmtDate(head.ts) + (head.mode === 'repeat' ? (lang() === 'en' ? ' · repeatable' : ' · 可重复') : '');
      var rows = g.items.map(function (h) {
        return '<div class="hist-row">' +
          '<span class="hist-no">' + h.index + '</span>' +
          '<div class="hist-main"><b>' + esc(h.name) + '</b>' +
          '<span class="' + (h.id ? '' : 'is-empty') + '">' + (h.id ? esc(h.id) : (lang() === 'en' ? 'NO ID' : '无学号')) + '</span>' +
          (h.pity ? '<span class="hist-pity">' + (lang() === 'en' ? 'PITY' : '保底') + '</span>' : '') +
          (h.source === 'id' ? '<span class="hist-src">' + (lang() === 'en' ? 'ID' : '学号') + '</span>' :
            (h.source === 'number' ? '<span class="hist-src">' + (h.no ? '#' + h.no : (lang() === 'en' ? 'NO.' : '序号')) + '</span>' :
            (h.source === 'seat' ? '<span class="hist-src">' + (h.seatLabel || (h.seat != null ? esc(seatLabel(h.seat)) : (lang() === 'en' ? 'SEAT' : '座位'))) + '</span>' : ''))) + '</div>' +
          '<span class="hist-stars" style="color:' + (STAR_COLORS[h.star] || '') + '">' + stars(h.star) + '</span>' +
          '<span class="hist-time">' + esc(h.time || '') + '</span>' +
          '</div>';
      }).join('');
      var seedTag = g.items[0] && g.items[0].seedHash ? ' · #' + g.items[0].seedHash : '';
      return '<div class="hist-group">' +
        '<div class="hist-group-head"><b>' + esc(meta) + seedTag + '</b>' +
        '<button type="button" class="mini-btn" data-replay="' + gi + '">' + (lang() === 'en' ? 'Replay' : '重新播放') + '</button></div>' +
        rows + '</div>';
    }).join('');
    $$('[data-replay]', body).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = gs[Number(btn.dataset.replay)];
        if (g) replayBatch(g.items);
      });
    });
  }

  async function replayBatch(items) {
    if (busy || !items || !items.length) return;
    busy = true;
    Sfx.ensure();
    if (items.length > 1) {
      renderTenCards(items);
      showTenOverlay();
      tenState.open = true;
      Sfx.play('ten', 1);
      busy = false;
      return;
    } else {
      var it = items[0];
      var card = $('#rollCard'), nm = $('#rollName'), idEl = $('#rollId'), stEl = $('#rollStar'), hint = $('#drawHint');
      showDrawOverlay();
      if (card) { card.classList.remove('winner'); card.classList.add('rolling'); }
      if (stEl) stEl.textContent = '';
      if (hint) hint.textContent = lang() === 'en' ? 'Replaying…' : '正在回放…';
      startTicks(78);
      await wait(750);
      stopTicks();
      if (card) { card.classList.remove('rolling'); card.classList.add('winner'); }
      if (nm) nm.textContent = it.name;
      if (idEl) { idEl.textContent = it.id || '—'; idEl.classList.toggle('is-empty', !it.id); }
      if (stEl) { stEl.style.setProperty('--star-color', STAR_COLORS[it.star]); stEl.textContent = stars(it.star); }
      if (hint) hint.textContent = lang() === 'en' ? 'Replay' : '回放';
      Sfx.play(it.star === 5 ? 'five' : 'result', 0.9);
      await wait(1150);
      hideDrawOverlay();
    }
    busy = false;
  }

  /* ---------------- 设置面板 ---------------- */
  function lang() { return state.settings.lang === 'en' ? 'en' : 'zh'; }

  function buildStarConfig() {
    var box = $('#starConfig'); if (!box) return;
    box.innerHTML = '';
    for (var s = 5; s >= 1; s--) {
      var row = document.createElement('div');
      row.className = 'star-row';
      row.innerHTML = '<span class="s-lab" style="color:' + STAR_COLORS[s] + '">' + s + '★</span>' +
        '<input type="range" min="0" max="100" step="1" data-star="' + s + '" value="' + n(state.settings.stars[s]) + '">' +
        '<input type="number" min="0" max="100" step="1" data-star="' + s + '" value="' + n(state.settings.stars[s]) + '">';
      box.appendChild(row);
    }
  }

  function syncStarInputs() {
    $$('#starConfig [data-star]').forEach(function (el) {
      var v = n(state.settings.stars[Number(el.dataset.star)]);
      if (el.value !== String(v)) el.value = v;
    });
    var sum = starSum();
    var sumEl = $('#starSum'), warn = $('#starSumWarn');
    if (sumEl) sumEl.textContent = sum;
    if (warn) {
      if (state.settings.weights.enabled) {
        warn.className = 'good';
        warn.textContent = lang() === 'en' ? 'weights on' : '权重模式生效';
      } else {
        warn.className = sum === 100 ? 'good' : 'bad';
        warn.textContent = sum === 100 ? (lang() === 'en' ? '✓ valid' : '✓ 可用') : (lang() === 'en' ? 'must be 100%' : '必须为 100%');
      }
    }
    $$('#presetRow button[data-preset]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.preset === state.settings.preset);
    });
    syncWeightPct();
  }

  function buildPresets() {
    var box = $('#presetRow'); if (!box) return;
    box.innerHTML = Object.keys(PRESETS).map(function (k) {
      var p = PRESETS[k];
      return '<button type="button" data-preset="' + k + '">' + (lang() === 'en' ? p.en : p.zh) + '</button>';
    }).join('') + '<button type="button" data-preset="__norm">' + (lang() === 'en' ? 'Normalise' : '归一化') + '</button>';
  }

  /* 星级权重（1–5 倍）：仅在权重模式下参与概率换算 */
  function buildWeightGrid() {
    var box = $('#weightGrid'); if (!box) return;
    var L = lang();
    box.innerHTML = '';
    for (var s = 5; s >= 1; s--) {
      var row = document.createElement('div');
      row.className = 'weight-row';
      row.innerHTML = '<span class="w-lab" style="color:' + STAR_COLORS[s] + '">' + s + '★</span>' +
        '<input type="number" min="0" max="5" step="0.5" data-w="' + s + '" value="' + Number(state.settings.weights.mult[s]) + '" aria-label="' + s + '★ ' + (L === 'en' ? 'weight' : '权重') + '">' +
        '<span class="w-pct" data-wpct="' + s + '">—</span>';
      box.appendChild(row);
    }
    buildWeightPresets();
    syncWeightPct();
  }

  var WEIGHT_PRESETS = {
    even: { zh: '均衡（全 1×）', en: 'Even (1×)', mult: { 5: 1, 4: 1, 3: 1, 2: 1, 1: 1 } },
    rare: { zh: '稀有向（5★ 0.2×）', en: 'Rare (5★ 0.2×)', mult: { 5: 0.2, 4: 0.6, 3: 1, 2: 1.6, 1: 2.5 } },
    generous: { zh: '大方（5★ 3×）', en: 'Generous (5★ 3×)', mult: { 5: 3, 4: 2.4, 3: 1.8, 2: 1.2, 1: 0.8 } },
    classroom: { zh: '课堂鼓励（中段偏多）', en: 'Classroom (mid-heavy)', mult: { 5: 1.2, 4: 1.8, 3: 2.6, 2: 2, 1: 1.2 } }
  };
  function buildWeightPresets() {
    var box = $('#weightPresets'); if (!box) return;
    box.innerHTML = Object.keys(WEIGHT_PRESETS).map(function (k) {
      var p = WEIGHT_PRESETS[k];
      return '<button type="button" data-wpreset="' + k + '">' + (lang() === 'en' ? p.en : p.zh) + '</button>';
    }).join('');
  }

  /* 概率模拟：按当前权重/百分比连抽 1000 次，输出实际分布（纯前端，不写状态） */
  function simulateOdds(times) {
    var N = times || 1000, w = starWeights(), total = 0, k;
    for (k = 5; k >= 1; k--) total += w[k];
    var hit = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (total <= 0) return hit;
    for (var i = 0; i < N; i++) {
      var r = Math.random() * total, got = 1;
      for (k = 5; k >= 1; k--) { if (r < w[k]) { got = k; break; } r -= w[k]; }
      hit[got]++;
    }
    return hit;
  }
  function runSim() {
    var out = $('#simOut'); if (!out) return;
    var N = 1000, hit = simulateOdds(N), parts = [];
    for (var s = 5; s >= 1; s--) parts.push(s + '★ ' + (hit[s] / N * 100).toFixed(1) + '%');
    out.textContent = (lang() === 'en' ? ('Simulated ' + N + ' draws: ') : ('模拟 ' + N + ' 抽：')) + parts.join(' · ');
    Sfx.play('coin', 0.7);
  }

  function syncWeightPct() {
    var box = $('#weightGrid'), en = $('#weightEnable');
    if (en) en.checked = !!state.settings.weights.enabled;
    if (box) box.classList.toggle('disabled', !state.settings.weights.enabled);
    $$('#weightGrid [data-w]').forEach(function (el) {
      var v = String(Number(state.settings.weights.mult[Number(el.dataset.w)]));
      if (el.value !== v) el.value = v;
    });
    var pct = weightPercent();
    var L = lang();
    $$('#weightGrid [data-wpct]').forEach(function (el) {
      var s = Number(el.dataset.wpct);
      el.textContent = pct[s].toFixed(1) + '%';
    });
    var tip = $('#weightPct');
    if (tip) {
      var note = state.settings.weights.enabled
        ? (L === 'en' ? 'Probability = weight ÷ total weight. Percentages above are what the current weights produce.' : '概率 = 该星级权重 ÷ 权重总和；右侧百分比就是当前权重的实际概率。')
        : (L === 'en' ? 'Weight mode is off — the 1–5★ percentages above are used directly.' : '权重模式未启用，仍按上方 1–5★ 百分比抽取。');
      if (state.settings.pity.lucky && state.settings.pity.luckyStep > 0 && luckBonus() > 0) {
        note += (L === 'en' ? ' Luck bonus currently adds ' : ' 幸运值当前额外加成 ') + luckBonus().toFixed(1) + (L === 'en' ? ' points to 5★.' : ' 点到 5★。');
      }
      tip.textContent = note;
    }
  }

  function buildSkins() {
    var box = $('#skinGrid'); if (!box) return;
    box.innerHTML = SKINS.map(function (s) {
      return '<button type="button" class="skin-opt' + (state.settings.skin === s.id ? ' active' : '') + '" data-skin="' + s.id + '">' +
        '<div class="skin-swatch ' + s.id + '"></div><span>' + (lang() === 'en' ? s.en : s.zh) + '</span></button>';
    }).join('');
  }

  /* 称号佩戴 UI */
  function buildTitleSelect() {
    var sel = $('#titleSelect'); if (!sel) return;
    var L = lang(), cur = state.settings.title || 'auto';
    var opts = ['<option value="auto">' + (L === 'en' ? 'Auto (highest unlocked)' : '自动（已解锁最高档）') + '</option>'];
    TITLES.forEach(function (t) {
      opts.push('<option value="' + t.id + '">' + t.ico + ' ' + (L === 'en' ? t.en : t.zh) + '</option>');
    });
    sel.innerHTML = opts.join('');
    sel.value = cur;
    if (sel.value !== cur) { sel.value = 'auto'; state.settings.title = 'auto'; }
    var prev = $('#titlePreview');
    if (prev) {
      var ttl = equippedTitle();
      prev.textContent = ttl
        ? (L === 'en' ? ('Wearing: ' + ttl.ico + ' ' + ttl.en + ' — shown on the stage and in the share card.') : ('当前佩戴：' + ttl.ico + ' ' + ttl.zh + '，会显示在舞台与分享图上。'))
        : (L === 'en' ? 'No title unlocked yet — draw a little more.' : '还没有解锁称号，多抽几次就会有的。');
    }
  }

  /* 分组管理：取色 / 重命名 / 解散 */
  function buildGroupManage() {
    var box = $('#groupManage'); if (!box) return;
    var L = lang(), gs = groups();
    if (!gs.length) {
      box.innerHTML = '<p class="set-desc">' + (L === 'en' ? 'No groups yet — type a group when adding people or in inline edit.' : '还没有分组，添加成员时填「分组」或行内编辑即可建立。') + '</p>';
      return;
    }
    box.innerHTML = gs.map(function (g) {
      var c = groupColor(g), cnt = state.participants.filter(function (p) { return p.group === g; }).length;
      return '<div class="group-row" data-group="' + esc(g) + '">' +
        '<input type="color" class="g-color" value="' + c + '" data-gcolor="' + esc(g) + '" title="' + (L === 'en' ? 'Group colour' : '分组颜色') + '">' +
        '<input type="text" class="g-name" value="' + esc(g) + '" maxlength="12" data-grename="' + esc(g) + '">' +
        '<span class="g-count">' + cnt + (L === 'en' ? '' : ' 人') + '</span>' +
        '<button type="button" class="mini-btn del" data-gdel="' + esc(g) + '">' + (L === 'en' ? 'Dissolve' : '解散') + '</button>' +
        '</div>';
    }).join('');
  }

  function renderSettings() {
    if (!$('#settingsModal')) return;
    $$('#modeSeg2 button').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === state.settings.mode); });
    $$('#langSeg button').forEach(function (b) { b.classList.toggle('active', b.dataset.lang === state.settings.lang); });
    syncStarInputs();
    var pe = $('#pityEnable'), pt = $('#pityTen'), pf = $('#pityFifty');
    if (pe) pe.checked = !!state.settings.pity.enabled;
    if (pt) { pt.checked = !!state.settings.pity.tenFour; pt.disabled = !state.settings.pity.enabled; }
    if (pf) { pf.checked = !!state.settings.pity.fiftyFive; pf.disabled = !state.settings.pity.enabled; }
    var ps = $('#pityStatus');
    if (ps) {
      var P = state.settings.pity;
      if (!P.enabled) ps.innerHTML = lang() === 'en' ? 'Pity is off. Nothing is forced.' : '保底已关闭，抽取完全随机。';
      else {
        var left = P.fiftyFive ? Math.max(0, 50 - (P.c5 + 1)) : null;
        ps.innerHTML = (lang() === 'en'
          ? ('Counter: ' + P.c5 + ' non-5★ pulls' + (left != null ? ' · 5★ in ' + left : ''))
          : ('当前计数：' + P.c5 + ' 抽未出 5★' + (left != null ? ' · 再 ' + left + ' 抽必出' : ''))) +
          '<br><span style="opacity:.75">' + (lang() === 'en' ? 'Pity only applies to draws made through the stage.' : '保底只影响从舞台发起的抽取，回放不计入。') + '</span>';
      }
    }
    var se = $('#soundEnable'), sv = $('#soundVol'), svo = $('#soundVolOut');
    if (se) se.checked = !!state.settings.sound.enabled;
    if (sv) sv.value = state.settings.sound.volume;
    if (svo) svo.textContent = state.settings.sound.volume;
    // 三通道音量 + BGM
    var mv = $('#masterVol'), mvo = $('#masterVolOut'), bv = $('#bgmVol'), bvo = $('#bgmVolOut');
    if (mv) mv.value = state.settings.sound.master;
    if (mvo) mvo.textContent = state.settings.sound.master;
    if (bv) bv.value = state.settings.sound.bgmVolume;
    if (bvo) bvo.textContent = state.settings.sound.bgmVolume;
    $$('#bgmTrackSeg button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.track === state.settings.sound.bgmTrack);
    });
    // 语音播报
    var sp = state.settings.speech || {};
    var spe = $('#speechEnable'), spr = $('#speechRate'), spp = $('#speechPitch');
    if (spe) spe.checked = !!sp.enabled;
    if (spr) spr.value = Number(sp.rate) || 1;
    if (spp) spp.value = Number(sp.pitch) || 1;
    var spro = $('#speechRateOut'), sppo = $('#speechPitchOut');
    if (spro) spro.textContent = (Number(sp.rate) || 1).toFixed(1);
    if (sppo) sppo.textContent = (Number(sp.pitch) || 1).toFixed(1);
    if (Speech.supported) Speech.loadVoices();
    // 抽取设置：人数 / 平衡 / 种子
    var pc = $('#pickCount'), pco = $('#pickCountOut'), bal = $('#balanceToggle'), sd = $('#seedInput'), ss = $('#seedStatus');
    if (pc) pc.value = state.settings.pickCount;
    if (pco) pco.textContent = state.settings.pickCount;
    if (bal) bal.checked = !!state.settings.balance;
    var lpEl = $('#longPressMs'), lpOut = $('#longPressMsOut');
    if (lpEl) lpEl.value = state.settings.longPressMs;
    if (lpOut) lpOut.textContent = state.settings.longPressMs + ' ms';
    if (sd && document.activeElement !== sd) sd.value = state.settings.seed || '';
    if (ss) {
      var L2 = lang();
      if (state.settings.seed) {
        var h = hashStr(String(state.settings.seed));
        ss.textContent = (L2 === 'en'
          ? ('Seed on: same seed + same roster replays the same draws. Hash #' + h)
          : ('固定种子已开启：相同种子 + 相同名单可复现同样的结果。哈希 #' + h));
        ss.className = 'set-desc strong';
      } else {
        ss.textContent = L2 === 'en' ? 'Seed off — every draw is truly random.' : '未设置种子，每次抽取都是真随机。';
        ss.className = 'set-desc';
      }
    }
    buildTitleSelect();
    buildGroupManage();
    buildAppearance();
    buildLibList();
    try {
      var errArr = JSON.parse(localStorage.getItem(ERRKEY) || '[]') || [];
      var eb2 = $('#errLogBtn');
      if (eb2) eb2.title = (lang() === 'en'
        ? ('Recent errors: ' + (Array.isArray(errArr) ? errArr.length : 0) + ' · click to export')
        : ('最近错误：' + (Array.isArray(errArr) ? errArr.length : 0) + ' 条 · 点击导出'));
    } catch (_) { }

    // 幸运值
    var le = $('#luckyEnable'), ls = $('#luckyStep'), lso = $('#luckyStepOut'), lst = $('#luckyStatus');
    if (le) le.checked = !!state.settings.pity.lucky;
    if (ls) { ls.value = state.settings.pity.luckyStep; ls.disabled = !state.settings.pity.lucky; }
    if (lso) lso.textContent = state.settings.pity.luckyStep + '%';
    if (lst) {
      lst.innerHTML = state.settings.pity.lucky
        ? (lang() === 'en'
          ? ('Current bonus: +' + luckBonus().toFixed(1) + ' points to 5★ (' + state.settings.pity.c5 + ' dry pulls, cap +60).')
          : ('当前加成：+' + luckBonus().toFixed(1) + ' 点到 5★（已连续 ' + state.settings.pity.c5 + ' 抽未出，上限 +60）。'))
        : (lang() === 'en' ? 'Off — 5★ odds stay flat.' : '关闭时 5★ 概率保持不变。');
    }
    // 权重 / 速度 / 快捷键
    buildWeightGrid();
    $$('#speedSeg button').forEach(function (b) { b.classList.toggle('active', b.dataset.speed === state.settings.animSpeed); });
    var sce = $('#scEnable'), scs = $('#scSpace');
    if (sce) sce.checked = !!state.settings.shortcuts.enabled;
    if (scs) scs.disabled = !state.settings.shortcuts.enabled;
    buildSkins();
    buildKbList();
    updateStorageInfo(storageBroken);
  }

  /* ---------------- 快捷键：可关闭、可自定义、冲突提示 ---------------- */
  var recordingKb = null;
  function keyLabel(k) {
    if (k === ' ' || k === 'space') return 'Space';
    if (k === 'shift+ ') return 'Shift + Space';
    if (k === 'escape') return 'Esc';
    if (k === 'enter') return 'Enter';
    if (k === 'tab') return 'Tab';
    if (String(k).length === 1) return String(k).toUpperCase();
    return String(k);
  }
  function keyFromEvent(e) {
    var k = e.key;
    if (k === ' ' || k === 'Spacebar') return e.shiftKey ? 'shift+ ' : ' ';
    if (k === 'Shift' || k === 'Control' || k === 'Meta' || k === 'Alt') return '';
    var low = String(k).toLowerCase();
    var parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey && low !== 'shift') parts.push('shift');
    parts.push(low);
    return parts.join('+');
  }
  function kbConflicts() {
    var keys = state.settings.shortcuts.keys, seen = {}, dup = [];
    ACTIONS.forEach(function (a) {
      var v = keys[a.id];
      if (!v) return;
      if (seen[v]) { var l = keyLabel(v); if (dup.indexOf(l) < 0) dup.push(l); }
      seen[v] = 1;
    });
    return dup;
  }
  function buildKbList() {
    var box = $('#kbList'); if (!box) return;
    var L = lang(), keys = state.settings.shortcuts.keys;
    box.innerHTML = ACTIONS.map(function (a) {
      return '<div class="kbd-item"><span>' + (L === 'en' ? a.en : a.zh) + '</span>' +
        '<span class="kb-val"><kbd data-kbkey="' + a.id + '">' + esc(keyLabel(keys[a.id])) + '</kbd>' +
        '<button type="button" class="kb-edit" data-kb="' + a.id + '">' + (L === 'en' ? 'Edit' : '改') + '</button></span></div>';
    }).join('') +
      '<div class="kbd-item"><span>' + (L === 'en' ? 'Close dialog' : '关闭弹窗') + '</span><span><kbd>Esc</kbd></span></div>' +
      '<div class="kbd-item"><span>' + (L === 'en' ? 'Undo / Redo' : '撤销 / 重做') + '</span><span><kbd>Ctrl</kbd> + <kbd>Z</kbd></span></div>';
    syncKb();
  }
  function syncKb() {
    var L = lang(), keys = state.settings.shortcuts.keys, sc = state.settings.shortcuts;
    $$('#kbList [data-kbkey]').forEach(function (el) { el.textContent = keyLabel(keys[el.dataset.kbkey]); });
    $$('#kbList [data-kb]').forEach(function (b) {
      b.classList.toggle('rec', recordingKb === b.dataset.kb);
      b.textContent = recordingKb === b.dataset.kb ? (L === 'en' ? 'Press…' : '按下…') : (L === 'en' ? 'Edit' : '改');
    });
    var warn = $('#kbWarn');
    if (warn) {
      var dup = kbConflicts();
      if (!sc.enabled) { warn.className = 'bad'; warn.textContent = L === 'en' ? 'All shortcuts are disabled.' : '快捷键已全部关闭。'; }
      else if (dup.length) {
        warn.className = 'bad';
        warn.textContent = (L === 'en' ? 'Conflict: ' : '键位冲突：') + dup.join(' / ') +
          (L === 'en' ? ' is used twice — the first match wins.' : ' 被重复绑定，先匹配到的动作生效。');
      } else { warn.className = 'good'; warn.textContent = L === 'en' ? 'No key conflicts.' : '键位没有冲突。'; }
    }
    var sp = $('#scSpace');
    if (sp) sp.checked = !!sc.spaceDraw;
  }

  function applyTheme() {
    var light = state.settings.theme !== 'dark';
    document.body.classList.toggle('light', light);
    var btn = $('#themeToggle');
    if (btn) btn.textContent = light ? '🌙' : '☀️';
  }
  var ACCENTS = ['#6ee7ff', '#b98cff', '#8affc1', '#ffd700', '#ff9db1', '#ffa45b', '#7ef0d8'];
  var BG_PRESETS = {
    auto: { zh: '跟随主题', en: 'Theme default', css: '' },
    aurora: { zh: '极光蓝', en: 'Aurora', css: 'linear-gradient(160deg,#061a2a 0%,#0a3049 38%,#123f60 66%,#1d2b52 100%)' },
    sunset: { zh: '落日橘', en: 'Sunset', css: 'linear-gradient(160deg,#2a1030 0%,#5a1b3d 42%,#8a3a2a 72%,#c46a2a 100%)' },
    forest: { zh: '森林绿', en: 'Forest', css: 'linear-gradient(160deg,#07170f 0%,#0d2a1c 42%,#154a2e 72%,#1f6440 100%)' },
    mono: { zh: '石墨灰', en: 'Graphite', css: 'linear-gradient(160deg,#0b0d12 0%,#171a22 55%,#262b36 100%)' }
  };
  /* 由主题色推一个邻近色，做渐变第二色 */
  function shiftColor(hex) {
    try {
      var r = parseInt(hex.slice(1, 3), 16) / 255, g2 = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
      var mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), h = 0, s = 0, l = (mx + mn) / 2;
      var d = mx - mn;
      if (d) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r) h = ((g2 - b) / d + (g2 < b ? 6 : 0));
        else if (mx === g2) h = (b - r) / d + 2;
        else h = (r - g2) / d + 4;
        h /= 6;
      }
      h = (h + 0.09) % 1; s = Math.min(1, s + 0.08); l = Math.min(0.78, l + 0.06);
      var hue2rgb = function (p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q2 = l < 0.5 ? l * (1 + s) : l + s - l * s, p2 = 2 * l - q2;
      var to = function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); };
      return '#' + to(hue2rgb(p2, q2, h + 1 / 3)) + to(hue2rgb(p2, q2, h)) + to(hue2rgb(p2, q2, h - 1 / 3));
    } catch (e) { return '#b98cff'; }
  }
  function applyAccent() {
    var a = state.settings.accent, root = document.documentElement;
    if (a) {
      root.style.setProperty('--accent', a);
      root.style.setProperty('--accent-2', shiftColor(a));
      document.body.classList.add('accent-on');
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-2');
      document.body.classList.remove('accent-on');
    }
  }
  function applyBg() {
    var el = $('#custom-bg'); if (!el) return;
    var img = state.settings.bgImage;
    var B = BG_PRESETS[state.settings.bg] || BG_PRESETS.auto;
    if (img) {
      el.style.backgroundImage = 'url("' + img + '")';
      document.body.classList.add('has-custom-bg');
    } else if (B.css) {
      el.style.backgroundImage = B.css;
      document.body.classList.add('has-custom-bg');
    } else {
      el.style.backgroundImage = 'none';
      document.body.classList.remove('has-custom-bg');
    }
  }
  /* 读取背景图片：压到最长边 1600px、JPEG 0.72，尽量少占 localStorage */
  function readBgImage(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(fr.error || new Error('read')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode')); };
        img.onload = function () {
          try {
            var maxSide = 1600, scale = Math.min(1, maxSide / Math.max(1, img.width, img.height));
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(img.width * scale));
            cv.height = Math.max(1, Math.round(img.height * scale));
            var c = cv.getContext('2d');
            c.drawImage(img, 0, 0, cv.width, cv.height);
            resolve(cv.toDataURL('image/jpeg', 0.72));
          } catch (e) { reject(e); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function buildAppearance() {
    var row = $('#accentRow');
    if (row) {
      row.innerHTML =
        '<button type="button" class="accent-dot' + (state.settings.accent ? '' : ' active') + '" data-accent="" ' +
        'style="background:linear-gradient(135deg,#6ee7ff,#b98cff)" title="' + (lang() === 'en' ? 'Default' : '默认配色') + '"></button>' +
        ACCENTS.map(function (c) {
          return '<button type="button" class="accent-dot' + (state.settings.accent === c ? ' active' : '') + '" data-accent="' + c + '" ' +
            'style="background:' + c + ';color:' + c + '" title="' + c + '"></button>';
        }).join('') +
        '<input type="color" class="accent-pick" id="accentPick" value="' + (state.settings.accent || '#6ee7ff') + '" title="' + (lang() === 'en' ? 'Custom colour' : '自定义颜色') + '">';
    }
    var bg = $('#bgRow');
    if (bg) {
      bg.innerHTML = Object.keys(BG_PRESETS).map(function (k) {
        var p = BG_PRESETS[k];
        var style = p.css ? 'background-image:' + p.css : 'background:linear-gradient(135deg,#1c2437,#0a0e18)';
        return '<button type="button" class="bg-thumb' + (state.settings.bg === k ? ' active' : '') + '" data-bg="' + k + '" style="' + style + '">' +
          '<span>' + (lang() === 'en' ? p.en : p.zh) + '</span></button>';
      }).join('');
    }
    var st = $('#bgStatus');
    if (st) {
      st.textContent = state.settings.bgImage
        ? (lang() === 'en' ? 'Custom image in use (stored locally)' : '正在使用自定义图片（已存本地）')
        : (lang() === 'en' ? 'Gradient presets are applied immediately.' : '渐变预设会立即生效。');
    }
  }


  function applySkin() {
    SKINS.forEach(function (s) { document.body.classList.remove('skin-' + s.id); });
    document.body.classList.add('skin-' + (state.settings.skin || 'liquid'));
  }
  function applySoundBtn() {
    var b = $('#soundBtn');
    if (b) {
      b.textContent = state.settings.sound.enabled ? '🔊' : '🔇';
      b.classList.toggle('on', !!state.settings.sound.enabled);
    }
    Sfx.sync();
  }

  var SKIP_I18N = {
    statTotal: 1, statDrawn: 1, statLeft: 1, rosterCount: 1, stageBadge: 1, animLabel: 1,
    starSum: 1, pityStatus: 1, storageSize: 1, batchCount: 1, pityHint: 1,
    lastName: 1, lastId: 1, lastStar: 1, confirmTitle: 1, confirmMsg: 1, historyBody: 1,
    statsBody: 1, guideBody: 1, importPreview: 1, starSumWarn: 1, soundVolOut: 1, tenGrid: 1,
    scopeName: 1, speedChip: 1, weightPct: 1, kbWarn: 1, luckyStatus: 1, luckyStepOut: 1, tenHint: 1
  };

  function applyLang() {
    var L = lang();
    $$('[data-zh]').forEach(function (el) {
      if (SKIP_I18N[el.id]) return;
      if (el.children.length) return;
      var v = L === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-zh');
      if (v) el.textContent = v;
    });
    $$('[data-zh-ph]').forEach(function (el) {
      var v = L === 'en' ? el.getAttribute('data-en-ph') : el.getAttribute('data-zh-ph');
      if (v) el.placeholder = v;
    });
    $$('[data-zh-title]').forEach(function (el) {
      var v = L === 'en' ? el.getAttribute('data-en-title') : el.getAttribute('data-zh-title');
      if (v) el.title = v;
    });
    document.documentElement.lang = L === 'en' ? 'en' : 'zh-CN';
    document.title = L === 'en' ? 'Random Roll · Liquid Glass' : '随机点名 · 液态玻璃抽卡系统';
    buildPresets();
    syncStarInputs();
    buildSkins();
    buildKbList();
    buildWeightGrid();
    buildAppearance();
    buildLibList();
    renderAll();
  }

  /* ---------------- 导入 ---------------- */
  function cleanCell(s) { return __core__.cleanCell(s); }
  function isHeaderRow(parts) { return __core__.isHeaderRow(parts); }
  function parseImport(text, existingIds, existingNames) {
    return __core__.parseImportLines(text, existingIds, existingNames);
  }

  /* xlsx / xls：SheetJS 以 base64 本地内联，首次使用时解码成 Blob 脚本执行，
     完全离线；解码只在第一次导入/导出 Excel 时发生一次。 */
  var sheetWB = null, sheetName = '', sheetBytes = null, sheetNames = [];
  var xlsxLoader = null;
  var payloadLoader = null;
  /* 按需拉取 base64 的 SheetJS 载荷：不占用首屏解析/下载，仅在真正导入导出 Excel 时加载。
     这样即使 xlsx.b64.js 体积大或加载慢，应用本身也不会被拖住。 */
  function loadXlsxPayload() {
    if (window.__XLSX_B64) return Promise.resolve(window.__XLSX_B64);
    if (payloadLoader) return payloadLoader;
    payloadLoader = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = 'xlsx.b64.js';
      sc.async = true;
      sc.onload = function () {
        if (window.__XLSX_B64) resolve(window.__XLSX_B64);
        else { payloadLoader = null; reject(new Error('sheetjs-missing')); }
      };
      sc.onerror = function () { payloadLoader = null; reject(new Error('sheetjs-missing')); };
      document.head.appendChild(sc);
    });
    return payloadLoader;
  }
  function decodeB64(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    if (window.TextDecoder) return new TextDecoder('utf-8').decode(bytes);
    var out = '', CH = 0x8000;
    for (var j = 0; j < len; j += CH) out += String.fromCharCode.apply(null, bytes.subarray(j, j + CH));
    try { return decodeURIComponent(escape(out)); } catch (e) { return out; }
  }
  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxLoader) return xlsxLoader;
    if (!window.__XLSX_B64) {
      return loadXlsxPayload().then(function () { return loadSheetJS(); });
    }
    var p = new Promise(function (resolve, reject) {
      var b64 = window.__XLSX_B64;
      if (!b64) { reject(new Error('sheetjs-missing')); return; }
      var src;
      try { src = decodeB64(b64); } catch (e) { reject(e); return; }
      var done = false;
      var finish = function (ok, err) {
        if (done) return;
        done = true;
        if (ok && window.XLSX) resolve(window.XLSX);
        else reject(err || new Error('sheetjs-init'));
      };
      var tryEval = function () {
        if (done) return;
        try { (0, eval)(src); finish(true); } catch (e) { finish(false, e); }
      };
      try {
        var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        var sc = document.createElement('script');
        sc.src = url;
        sc.onload = function () { try { URL.revokeObjectURL(url); } catch (e) { } finish(true); };
        sc.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) { } tryEval(); };
        document.head.appendChild(sc);
        setTimeout(function () { if (!done) tryEval(); }, 2500);
      } catch (e) { tryEval(); }
    });
    xlsxLoader = p.catch(function (e) { xlsxLoader = null; throw e; });
    return xlsxLoader;
  }
  function sheetNamesOf(data) {
    try {
      var wb = window.XLSX.read(data, { type: 'array', sheetRows: 0 });
      return wb.SheetNames || [];
    } catch (e) { return []; }
  }
  function sheetToText(data, name) {
    var XLSX = window.XLSX;
    if (!XLSX) return '';
    var wb = XLSX.read(data, { type: 'array' });
    var pick = (name && wb.Sheets[name]) ? name : wb.SheetNames[0];
    var sheet = wb.Sheets[pick];
    if (!sheet) return '';
    sheetWB = wb; sheetName = pick;
    var arr = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    return arr.map(function (row) {
      var cells = [];
      for (var i = 0; i < 4; i++) cells.push(String(row[i] == null ? '' : row[i]).trim());
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      return cells.join('\t');
    }).filter(function (l) { return l.replace(/\t/g, '').trim() !== ''; }).join('\n');
  }
  function fillSheetSelect(names, cur) {
    var wrap = $('#sheetPick'), sel = $('#sheetSelect');
    if (!wrap || !sel) return;
    if (!names || names.length <= 1) { wrap.style.display = 'none'; sel.innerHTML = ''; return; }
    wrap.style.display = '';
    sel.innerHTML = names.map(function (nm) {
      return '<option value="' + esc(nm) + '"' + (nm === cur ? ' selected' : '') + '>' + esc(nm) + '</option>';
    }).join('');
  }

  function renderImportPreview() {
    var box = $('#importPreview'), ta = $('#importText');
    if (!box || !ta) return;
    var text = ta.value;
    if (!text.trim()) {
      box.innerHTML = lang() === 'en'
        ? 'Live preview appears as you type: valid entries, duplicate IDs and skipped blank lines.'
        : '输入内容后实时预览有效人数、重复学号与空行。';
      return;
    }
    var existing = state.participants.map(function (p) { return p.id; });
    var names = state.participants.map(function (p) { return p.name; });
    var r = parseImport(text, existing, names);
    var L = lang();
    var html = '<b>' + r.rows.length + '</b> ' + (L === 'en' ? 'valid entries' : '条有效') +
      ' · <b>' + r.blank + '</b> ' + (L === 'en' ? 'blank lines skipped' : '空行跳过');
    if (r.dupeIds.length) {
      html += ' · <span class="warn">' + r.dupeIds.length + ' ' + (L === 'en' ? 'duplicate IDs skipped' : '条重复学号已跳过') + '</span>';
      html += '<br><span class="warn">' + r.dupeIds.slice(0, 6).map(function (d) {
        return (L === 'en' ? 'line ' : '第') + d.line + (L === 'en' ? ': ' : ' 行：') + esc(d.name) + ' / ' + esc(d.id);
      }).join('，') + (r.dupeIds.length > 6 ? ' …' : '') + '</span>';
    }
    if (r.dupeNames.length) {
      html += '<br><span class="warn">' + (L === 'en'
        ? (r.dupeNames.length + ' entries share a name with an existing participant (kept, please double-check)')
        : (r.dupeNames.length + ' 条与已有姓名重名（仍会导入，请自行确认）')) + '：' +
        esc(r.dupeNames.slice(0, 6).map(function (d) { return d.name; }).join('、')) +
        (r.dupeNames.length > 6 ? ' …' : '') + '</span>';
    }
    if (r.bad.length) {
      html += '<br><span class="warn">' + r.bad.length + ' ' + (L === 'en' ? 'invalid lines' : '行无法解析') +
        '：' + r.bad.slice(0, 5).map(function (b) { return (L === 'en' ? 'line ' : '第') + b.line + (L === 'en' ? '' : ' 行'); }).join('，') +
        (r.bad.length > 5 ? ' …' : '') + '</span>';
    }
    if (r.rows.length) {
      html += '<br><span class="ok">' + (L === 'en' ? 'Preview: ' : '预览：') + esc(r.rows.slice(0, 5).map(function (x) {
        return x.name + (x.id ? '(' + x.id + ')' : '') + (x.group ? '[' + x.group + ']' : '');
      }).join(' · ')) + (r.rows.length > 5 ? ' …' : '') + '</span>';
    }
    box.innerHTML = html;
  }

  function addParticipants(rows) {
    var order = nextOrder();
    rows.forEach(function (r) {
      state.participants.push({
        uid: nextUid(), name: r.name, id: r.id || '', group: r.group || '',
        drawn: false, drawnAt: 0, order: order++, excluded: false, count: 0
      });
    });
    syncSeatmap();
  }

  function readFileText(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || '')); };
      fr.onerror = function () { reject(fr.error || new Error('read error')); };
      fr.readAsText(file, 'utf-8');
    });
  }

  /* ---------------- 统计 ---------------- */
  var ACHV = [
    /* 新手 */
    { id: 'first', cat: 'novice', ico: '🎯', zh: '初次抽卡', en: 'First draw', test: function (s) { return s.total >= 1; } },
    { id: 'ten', cat: 'novice', ico: '🔟', zh: '十连体验', en: 'Ten pull', test: function (s) { return s.tenBatches >= 1; } },
    { id: 'five', cat: 'novice', ico: '👑', zh: '五星出货', en: 'Five star', test: function (s) { return s.c5 >= 1; } },
    { id: 'roster20', cat: 'novice', ico: '📋', zh: '建好名单', en: 'Roster ready', test: function (s) { return s.roster >= 20; } },
    /* 成长 */
    { id: 'batch10', cat: 'growth', ico: '📚', zh: '十次抽取', en: '10 batches', test: function (s) { return s.batches >= 10; } },
    { id: 'batch50', cat: 'growth', ico: '📚', zh: '五十次抽取', en: '50 batches', test: function (s) { return s.batches >= 50; } },
    { id: 'total100', cat: 'growth', ico: '💯', zh: '百抽达成', en: '100 draws', test: function (s) { return s.total >= 100; } },
    { id: 'total500', cat: 'growth', ico: '🚀', zh: '五百抽', en: '500 draws', test: function (s) { return s.total >= 500; } },
    /* 收集 */
    { id: 'all', cat: 'collect', ico: '🏁', zh: '全员抽完', en: 'All drawn', test: function (s) { return s.roster > 0 && s.left === 0; } },
    { id: 'big', cat: 'collect', ico: '🗂', zh: '大班名单', en: '50+ roster', test: function (s) { return s.roster >= 50; } },
    { id: 'unique30', cat: 'collect', ico: '🧑‍🎓', zh: '三十人上榜', en: '30 unique winners', test: function (s) { return s.unique >= 30; } },
    { id: 'coverage', cat: 'collect', ico: '🎖', zh: '覆盖九成', en: '90% coverage', test: function (s) { return s.roster >= 10 && s.unique >= s.roster * 0.9; } },
    /* 欧皇 */
    { id: 'five5', cat: 'lucky', ico: '🌟', zh: '五星收藏家', en: '5× five star', test: function (s) { return s.c5 >= 5; } },
    { id: 'five10', cat: 'lucky', ico: '✨', zh: '五星十连击', en: '10× five star', test: function (s) { return s.c5 >= 10; } },
    { id: 'doublefive', cat: 'lucky', ico: '🌈', zh: '双黄蛋', en: 'Double five', test: function (s) { return s.maxFive >= 2; } },
    { id: 'rate20', cat: 'lucky', ico: '🍀', zh: '欧气爆表', en: '20% five rate', test: function (s) { return s.total >= 10 && s.c5 / s.total >= 0.2; } },
    /* 非酋 */
    { id: 'dry50', cat: 'unlucky', ico: '🫠', zh: '五十抽无五星', en: '50 draws, no 5★', test: function (s) { return s.total >= 50 && s.c5 === 0; } },
    { id: 'dry30c4', cat: 'unlucky', ico: '😐', zh: '三十抽无四星', en: '30 draws, no 4★', test: function (s) { return s.total >= 30 && s.c4 === 0; } },
    { id: 'lowmax', cat: 'unlucky', ico: '🌧', zh: '从未超过二星', en: 'Never above 2★', test: function (s) { return s.total >= 30 && s.bestStar <= 2; } },
    { id: 'repeat10', cat: 'unlucky', ico: '🔁', zh: '老是被抽到', en: 'Drawn 10 times', test: function (s) { return s.maxCount >= 10; } },
    /* 彩蛋 */
    { id: 'repeat', cat: 'easter', ico: '♻️', zh: '可重复模式', en: 'Repeat mode', test: function (s) { return s.repeatDraws >= 1; } },
    { id: 'repeat100', cat: 'easter', ico: '🌀', zh: '可重复百抽', en: '100 repeat draws', test: function (s) { return s.repeatDraws >= 100; } },
    { id: 'pk3', cat: 'easter', ico: '⚔️', zh: '来打一架', en: 'PK time', test: function (s) { return s.pkRuns >= 1; } },
    { id: 'archivist', cat: 'easter', ico: '🗃', zh: '历史管理员', en: 'Archivist', test: function (s) { return s.archives >= 1; } },
    { id: 'import3', cat: 'easter', ico: '📥', zh: '导入达人', en: 'Import master', test: function (s) { return s.imports >= 3; } },
    { id: 'mode3', cat: 'easter', ico: '🎛', zh: '模式玩家', en: 'Mode player', test: function (s) { return s.modes >= 3; } }
  ];

  /* ---------------- 课堂积分：候选、记录、汇总 ---------------- */
  var pointSel = {};
  function selectedPointUids() {
    return Object.keys(pointSel).filter(function (k) { return pointSel[k]; });
  }
  function pointCandidates(scopeArg) {
    var scope = scopeArg || state.settings.pointScope || 'recent10';
    var by = participantsByUid();
    if (scope === 'all') {
      return state.participants.slice().sort(function (a, b) { return a.order - b.order; })
        .map(function (p) { return { p: p, h: null }; });
    }
    var hist = state.history.slice();
    if (!hist.length) return [];
    var take;
    if (scope === 'recent1') {
      var bid = hist[hist.length - 1].batchId;
      take = hist.filter(function (h) { return h.batchId === bid; });
    } else {
      take = hist.slice(-(scope === 'recent20' ? 20 : 10));
    }
    var seen = {}, out = [];
    take.slice().reverse().forEach(function (h) {
      var p = by[h.uid];
      if (!p) {
        for (var i = 0; i < state.participants.length; i++) {
          if (state.participants[i].name === h.name) { p = state.participants[i]; break; }
        }
      }
      if (!p || seen[p.uid]) return;
      seen[p.uid] = 1;
      out.push({ p: p, h: h });
    });
    return out;
  }
  function pointLogRows(limit) {
    var rows = state.pointLog.slice().reverse();
    return limit ? rows.slice(0, limit) : rows;
  }
  function pointLogFiltered() {
    var uid = state.settings.pointLogUid || 'all';
    var range = state.settings.pointLogRange || 'all';
    var from = 0;
    if (range === 'today') { var d = new Date(); d.setHours(0, 0, 0, 0); from = d.getTime(); }
    else if (range === '7') from = Date.now() - 7 * 86400000;
    else if (range === '30') from = Date.now() - 30 * 86400000;
    return state.pointLog.filter(function (r) {
      if (uid !== 'all' && r.uid !== uid) return false;
      if (from && (Number(r.ts) || 0) < from) return false;
      return true;
    });
  }
  function pointAgg() {
    var agg = {}, pos = 0, neg = 0;
    state.pointLog.forEach(function (r) {
      var d = Number(r.delta) || 0;
      if (d > 0) pos += d; else if (d < 0) neg += d;
      var a = agg[r.uid] || (agg[r.uid] = { pos: 0, neg: 0, n: 0, posN: 0, negN: 0 });
      a.n++;
      if (d > 0) { a.pos += d; a.posN++; } else { a.neg += d; a.negN++; }
    });
    return { byUid: agg, pos: pos, neg: neg };
  }

  function renderPoints() {
    var body = $('#pointsBody'); if (!body) return;
    var L = lang();
    var cands = pointCandidates();
    var valid = {};
    cands.forEach(function (c) { valid[c.p.uid] = 1; });
    Object.keys(pointSel).forEach(function (k) { if (!valid[k]) delete pointSel[k]; });
    var selN = selectedPointUids().length;
    var agg = pointAgg();
    // 排序：当前积分 / 加分次数 / 扣分次数 / 最近抽到
    var sortBy = state.settings.pointSort || 'points';
    cands.sort(function (a, b) {
      var pa = pointsOf(a.p.uid), pb = pointsOf(b.p.uid);
      var aa = agg.byUid[a.p.uid] || { pos: 0, neg: 0, posN: 0, negN: 0 };
      var ab = agg.byUid[b.p.uid] || { pos: 0, neg: 0, posN: 0, negN: 0 };
      if (sortBy === 'plus') return ab.posN - aa.posN || pb - pa || a.p.order - b.p.order;
      if (sortBy === 'minus') return ab.negN - aa.negN || pb - pa || a.p.order - b.p.order;
      if (sortBy === 'recent') return 0;
      return pb - pa || a.p.order - b.p.order;
    });
    var logsAll = pointLogFiltered();
    var logs = logsAll.slice().reverse().slice(0, 60);
    var lPos = 0, lNeg = 0;
    logsAll.forEach(function (r) { var d = Number(r.delta) || 0; if (d > 0) lPos += d; else lNeg += d; });

    var sortOpts = [
      ['points', L === 'en' ? 'Points high → low' : '积分 高 → 低'],
      ['plus', L === 'en' ? 'Most additions' : '加分次数最多'],
      ['minus', L === 'en' ? 'Most deductions' : '扣分次数最多'],
      ['recent', L === 'en' ? 'Recently drawn' : '最近抽到']
    ].map(function (o) {
      return '<option value="' + o[0] + '"' + (sortBy === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');

    var logUids = {}, logUserOpts = '<option value="all">' + (L === 'en' ? 'All students' : '全部学生') + '</option>';
    state.pointLog.forEach(function (r) { if (r.uid) logUids[r.uid] = r.name; });
    if (state.settings.pointLogUid !== 'all' && !logUids[state.settings.pointLogUid]) {
      state.settings.pointLogUid = 'all';
      save();
    }
    Object.keys(logUids).sort(function (a, b) { return String(logUids[a]).localeCompare(String(logUids[b]), 'zh-Hans-CN'); })
      .forEach(function (uid) {
        logUserOpts += '<option value="' + esc(uid) + '"' + (state.settings.pointLogUid === uid ? ' selected' : '') + '>' + esc(logUids[uid]) + '</option>';
      });
    var rangeOpts = [
      ['all', L === 'en' ? 'All time' : '全部时间'],
      ['today', L === 'en' ? 'Today' : '今天'],
      ['7', L === 'en' ? 'Last 7 days' : '近 7 天'],
      ['30', L === 'en' ? 'Last 30 days' : '近 30 天']
    ].map(function (o) {
      return '<option value="' + o[0] + '"' + (state.settings.pointLogRange === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');

    var scopeOpts = [
      ['recent1', L === 'en' ? 'Latest batch' : '最近一批'],
      ['recent10', L === 'en' ? 'Last 10 draws' : '最近 10 抽'],
      ['recent20', L === 'en' ? 'Last 20 draws' : '最近 20 抽'],
      ['all', L === 'en' ? 'Whole roster' : '全部名单']
    ].map(function (o) {
      return '<option value="' + o[0] + '"' + (state.settings.pointScope === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');

    var rows = cands.map(function (c) {
      var p = c.p, pts = pointsOf(p.uid);
      var a = agg.byUid[p.uid] || { posN: 0, negN: 0 };
      var when = c.h ? fmtDate(c.h.ts) : (L === 'en' ? 'in roster' : '名单内');
      var cls = pts > 0 ? '' : (pts < 0 ? ' neg' : ' zero');
      return '<label class="pts-row' + (pointSel[p.uid] ? ' on' : '') + '" data-puid="' + p.uid + '">' +
        '<input type="checkbox" data-psel="1"' + (pointSel[p.uid] ? ' checked' : '') + '>' +
        '<div class="pts-main"><b>' + esc(p.name) + '</b><span>' +
        (p.id ? esc(p.id) : (L === 'en' ? 'NO ID' : '无学号')) + ' · ' + esc(p.group || (L === 'en' ? 'Ungrouped' : '未分组')) +
        '</span></div>' +
        '<span class="pts-counts" title="' + (L === 'en' ? 'Add / deduct times' : '加分 / 扣分次数') + '">+' + (a.posN || 0) + ' / −' + (a.negN || 0) + '</span>' +
        '<span class="pts-when">' + esc(when) + '</span>' +
        '<span class="pts-total' + cls + '">' + fmtSigned(pts) + '</span>' +
        '</label>';
    }).join('');

    var empty = !cands.length
      ? '<div class="pts-empty">' +
        (L === 'en'
          ? 'No recent draws yet.<br>Draw once first, or switch the scope to “Whole roster”.'
          : '还没有可加分的同学。<br>先抽一次，或把上方范围切换到「全部名单」。') + '</div>'
      : '';

    var logHtml = logs.length ? logs.map(function (r) {
      var d = Number(r.delta) || 0;
      return '<div class="pts-log-row">' +
        '<span class="pts-log-time">' + esc(fmtDate(r.ts)) + '</span>' +
        '<div class="pts-log-main"><b>' + esc(r.name) + '</b><span>' + esc(r.reason || '—') + '</span></div>' +
        '<span class="pts-delta-tag ' + (d > 0 ? 'pos' : (d < 0 ? 'neg' : '')) + '">' + fmtSigned(d) + '</span>' +
        '</div>';
    }).join('') : '<div class="pts-empty">' + (L === 'en' ? 'No point changes yet.' : '还没有积分变动记录。') + '</div>';

    var reasonPresets = L === 'en'
      ? ['Correct answer', 'Class performance', 'Great homework', 'Big progress', 'Rule breaking']
      : ['回答正确', '课堂表现', '作业优秀', '进步明显', '违纪扣分'];

    body.innerHTML =
      '<div class="pts-sum">' +
        '<div class="pts-stat"><b>' + cands.length + '</b><span>' + (L === 'en' ? 'CANDIDATES' : '候选学生') + '</span></div>' +
        '<div class="pts-stat"><b id="ptsSelCount">' + selN + '</b><span>' + (L === 'en' ? 'SELECTED' : '已选学生') + '</span></div>' +
        '<div class="pts-stat pos"><b>+' + agg.pos + '</b><span>' + (L === 'en' ? 'POINTS GIVEN' : '累计加分') + '</span></div>' +
        '<div class="pts-stat neg"><b>' + agg.neg + '</b><span>' + (L === 'en' ? 'POINTS DEDUCTED' : '累计扣分') + '</span></div>' +
      '</div>' +
      '<div class="pts-toolbar">' +
        '<select id="ptsScope" title="' + (L === 'en' ? 'Who can receive points' : '可加分范围') + '">' + scopeOpts + '</select>' +
        '<select id="ptsSort" title="' + (L === 'en' ? 'Sort list' : '列表排序') + '">' + sortOpts + '</select>' +
        '<button type="button" class="mini-btn" id="ptsSelectAll">' + (L === 'en' ? 'Select all' : '全选') + '</button>' +
        '<button type="button" class="mini-btn" id="ptsClearSel">' + (L === 'en' ? 'Clear' : '清空选择') + '</button>' +
        '<span class="pts-count" id="ptsCount"></span>' +
      '</div>' +
      '<div class="pts-list" id="ptsList">' + rows + empty + '</div>' +
      '<div class="pts-form">' +
        '<div class="pts-line"><span>' + (L === 'en' ? 'Points' : '分值') + '</span>' +
          '<div class="pts-quick">' +
            [-5, -2, -1, 1, 2, 5].map(function (d) {
              return '<button type="button" data-delta="' + d + '">' + (d > 0 ? '+' : '') + d + '</button>';
            }).join('') +
          '</div>' +
          '<input type="number" id="ptsDelta" class="pts-delta" value="1" min="-99" max="99" step="1" inputmode="numeric">' +
        '</div>' +
        '<div class="pts-line"><span>' + (L === 'en' ? 'Reason' : '原因') + '</span>' +
          '<input type="text" id="ptsReason" class="pts-reason" maxlength="40" placeholder="' +
          (L === 'en' ? 'e.g. answered correctly' : '例如：回答正确') + '">' +
        '</div>' +
        '<div class="pts-line"><span></span><div class="pts-reasons">' +
          reasonPresets.map(function (t) { return '<button type="button" data-reason="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') +
        '</div></div>' +
        '<button type="button" class="pts-apply" id="ptsApply"></button>' +
      '</div>' +
      '<div class="pts-log-head"><b>' + (L === 'en' ? 'CHANGE LOG' : '积分流水') + '</b>' +
        '<select id="ptsLogUid" title="' + (L === 'en' ? 'Filter by student' : '按学生筛选') + '">' + logUserOpts + '</select>' +
        '<select id="ptsLogRange" title="' + (L === 'en' ? 'Filter by time' : '按时间筛选') + '">' + rangeOpts + '</select>' +
        '<span class="pts-meta">' + (L === 'en'
          ? (logsAll.length + ' records · +' + lPos + ' / ' + lNeg)
          : ('共 ' + logsAll.length + ' 条 · +' + lPos + ' / ' + lNeg)) + '</span>' +
        '<button type="button" id="ptsUndoLast">' + (L === 'en' ? 'Undo last' : '撤销最近一次') + '</button>' +
        '<button type="button" id="ptsClearLog">' + (L === 'en' ? 'Clear' : '清空记录') + '</button>' +
      '</div>' +
      '<div class="pts-log">' + logHtml + '</div>';

    syncPointsUI();
  }

  function syncPointsUI() {
    var body = $('#pointsBody'); if (!body) return;
    var L = lang();
    var uids = selectedPointUids();
    var deltaEl = $('#ptsDelta');
    var delta = Math.round(Number(deltaEl && deltaEl.value) || 0);
    var cnt = $('#ptsSelCount'); if (cnt) cnt.textContent = uids.length;
    var meta = $('#ptsCount');
    if (meta) meta.textContent = (L === 'en'
      ? (uids.length + ' selected · click a row to toggle')
      : ('已选 ' + uids.length + ' 人 · 点击整行即可勾选'));
    $$('#ptsList .pts-row').forEach(function (row) {
      var on = !!pointSel[row.dataset.puid];
      row.classList.toggle('on', on);
      var cb = row.querySelector('input[data-psel]');
      if (cb) cb.checked = on;
    });
    $$('#pointsBody .pts-quick button').forEach(function (b) {
      b.classList.toggle('on', Number(b.dataset.delta) === delta);
    });
    var apply = $('#ptsApply');
    if (apply) {
      var enough = uids.length > 0 && delta !== 0;
      apply.disabled = !enough;
      apply.textContent = delta === 0
        ? (L === 'en' ? 'Enter a non-zero value' : '请输入非 0 分值')
        : (L === 'en'
          ? (delta > 0 ? ('Add ' + delta + ' to ' + uids.length + ' students') : ('Deduct ' + Math.abs(delta) + ' from ' + uids.length + ' students'))
          : (delta > 0 ? ('给 ' + uids.length + ' 人加 ' + delta + ' 分') : ('给 ' + uids.length + ' 人扣 ' + Math.abs(delta) + ' 分')));
    }
  }

  /* 统一写入积分记录：返回实际写入人数；副作用仅限 pointLog 与汇总 */
  function addPointRecords(uids, delta, reason) {
    var by = participantsByUid();
    var valid = (uids || []).filter(function (u) { return !!by[u]; });
    delta = Math.max(-99, Math.min(99, Math.round(Number(delta) || 0)));
    if (!valid.length || !delta) return 0;
    var now = Date.now();
    var batch = 'pb' + now.toString(36) + Math.random().toString(36).slice(2, 5);
    var why = String(reason || '').slice(0, 40) || (lang() === 'en' ? 'Class performance' : '课堂表现');
    pushUndo();
    valid.forEach(function (uid) {
      var p = by[uid];
      state.pointLog.push({
        rid: 'pt' + (state.pointSeq++), uid: uid, name: p.name, sid: p.id || '', group: p.group || '',
        delta: delta, reason: why, ts: now, batch: batch
      });
    });
    if (state.pointLog.length > POINT_LOG_CAP) state.pointLog = state.pointLog.slice(-POINT_LOG_CAP);
    recountPoints();
    return valid.length;
  }

  function afterPointChange() {
    save();
    renderAll();
    if ($('#pointsModal') && $('#pointsModal').classList.contains('active')) renderPoints();
    if ($('#statsModal') && $('#statsModal').classList.contains('active')) renderStats();
  }

  /* 抽中 / 行内快捷加减分 */
  function quickPoint(uid, delta, reason) {
    var L = lang();
    var p = participantsByUid()[uid];
    if (!p) { toast(L === 'en' ? 'Student not in roster' : '该学生不在名单里', 'err'); return; }
    var why = reason || (delta > 0 ? (L === 'en' ? 'Quick add' : '快捷加分') : (L === 'en' ? 'Quick deduct' : '快捷扣分'));
    var n = addPointRecords([uid], delta, why);
    if (!n) return;
    afterPointChange();
    Sfx.play(delta > 0 ? 'coin' : 'error', 0.7);
    toast(p.name + ' ' + fmtSigned(delta) + (L === 'en' ? ' pts' : ' 分') + ' · ' + why, delta > 0 ? 'ok' : 'err');
    logAction('points', (delta > 0 ? '加分 ' : '扣分 ') + p.name + ' ' + Math.abs(delta) + ' 分：' + why);
  }

  /* 打开积分弹窗并预选某位学生 */
  function openPointsFor(uid) {
    var inList = pointCandidates().some(function (c) { return c.p.uid === uid; });
    if (!inList) { state.settings.pointScope = 'all'; save(); }
    pointSel = {};
    openModal($('#pointsModal'));
    if (participantsByUid()[uid]) { pointSel[uid] = 1; syncPointsUI(); }
  }

  function applyPoints() {
    var L = lang();
    var uids = selectedPointUids();
    var deltaEl = $('#ptsDelta'), reasonEl = $('#ptsReason');
    var delta = Math.max(-99, Math.min(99, Math.round(Number(deltaEl && deltaEl.value) || 0)));
    if (!uids.length) { toast(L === 'en' ? 'Select at least one student' : '请先勾选至少一名学生', 'err'); Sfx.play('error', 0.6); return; }
    if (!delta) { toast(L === 'en' ? 'Points cannot be zero' : '分值不能为 0', 'err'); return; }
    var valid = uids.filter(function (u) { return !!participantsByUid()[u]; });
    if (!valid.length) { toast(L === 'en' ? 'Selected students are gone' : '选中的学生已不在名单里', 'err'); return; }
    var reason = String((reasonEl && reasonEl.value) || '').trim().slice(0, 40) ||
      (L === 'en' ? 'Class performance' : '课堂表现');
    var n = addPointRecords(valid, delta, reason);
    if (!n) return;
    pointSel = {};
    afterPointChange();
    logAction('points', (delta > 0 ? '加分 ' : '扣分 ') + n + ' 人 ' + Math.abs(delta) + ' 分：' + reason);
    Sfx.play(delta > 0 ? 'coin' : 'error', 0.75);
    toast((delta > 0 ? (L === 'en' ? 'Added ' : '已给 ') : (L === 'en' ? 'Deducted ' : '已扣 ')) +
      n + (L === 'en' ? ' students ' : ' 人 ') + Math.abs(delta) +
      (L === 'en' ? ' points · ' : ' 分 · ') + reason, delta > 0 ? 'ok' : 'err');
  }

  function undoLastPoints() {
    var L = lang();
    if (!state.pointLog.length) { toast(L === 'en' ? 'No point records' : '还没有积分记录', 'err'); return; }
    var last = state.pointLog[state.pointLog.length - 1];
    pushUndo();
    var n = 0;
    if (last.batch) {
      state.pointLog = state.pointLog.filter(function (r) {
        if (r.batch === last.batch) { n++; return false; }
        return true;
      });
    } else { state.pointLog.pop(); n = 1; }
    recountPoints();
    save(); renderAll(); renderPoints();
    if ($('#statsModal') && $('#statsModal').classList.contains('active')) renderStats();
    toast((L === 'en' ? 'Undid ' : '已撤销 ') + n + (L === 'en' ? ' changes' : ' 条积分变动'), 'ok');
  }

  async function clearPoints() {
    var L = lang();
    if (!state.pointLog.length) { toast(L === 'en' ? 'No point records' : '还没有积分记录', 'err'); return; }
    var ok = await ask({
      title: L === 'en' ? 'Clear all points?' : '清空全部积分记录？',
      msg: (L === 'en'
        ? ('This removes <b>' + state.pointLog.length + '</b> point records and resets every total to 0. Roster and draw history stay.')
        : ('将删除 <b>' + state.pointLog.length + '</b> 条积分记录，所有学生的当前积分归零。名单与抽卡历史不受影响。')),
      ok: L === 'en' ? 'Clear' : '清空', danger: true
    });
    if (!ok) return;
    pushUndo();
    state.pointLog = [];
    state.pointSeq = 1;
    state.settings.pointLogUid = 'all';
    pointSel = {};
    recountPoints();
    save(); renderAll(); renderPoints();
    if ($('#statsModal') && $('#statsModal').classList.contains('active')) renderStats();
    toast(L === 'en' ? 'Points cleared' : '积分记录已清空', 'ok');
  }

  function pointsReport() {
    // 报表里的「最近抽到」固定按最近 10 抽去重，不受界面范围切换影响
    var cands = pointCandidates('recent10');
    var agg = pointAgg().byUid;
    var recent = cands.map(function (c, i) {
      return {
        index: i + 1, name: c.p.name, sid: c.p.id || '', group: c.p.group || '',
        last: c.h ? fmtDate(c.h.ts) : '', points: pointsOf(c.p.uid)
      };
    });
    var logs = state.pointLog.slice().reverse().map(function (r, i) {
      return {
        index: i + 1, time: fmtDate(r.ts), name: r.name, sid: r.sid || '',
        group: r.group || '', delta: Number(r.delta) || 0, reason: r.reason || ''
      };
    });
    var totals = state.participants.slice().map(function (p) {
      var a = agg[p.uid] || { pos: 0, neg: 0, n: 0, posN: 0, negN: 0 };
      return { p: p, pts: pointsOf(p.uid), pos: a.pos, neg: a.neg, n: a.n, posN: a.posN || 0, negN: a.negN || 0 };
    }).sort(function (a, b) {
      return b.pts - a.pts || a.p.order - b.p.order;
    }).map(function (x, i) {
      return {
        rank: i + 1, name: x.p.name, sid: x.p.id || '', group: x.p.group || '',
        points: x.pts, plus: x.pos, minus: x.neg, count: x.n, plusN: x.posN, minusN: x.negN
      };
    });
    return { recent: recent, logs: logs, totals: totals };
  }

  function exportPointsJson(d) {
    var L = lang();
    download('积分报表_' + stamp() + '.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      recentWinners: d.recent, pointLog: d.logs, totals: d.totals
    }, null, 2), 'application/json;charset=utf-8');
    toast(L === 'en' ? 'Points report exported as JSON' : '积分报表已导出（JSON）', 'ok');
  }

  async function exportPoints() {
    var L = lang();
    var d = pointsReport();
    if (!d.recent.length && !d.logs.length) {
      toast(L === 'en' ? 'No points data to export yet' : '还没有可导出的积分数据', 'err');
      return;
    }
    if (!window.XLSX) { try { await loadSheetJS(); } catch (e) { } }
    if (!window.XLSX) { exportPointsJson(d); return; }
    try {
      var wb = XLSX.utils.book_new();
      var h1 = L === 'en' ? ['#', 'Name', 'Student ID', 'Group', 'Last drawn', 'Current points']
        : ['序号', '姓名', '学号', '分组', '最近抽中', '当前积分'];
      var a1 = [h1].concat(d.recent.map(function (r) { return [r.index, r.name, r.sid, r.group, r.last, r.points]; }));
      var h2 = L === 'en' ? ['#', 'Time', 'Name', 'Student ID', 'Group', 'Change', 'Reason']
        : ['序号', '时间', '姓名', '学号', '分组', '变动', '原因'];
      var a2 = [h2].concat(d.logs.map(function (r) { return [r.index, r.time, r.name, r.sid, r.group, r.delta, r.reason]; }));
      var h3 = L === 'en' ? ['Rank', 'Name', 'Student ID', 'Group', 'Current points', 'Added', 'Add times', 'Deducted', 'Deduct times', 'Records']
        : ['排名', '姓名', '学号', '分组', '当前积分', '加分合计', '加分次数', '扣分合计', '扣分次数', '记录数'];
      var a3 = [h3].concat(d.totals.map(function (r) { return [r.rank, r.name, r.sid, r.group, r.points, r.plus, r.plusN, r.minus, r.minusN, r.count]; }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a1), L === 'en' ? 'Recent winners' : '最近抽到');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a2), L === 'en' ? 'Point changes' : '积分变动');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a3), L === 'en' ? 'Current totals' : '当前积分');
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      download('积分报表_' + stamp() + '.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      toast(L === 'en' ? 'Points report exported (3 sheets)' : '积分报表已导出（3 个工作表）', 'ok');
    } catch (e) {
      exportPointsJson(d);
    }
  }

  /* ---------------- 座位表：渲染 / 编辑 / 拖拽 ---------------- */
  var seatEdit = false, seatSel = null;
  function isSeatFlat() {
    var v = state.settings.seatFlat;
    return (v === true || v === false) ? v : LOW_END;
  }
  function seatShort(i) {
    var C = Math.max(1, Number(state.seatmap.cols) || 1);
    return (Math.floor(i / C) + 1) + '-' + (i % C + 1);
  }
  function seatStats() {
    var by = participantsByUid(), seated = 0, numbered = 0;
    var grid = (state.seatmap && state.seatmap.grid) || [];
    grid.forEach(function (uid) { if (uid && by[uid]) seated++; });
    state.participants.forEach(function (p) { if (seatNoOf(p.uid) >= 1) numbered++; });
    var total = state.participants.length;
    var cap = Math.max(1, (Number(state.seatmap.rows) || 1) * (Number(state.seatmap.cols) || 1));
    return {
      seated: seated, total: total, unseated: Math.max(0, total - seated),
      numbered: numbered, unnumbered: Math.max(0, total - numbered),
      rows: Number(state.seatmap.rows) || 1, cols: Number(state.seatmap.cols) || 1,
      cap: cap, gaps: Math.max(0, cap - seated)
    };
  }
  function renderSeatMap() {
    var body = $('#seatBody'); if (!body) return;
    syncSeatmap();
    var L = lang(), by = participantsByUid(), st = seatStats();
    var flat = isSeatFlat() || st.rows > 8 || st.cols > 12;
    var sm = state.seatmap, grid = sm.grid || [];
    var lastUid = state.last && state.last.uid ? state.last.uid : '';
    var hitIdx = lastUid ? seatIndexOfUid(lastUid) : -1;
    var slotsHtml = '';
    for (var cell = 0; cell < st.cap; cell++) {
      var r = Math.floor(cell / st.cols) + 1, c = cell % st.cols + 1;
      var uid = grid[cell], p = uid ? by[uid] : null;
      var isHit = p && cell === hitIdx;
      var sel = seatEdit && seatSel === cell;
      var no = p ? seatNoOf(p.uid) : 0;
      var seatCls = 'seat' + (p ? ' occupied' : ' empty') + (sel ? ' sel' : '') + (isHit ? ' hit' : '');
      var aria = seatLabel(cell) + (p ? (L === 'en' ? ', ' : '，') + p.name + (no ? (L === 'en' ? ', number ' + no : '，序号 ' + no) : (L === 'en' ? ', unnumbered' : '，未编号')) : (L === 'en' ? ', empty slot' : '，空格（非座位）'));
      slotsHtml += '<div class="seat-slot' + (p ? ' occupied' : ' empty') + '" data-cell="' + cell + '" style="grid-row:' + r + ';grid-column:' + c + '"' +
        (p ? '' : ' data-empty="1"') + '>' +
        (p ? '<div class="' + seatCls + '" data-seat="' + cell + '" data-uid="' + uid + '" role="' + (seatEdit ? 'button' : 'group') + '" tabindex="' + (seatEdit ? '0' : '-1') + '"' +
          ' aria-label="' + esc(aria) + '" title="' + esc(aria) + '"' + (seatEdit ? ' draggable="true"' : '') + '>' +
          '<span class="seat-no">' + (no ? '#' + no : (L === 'en' ? '—' : '未编号')) + '</span>' +
          '<span class="seat-name">' + esc(p.name) + '</span>' +
          '<span class="seat-pos">' + seatShort(cell) + '</span>' +
          '</div>' : '') +
        '</div>';
    }
    var editRules = L === 'en'
      ? 'Seat count always equals roster size. The grid may contain empty slots (not seats, not drawn). Default is a near-square layout; drag seats to the left/right or any empty slot, swap seats, or make an independent row/column. Numbers stay with the student unless you renumber.'
      : '座位数始终等于名单人数；网格中的空格不是座位、不参与抽取。默认近方阵；可把末排座位拖到左侧/右侧或任意空格，也可互换或独立成列/成行；拖动只改位置，不改序号。';
    var layoutBar = seatEdit
      ? '<div class="seat-layout-bar">' +
          '<label>' + (L === 'en' ? 'Rows' : '行') + ' <input type="number" id="seatRowsInput" min="1" max="' + Math.max(1, st.total) + '" value="' + st.rows + '"></label>' +
          '<label>' + (L === 'en' ? 'Cols' : '列') + ' <input type="number" id="seatColsInput" min="1" max="' + Math.max(1, st.total) + '" value="' + st.cols + '"></label>' +
          '<button type="button" class="mini-btn" id="seatApplyLayout">' + (L === 'en' ? 'Apply' : '应用布局') + '</button>' +
          '<button type="button" class="mini-btn" id="seatAutoLayout">' + (L === 'en' ? 'Near-square' : '自动方阵') + '</button>' +
          '<button type="button" class="mini-btn" id="seatAutoNumber">' + (L === 'en' ? 'Number unnumbered' : '按拼音自动编号') + (st.unnumbered ? ' (' + st.unnumbered + ')' : '') + '</button>' +
          '<button type="button" class="mini-btn" id="seatImportBtn">' + (L === 'en' ? 'Import Excel' : '导入 Excel') + '</button>' +
        '</div>' +
        '<p class="seat-rules">' + esc(editRules) + '</p>'
      : '';
    body.innerHTML =
      '<div class="seat-top">' +
        '<div class="seat-stats"><b>' + (L === 'en' ? 'Seated ' + st.seated : '已入座 ' + st.seated) + '</b> / ' +
          (L === 'en' ? ('total ' + st.total + '，' + st.unseated + ' unseated — not included in seat draw')
                      : ('共 ' + st.total + '，' + st.unseated + ' 人未入座不参与座位抽')) +
          ' · <span class="' + (st.unnumbered ? 'seat-warn' : '') + '">' + (L === 'en' ? ('numbered ' + st.numbered + '/' + st.total) : ('已编号 ' + st.numbered + '/' + st.total)) + '</span>' +
        '</div>' +
        '<div class="seat-tools">' +
          '<div class="seg seat-mode-seg" id="seatModeSeg">' +
            '<button type="button" data-seatmode="draw"' + (!seatEdit ? ' class="active"' : '') + '>' + (L === 'en' ? 'Draw mode' : '抽奖模式') + '</button>' +
            '<button type="button" data-seatmode="edit"' + (seatEdit ? ' class="active"' : '') + '>' + (L === 'en' ? 'Edit mode' : '编辑模式') + '</button>' +
          '</div>' +
          '<button type="button" class="mini-btn" id="seatFlatBtn"' + ((st.rows > 8 || st.cols > 12) ? ' disabled title="' + (L === 'en' ? 'Too many rows/columns — 2D is used' : '行/列过多，自动使用 2D') + '"' : '') + '>' + (flat ? (L === 'en' ? '3D view' : '3D 视图') : (L === 'en' ? '2D view' : '2D 视图')) + '</button>' +
        '</div>' +
      '</div>' +
      layoutBar +
      '<div class="seat-stage' + (flat ? ' flat' : '') + '" id="seatStage">' +
        '<div class="seat-floor" id="seatFloor" style="grid-template-columns:repeat(' + st.cols + ',minmax(0,1fr));min-width:' + (st.cols * 62) + 'px;--seat-cols:' + st.cols + ';--seat-rows:' + st.rows + '">' + slotsHtml + '</div>' +
        '<div class="seat-podium">' + (L === 'en' ? 'PODIUM' : '讲 台') + '</div>' +
      '</div>' +
      '<div class="seat-hint">' + (L === 'en'
        ? ('Grid ' + st.rows + '×' + st.cols + ' · ' + st.seated + ' seats · ' + st.gaps + ' empty slots (not seats)')
        : ('网格 ' + st.rows + '×' + st.cols + ' · ' + st.seated + ' 个座位 · ' + st.gaps + ' 个空格（不是座位，不参与抽取）')) +
        (seatEdit ? (L === 'en' ? ' · Drag a seat onto another seat to swap, or onto an empty slot to move.' : ' · 拖到另一个座位互换，拖到空格移动。') : '') +
      '</div>';
    var sd = $('#seatDrawBtn');
    if (sd) {
      sd.style.display = seatEdit ? 'none' : '';
      sd.disabled = seatEdit || !st.seated;
      sd.textContent = L === 'en' ? 'Draw a seat' : '抽座位';
      sd.title = seatEdit ? (L === 'en' ? 'Switch to draw mode first' : '请先切回抽奖模式')
        : (!st.seated ? (L === 'en' ? 'No seats yet' : '还没有座位') : '');
    }
  }

  function moveSeatTo(uid, cell) {
    if (!uid || !(cell >= 0 && cell < seatStats().cap)) return;
    var grid = state.seatmap.grid;
    var old = grid.indexOf(uid);
    if (old === cell) { seatSel = null; renderSeatMap(); return; }
    var p = participantsByUid()[uid];
    if (!p) return;
    pushUndo();
    state.seatmap.auto = false;
    var prev = grid[cell] || null;
    if (old >= 0) grid[old] = prev;
    grid[cell] = uid;
    seatSel = null;
    save(); renderSeatMap(); renderLastCard();
    Sfx.play('click', 0.5);
    toast(p.name + ' → ' + seatLabel(cell), 'ok');
  }

  function autoNumberSeats() {
    var L = lang();
    var un = state.participants.filter(function (p) { return seatNoOf(p.uid) < 1; });
    if (!un.length) { toast(L === 'en' ? 'Everyone already has a number' : '所有学生都已有序号', 'ok'); return; }
    var used = {}, free = [], maxUsed = 0;
    state.participants.forEach(function (p) { var n = seatNoOf(p.uid); if (n) { used[n] = 1; if (n > maxUsed) maxUsed = n; } });
    // 只填空号：优先补 1..N 中的空位；若号段已被占满则顺延，绝不覆盖已有编号
    var top = Math.max(state.participants.length, maxUsed) + un.length + 1;
    for (var n = 1; n <= top && free.length < un.length; n++) if (!used[n]) free.push(n);
    if (!free.length) { toast(L === 'en' ? 'No free numbers' : '没有可用序号', 'err'); return; }
    un.sort(function (a, b) {
      var pa = pyOf(a.name), pb = pyOf(b.name);
      return pa === pb ? a.name.localeCompare(b.name, 'zh-Hans-CN') || a.order - b.order : (pa < pb ? -1 : 1);
    });
    pushUndo();
    un.forEach(function (p, i) { if (free[i] != null) state.seatmap.numbers[p.uid] = free[i]; });
    save(); renderSeatMap(); renderLastCard();
    toast(L === 'en' ? ('Numbered ' + un.length + ' unnumbered students by pinyin') : ('已按姓名首字母为 ' + un.length + ' 人编号，原有编号保持不变'), 'ok');
  }

  function applySeatLayout(rows, cols) {
    var L = lang();
    var N = state.participants.length;
    rows = Math.round(Number(rows)); cols = Math.round(Number(cols));
    if (!(rows >= 1 && cols >= 1) || rows > Math.max(1, N) || cols > Math.max(1, N)) {
      toast(L === 'en' ? ('Rows/columns must be 1–' + Math.max(1, N)) : ('行/列必须在 1–' + Math.max(1, N) + ' 之间'), 'err');
      return;
    }
    if (rows * cols < N) {
      toast(L === 'en' ? ('Grid too small: ' + rows + '×' + cols + ' < ' + N + ' seats') : ('网格太小：' + rows + '×' + cols + ' 容不下 ' + N + ' 个座位'), 'err');
      return;
    }
    pushUndo();
    var sm = state.seatmap;
    var ordered = seatOrder(participantsByUid(), sm.grid);
    sm.auto = false;
    sm.rows = rows; sm.cols = cols;
    sm.grid = new Array(rows * cols).fill(null);
    ordered.forEach(function (p, i) { if (i < sm.grid.length) sm.grid[i] = p.uid; });
    syncSeatmap();
    save(); renderSeatMap(); renderLastCard();
    toast(L === 'en' ? ('Layout ' + rows + '×' + cols) : ('布局已设为 ' + rows + '×' + cols), 'ok');
  }

  function autoLayoutSeats() {
    pushUndo();
    state.seatmap.auto = true;
    syncSeatmap({ force: true });
    save(); renderSeatMap(); renderLastCard();
    toast(lang() === 'en' ? 'Near-square layout restored' : '已恢复近方阵布局', 'ok');
  }

  function seatClick(cell) {
    if (!seatEdit) return;
    var grid = state.seatmap.grid;
    if (seatSel === cell) { seatSel = null; renderSeatMap(); return; }
    if (seatSel != null && grid[seatSel]) { moveSeatTo(grid[seatSel], cell); return; }
    if (grid[cell]) { seatSel = cell; renderSeatMap(); }
    else toast(lang() === 'en' ? 'Pick a seat first, then an empty slot' : '请先点一个有人的座位，再点空格移动', 'err');
  }

  /* ---------------- 座位 Excel 导出 / 导入 ---------------- */
  function seatSheetAoa() {
    syncSeatmap();
    var L = lang();
    var head = L === 'en'
      ? ['Seat no.', 'Name', 'Student ID', 'Row', 'Col', 'Seat']
      : ['座位号', '姓名', '学号', '行', '列', '座位'];
    var rows = [head];
    var C = Math.max(1, Number(state.seatmap.cols) || 1);
    var list = state.participants.slice().sort(function (a, b) {
      var na = seatNoOf(a.uid), nb = seatNoOf(b.uid);
      if (na && nb && na !== nb) return na - nb;
      if (na && !nb) return -1;
      if (!na && nb) return 1;
      return seatIndexOfUid(a.uid) - seatIndexOfUid(b.uid);
    });
    list.forEach(function (p) {
      var idx = seatIndexOfUid(p.uid);
      var no = seatNoOf(p.uid);
      rows.push([
        no || '',
        p.name,
        p.id || '',
        idx >= 0 ? Math.floor(idx / C) + 1 : '',
        idx >= 0 ? (idx % C) + 1 : '',
        idx >= 0 ? seatLabel(idx) : ''
      ]);
    });
    return rows;
  }

  async function exportSeatXlsx() {
    var L = lang();
    if (!state.participants.length) { toast(L === 'en' ? 'Roster is empty' : '名单为空', 'err'); return; }
    if (!window.XLSX) { try { await loadSheetJS(); } catch (e) { } }
    var aoa = seatSheetAoa();
    if (!window.XLSX) {
      var lib = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      download('座位表_' + stamp() + '.csv', '\ufeff' + aoa.map(function (r) { return r.map(lib).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
      toast(L === 'en' ? 'Seat CSV exported (Excel engine unavailable)' : 'Excel 引擎不可用，已导出座位 CSV', 'ok');
      return;
    }
    try {
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), L === 'en' ? 'Seats' : '座位表');
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      download('座位表_' + stamp() + '.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      toast(L === 'en' ? 'Seat sheet exported' : '座位表已导出（Excel）', 'ok');
    } catch (e) {
      toast(L === 'en' ? 'Seat export failed' : '座位表导出失败', 'err');
    }
  }

  function importSeatExcel() {
    var inp = $('#seatImportFile');
    if (inp) { inp.value = ''; inp.click(); }
  }

  async function handleSeatImportFile(file) {
    var L = lang();
    if (!file) return;
    var N = state.participants.length;
    if (!N) { toast(L === 'en' ? 'Roster is empty' : '名单为空，无法导入座位', 'err'); return; }
    if (!window.XLSX) { try { await loadSheetJS(); } catch (e) { } }
    if (!window.XLSX) { toast(L === 'en' ? 'Excel engine unavailable' : 'Excel 解析库不可用', 'err'); return; }
    var wb;
    try {
      var buf = await file.arrayBuffer();
      wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    } catch (e) {
      toast(L === 'en' ? 'Cannot read this Excel file' : '无法读取该 Excel 文件', 'err'); return;
    }
    var sheetName = wb.SheetNames.indexOf('座位表') >= 0 ? '座位表' : (wb.SheetNames.indexOf('Seats') >= 0 ? 'Seats' : wb.SheetNames[0]);
    var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: '' });
    if (!aoa || !aoa.length) { toast(L === 'en' ? 'Empty sheet' : '工作表为空', 'err'); return; }
    var norm = function (v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ''); };
    var heads = {
      no: ['座位号', '序号', '编号', '座号', 'seatno', 'seatno.', 'no', 'no.', 'number', 'seatnumber'],
      name: ['姓名', '名字', '学生', 'name', 'student'],
      id: ['学号', 'id', 'studentid', 'studentno'],
      row: ['行', 'row'],
      col: ['列', 'col', 'column'],
      seat: ['座位', '座位标签', 'seat']
    };
    var findCol = function (row, keys) {
      for (var i = 0; i < row.length; i++) if (keys.indexOf(norm(row[i])) >= 0) return i;
      return -1;
    };
    var hi = -1, cols = null;
    for (var r = 0; r < Math.min(10, aoa.length); r++) {
      var cName = findCol(aoa[r], heads.name);
      if (cName >= 0) {
        cols = {
          no: findCol(aoa[r], heads.no), name: cName, id: findCol(aoa[r], heads.id),
          row: findCol(aoa[r], heads.row), col: findCol(aoa[r], heads.col), seat: findCol(aoa[r], heads.seat)
        };
        hi = r; break;
      }
    }
    if (hi < 0) { toast(L === 'en' ? 'No “Name” column found' : '未找到“姓名”列，请使用导出的座位表模板', 'err'); return; }
    if (cols.no < 0) { toast(L === 'en' ? 'No “Seat no.” column found' : '未找到“座位号”列', 'err'); return; }
    var byId = {}, byName = {};
    state.participants.forEach(function (p) {
      if (p.id) byId[String(p.id).toLowerCase()] = p;
      (byName[p.name] = byName[p.name] || []).push(p);
    });
    var errs = [], used = {}, usedNo = {}, list = [];
    for (var i2 = hi + 1; i2 < aoa.length; i2++) {
      var row = aoa[i2] || [];
      var name = String(row[cols.name] == null ? '' : row[cols.name]).trim();
      if (!name && !String(row[cols.no] == null ? '' : row[cols.no]).trim()) continue;
      var line = i2 + 1;
      if (!name) { errs.push((L === 'en' ? 'Row ' : '第 ') + line + (L === 'en' ? ': missing name' : ' 行：姓名为空')); continue; }
      var sid = cols.id >= 0 ? String(row[cols.id] == null ? '' : row[cols.id]).trim() : '';
      var p = sid ? byId[sid.toLowerCase()] : (byName[name] && byName[name].length === 1 ? byName[name][0] : null);
      if (!p && !sid && byName[name]) {
        p = byName[name].filter(function (x) { return !used[x.uid]; })[0] || null;
      }
      if (!p) { errs.push((L === 'en' ? 'Row ' : '第 ') + line + (L === 'en' ? ': name/ID not in roster' : ' 行：姓名/学号不在名单中') + '（' + name + '）'); continue; }
      if (sid && name && p.name !== name) {
        errs.push((L === 'en' ? 'Row ' : '第 ') + line + (L === 'en' ? ': name does not match the student ID' : ' 行：姓名与学号不匹配') + '（' + name + ' / ' + sid + '）');
        continue;
      }
      if (used[p.uid]) { errs.push((L === 'en' ? 'Row ' : '第 ') + line + (L === 'en' ? ': duplicate student' : ' 行：学生重复') + '（' + name + '）'); continue; }
      used[p.uid] = 1;
      var noRaw = String(row[cols.no] == null ? '' : row[cols.no]).trim();
      var no = Math.round(Number(noRaw));
      if (!(no >= 1 && no <= 9999) || !noRaw || isNaN(Number(noRaw))) { errs.push((L === 'en' ? 'Row ' : '第 ') + line + (L === 'en' ? ': invalid seat number' : ' 行：座位号无效')); continue; }
      if (usedNo[no]) { errs.push((L === 'en' ? 'Row ' : '第 ') + line + (L === 'en' ? ': duplicate seat number ' : ' 行：座位号重复 ') + no); continue; }
      usedNo[no] = 1;
      var rv = cols.row >= 0 ? String(row[cols.row] == null ? '' : row[cols.row]).trim() : '';
      var cv = cols.col >= 0 ? String(row[cols.col] == null ? '' : row[cols.col]).trim() : '';
      list.push({ p: p, no: no, rowRaw: rv, colRaw: cv, line: line });
    }
    if (errs.length) {
      toast((L === 'en' ? 'Seat import failed: ' : '座位导入失败：') + errs.slice(0, 2).join(L === 'en' ? '; ' : '；'), 'err');
      try { console.warn('[seat import]', errs); } catch (e) { }
      return;
    }
    if (list.length !== N) {
      toast(L === 'en' ? ('Row count mismatch: expected ' + N + ', got ' + list.length) : ('人数不一致：名单 ' + N + ' 人，表格 ' + list.length + ' 人'), 'err');
      return;
    }
    var missing = state.participants.filter(function (p) { return !used[p.uid]; });
    if (missing.length) {
      toast(L === 'en' ? 'Some roster members are missing from the sheet' : '表格中缺少部分名单成员：' + missing.slice(0, 3).map(function (p) { return p.name; }).join('、'), 'err');
      return;
    }
    var havePos = list.filter(function (x) { return x.rowRaw !== '' || x.colRaw !== ''; }).length;
    var rows, cols, grid, numbers = {};
    if (havePos && havePos !== list.length) {
      toast(L === 'en' ? 'Some rows have row/col and some do not' : '部分行有“行/列”、部分没有，请补全后再导入', 'err');
      return;
    }
    if (havePos) {
      var maxR = 0, maxC = 0, cells = {}, posErr = '';
      list.forEach(function (x) {
        var rr = Math.round(Number(x.rowRaw)), cc = Math.round(Number(x.colRaw));
        if (!(rr >= 1 && cc >= 1) || rr > N || cc > N) { posErr = (L === 'en' ? 'Invalid row/col at line ' : '行/列无效：第 ') + x.line + (L === 'en' ? '' : ' 行'); return; }
        var key = rr + ',' + cc;
        if (cells[key]) { posErr = (L === 'en' ? 'Duplicate seat position at line ' : '座位位置重复：第 ') + x.line + (L === 'en' ? '' : ' 行'); return; }
        cells[key] = x; maxR = Math.max(maxR, rr); maxC = Math.max(maxC, cc);
      });
      if (posErr) { toast(posErr, 'err'); return; }
      rows = maxR; cols = maxC;
      if (rows * cols < N) { toast(L === 'en' ? 'Grid too small for all seats' : '表格中的行/列容不下全部座位', 'err'); return; }
      grid = new Array(rows * cols).fill(null);
      list.forEach(function (x) {
        var idx = (Math.round(Number(x.rowRaw)) - 1) * cols + (Math.round(Number(x.colRaw)) - 1);
        grid[idx] = x.p.uid;
        numbers[x.p.uid] = x.no;
      });
    } else {
      var d = nearSquare(N);
      rows = d.rows; cols = d.cols;
      grid = new Array(rows * cols).fill(null);
      list.slice().sort(function (a, b) { return a.no - b.no; }).forEach(function (x, i) {
        grid[i] = x.p.uid;
        numbers[x.p.uid] = x.no;
      });
    }
    pushUndo();
    state.seatmap.rows = rows;
    state.seatmap.cols = cols;
    state.seatmap.grid = grid;
    state.seatmap.numbers = numbers;
    state.seatmap.auto = false;
    syncSeatmap();
    save(); renderSeatMap(); renderLastCard();
    toast(L === 'en' ? ('Seat sheet imported: ' + N + ' seats, layout ' + rows + '×' + cols) : ('座位表已导入：' + N + ' 个座位，布局 ' + rows + '×' + cols), 'ok');
  }

  function renderStats() {
    var body = $('#statsBody'); if (!body) return;
    var L = lang();
    var st = achievementStats();
    if (!st.total) {
      body.innerHTML = '<div class="empty">' + (L === 'en' ? 'No data yet — draw a few times.' : '还没有数据，先抽几次吧。') + '</div>';
      return;
    }
    var uniq = {};
    state.history.forEach(function (h) { uniq[h.uid || h.name] = 1; });
    var drawn = drawnCount(), roster = st.roster;

    var cards = [
      [st.total, L === 'en' ? 'TOTAL DRAWS' : '总抽取'],
      [Object.keys(uniq).length, L === 'en' ? 'UNIQUE WINNERS' : '去重人数'],
      [st.c5, L === 'en' ? 'FIVE STAR' : '五星次数'],
      [st.batches, L === 'en' ? 'BATCHES' : '抽卡批次'],
      [(st.c5 / st.total * 100).toFixed(1) + '%', L === 'en' ? '5★ RATE' : '五星出率'],
      [roster ? Math.round(drawn / roster * 100) + '%' : '0%', L === 'en' ? 'COVERAGE' : '名单覆盖率'],
      [st.maxCount + (L === 'en' ? '×' : ' 次'), L === 'en' ? 'MOST DRAWN' : '最高抽中']
    ];

    var counts = {};
    state.history.forEach(function (h) {
      var k = h.uid || h.name;
      if (!counts[k]) counts[k] = { name: h.name, id: h.id, n: 0, best: 1 };
      counts[k].n++;
      if (h.star > counts[k].best) counts[k].best = h.star;
    });
    var rank = Object.keys(counts).map(function (k) { return counts[k]; }).sort(function (a, b) {
      if (state.settings.mode === 'repeat') return b.n - a.n || b.best - a.best || a.name.localeCompare(b.name, 'zh-Hans-CN');
      return b.best - a.best || b.n - a.n || a.name.localeCompare(b.name, 'zh-Hans-CN');
    }).slice(0, 10);
    var rankTitle = state.settings.mode === 'repeat'
      ? (L === 'en' ? 'MOST DRAWN (TOP 10)' : '抽中次数排行（前十）')
      : (L === 'en' ? 'BEST STARS (TOP 10)' : '按星级排行（前十）');

    var ttl = currentTitle();
    var logs = (state.logs || []).slice(-14).reverse();

    body.innerHTML =
      '<div class="stat-grid">' + cards.map(function (c) {
        return '<div class="stat-card"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>';
      }).join('') + '</div>' +
      '<div class="sec-title">' + (L === 'en' ? 'STAR DISTRIBUTION' : '星级分布') + '</div>' +
      '<canvas id="statsChart" class="stats-canvas" width="600" height="180" aria-label="' + (L === 'en' ? 'Star distribution and recent trend' : '星级分布与最近趋势') + '"></canvas>' +
      '<div class="chart-legend">' +
        '<span><i style="background:#ffd700"></i>' + (L === 'en' ? '5★' : '5★') + '</span>' +
        '<span><i style="background:#c77dff"></i>4★</span><span><i style="background:#6ee7ff"></i>3★</span>' +
        '<span><i style="background:#8affc1"></i>2★</span><span><i style="background:#9aa5c4"></i>1★</span>' +
        '<span style="opacity:.7">' + (L === 'en' ? 'right: last 20 draws' : '右侧：最近 20 抽走势') + '</span>' +
      '</div>' +
      '<div class="sec-title">' + (L === 'en' ? 'GROUP SHARE' : '分组占比') + '</div>' +
      '<canvas id="statsGroupChart" class="stats-canvas group" width="600" height="170" aria-label="' + (L === 'en' ? 'Group share' : '分组占比') + '"></canvas>' +
      (function () {
        var rows = state.participants.slice().map(function (p) { return { p: p, pts: pointsOf(p.uid) }; })
          .filter(function (x) { return x.pts !== 0; })
          .sort(function (a, b) { return b.pts - a.pts || a.p.order - b.p.order; }).slice(0, 5);
        if (!rows.length) return '';
        return '<div class="sec-title">' + (L === 'en' ? 'POINTS LEADERBOARD (TOP 5)' : '积分榜（前五）') + '</div>' +
          '<div>' + rows.map(function (x, i) {
            return '<div class="rank-row' + (i === 0 ? ' top1' : '') + '"><span class="rank-no">' + (i + 1) + '</span>' +
              '<div class="rank-main"><b>' + esc(x.p.name) + '</b><span>' + (x.p.id ? esc(x.p.id) : (L === 'en' ? 'NO ID' : '无学号')) + '</span></div>' +
              '<span class="rank-stat" style="color:' + (x.pts > 0 ? '#8affc1' : '#ff9db1') + '">' + fmtSigned(x.pts) + (L === 'en' ? ' pts' : ' 分') + '</span></div>';
          }).join('') + '</div>';
      })() +
      '<div class="sec-title">' + (L === 'en' ? 'TITLE' : '当前称号') + '</div>' +
      '<div class="achv on" style="cursor:default">' +
        '<span class="ico">' + (ttl ? ttl.ico : '🌱') + '</span>' +
        '<span>' + (ttl ? (L === 'en' ? ttl.en : ttl.zh) : (L === 'en' ? 'Newcomer — keep drawing' : '新人 · 继续抽卡')) + '</span>' +
      '</div>' +
      '<div class="sec-title">' + (L === 'en' ? 'ACHIEVEMENTS (' + Object.keys(state.achv || {}).length + '/' + ACHV.length + ')' : '成就（' + Object.keys(state.achv || {}).length + '/' + ACHV.length + '）') + '</div>' +
      ACHV_CATS.map(function (cat) {
        var list = ACHV.filter(function (a) { return (a.cat || 'novice') === cat.id; });
        if (!list.length) return '';
        var got = list.filter(function (a) { return state.achv && state.achv[a.id]; }).length;
        return '<div class="achv-cat-head' + (got === list.length ? ' done' : '') + '">' +
            '<span class="achv-cat-ico">' + (got === list.length ? '✔' : '') + '</span>' +
            '<b>' + (L === 'en' ? cat.en : cat.zh) + '</b>' +
            '<span class="achv-cat-n">' + got + '/' + list.length + '</span>' +
          '</div>' +
          '<div class="achv-list">' + list.map(function (a) {
            var at = state.achv && state.achv[a.id];
            return '<div class="achv' + (at ? ' on' : '') + '" title="' + esc(L === 'en' ? a.en : a.zh) + '"><span class="ico">' + a.ico + '</span>' +
              '<span>' + (L === 'en' ? a.en : a.zh) + '</span>' +
              (at ? '<span class="achv-time">' + fmtDate(at) + '</span>' : '') + '</div>';
          }).join('') + '</div>';
      }).join('') +
      '<div class="sec-title">' + rankTitle + '</div>' +
      '<div>' + rank.map(function (r, i) {
        var cls = i === 0 ? ' top1' : (i === 1 ? ' top2' : (i === 2 ? ' top3' : ''));
        return '<div class="rank-row' + cls + '"><span class="rank-no">' + (i + 1) + '</span>' +
          '<div class="rank-main"><b>' + esc(r.name) + '</b><span>' + (r.id ? esc(r.id) : (L === 'en' ? 'NO ID' : '无学号')) + '</span></div>' +
          '<span class="rank-stat">' + r.n + (L === 'en' ? '× · best ' : ' 次 · 最高 ') + stars(r.best) + '</span></div>';
      }).join('') + '</div>' +
      (logs.length
        ? '<div class="sec-title">' + (L === 'en' ? 'RECENT ACTIVITY' : '最近操作') + '</div>' +
          '<div>' + logs.map(function (g) {
            return '<div class="hist-row"><span class="hist-time">' + esc(g.t || '') + '</span>' +
              '<div class="hist-main"><span>' + esc(g.text || '') + '</span></div></div>';
          }).join('') + '</div>'
        : '');
    drawStatsChart();
    drawGroupChart();
  }

  /* Canvas 图表：左侧星级分布（横向条），右侧最近 20 抽星级走势（折线） */
  function drawStatsChart() {
    var cv = $('#statsChart'); if (!cv || !cv.getContext) return;
    var st = achievementStats();
    var w = Math.max(280, cv.clientWidth || 600), h = 180;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var rr = function (x, y, ww, hh, r) {
      g.beginPath();
      if (g.roundRect) { g.roundRect(x, y, ww, hh, r); return; }
      g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath();
    };
    g.fillStyle = 'rgba(8,13,28,.55)'; rr(0, 0, w, h, 12); g.fill();

    var counts = st.starCounts || {}, maxN = 1;
    [5, 4, 3, 2, 1].forEach(function (s) { maxN = Math.max(maxN, counts[s] || 0); });
    var padL = 16, padT = 18, leftW = Math.max(150, Math.floor(w * 0.52));
    var rowH = (h - 34) / 5;
    var trackX = padL + 30, trackW = leftW - trackX - 52;
    for (var i = 0; i < 5; i++) {
      var s = 5 - i, y = padT + i * rowH;
      var cnt = counts[s] || 0;
      g.fillStyle = STAR_COLORS[s] || '#9aa5c4';
      g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'left';
      g.fillText(s + '★', padL, y + 13);
      g.fillStyle = 'rgba(255,255,255,.09)'; rr(trackX, y + 4, trackW, 10, 5); g.fill();
      var wRatio = cnt / maxN;
      if (cnt > 0) {
        g.fillStyle = STAR_COLORS[s] || '#6ee7ff';
        g.globalAlpha = 0.9;
        rr(trackX, y + 4, Math.max(4, trackW * wRatio), 10, 5); g.fill();
        g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(226,236,255,.7)';
      g.font = '500 10.5px ui-monospace, monospace'; g.textAlign = 'right';
      g.fillText(cnt + (st.total ? ' · ' + (cnt / st.total * 100).toFixed(0) + '%' : ''), leftW - 14, y + 13);
    }

    // 右：最近 20 抽走势
    var x0 = leftW + 4;
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, 12); g.lineTo(x0, h - 12); g.stroke();
    var pts = state.history.slice(-20);
    var x1 = x0 + 18, x2 = w - 18, yT = 28, yB = h - 28;
    for (var lv = 5; lv >= 1; lv--) {
      var yy = yB - ((lv - 1) / 4) * (yB - yT);
      g.strokeStyle = lv === 5 ? 'rgba(255,215,0,.22)' : 'rgba(255,255,255,.07)';
      g.beginPath(); g.moveTo(x1, yy); g.lineTo(x2, yy); g.stroke();
    }
    if (pts.length) {
      var step = pts.length > 1 ? (x2 - x1) / (pts.length - 1) : 0;
      var xy = pts.map(function (p, idx) {
        return { x: x1 + idx * step, y: yB - ((Math.max(1, Math.min(5, p.star)) - 1) / 4) * (yB - yT), s: p.star };
      });
      g.strokeStyle = 'rgba(110,231,255,.9)'; g.lineWidth = 2;
      g.beginPath();
      xy.forEach(function (q, idx) { if (idx === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y); });
      g.stroke();
      xy.forEach(function (q) {
        g.beginPath(); g.arc(q.x, q.y, 3, 0, 6.2832);
        g.fillStyle = STAR_COLORS[q.s] || '#6ee7ff'; g.fill();
        g.strokeStyle = 'rgba(8,13,28,.8)'; g.lineWidth = 1; g.stroke();
      });
      g.fillStyle = 'rgba(226,236,255,.45)';
      g.font = '500 10px system-ui, sans-serif'; g.textAlign = 'left';
      g.fillText('1', x0 + 5, yB + 4);
      g.fillText('5', x0 + 5, yT + 4);
      g.textAlign = 'right';
      g.fillText('#' + state.history.length, x2, h - 10);
    } else {
      g.fillStyle = 'rgba(226,236,255,.4)';
      g.font = '500 12px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(lang() === 'en' ? 'No draws yet' : '还没有抽取数据', x0 + (w - x0) / 2, h / 2 + 4);
    }
  }
  function drawGroupChart() {
    var cv = $('#statsGroupChart'); if (!cv || !cv.getContext) return;
    var L = lang();
    var counts = {}, total = 0;
    state.participants.forEach(function (p) {
      var g = p.group || (L === 'en' ? 'Ungrouped' : '未分组');
      counts[g] = (counts[g] || 0) + 1;
      total++;
    });
    var list = Object.keys(counts).map(function (g) { return { g: g, n: counts[g], c: groupColor(g) || '#9aa5c4' }; })
      .sort(function (a, b) { return b.n - a.n; });
    if (list.length > 6) {
      var rest = list.slice(5).reduce(function (a, x) { return a + x.n; }, 0);
      list = list.slice(0, 5);
      if (rest) list.push({ g: L === 'en' ? 'Others' : '其他', n: rest, c: '#6b7897' });
    }
    var w = Math.max(280, cv.clientWidth || 600), h = 170;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(8,13,28,.55)';
    var rr = function (x, y, ww, hh, r) {
      g.beginPath();
      if (g.roundRect) { g.roundRect(x, y, ww, hh, r); return; }
      g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath();
    };
    rr(0, 0, w, h, 12); g.fill();
    if (!total) {
      g.fillStyle = 'rgba(226,236,255,.4)';
      g.font = '500 12px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(L === 'en' ? 'No groups yet' : '还没有分组数据', w / 2, h / 2);
      return;
    }
    var cx = 102, cy = h / 2 + 2, R = 62, r0 = 38, ang = -Math.PI / 2;
    list.forEach(function (x) {
      var a = x.n / total * Math.PI * 2;
      g.beginPath();
      g.arc(cx, cy, R, ang, ang + a);
      g.arc(cx, cy, r0, ang + a, ang, true);
      g.closePath();
      g.fillStyle = x.c; g.globalAlpha = .92; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(8,13,28,.7)'; g.lineWidth = 1.5; g.stroke();
      ang += a;
    });
    g.textAlign = 'center';
    g.fillStyle = 'rgba(234,240,255,.95)';
    g.font = '800 20px system-ui, sans-serif';
    g.fillText(String(total), cx, cy + 2);
    g.fillStyle = 'rgba(226,236,255,.5)';
    g.font = '500 10px system-ui, sans-serif';
    g.fillText(L === 'en' ? 'PEOPLE' : '总人数', cx, cy + 18);
    var lx = 196, ly = 26, rowH = 22;
    list.forEach(function (x) {
      g.fillStyle = x.c;
      rr(lx, ly - 8, 9, 9, 2); g.fill();
      g.fillStyle = 'rgba(234,240,255,.85)';
      g.font = '600 11.5px system-ui, sans-serif'; g.textAlign = 'left';
      var name = x.g.length > 10 ? x.g.slice(0, 10) + '…' : x.g;
      g.fillText(name, lx + 15, ly + 1);
      g.fillStyle = 'rgba(226,236,255,.55)';
      g.font = '500 10.5px ui-monospace, monospace'; g.textAlign = 'right';
      g.fillText(x.n + ' · ' + (x.n / total * 100).toFixed(0) + '%', w - 16, ly + 1);
      ly += rowH;
    });
  }

  window.addEventListener('resize', function () {
    if ($('#statsModal') && $('#statsModal').classList.contains('active')) { drawStatsChart(); drawGroupChart(); }
    vsStep = 0;
    if (vsActive) { vsKey = ''; vsSchedule(); }
  });

  /* ---------------- 导出 ---------------- */
  /* 复制文本：优先 Clipboard API，file:// 或旧浏览器回退到 execCommand */
  function copyText(text) {
    return new Promise(function (resolve) {
      var done = function (ok) { resolve(!!ok); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
          return;
        }
      } catch (e) { }
      done(fallbackCopy(text));
    });
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function download(name, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1200);
  }

  function exportCsv() {
    if (!state.history.length) { toast(lang() === 'en' ? 'Nothing to export yet' : '还没有抽取记录可导出', 'err'); return; }
    var head = lang() === 'en' ? ['#', 'Name', 'Student ID', 'Group', 'Stars', 'Batch', 'Time'] : ['序号', '姓名', '学号', '分组', '星级', '批次', '时间'];
    var lines = [head.join(',')];
    state.history.forEach(function (h) {
      lines.push([h.index, '"' + String(h.name).replace(/"/g, '""') + '"', '"' + String(h.id || '').replace(/"/g, '""') + '"',
        '"' + String(h.group || '').replace(/"/g, '""') + '"', h.star, h.batchId, h.time].join(','));
    });
    download('点名结果_' + stamp() + '.csv', '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    toast(lang() === 'en' ? 'CSV exported' : 'CSV 已导出', 'ok');
  }

  /* 名单 CSV：只导出当前名单，便于给别的老师 / 别的班级复用 */
  function exportRosterCsv() {
    var L = lang();
    if (!state.participants.length) { toast(L === 'en' ? 'Roster is empty' : '名单为空', 'err'); return; }
    var head = L === 'en' ? ['#', 'Name', 'Student ID', 'Group'] : ['序号', '姓名', '学号', '分组'];
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [head.join(',')];
    state.participants.forEach(function (p, i) {
      lines.push([i + 1, q(p.name), q(p.id || ''), q(p.group || '')].join(','));
    });
    download('点名名单_' + stamp() + '.csv', '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    toast(L === 'en' ? 'Roster CSV exported' : '名单 CSV 已导出', 'ok');
  }

  function exportTxt() {
    if (!state.history.length) { toast(lang() === 'en' ? 'Nothing to export yet' : '还没有抽取记录可导出', 'err'); return; }
    var L = lang();
    var out = ['=== ' + (L === 'en' ? 'Random Roll results' : '随机点名结果') + ' · ' + new Date().toLocaleString() + ' ===', ''];
    groupHistory().slice().reverse().forEach(function (g) {
      var h0 = g.items[0];
      out.push('[' + fmtDate(h0.ts) + '] ' + (g.items.length > 1 ? (L === 'en' ? 'Ten pull' : '十连') : (L === 'en' ? 'Single' : '单抽')) + (h0.mode === 'repeat' ? (L === 'en' ? ' (repeatable)' : '（可重复）') : ''));
      g.items.forEach(function (h) {
        out.push('  ' + String(h.index).padStart(3, ' ') + '. ' + h.name + (h.id ? ' (' + h.id + ')' : '') + '  ' + stars(h.star) + '  ' + h.time);
      });
      out.push('');
    });
    out.push((L === 'en' ? 'Total ' : '共 ') + state.history.length + (L === 'en' ? ' draws' : ' 次抽取'));
    download('点名结果_' + stamp() + '.txt', out.join('\r\n'));
    toast(L === 'en' ? 'TXT exported' : 'TXT 已导出', 'ok');
  }

  function exportJson() {
    download('点名备份_' + stamp() + '.json', JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    toast(lang() === 'en' ? 'Backup exported' : '备份已导出', 'ok');
  }

  function exportPng() {
    var last = state.last || (state.history.length ? state.history[state.history.length - 1] : null);
    if (!last) { toast(lang() === 'en' ? 'Draw something first' : '先抽一次再导出图片', 'err'); return; }
    var L = lang();
    var W = 1200, H = 675;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#101833'); grd.addColorStop(0.5, '#1a2244'); grd.addColorStop(1, '#2a1b45');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    var col = STAR_COLORS[last.star] || '#6ee7ff';
    var rg = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 520);
    rg.addColorStop(0, (STAR_GLOW[last.star] || 'rgba(110,231,255,.3)'));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);

    // 星点
    for (var i = 0; i < 160; i++) {
      var x = Math.random() * W, y = Math.random() * H, r = Math.random() * 1.8 + 0.4;
      g.globalAlpha = Math.random() * 0.7 + 0.15;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    g.textAlign = 'center';
    g.fillStyle = 'rgba(234,240,255,.55)';
    g.font = '600 20px "Microsoft YaHei", system-ui, sans-serif';
    g.fillText((L === 'en' ? 'RANDOM ROLL · RESULT' : '随 机 点 名 · 抽 卡 结 果'), W / 2, 120);

    g.fillStyle = 'rgba(234,240,255,.35)';
    g.font = '700 130px "Microsoft YaHei", system-ui, sans-serif';
    g.fillText(last.name.slice(0, 8), W / 2, H / 2 + 20);

    g.fillStyle = col;
    g.font = '700 54px system-ui, sans-serif';
    g.fillText(stars(last.star), W / 2, H / 2 + 110);

    if (last.id) {
      g.fillStyle = 'rgba(234,240,255,.6)';
      g.font = '500 24px ui-monospace, monospace';
      g.fillText(last.id, W / 2, H / 2 + 160);
    }
    // 称号：与结果页、长图保持一致
    var ttlPng = equippedTitle();
    if (ttlPng) {
      g.fillStyle = 'rgba(255,230,163,.92)';
      g.font = '600 22px "Microsoft YaHei", system-ui, sans-serif';
      g.fillText('「 ' + (L === 'en' ? ttlPng.en : ttlPng.zh) + ' 」', W / 2, H / 2 + (last.id ? 205 : 175));
    }

    g.fillStyle = 'rgba(234,240,255,.4)';
    g.font = '500 20px "Microsoft YaHei", system-ui, sans-serif';
    g.fillText((L === 'en' ? 'Total roster ' : '名单 ') + state.participants.length +
      (L === 'en' ? ' · draws ' : ' 人 · 已抽 ') + state.history.length +
      (L === 'en' ? ' · ' : ' 次 · ') + new Date().toLocaleString(), W / 2, H - 70);

    cv.toBlob(function (blob) {
      if (!blob) { toast('图片生成失败', 'err'); return; }
      download('点名卡片_' + stamp() + '.png', blob);
      toast(L === 'en' ? 'PNG exported' : '图片已导出', 'ok');
    }, 'image/png');
  }

  /* 分享长图：班级信息 + 最新结果 + 星级分布 + 排行 + 成就 */
  function exportShareLong() {
    var L = lang(), st = achievementStats();
    if (!st.total && !state.participants.length) {
      toast(L === 'en' ? 'Add a roster first' : '先添加名单再生成分享图', 'err');
      return;
    }
    var W = 900, H = 1420;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var F = function (w, s) { return w + ' ' + s + 'px "Microsoft YaHei", system-ui, sans-serif'; };

    var grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#0d1430'); grd.addColorStop(0.55, '#161d3e'); grd.addColorStop(1, '#2a1b45');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 220; i++) {
      g.globalAlpha = Math.random() * 0.6 + 0.1;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(Math.random() * W, Math.random() * H, Math.random() * 1.6 + 0.3, 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;

    var pad = 64;
    g.textAlign = 'left';
    g.fillStyle = 'rgba(234,240,255,.95)';
    g.font = F(700, 44);
    g.fillText(L === 'en' ? 'Random Roll · Class Report' : '随机点名 · 班级抽卡报告', pad, 110);
    g.fillStyle = 'rgba(234,240,255,.55)';
    g.font = F(500, 20);
    g.fillText(new Date().toLocaleString(), pad, 148);

    // 概览
    var boxes = [
      [state.participants.length, L === 'en' ? 'ROSTER' : '名单人数'],
      [st.total, L === 'en' ? 'DRAWS' : '抽取次数'],
      [st.c5, L === 'en' ? 'FIVE STAR' : '五星次数'],
      [Object.keys(state.achv || {}).length + '/' + ACHV.length, L === 'en' ? 'ACHV' : '成就']
    ];
    var bw = (W - pad * 2 - 36) / 4, y0 = 190;
    boxes.forEach(function (b, k) {
      var x = pad + k * (bw + 12);
      g.fillStyle = 'rgba(255,255,255,.06)';
      g.beginPath();
      if (g.roundRect) { g.roundRect(x, y0, bw, 104, 18); g.fill(); } else g.fillRect(x, y0, bw, 104);
      g.fillStyle = 'rgba(234,240,255,.96)';
      g.font = F(700, 34); g.textAlign = 'center';
      g.fillText(String(b[0]), x + bw / 2, y0 + 52);
      g.fillStyle = 'rgba(234,240,255,.5)';
      g.font = F(500, 15);
      g.fillText(String(b[1]), x + bw / 2, y0 + 82);
      g.textAlign = 'left';
    });

    // 最新结果
    var y = y0 + 150;
    g.fillStyle = 'rgba(234,240,255,.45)';
    g.font = F(600, 16);
    g.fillText(L === 'en' ? 'LATEST RESULT' : '最近一次结果', pad, y);
    y += 26;
    var last = state.last;
    if (last) {
      g.fillStyle = STAR_COLORS[last.star] || '#6ee7ff';
      g.font = F(700, 64);
      g.fillText(String(last.name).slice(0, 10), pad, y + 56);
      g.font = F(600, 30);
      g.fillText(stars(last.star), pad, y + 100);
      if (last.id) {
        g.fillStyle = 'rgba(234,240,255,.5)';
        g.font = F(500, 20);
        g.fillText(last.id, pad + 320, y + 100);
      }
      y += 140;
    } else {
      g.fillStyle = 'rgba(234,240,255,.4)';
      g.font = F(500, 22);
      g.fillText(L === 'en' ? 'No draws yet' : '还没有抽取记录', pad, y + 30);
      y += 76;
    }

    // 星级分布
    g.fillStyle = 'rgba(234,240,255,.45)';
    g.font = F(600, 16);
    g.fillText(L === 'en' ? 'STAR DISTRIBUTION' : '星级分布', pad, y);
    y += 34;
    var maxC = 1;
    for (var s = 5; s >= 1; s--) maxC = Math.max(maxC, st.starCounts[s] || 0);
    for (var s2 = 5; s2 >= 1; s2--) {
      var cnt = st.starCounts[s2] || 0;
      var barW = Math.round((W - pad * 2 - 190) * (cnt / maxC));
      g.fillStyle = STAR_COLORS[s2];
      g.font = F(600, 18);
      g.fillText(stars(s2), pad, y + 16);
      g.globalAlpha = 0.85;
      g.beginPath();
      if (g.roundRect) { g.roundRect(pad + 150, y, Math.max(4, barW), 22, 11); g.fill(); } else g.fillRect(pad + 150, y, Math.max(4, barW), 22);
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(234,240,255,.6)';
      g.font = F(500, 16);
      g.fillText(cnt + (L === 'en' ? '×' : ' 次'), pad + 150 + Math.max(4, barW) + 14, y + 17);
      y += 34;
    }

    // 排行前五
    y += 22;
    g.fillStyle = 'rgba(234,240,255,.45)';
    g.font = F(600, 16);
    g.fillText(L === 'en' ? 'TOP 5' : '抽中排行前五', pad, y);
    y += 34;
    var counts = {};
    state.history.forEach(function (h) {
      var k = h.uid || h.name;
      if (!counts[k]) counts[k] = { name: h.name, id: h.id, n: 0, best: 1 };
      counts[k].n++; if (h.star > counts[k].best) counts[k].best = h.star;
    });
    var top = Object.keys(counts).map(function (k) { return counts[k]; })
      .sort(function (a, b) { return b.n - a.n || b.best - a.best; }).slice(0, 5);
    if (!top.length) {
      g.fillStyle = 'rgba(234,240,255,.4)';
      g.font = F(500, 18);
      g.fillText('—', pad, y + 18);
      y += 40;
    } else {
      top.forEach(function (r, idx) {
        g.fillStyle = 'rgba(234,240,255,.9)';
        g.font = F(600, 22);
        g.fillText((idx + 1) + '. ' + String(r.name).slice(0, 12), pad, y + 20);
        g.fillStyle = 'rgba(234,240,255,.55)';
        g.font = F(500, 17);
        g.fillText(r.n + (L === 'en' ? '× ' : ' 次 ') + stars(r.best), pad + 380, y + 20);
        y += 34;
      });
    }

    var ttl = equippedTitle();
    g.fillStyle = 'rgba(234,240,255,.4)';
    g.font = F(500, 18);
    g.fillText((L === 'en' ? 'Title: ' : '称号：') + (ttl ? (L === 'en' ? ttl.en : ttl.zh) : (L === 'en' ? 'Newcomer' : '新人')), pad, H - 52);

    cv.toBlob(function (blob) {
      if (!blob) { toast(L === 'en' ? 'Image failed' : '图片生成失败', 'err'); return; }
      download('点名长图_' + stamp() + '.png', blob);
      toast(L === 'en' ? 'Long image exported' : '分享长图已导出', 'ok');
    }, 'image/png');
  }

  /* Excel（真正的 .xlsx，走内联 SheetJS）：名单 / 历史 / 统计 三个工作表 */
  async function exportXlsx() {
    var L = lang();
    if (!window.XLSX) {
      try { await loadSheetJS(); } catch (e0) { }
    }
    if (!window.XLSX) { toast(L === 'en' ? 'Excel engine could not load — use CSV instead' : 'Excel 解析库加载失败，请改用 CSV 导出', 'err'); return; }
    var wb = XLSX.utils.book_new();
    var roster = state.participants.map(function (p, i) {
      return {
        [L === 'en' ? '#' : '序号']: i + 1,
        [L === 'en' ? 'Name' : '姓名']: p.name,
        [L === 'en' ? 'Student ID' : '学号']: p.id || '',
        [L === 'en' ? 'Group' : '分组']: p.group || '',
        [L === 'en' ? 'Drawn' : '已抽中']: p.drawn ? (L === 'en' ? 'yes' : '是') : (L === 'en' ? 'no' : '否'),
        [L === 'en' ? 'Times drawn' : '抽中次数']: Number(p.count) || 0,
        [L === 'en' ? 'Excluded' : '已排除']: p.excluded ? (L === 'en' ? 'yes' : '是') : ''
      };
    });
    var hist = state.history.map(function (h) {
      return {
        [L === 'en' ? '#' : '序号']: h.index,
        [L === 'en' ? 'Name' : '姓名']: h.name,
        [L === 'en' ? 'Student ID' : '学号']: h.id || '',
        [L === 'en' ? 'Group' : '分组']: h.group || '',
        [L === 'en' ? 'Stars' : '星级']: h.star,
        [L === 'en' ? 'Batch' : '批次']: h.batchId,
        [L === 'en' ? 'Mode' : '模式']: h.mode === 'repeat' ? (L === 'en' ? 'repeatable' : '可重复') : (L === 'en' ? 'no-repeat' : '不重复'),
        [L === 'en' ? 'Time' : '时间']: h.time
      };
    });
    var st = achievementStats();
    var stats = [
      { [L === 'en' ? 'Metric' : '指标']: L === 'en' ? 'Roster size' : '名单人数', [L === 'en' ? 'Value' : '数值']: st.roster },
      { [L === 'en' ? 'Metric' : '指标']: L === 'en' ? 'Draws' : '抽取次数', [L === 'en' ? 'Value' : '数值']: st.total },
      { [L === 'en' ? 'Metric' : '指标']: L === 'en' ? '5★' : '五星次数', [L === 'en' ? 'Value' : '数值']: st.c5 },
      { [L === 'en' ? 'Metric' : '指标']: L === 'en' ? '4★' : '四星次数', [L === 'en' ? 'Value' : '数值']: st.c4 },
      { [L === 'en' ? 'Metric' : '指标']: L === 'en' ? 'Ten pulls' : '十连次数', [L === 'en' ? 'Value' : '数值']: st.tenBatches },
      { [L === 'en' ? 'Metric' : '指标']: L === 'en' ? 'Best star' : '最高星级', [L === 'en' ? 'Value' : '数值']: st.bestStar || 0 }
    ];
    try {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roster), L === 'en' ? 'Roster' : '名单');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hist), L === 'en' ? 'History' : '历史');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stats), L === 'en' ? 'Stats' : '统计');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(seatSheetAoa()), L === 'en' ? 'Seats' : '座位表');
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      download('点名数据_' + stamp() + '.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      toast(L === 'en' ? 'Excel exported' : 'Excel 已导出', 'ok');
    } catch (e) {
      toast(L === 'en' ? 'Excel export failed' : 'Excel 导出失败', 'err');
    }
  }

  /* 十连长图：把最近一次十连的十张卡画成一张竖图 */
  function exportTenLong() {
    var L = lang();
    var batch = null, last = state.history.filter(function (h) { return h.batchId; }).length
      ? state.history[state.history.length - 1] : null;
    if (last) {
      var items = state.history.filter(function (h) { return h.batchId === last.batchId; });
      if (items.length) batch = items;
    }
    if (!batch || batch.length < 2) {
      toast(L === 'en' ? 'Need a ten-pull first' : '先抽一次十连再导出长图', 'err');
      return;
    }
    var W = 900, pad = 48, cardW = 240, cardH = 132, gap = 18;
    var cols = Math.min(2, batch.length);
    var rows = Math.ceil(batch.length / cols);
    var H = pad * 2 + 96 + rows * (cardH + gap) + 96;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var F = function (w, s) { return w + ' ' + s + "px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"; };
    var bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0b1020'); bg.addColorStop(0.5, '#151a35'); bg.addColorStop(1, '#0a0f1e');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 200; i++) {
      g.globalAlpha = Math.random() * 0.6 + 0.1;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.3, 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(234,240,255,.95)';
    g.font = F(700, 34);
    g.fillText(L === 'en' ? 'Ten-pull result' : '十连结果', W / 2, pad + 34);
    g.fillStyle = 'rgba(234,240,255,.5)';
    g.font = F(500, 16);
    g.fillText(fmtDate(batch[0].ts), W / 2, pad + 62);

    var startY = pad + 96;
    var totalW = cols * cardW + (cols - 1) * gap;
    var x0 = (W - totalW) / 2;
    batch.forEach(function (h, idx) {
      var cx = x0 + (idx % cols) * (cardW + gap);
      var cy = startY + Math.floor(idx / cols) * (cardH + gap);
      var col = STAR_COLORS[h.star] || '#9aa5c4';
      var grd = g.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      grd.addColorStop(0, 'rgba(22,28,48,.96)');
      grd.addColorStop(0.55, 'rgba(30,38,66,.94)');
      grd.addColorStop(1, col + '33');
      g.beginPath();
      if (g.roundRect) g.roundRect(cx, cy, cardW, cardH, 16); else g.rect(cx, cy, cardW, cardH);
      g.fillStyle = grd; g.fill();
      g.lineWidth = h.star === 5 ? 2.4 : 1.2;
      g.strokeStyle = col + (h.star === 5 ? 'cc' : '55');
      g.stroke();
      g.textAlign = 'left';
      g.fillStyle = col;
      g.font = F(700, 16);
      g.fillText(stars(h.star), cx + 16, cy + 30);
      g.fillStyle = 'rgba(234,240,255,.95)';
      g.font = F(700, 24);
      g.fillText(String(h.name).slice(0, 8), cx + 16, cy + 68);
      g.fillStyle = 'rgba(234,240,255,.5)';
      g.font = F(500, 15);
      g.fillText(h.id || '', cx + 16, cy + 96);
    });
    g.textAlign = 'center';
    var dist = {};
    batch.forEach(function (h) { dist[h.star] = (dist[h.star] || 0) + 1; });
    var parts = [5, 4, 3, 2, 1].filter(function (s) { return dist[s]; })
      .map(function (s) { return s + '★×' + dist[s]; });
    g.fillStyle = 'rgba(234,240,255,.8)';
    g.font = F(600, 18);
    g.fillText(parts.join(' · '), W / 2, startY + rows * (cardH + gap) + 34);
    var ttlTen = equippedTitle();
    if (ttlTen) {
      g.fillStyle = 'rgba(255,230,163,.88)';
      g.font = F(600, 17);
      g.fillText('「 ' + (L === 'en' ? ttlTen.en : ttlTen.zh) + ' 」', W / 2, startY + rows * (cardH + gap) + 68);
    }
    g.fillStyle = 'rgba(234,240,255,.5)';
    g.font = F(500, 15);
    g.fillText((L === 'en' ? 'Class ' : '班级 ') + state.participants.length + (L === 'en' ? ' people · ' : ' 人 · ') +
      state.history.length + (L === 'en' ? ' draws · ' : ' 抽 · ') + fmtDate(batch[0].ts), W / 2, H - 52);
    g.fillStyle = 'rgba(234,240,255,.35)';
    g.font = F(500, 14);
    g.fillText(L === 'en' ? 'Random Roll · card draw' : '随机点名 · 抽卡系统', W / 2, H - 26);

    cv.toBlob(function (blob) {
      if (!blob) { toast(L === 'en' ? 'Image failed' : '图片生成失败', 'err'); return; }
      download('十连结果_' + stamp() + '.png', blob);
      toast(L === 'en' ? 'Ten-pull card exported' : '十连长图已导出', 'ok');
    }, 'image/png');
  }

  /* 打印范围：给 body 加类，交给 @media print 控制 */
  function doPrint(scope) {
    var cls = ['print-only-roster', 'print-only-history'];
    cls.forEach(function (c) { document.body.classList.remove(c); });
    if (scope === 'roster') document.body.classList.add('print-only-roster');
    else if (scope === 'history') document.body.classList.add('print-only-history');
    setTimeout(function () {
      window.print();
      setTimeout(function () { cls.forEach(function (c) { document.body.classList.remove(c); }); }, 400);
    }, 60);
  }

  function doExport(fmt) {
    if (fmt === 'csv') exportCsv();
    else if (fmt === 'rostercsv') exportRosterCsv();
    else if (fmt === 'txt') exportTxt();
    else if (fmt === 'json') exportJson();
    else if (fmt === 'png') exportPng();
    else if (fmt === 'pnglong') exportShareLong();
    else if (fmt === 'xl') exportXlsx();
    else if (fmt === 'points') exportPoints();
    else if (fmt === 'tenpng') exportTenLong();
    else if (fmt === 'print') {
      var ps = $('#printScope');
      doPrint(ps ? ps.value : 'all');
    }
  }

  /* ---------------- 背景特效 ---------------- */
  function initStarfield() {
    var cv = $('#starfield'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, list = [];
    function make() {
      var count = Math.max(60, Math.min(340, Math.round(window.innerWidth * window.innerHeight / 9000)));
      list = [];
      for (var i = 0; i < count; i++) {
        list.push({
          x: Math.random() * W, y: Math.random() * H,
          r: (Math.random() * 1.5 + 0.35) * dpr,
          ph: Math.random() * Math.PI * 2,
          sp: Math.random() * 0.022 + 0.006,
          vy: (Math.random() * 0.09 + 0.015) * dpr
        });
      }
    }
    function resize() {
      W = cv.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      H = cv.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
      make();
    }
    resize();
    window.addEventListener('resize', resize);
    (function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        s.ph += s.sp;
        s.y += s.vy;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
        ctx.globalAlpha = 0.28 + 0.62 * Math.abs(Math.sin(s.ph));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    })();
  }

  function initGlow() {
    var el = $('#cursor-glow'); if (!el) return;
    var tx = window.innerWidth / 2, ty = window.innerHeight / 2, x = tx, y = ty;
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      x += (tx - x) * 0.13;
      y += (ty - y) * 0.13;
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  function initTilt() {
    var card = $('#lastCard'); if (!card) return;
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      var rx = (0.5 - py) * 12, ry = (px - 0.5) * 16;
      card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(4px)';
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
    card.addEventListener('mouseleave', function () { card.style.transform = ''; });
  }

  /* ---------------- 首次引导 ---------------- */
  var GUIDE = [
    {
      zh: '在左侧 <b>参与者名单</b> 中手动添加，或打开右上角 <b>⚙ 设置 → 快捷入口 → 导入</b>（快捷键 <code>E</code>）批量粘贴名单。支持 <code>姓名</code>、<code>姓名,学号</code>、<code>姓名,学号,分组</code> 三种写法。',
      en: 'Add participants on the left, or open <b>⚙ Settings → Shortcuts → Import</b> (shortcut <code>E</code>) to paste a roster. Formats: <code>Name</code>, <code>Name,StudentID</code>, <code>Name,StudentID,Group</code>.'
    },
    {
      zh: '点 <b>单抽</b> 或 <b>十连</b> 开始抽卡（<code>空格</code> 单抽、<code>Shift+空格</code> 十连）。不重复模式下抽中者自动移出候选池，也可以随时手动「放回」。',
      en: 'Hit <b>Single</b> or <b>Ten pull</b> (<code>Space</code> / <code>Shift+Space</code>). In no-repeat mode winners leave the pool and can be returned manually at any time.'
    },
    {
      zh: '在 <b>设置</b>（快捷键 <code>S</code>）里调整 1–5★ 概率、开启保底、切换卡面皮肤与音效；概率合计必须正好 100% 才能抽取。',
      en: 'Open <b>Settings</b> (<code>S</code>) to tune 1–5★ odds, enable pity, change card skins and sound. Odds must total exactly 100% before drawing.'
    },
    {
      zh: '名单、历史、设置都会自动保存在本机浏览器（localStorage），关掉页面也不会丢。可在设置里导出 <b>JSON 备份</b>，或把结果导出成 <b>CSV / TXT / 图片</b>。',
      en: 'Roster, history and settings are stored in this browser (localStorage) and survive a reload. Export a <b>JSON backup</b> or the results as <b>CSV / TXT / image</b>.'
    }
  ];
  function renderGuide() {
    var box = $('#guideBody'); if (!box) return;
    var L = lang();
    box.innerHTML = GUIDE.map(function (g, i) {
      return '<div class="guide-step"><span class="guide-num">' + (i + 1) + '</span><p>' + (L === 'en' ? g.en : g.zh) + '</p></div>';
    }).join('');
  }

  /* ---------------- 重置 ---------------- */
  async function resetAll() {
    var ok = await ask({
      title: lang() === 'en' ? 'Reset system' : '重置系统',
      msg: (lang() === 'en'
        ? 'This clears <b>the whole roster</b>, <b>all draw history</b>, <b>point records</b> and <b>seat assignments</b>. Your settings, odds, pity and sound preferences are kept. You can undo afterwards.'
        : '将清空 <b>全部名单</b>、<b>抽取历史</b>、<b>积分记录</b> 与 <b>座位安排</b>。设置、概率、保底与音效偏好会保留。操作后仍可撤销。') +
        '<br><span style="opacity:.7;font-size:12px">' + (lang() === 'en' ? 'Roster: ' : '当前名单：') +
        state.participants.length + (lang() === 'en' ? ' · history: ' : ' 人 · 历史 ') + state.history.length + (lang() === 'en' ? ' draws' : ' 次') + '</span>',
      ok: lang() === 'en' ? 'Reset' : '确认重置',
      cancel: lang() === 'en' ? 'Cancel' : '取消',
      danger: true
    });
    if (!ok) return;
    pushUndo();
    state.participants = [];
    state.history = [];
    state.last = null;
    state.drawIndex = 0;
    state.seq = 1;
    state.seatmap = freshSeatmap();
    state.settings.group = 'all';
    state.settings.scope = 'all';
    state.settings.search = '';
    state.settings.filter = 'all';
    state.settings.starFilter = 'all';
    state.settings.countFilter = 'all';
    state.settings.excludeFilter = 'all';
    state.settings.pity.c5 = 0;
    state.pointLog = [];
    state.points = {};
    state.pointSeq = 1;
    pointSel = {};
    selected = {};
    editingUid = null;
    save();
    renderAll();
    logAction('reset', lang() === 'en' ? 'Roster and history cleared' : '重置：清空名单与历史');
    toast(lang() === 'en' ? 'Reset done' : '已重置，名单与历史清空', 'ok');
  }

  async function clearHistory() {
    if (!state.history.length) { toast(lang() === 'en' ? 'History is already empty' : '历史已经是空的', 'err'); return; }
    var ok = await ask({
      title: lang() === 'en' ? 'Clear history' : '清空历史',
      msg: lang() === 'en' ? 'All draw records will be removed. The roster and drawn marks stay.' : '将删除全部抽取记录，名单与「已抽中」标记保留。',
      ok: lang() === 'en' ? 'Clear' : '清空', danger: true
    });
    if (!ok) return;
    pushUndo();
    state.history = [];
    state.last = null;
    state.drawIndex = 0;
    save();
    renderAll();
    if ($('#historyModal').classList.contains('active')) renderHistory();
    if ($('#statsModal').classList.contains('active')) renderStats();
    toast(lang() === 'en' ? 'History cleared' : '历史已清空', 'ok');
  }

  /* ---------------- 设置页分类导航 ---------------- */
  function initSettingsNav() {
    var nav = $('#setNav'), body = $('#settingsModal .modal-body');
    if (!nav || !body || nav.dataset.bound) return;
    nav.dataset.bound = '1';
    var btns = $$('[data-target]', nav);
    function setActive(id) {
      btns.forEach(function (b) { b.classList.toggle('active', b.dataset.target === id); });
      var cur = null;
      btns.forEach(function (b) { if (b.dataset.target === id) cur = b; });
      if (cur) {
        var nr = nav.getBoundingClientRect(), cr = cur.getBoundingClientRect();
        if (cr.left < nr.left + 4) nav.scrollLeft -= (nr.left - cr.left) + 8;
        else if (cr.right > nr.right - 4) nav.scrollLeft += (cr.right - nr.right) + 8;
      }
    }
    nav.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-target]') : null;
      if (!b) return;
      var g = document.getElementById(b.dataset.target);
      if (!g) return;
      var br = body.getBoundingClientRect(), gr = g.getBoundingClientRect();
      var target = Math.max(0, body.scrollTop + (gr.top - br.top) - nav.offsetHeight - 12);
      var reduce = false;
      try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) { }
      if (reduce) body.scrollTop = target;
      else {
        try { body.scrollTo({ top: target, behavior: 'smooth' }); }
        catch (err) { body.scrollTop = target; }
        // 某些环境（无动画 / 旧内核）smooth 不生效时兜底
        setTimeout(function () { if (Math.abs(body.scrollTop - target) > 8) body.scrollTop = target; }, 480);
      }
      setActive(b.dataset.target);
      Sfx.play('click', 0.4);
    });
    var spyTimer = 0;
    function spyNow() {
      var br = body.getBoundingClientRect();
      var line = br.top + nav.offsetHeight + 60;
      var cur = btns.length ? btns[0].dataset.target : '';
      $$('.set-group', body).forEach(function (g) {
        if (g.getBoundingClientRect().top <= line) cur = g.id;
      });
      if (cur) setActive(cur);
    }
    body.addEventListener('scroll', function () {
      if (spyTimer) return;
      spyTimer = setTimeout(function () { spyTimer = 0; spyNow(); }, 60);
    }, { passive: true });
    setActive(btns.length ? btns[0].dataset.target : '');
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    initSettingsNav();
    // 添加
    var form = $('#addForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameEl = $('#inputName'), idEl = $('#inputId'), gEl = $('#inputGroup');
      var name = (nameEl.value || '').trim();
      if (!name) { toast(lang() === 'en' ? 'Name is required' : '请填写姓名', 'err'); nameEl.focus(); return; }
      var id = (idEl.value || '').trim();
      var group = (gEl.value || '').trim();
      if (id && state.participants.some(function (p) { return p.id && p.id.toLowerCase() === id.toLowerCase(); })) {
        toast(lang() === 'en' ? ('Student ID ' + id + ' already exists') : ('学号 ' + id + ' 已存在，请检查'), 'err');
        idEl.focus(); return;
      }
      pushUndo();
      state.participants.push({ uid: nextUid(), name: name.slice(0, 20), id: id.slice(0, 30), group: group.slice(0, 12), drawn: false, drawnAt: 0, order: nextOrder() });
      syncSeatmap();
      save(); renderAll();
      Sfx.play('click', 0.5);
      nameEl.value = ''; idEl.value = ''; gEl.value = '';
      nameEl.focus();
      toast(lang() === 'en' ? ('Added ' + name) : ('已添加 ' + name), 'ok');
    });

    // 名单列表委托
    var listEl = $('#rosterList');
    if (listEl) {
      listEl.addEventListener('click', async function (e) {
        var badge = e.target.closest ? e.target.closest('[data-points]') : null;
        if (badge) { openPointsFor(badge.dataset.points); return; }
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) return;
        var row = btn.closest('.p-row'); if (!row) return;
        var uid = row.dataset.uid;
        var p = state.participants.filter(function (x) { return x.uid === uid; })[0];
        if (!p) return;
        var act = btn.dataset.act;
        if (act === 'plus1') { quickPoint(uid, 1); return; }
        if (act === 'minus1') { quickPoint(uid, -1); return; }
        if (act === 'edit') { editingUid = uid; renderRoster(); return; }
        if (act === 'cancel') { editingUid = null; renderRoster(); return; }
        if (act === 'save') {
          var nm = row.querySelector('[data-f="name"]').value.trim();
          var idv = row.querySelector('[data-f="id"]').value.trim();
          var gv = row.querySelector('[data-f="group"]').value.trim();
          if (!nm) { toast(lang() === 'en' ? 'Name is required' : '姓名不能为空', 'err'); return; }
          if (idv && state.participants.some(function (x) { return x.uid !== uid && x.id && x.id.toLowerCase() === idv.toLowerCase(); })) {
            toast(lang() === 'en' ? 'Duplicate student ID' : '学号与其他人重复', 'err'); return;
          }
          pushUndo();
          p.name = nm.slice(0, 20); p.id = idv.slice(0, 30); p.group = gv.slice(0, 12);
          editingUid = null;
          save(); renderAll();
          toast(lang() === 'en' ? 'Saved' : '已保存', 'ok');
          return;
        }
        if (act === 'del') {
          var okDel = await ask({
            title: lang() === 'en' ? 'Delete participant' : '删除名单成员',
            msg: (lang() === 'en'
              ? ('Delete <b>' + esc(p.name) + '</b>' + (p.id ? ' (' + esc(p.id) + ')' : '') + '? This can be undone.')
              : ('确定删除 <b>' + esc(p.name) + '</b>' + (p.id ? '（' + esc(p.id) + '）' : '') + '吗？这一步可以撤销。')),
            ok: lang() === 'en' ? 'Delete' : '删除', danger: true
          });
          if (!okDel) return;
          pushUndo();
          state.participants = state.participants.filter(function (x) { return x.uid !== uid; });
          var ds = {}; ds[uid] = 1; unseatUids(ds);
          syncSeatmap();
          delete selected[uid];
          save(); renderAll();
          logAction('delete', (lang() === 'en' ? 'Deleted ' : '删除 ') + p.name);
          toast(lang() === 'en' ? 'Deleted' : '已删除', 'ok');
          return;
        }
        if (act === 'return') {
          pushUndo();
          p.drawn = false; p.drawnAt = 0;
          save(); renderAll();
          toast(lang() === 'en' ? (p.name + ' returned to the pool') : ('已把 ' + p.name + ' 放回候选池'), 'ok');
          return;
        }
        if (act === 'exclude') {
          pushUndo();
          p.excluded = true;
          delete selected[uid];
          save(); renderAll();
          logAction('exclude', (lang() === 'en' ? 'Excluded ' : '临时排除：') + p.name);
          toast(lang() === 'en' ? (p.name + ' temporarily excluded') : ('已临时排除 ' + p.name), 'ok');
          return;
        }
        if (act === 'include') {
          pushUndo();
          p.excluded = false;
          save(); renderAll();
          logAction('include', (lang() === 'en' ? 'Restored ' : '恢复参与：') + p.name);
          toast(lang() === 'en' ? (p.name + ' is back in the pool') : ('已恢复 ' + p.name + ' 参与抽取'), 'ok');
          return;
        }
      });
      listEl.addEventListener('change', function (e) {
        var cb = e.target;
        if (!cb || cb.dataset.role !== 'sel') return;
        var row = cb.closest('.p-row'); if (!row) return;
        if (cb.checked) selected[row.dataset.uid] = true; else delete selected[row.dataset.uid];
        row.classList.toggle('selected', cb.checked);
        renderSelectionBar();
      });
      // 行内编辑键位：Enter 保存 / Esc 取消 / Tab 在三个字段间切换
      listEl.addEventListener('keydown', function (e) {
        var t = e.target;
        if (!t || !t.dataset || !t.dataset.f) return;
        var row = t.closest ? t.closest('.p-row') : null;
        if (!row) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          var sv = row.querySelector('[data-act="save"]');
          if (sv) sv.click();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          editingUid = null;
          renderRoster();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          var fields = row.querySelectorAll('[data-f]');
          var idx = Array.prototype.indexOf.call(fields, t);
          var next = e.shiftKey ? idx - 1 : idx + 1;
          if (next < 0) next = fields.length - 1;
          if (next >= fields.length) next = 0;
          fields[next].focus();
          if (fields[next].select) fields[next].select();
        }
      });
    }

    var allBtn = $('#selectAllBtn');
    if (allBtn) allBtn.addEventListener('click', function () {
      var vis = visibleParticipants();
      var allSel = vis.length > 0 && vis.every(function (p) { return selected[p.uid]; });
      selected = {};
      if (!allSel) vis.forEach(function (p) { selected[p.uid] = true; });
      renderRoster();
    });

    var batchBar = $('#batchBar');
    if (batchBar) batchBar.addEventListener('click', async function (e) {
      var b = e.target.closest ? e.target.closest('[data-batch]') : null;
      if (!b) return;
      var uids = selectedUids();
      if (!uids.length) return;
      var act = b.dataset.batch;
      if (act === 'clear') { selected = {}; renderRoster(); return; }
      if (act === 'return') {
        pushUndo();
        var cnt = 0;
        state.participants.forEach(function (p) { if (selected[p.uid] && p.drawn) { p.drawn = false; p.drawnAt = 0; cnt++; } });
        save(); renderAll();
        toast(lang() === 'en' ? (cnt + ' returned') : ('已放回 ' + cnt + ' 人'), 'ok');
        return;
      }
      if (act === 'exclude' || act === 'include') {
        pushUndo();
        var on = act === 'exclude';
        state.participants.forEach(function (p) { if (selected[p.uid]) p.excluded = on; });
        save(); renderAll();
        logAction(on ? 'exclude' : 'include', (on ? '批量临时排除 ' : '批量恢复 ') + uids.length + ' 人');
        toast(lang() === 'en'
          ? (uids.length + (on ? ' excluded' : ' restored'))
          : ('已' + (on ? '排除 ' : '恢复 ') + uids.length + ' 人'), 'ok');
        return;
      }
      if (act === 'move') {
        var gs = groups();
        var val = await askText({
          title: lang() === 'en' ? 'Move to group' : '移动到分组',
          msg: (lang() === 'en' ? 'Move <b>' + uids.length + '</b> selected participants to:' : '把选中的 <b>' + uids.length + '</b> 人移动到：'),
          value: '', max: 12,
          ph: lang() === 'en' ? 'Group name (empty = ungroup)' : '分组名（留空 = 移出分组）',
          hint: gs.length ? ((lang() === 'en' ? 'Existing groups: ' : '已有分组：') + esc(gs.join(' / '))) : ''
        });
        if (val === null) return;
        pushUndo();
        var g2 = String(val).slice(0, 12);
        var moved = 0;
        state.participants.forEach(function (p) { if (selected[p.uid]) { p.group = g2; moved++; } });
        save(); renderAll(); renderSettings();
        logAction('group', (lang() === 'en' ? 'Moved ' : '批量移动到「') + (g2 || (lang() === 'en' ? 'ungrouped' : '未分组')) + (lang() === 'en' ? '': '」') + moved + (lang() === 'en' ? ' people' : ' 人'));
        toast(lang() === 'en'
          ? (moved + ' moved to ' + (g2 || 'ungrouped'))
          : ('已把 ' + moved + ' 人移动到「' + (g2 || '未分组') + '」'), 'ok');
        return;
      }
      if (act === 'delete') {
        var ok = await ask({
          title: lang() === 'en' ? 'Delete participants' : '删除参与者',
          msg: (lang() === 'en' ? 'Delete <b>' + uids.length + '</b> selected participants?' : '确定删除选中的 <b>' + uids.length + '</b> 人？') +
            (lang() === 'en' ? '' : '<br><span style="opacity:.7;font-size:12px">可在删除后撤销。</span>'),
          ok: lang() === 'en' ? 'Delete' : '删除', danger: true
        });
        if (!ok) return;
        pushUndo();
        var set = {};
        uids.forEach(function (u) { set[u] = 1; });
        state.participants = state.participants.filter(function (p) { return !set[p.uid]; });
        unseatUids(set);
        syncSeatmap();
        selected = {};
        save(); renderAll();
        toast(lang() === 'en' ? 'Deleted' : '已删除', 'ok');
      }
    });

    // 搜索 / 筛选 / 排序 / 分组
    var searchEl = $('#searchInput');
    if (searchEl) {
      var st = null;
      // 160ms 防抖：只重建列表，不写盘；离开输入框/回车时再持久化一次
      searchEl.addEventListener('input', function () {
        clearTimeout(st);
        st = setTimeout(function () {
          state.settings.search = searchEl.value;
          renderRoster();
        }, 160);
      });
      searchEl.addEventListener('change', function () {
        state.settings.search = searchEl.value;
        save();
      });
    }
    var filterEl = $('#filterSelect');
    if (filterEl) filterEl.addEventListener('change', function () {
      state.settings.filter = filterEl.value; save(); renderRoster();
    });
    // 组合筛选：星级 / 次数 / 排除状态（与分组、搜索、抽中状态叠加）
    [['#starFilter', 'starFilter'], ['#countFilter', 'countFilter'], ['#excludeFilter', 'excludeFilter']].forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      el.value = state.settings[pair[1]] || 'all';
      el.addEventListener('change', function () {
        state.settings[pair[1]] = el.value;
        save(); renderRoster();
        Sfx.play('tick', 0.4);
      });
    });
    var sortEl = $('#sortSelect');
    if (sortEl) sortEl.addEventListener('change', function () {
      state.settings.sort = sortEl.value; save(); renderRoster();
    });
    var dirBtn = $('#sortDirBtn');
    if (dirBtn) {
      var paintDir = function () {
        var desc = state.settings.sortDir === 'desc';
        dirBtn.textContent = lang() === 'en' ? (desc ? 'Desc ↓' : 'Asc ↑') : (desc ? '降序 ↓' : '升序 ↑');
        dirBtn.dataset.dir = desc ? 'desc' : 'asc';
        dirBtn.classList.toggle('on', desc);
      };
      paintDir();
      dirBtn.addEventListener('click', function () {
        state.settings.sortDir = state.settings.sortDir === 'desc' ? 'asc' : 'desc';
        paintDir(); save(); renderRoster();
        Sfx.play('tick', 0.5);
      });
      window.__paintSortDir = paintDir;
    }
    var groupEl = $('#groupSelect');
    if (groupEl) groupEl.addEventListener('change', function () {
      state.settings.group = groupEl.value;
      state.settings.scope = groupEl.value === 'all' ? 'all' : 'group';
      save(); renderGroups(); renderRoster(); renderStage();
    });

    // 抽取范围 segmented：与分组选择严格同步（选全部 = 抽全名单）
    var scopeSeg = $('#scopeSeg');
    if (scopeSeg) scopeSeg.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-scope]') : null;
      if (!b || b.disabled) return;
      if (b.dataset.scope === 'all') {
        state.settings.group = 'all';
        state.settings.scope = 'all';
      } else {
        if (state.settings.group === 'all') {
          toast(lang() === 'en' ? 'Pick a group in the roster panel first' : '请先在左侧名单里选择一个分组', 'err');
          return;
        }
        state.settings.scope = 'group';
      }
      save(); renderGroups(); renderRoster(); renderStage();
      Sfx.play('click', 0.5);
    });

    // 速度徽标：点击循环 0.5x → 1x → 1.5x
    var speedChip = $('#speedChip');
    if (speedChip) speedChip.addEventListener('click', function () {
      var i = SPEEDS.indexOf(state.settings.animSpeed);
      state.settings.animSpeed = SPEEDS[(i + 1) % SPEEDS.length];
      save(); renderScope(); renderSettings();
      toast(lang() === 'en' ? ('Animation speed ' + state.settings.animSpeed + 'x') : ('动画速度：' + state.settings.animSpeed + 'x'), 'ok');
    });

    // 跳过本轮动画 / 十连：立即揭示全部
    var sdb = $('#skipDrawBtn');
    if (sdb) sdb.addEventListener('click', function (e) { e.stopPropagation(); doSkip(); });
    var stb = $('#skipTenBtn');
    if (stb) stb.addEventListener('click', function (e) {
      e.stopPropagation();
      Sfx.play('click', 0.6);
      tenShowAll();
    });

    // 模式切换（二次确认）
    $$('#modeSeg button, #modeSeg2 button').forEach(function (b) {
      b.addEventListener('click', function () { switchMode(b.dataset.mode); });
    });

    // 动画菜单
    var sw = $('#animSwitcher'), trigger = $('#animTrigger'), menu = $('#animMenu');
    if (trigger && sw) trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      sw.classList.toggle('open');
      Sfx.play('click', 0.4);
    });
    if (menu) menu.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-anim]') : null;
      if (!b) return;
      e.stopPropagation();
      var a = b.dataset.anim;
      if (!ANIMS[a]) return;
      state.settings.animation = a;
      save();
      $$('#animMenu button').forEach(function (x) { x.classList.toggle('active', x.dataset.anim === a); });
      var lbl = $('#animLabel');
      if (lbl) lbl.textContent = ANIMS[a];
      if (sw) sw.classList.remove('open');
      Sfx.play('click', 0.6);
      toast(lang() === 'en' ? ('Animation: ' + a) : ('动画已切换：' + ANIMS[a]), 'ok');
    });
    document.addEventListener('click', function (e) {
      if (sw && !sw.contains(e.target)) sw.classList.remove('open');
    });

    // 抽取按钮
    var db = $('#drawBtn'), dt = $('#drawTenBtn');
    if (db) db.addEventListener('click', function () { Sfx.play('click', 0.6); drawSingle(); });
    if (dt) dt.addEventListener('click', function () { Sfx.play('click', 0.6); drawTen(); });
    var idb = $('#drawIdBtn');
    if (idb) idb.addEventListener('click', function () { Sfx.play('click', 0.6); drawSingle('id'); });
    var osb = $('#openSeatBtn');
    if (osb) osb.addEventListener('click', function () { openModal($('#seatModal')); });
    var dmRange = $('#drawModeRange');
    if (dmRange) dmRange.addEventListener('input', function () {
      var v = Math.max(0, Math.min(2, Math.round(Number(dmRange.value) || 0)));
      state.settings.drawMode = DRAW_MODES[v];
      save(); syncDrawModeUI(); renderStageNote(); Sfx.play('tick', 0.4);
    });
    $$('.draw-mode-labels span').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = DRAW_MODES.indexOf(el.dataset.mode);
        if (idx < 0) return;
        state.settings.drawMode = DRAW_MODES[idx];
        save(); syncDrawModeUI(); renderStageNote(); Sfx.play('click', 0.4);
      });
    });

    // 主题 / 音效 / 设置
    var tb = $('#themeToggle');
    if (tb) tb.addEventListener('click', function () {
      state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
      applyTheme(); save(); Sfx.play('click', 0.5);
    });
    var sb = $('#soundBtn');
    if (sb) sb.addEventListener('click', function () {
      state.settings.sound.enabled = !state.settings.sound.enabled;
      applySoundBtn(); save();
      if (state.settings.sound.enabled) { Sfx.ensure(); Sfx.play('result', 0.7); }
      toast(state.settings.sound.enabled ? (lang() === 'en' ? 'Sound on' : '音效已开启') : (lang() === 'en' ? 'Muted' : '已静音'), 'ok');
    });
    var setBtn = $('#settingsBtn');
    if (setBtn) setBtn.addEventListener('click', function () { openModal($('#settingsModal')); });
    var expBtn = $('#exportBtn');
    if (expBtn) expBtn.addEventListener('click', function () { Sfx.play('click', 0.5); openModal($('#exportModal')); });

    // 统一动作分发：底部 dock 只剩撤销/重做，其余入口在设置面板「快捷入口」
    function runAction(a) {
      if (a === 'import') openModal($('#importModal'));
      else if (a === 'history') openModal($('#historyModal'));
      else if (a === 'stats') openModal($('#statsModal'));
      else if (a === 'points') openModal($('#pointsModal'));
      else if (a === 'seats') openModal($('#seatModal'));
      else if (a === 'export') openModal($('#exportModal'));
      else if (a === 'settings') openModal($('#settingsModal'));
      else if (a === 'pk') { openModal($('#pkModal')); renderPk(); }
      else if (a === 'undo') undo();
      else if (a === 'redo') redo();
      else if (a === 'reset') resetAll();
    }
    var dock = $('#dock');
    if (dock) dock.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!b) return;
      Sfx.play('click', 0.5);
      runAction(b.dataset.action);
    });

    // 设置面板里的快捷入口：先收起设置，再打开目标面板（避免弹窗堆叠）
    var quickGrid = $('#quickGrid');
    if (quickGrid) quickGrid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!b) return;
      Sfx.play('click', 0.5);
      var a = b.dataset.action;
      closeEl($('#settingsModal'));
      setTimeout(function () { runAction(a); }, 120);
    });

    // 设置面板内的危险操作：重置
    var resetBtn2 = $('#resetBtn2');
    if (resetBtn2) resetBtn2.addEventListener('click', function () {
      Sfx.play('click', 0.5);
      closeEl($('#settingsModal'));
      setTimeout(function () { resetAll(); }, 120);
    });

    // 关于：作者 GitHub 主页为占位，填好地址后自动变成可点链接
    var profLink = $('#aboutProfile');
    if (profLink) {
      var todoProfile = function (e) {
        if (e) e.preventDefault();
        toast(lang() === 'en'
          ? 'Author GitHub profile link is not set yet — add it to ABOUT.profile in app.js'
          : '作者 GitHub 主页地址还没填，可在 app.js 的 ABOUT.profile 里补上', 'err');
      };
      if (ABOUT.profile) {
        profLink.href = ABOUT.profile;
        profLink.target = '_blank';
        profLink.rel = 'noopener noreferrer';
        profLink.classList.remove('is-todo');
        profLink.removeAttribute('aria-disabled');
        profLink.removeAttribute('role');
        profLink.removeAttribute('tabindex');
        profLink.removeAttribute('data-todo');
        var pu = $('#aboutProfileUrl');
        if (pu) {
          pu.textContent = ABOUT.profile.replace(/^https?:\/\//, '').replace(/\/$/, '');
          pu.removeAttribute('data-zh');
          pu.removeAttribute('data-en');
        }
      } else {
        profLink.addEventListener('click', todoProfile);
        profLink.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') todoProfile(e);
        });
      }
    }
    var verEl = $('#aboutVersion');
    if (verEl) verEl.textContent = String(state.version || 4);

    // 关闭按钮 / 遮罩点击
    $$('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.closest('.modal');
        closeEl(m);
      });
    });
    $$('.modal').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m) closeEl(m);
      });
    });

    // 确认弹窗
    var okBtn = $('#confirmOk'), cancelBtn = $('#confirmCancel'), cclose = $('#confirmClose');
    if (okBtn) okBtn.addEventListener('click', function () { settleConfirm(true); });
    if (cancelBtn) cancelBtn.addEventListener('click', function () { settleConfirm(false); });
    if (cclose) cclose.addEventListener('click', function () { settleConfirm(false); });

    // 十连卡堆：只有点卡牌才推进（遮罩不响应）；全部展示完成后点任意处关闭
    var ten = $('#tenOverlay');
    if (ten) ten.addEventListener('click', function (e) {
      if (!ten.classList.contains('active')) return;
      var done = !tenState.open || tenState.shown >= tenState.items.length;
      if (done) { hideTenOverlay(); return; }
      var onCard = e.target && e.target.closest ? e.target.closest('.ten-card, .deck-box') : null;
      if (!onCard) return;                       // 点遮罩/背景：什么都不做
      if (Date.now() - tenOpenedAt < 200) return; // 防连点一开就跳过
      tenAdvance();
    });

    // 导入
    var ta = $('#importText');
    if (ta) ta.addEventListener('input', function () { renderImportPreview(); });
    var pickBtn = $('#pickFileBtn'), fileInput = $('#fileInput');
    if (pickBtn && fileInput) {
      pickBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', async function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var fname = f.name || '';
        try {
          var text = '';
          var isSheet = /\.(xlsx|xls|xlsm)$/i.test(fname);
          if (isSheet) {
            // 解析库本地内联；万一缺失（被裁剪过的页面）就引导用户走 CSV
            if (!window.XLSX) {
              try { await loadSheetJS(); } catch (e0) { }
            }
            if (!window.XLSX) {
              toast(lang() === 'en'
                ? 'Excel reader could not load — save it as .csv and import that instead'
                : 'Excel 解析库加载失败，请另存为 .csv 后导入', 'err');
              fileInput.value = '';
              return;
            }
            var buf = await new Promise(function (res, rej) {
              var fr = new FileReader();
              fr.onload = function () { res(fr.result); };
              fr.onerror = function () { rej(fr.error || new Error('read error')); };
              fr.readAsArrayBuffer(f);
            });
            var bytes = new Uint8Array(buf);
            var names = sheetNamesOf(bytes);
            text = sheetToText(bytes, names[0] || '');
            fillSheetSelect(names, names[0] || '');
            // 记住原始字节，切换工作表时重新解析
            sheetBytes = bytes; sheetNames = names;
          } else {
            text = await readFileText(f);
            fillSheetSelect([], '');
            sheetBytes = null; sheetNames = [];
          }
          if (/\.json$/i.test(fname)) {
            try {
              var data = JSON.parse(text);
              var arr = Array.isArray(data) ? data : (Array.isArray(data.participants) ? data.participants : null);
              if (arr) {
                text = arr.map(function (x) {
                  if (typeof x === 'string') return x;
                  return [x.name || '', x.id || '', x.group || ''].join(',');
                }).join('\n');
              }
            } catch (e2) { }
          }
          ta.value = text;
          renderImportPreview();
          toast(lang() === 'en' ? ('Loaded ' + fname) : ('已读取 ' + fname), 'ok');
        } catch (e) { toast(lang() === 'en' ? 'File read failed' : '文件读取失败', 'err'); }
        fileInput.value = '';
      });
    }

    // Excel 多工作表切换
    var sheetSel = $('#sheetSelect');
    if (sheetSel) sheetSel.addEventListener('change', function () {
      if (!sheetBytes || !window.XLSX) return;
      var t = sheetToText(sheetBytes, sheetSel.value);
      var ta2 = $('#importText');
      if (ta2) ta2.value = t;
      renderImportPreview();
      toast(lang() === 'en' ? ('Sheet: ' + sheetSel.value) : ('已切换工作表：' + sheetSel.value), 'ok');
    });

    var appendBtn = $('#appendBtn');
    if (appendBtn) appendBtn.addEventListener('click', async function () {
      var existing = state.participants.map(function (p) { return p.id; });
      var names = state.participants.map(function (p) { return p.name; });
      var r = parseImport($('#importText').value, existing, names);
      if (!r.rows.length) { toast(lang() === 'en' ? 'No valid entries to append' : '没有可追加的有效条目', 'err'); return; }
      // 重名确认
      if (r.dupeNames.length) {
        var okN = await ask({
          title: lang() === 'en' ? 'Duplicate names' : '存在重名',
          msg: (lang() === 'en'
            ? ('<b>' + r.dupeNames.length + '</b> entries share a name with someone already in the roster (' + esc(r.dupeNames.slice(0, 8).map(function (d) { return d.name; }).join('、')) + (r.dupeNames.length > 8 ? ' …' : '') + '). Append them anyway?')
            : ('有 <b>' + r.dupeNames.length + '</b> 条与名单中已有姓名重名（' + esc(r.dupeNames.slice(0, 8).map(function (d) { return d.name; }).join('、')) + (r.dupeNames.length > 8 ? ' …' : '') + '）。仍要追加吗？')),
          ok: lang() === 'en' ? 'Append anyway' : '仍然追加'
        });
        if (!okN) return;
      }
      pushUndo();
      addParticipants(r.rows);
      save(); renderAll();
      var msg = (lang() === 'en' ? ('Appended ' + r.rows.length) : ('已追加 ' + r.rows.length + ' 人'));
      if (r.dupeIds.length) msg += (lang() === 'en' ? (', skipped ' + r.dupeIds.length + ' duplicates') : ('，跳过 ' + r.dupeIds.length + ' 条重复学号'));
      toast(msg, 'ok');
      logAction('import', (lang() === 'en' ? 'Appended ' : '追加导入 ') + r.rows.length + (lang() === 'en' ? ' entries' : ' 人'));
      closeEl($('#importModal'));
    });

    // 按学号更新：同名/同学号覆盖姓名与分组，新学号追加
    var updateBtn = $('#updateBtn');
    if (updateBtn) updateBtn.addEventListener('click', async function () {
      var r = parseImport($('#importText').value, []);
      if (!r.rows.length) { toast(lang() === 'en' ? 'No valid entries' : '没有可导入的有效条目', 'err'); return; }
      // 规划由 core.js 纯函数完成（已被回归测试覆盖）：三种模式——已存在更新 / 新学号追加 / 空学号追加
      var plan = __core__.planBySidUpdate(r.rows, state.participants);
      // 重名保护：同一个姓名对应不同学号时先确认，避免把两个人合成一个
      if (plan.dupNames.length) {
        var okDup = await ask({
          title: lang() === 'en' ? 'Duplicate names' : '存在重名',
          msg: (lang() === 'en'
            ? ('<b>' + plan.dupNames.length + '</b> entries reuse a name that already belongs to someone else (different student ID). Continue anyway?')
            : ('有 <b>' + plan.dupNames.length + '</b> 条与名单里的其他人同名但学号不同（' + esc(plan.dupNames.slice(0, 6).join('、')) + (plan.dupNames.length > 6 ? ' …' : '') + '）。继续按学号更新吗？')) +
            '<br><span style="opacity:.7;font-size:12px">' + (lang() === 'en'
              ? 'Empty student IDs are always appended as new entries.'
              : '学号为空的行会作为新成员追加。') + '</span>',
          ok: lang() === 'en' ? 'Continue' : '继续更新'
        });
        if (!okDup) return;
      }
      var uidMap = {};
      state.participants.forEach(function (p) { uidMap[p.uid] = p; });
      var updated = 0, added = 0;
      pushUndo();
      plan.updates.forEach(function (u) {
        var p = uidMap[u.uid];
        if (u.name) p.name = u.name;
        if (u.group) p.group = u.group;
        updated++;
      });
      plan.adds.forEach(function (row) {
        var order = nextOrder();
        var p2 = { uid: nextUid(), name: row.name, id: row.id || '', group: row.group || '', drawn: false, drawnAt: 0, order: order, excluded: false, count: 0 };
        state.participants.push(p2);
        uidMap[p2.uid] = p2;
        added++;
      });
      syncSeatmap();
      save(); renderAll();
      logAction('import', '按学号更新 ' + updated + ' 人，新增 ' + added + ' 人');
      toast(lang() === 'en' ? ('Updated ' + updated + ', added ' + added) : ('已更新 ' + updated + ' 人，新增 ' + added + ' 人'), 'ok');
      closeEl($('#importModal'));
    });

    var replaceBtn = $('#replaceBtn');
    if (replaceBtn) replaceBtn.addEventListener('click', async function () {
      var r = parseImport($('#importText').value, []);
      if (!r.rows.length) { toast(lang() === 'en' ? 'No valid entries' : '没有可导入的有效条目', 'err'); return; }
      if (state.participants.length) {
        var ok = await ask({
          title: lang() === 'en' ? 'Replace roster' : '替换名单',
          msg: (lang() === 'en'
            ? ('The current <b>' + state.participants.length + '</b> participants, their drawn marks and seat assignments will be replaced by <b>' + r.rows.length + '</b> new entries. History is kept.')
            : ('当前 <b>' + state.participants.length + '</b> 人及其「已抽中」标记与座位安排将被新的 <b>' + r.rows.length + '</b> 条名单替换。抽取历史保留。')),
          ok: lang() === 'en' ? 'Replace' : '替换', danger: true
        });
        if (!ok) return;
      }
      pushUndo();
      state.participants = [];
      state.seq = 1;
      state.seatmap = freshSeatmap();
      selected = {};
      addParticipants(r.rows);
      save(); renderAll();
      // 二次确认：切换模式时若原名单已抽中，保留 drawn 语义不变（新名单全部未抽）
      toast(lang() === 'en' ? ('Replaced with ' + r.rows.length + ' entries') : ('已替换为 ' + r.rows.length + ' 人'), 'ok');
      closeEl($('#importModal'));
    });

    // 历史
    var ch = $('#clearHistoryBtn'), ch2 = $('#clearHistoryBtn2');
    if (ch) ch.addEventListener('click', clearHistory);
    if (ch2) ch2.addEventListener('click', clearHistory);
    var arcBtn = $('#archiveBtn');
    if (arcBtn) arcBtn.addEventListener('click', async function () {
      var keepN = Math.min(100, state.history.length);
      var ok = await ask({
        title: lang() === 'en' ? 'Archive history?' : '归档历史？',
        msg: (lang() === 'en'
          ? 'All ' + state.history.length + ' records are exported to a JSON file first. Then only the latest <b>' + keepN + '</b> stay in the app, along with a summary of stars, groups and dates.'
          : '会先把全部 ' + state.history.length + ' 条记录导出为 JSON 文件，然后仅保留最近 <b>' + keepN + '</b> 条，并保留星级 / 分组 / 日期摘要。') +
          '<br><span style="opacity:.72;font-size:12px">' + (lang() === 'en'
            ? 'Roster is untouched. This step can be undone.'
            : '名单不受影响，此步骤可以撤销。') + '</span>',
        ok: lang() === 'en' ? 'Archive' : '归档'
      });
      if (ok) archiveHistory();
    });
    var eb2 = $('#exportBtn2');
    if (eb2) eb2.addEventListener('click', function () { closeEl($('#historyModal')); openModal($('#exportModal')); });

    // 设置：星级概率
    var sc = $('#starConfig');
    if (sc) {
      sc.addEventListener('input', function (e) {
        var t = e.target;
        if (!t.dataset || !t.dataset.star) return;
        var s = Number(t.dataset.star);
        state.settings.stars[s] = n(t.value);
        state.settings.preset = 'custom';
        $$('#starConfig [data-star="' + s + '"]').forEach(function (el) { if (el !== t) el.value = state.settings.stars[s]; });
        syncStarInputs();
        save();
      });
    }
    var pr = $('#presetRow');
    if (pr) pr.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-preset]') : null;
      if (!b) return;
      var key = b.dataset.preset;
      if (key === '__norm') {
        var sum = starSum();
        if (sum === 0) { toast(lang() === 'en' ? 'All odds are zero' : '概率全为 0，无法归一', 'err'); return; }
        var acc = 0, keys = [5, 4, 3, 2, 1];
        var raw = keys.map(function (k) { return n(state.settings.stars[k]) * 100 / sum; });
        var rounded = raw.map(function (v) { return Math.floor(v); });
        acc = rounded.reduce(function (a, b2) { return a + b2; }, 0);
        var rest = 100 - acc;
        var order = raw.map(function (v, i) { return { i: i, f: v - Math.floor(v) }; })
          .sort(function (a, b2) { return b2.f - a.f; });
        for (var i = 0; i < rest; i++) rounded[order[i % order.length].i]++;
        keys.forEach(function (k, idx) { state.settings.stars[k] = rounded[idx]; });
        state.settings.preset = 'custom';
        syncStarInputs(); save();
        toast(lang() === 'en' ? 'Odds normalised to 100%' : '已按比例归一化到 100%', 'ok');
        return;
      }
      var p = PRESETS[key];
      if (!p) return;
      state.settings.stars = numStars(p.stars);
      state.settings.preset = key;
      syncStarInputs(); save();
      Sfx.play('click', 0.5);
      toast(lang() === 'en' ? ('Preset: ' + p.en) : ('已应用预设：' + p.zh), 'ok');
    });

    // 保底
    [['#pityEnable', 'enabled'], ['#pityTen', 'tenFour'], ['#pityFifty', 'fiftyFive']].forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      el.addEventListener('change', function () {
        state.settings.pity[pair[1]] = el.checked;
        if (pair[1] === 'enabled') { var ps = $('#pityTen'), pf = $('#pityFifty'); if (ps) ps.disabled = !el.checked; if (pf) pf.disabled = !el.checked; }
        if (pair[1] === 'enabled' && !el.checked) state.settings.pity.c5 = 0;
        save(); renderSettings(); renderPity();
        Sfx.play('click', 0.5);
      });
    });

    // 音效
    var seEl = $('#soundEnable');
    if (seEl) seEl.addEventListener('change', function () {
      state.settings.sound.enabled = seEl.checked;
      applySoundBtn(); save();
      if (seEl.checked) { Sfx.ensure(); Sfx.play('result', 0.7); }
      renderSettings();
    });
    var svEl = $('#soundVol');
    if (svEl) svEl.addEventListener('input', function () {
      state.settings.sound.volume = Number(svEl.value) || 0;
      Sfx.sync();
      var o = $('#soundVolOut'); if (o) o.textContent = state.settings.sound.volume;
      save();
    });
    if (svEl) svEl.addEventListener('change', function () { Sfx.play('tick', 0.8); });

    // 总音量 / 背景音乐（三通道）
    var maEl = $('#masterVol');
    if (maEl) maEl.addEventListener('input', function () {
      state.settings.sound.master = Number(maEl.value) || 0;
      var o = $('#masterVolOut'); if (o) o.textContent = state.settings.sound.master;
      Sfx.sync(); Bgm.sync(); save();
    });
    var bgEl = $('#bgmVol');
    if (bgEl) {
      bgEl.addEventListener('input', function () {
        state.settings.sound.bgmVolume = Number(bgEl.value) || 0;
        var o = $('#bgmVolOut'); if (o) o.textContent = state.settings.sound.bgmVolume;
        Bgm.sync(); save();
      });
      bgEl.addEventListener('change', function () { Sfx.play('tick', 0.8); });
    }
    var btSeg = $('#bgmTrackSeg');
    if (btSeg) btSeg.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-track]') : null;
      if (!b) return;
      state.settings.sound.bgmTrack = b.dataset.track;
      $$('#bgmTrackSeg button').forEach(function (x) { x.classList.toggle('active', x === b); });
      Bgm.stop(true);
      Bgm.sync(); save();
      if (Bgm.enabled()) Sfx.play('coin', 0.6);
    });

    // 语音播报设置
    var spEn = $('#speechEnable');
    if (spEn) spEn.addEventListener('change', function () {
      state.settings.speech.enabled = spEn.checked;
      save();
      if (spEn.checked) { Speech.loadVoices(); Speech.sample(); }
    });
    var spRate = $('#speechRate');
    if (spRate) spRate.addEventListener('input', function () {
      state.settings.speech.rate = Math.max(0.6, Math.min(1.6, Number(spRate.value) || 1));
      var o = $('#speechRateOut'); if (o) o.textContent = state.settings.speech.rate.toFixed(1);
      save();
    });
    if (spRate) spRate.addEventListener('change', function () { Speech.sample(); });
    var spPitch = $('#speechPitch');
    if (spPitch) spPitch.addEventListener('input', function () {
      state.settings.speech.pitch = Math.max(0.6, Math.min(1.6, Number(spPitch.value) || 1));
      var o = $('#speechPitchOut'); if (o) o.textContent = state.settings.speech.pitch.toFixed(1);
      save();
    });
    if (spPitch) spPitch.addEventListener('change', function () { Speech.sample(); });
    var spVoice = $('#speechVoice');
    if (spVoice) spVoice.addEventListener('change', function () {
      state.settings.speech.voice = spVoice.value || '';
      save();
      if (state.settings.speech.enabled) Speech.sample();
    });

    // 权重预设 / 概率模拟
    var wpBox = $('#weightPresets');
    if (wpBox) wpBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-wpreset]') : null;
      if (!b) return;
      var p = WEIGHT_PRESETS[b.dataset.wpreset];
      if (!p) return;
      state.settings.weights.mult = numMult(p.mult);
      state.settings.weights.enabled = true;
      save(); renderSettings();
      Sfx.play('click', 0.6);
      toast(lang() === 'en' ? ('Weight preset: ' + p.en) : ('已应用权重预设：' + p.zh), 'ok');
    });
    var simBtn = $('#simBtn');
    if (simBtn) simBtn.addEventListener('click', runSim);

    // 称号佩戴
    var tSel = $('#titleSelect');
    if (tSel) tSel.addEventListener('change', function () {
      state.settings.title = tSel.value || 'auto';
      save(); buildTitleSelect(); renderPity();
      Sfx.play('click', 0.5);
    });

    // 抽取设置：人数 / 平衡 / 种子
    var pcEl = $('#pickCount');
    if (pcEl) pcEl.addEventListener('change', function () {
      state.settings.pickCount = Math.max(1, Math.min(50, Number(pcEl.value) || 10));
      save(); renderSettings(); renderStage();
      Sfx.play('tick', 0.6);
    });
    var balEl = $('#balanceToggle');
    if (balEl) balEl.addEventListener('change', function () {
      state.settings.balance = balEl.checked;
      save(); renderSettings();
      toast(balEl.checked
        ? (lang() === 'en' ? 'Balanced draw on — groups get their share of each batch' : '已开启分组平衡：每批按各组人数比例分配名额')
        : (lang() === 'en' ? 'Balanced draw off' : '已关闭分组平衡'), 'ok');
    });
    var seedEl = $('#seedInput');
    async function requestSeed(next) {
      next = String(next == null ? '' : next).trim().slice(0, 40);
      var old = String(state.settings.seed || '').trim();
      if (next === old) return true;
      var L = lang();
      if (old || next) {
        var ok = await ask({
          title: L === 'en' ? 'Change random seed?' : '更改随机种子？',
          msg: (L === 'en'
            ? ('Changing the seed alters every future draw. The pity counter (<b>' + state.settings.pity.c5 + '</b> draws without 5★) is kept unchanged.')
            : ('更改种子会改变后续所有抽取的随机序列；当前保底计数（<b>' + state.settings.pity.c5 + '</b> 抽未出 5★）会原样保留，不会被重置。')),
          ok: L === 'en' ? 'Change seed' : '确认更改'
        });
        if (!ok) return false;
      }
      state.settings.seed = next;   // 只改种子，不动保底计数
      save(); renderSettings(); renderStage();
      return true;
    }
    if (seedEl) seedEl.addEventListener('change', async function () {
      var okSeed = await requestSeed(seedEl.value);
      if (!okSeed) { seedEl.value = state.settings.seed || ''; return; }
      if (state.settings.seed) {
        toast((lang() === 'en' ? 'Seed set #' : '种子已固定，哈希 #') + hashStr(state.settings.seed), 'ok');
      } else {
        toast(lang() === 'en' ? 'Seed cleared — draws are random again' : '已清除种子，后续抽取恢复真随机', 'ok');
      }
    });
    // 复制种子（含哈希），方便把同一局的随机序列发给同事复现
    var seedCopy = $('#seedCopyBtn');
    if (seedCopy) seedCopy.addEventListener('click', function () {
      var v = String((seedEl && seedEl.value) || state.settings.seed || '').trim();
      if (!v) { toast(lang() === 'en' ? 'No seed yet — set one first' : '还没有设置种子，请先输入或点「随机一个」', 'err'); return; }
      var txt = v + '  #' + hashStr(v);
      copyText(txt).then(function (okCopy) {
        toast(okCopy
          ? (lang() === 'en' ? ('Copied: ' + txt) : ('已复制种子与哈希：' + txt))
          : (lang() === 'en' ? 'Copy failed — select the text manually' : '复制失败，请手动选择文本复制'), okCopy ? 'ok' : 'err');
      });
    });
    // 随机生成一个可读种子
    var seedDice = $('#seedDiceBtn');
    if (seedDice) seedDice.addEventListener('click', async function () {
      var d = new Date();
      var s = 'seed-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '-' +
        Math.random().toString(36).slice(2, 6);
      var okSeed = await requestSeed(s);
      if (!okSeed) return;
      if (seedEl) seedEl.value = s;
      Sfx.play('coin', 0.6);
      toast(lang() === 'en' ? ('Seed: ' + s) : ('已生成种子：' + s), 'ok');
    });
    var seedVerify = $('#seedVerifyBtn');
    if (seedVerify) seedVerify.addEventListener('click', function () {
      var L = lang();
      var v = String((seedEl && seedEl.value) || state.settings.seed || '').trim();
      if (!v) { toast(L === 'en' ? 'Enter a seed first' : '请先输入或生成一个种子', 'err'); return; }
      var h = hashStr(v);
      var hits = state.history.filter(function (x) {
        return x.seedHash === h || (x.seedText && x.seedText === v);
      });
      var ss = $('#seedStatus');
      if (ss) {
        ss.className = 'set-desc strong';
        ss.innerHTML = hits.length
          ? (L === 'en'
            ? ('✓ Seed verified: hash #' + h + ' matches ' + hits.length + ' history records (latest ' + fmtDate(hits[hits.length - 1].ts) + ').')
            : ('✓ 种子验证通过：哈希 #' + h + ' 命中 ' + hits.length + ' 条历史记录（最近 ' + fmtDate(hits[hits.length - 1].ts) + '）。'))
          : (L === 'en'
            ? ('✗ No history record matches seed hash #' + h + '. Check the seed or draw again.')
            : ('✗ 未找到与该种子哈希 #' + h + ' 匹配的历史记录，请检查种子或重新抽取。'));
      }
      toast(hits.length
        ? (L === 'en' ? ('Seed matched ' + hits.length + ' records') : ('种子验证通过，命中 ' + hits.length + ' 条历史'))
        : (L === 'en' ? 'No matching history for this seed' : '该种子没有匹配的历史记录'), hits.length ? 'ok' : 'err');
    });
    var lpEl2 = $('#longPressMs');
    if (lpEl2) lpEl2.addEventListener('input', function () {
      state.settings.longPressMs = Math.max(200, Math.min(1200, Number(lpEl2.value) || 480));
      var o = $('#longPressMsOut');
      if (o) o.textContent = state.settings.longPressMs + ' ms';
      save();
    });

    // 分组管理：取色 / 重命名 / 解散
    var gmBox = $('#groupManage');
    if (gmBox) {
      gmBox.addEventListener('input', function (e) {
        var t = e.target;
        if (t.dataset && t.dataset.gcolor) {
          state.settings.groupColors[t.dataset.gcolor] = t.value;
          save(); renderRoster();
        }
      });
      gmBox.addEventListener('change', function (e) {
        var t = e.target;
        if (t.dataset && t.dataset.grename) {
          var from = t.dataset.grename, to = String(t.value || '').trim().slice(0, 12);
          if (!to) { t.value = from; return; }
          if (to === from) return;
          pushUndo();
          var moved = renameGroup(from, to);
          if (moved === false) {
            toast(lang() === 'en' ? 'That group name already exists' : '同名分组已存在', 'err');
            t.value = from; return;
          }
          save(); renderAll(); renderSettings();
          logAction('group', (lang() === 'en' ? 'Renamed group ' : '重命名分组 ') + from + ' → ' + to);
          toast((lang() === 'en' ? 'Renamed, ' : '已重命名，') + moved + (lang() === 'en' ? ' members moved' : ' 人随之迁移'), 'ok');
        }
      });
      gmBox.addEventListener('click', async function (e) {
        var b = e.target.closest ? e.target.closest('[data-gdel]') : null;
        if (!b) return;
        var g = b.dataset.gdel;
        var n = state.participants.filter(function (p) { return p.group === g; }).length;
        var ok = await ask({
          title: lang() === 'en' ? 'Dissolve group' : '解散分组',
          msg: (lang() === 'en' ? 'Dissolve <b>' + esc(g) + '</b>? ' : '解散分组 <b>' + esc(g) + '</b>，') +
            n + (lang() === 'en' ? ' members keep existing but lose the group.' : ' 人仍保留，只是不再属于该分组。'),
          ok: lang() === 'en' ? 'Dissolve' : '解散'
        });
        if (!ok) return;
        pushUndo();
        dissolveGroup(g);
        save(); renderAll(); renderSettings();
        logAction('group', (lang() === 'en' ? 'Dissolved group ' : '解散分组 ') + g);
      });
    }

    // 外观：主题色
    var accRow = $('#accentRow');
    if (accRow) {
      accRow.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-accent]') : null;
        if (!b) return;
        state.settings.accent = b.dataset.accent || '';
        applyAccent(); buildAppearance(); save();
        Sfx.play('click', 0.5);
        toast(state.settings.accent
          ? (lang() === 'en' ? ('Accent: ' + state.settings.accent) : ('主题色已应用：' + state.settings.accent))
          : (lang() === 'en' ? 'Back to default palette' : '已恢复默认配色'), 'ok');
      });
      accRow.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'accentPick') return;
        state.settings.accent = e.target.value;
        applyAccent(); save();
      });
      accRow.addEventListener('change', function (e) {
        if (!e.target || e.target.id !== 'accentPick') return;
        buildAppearance();
        Sfx.play('click', 0.5);
      });
    }

    // 外观：背景（渐变预设 / 本机图片）
    var bgRowEl = $('#bgRow');
    if (bgRowEl) bgRowEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-bg]') : null;
      if (!b) return;
      state.settings.bg = b.dataset.bg;
      state.settings.bgImage = '';      // 选渐变即清除自定义图片
      applyBg(); buildAppearance(); save();
      Sfx.play('click', 0.5);
      toast(lang() === 'en' ? 'Background updated' : '背景已更新', 'ok');
    });
    var bgInput = $('#bgImageInput');
    if (bgInput) bgInput.addEventListener('change', function () {
      var f = bgInput.files && bgInput.files[0];
      if (!f) return;
      readBgImage(f).then(function (data) {
        if (!data) { toast(lang() === 'en' ? 'Image read failed' : '图片读取失败', 'err'); return; }
        var size = data.length;
        if (size > 1.6 * 1024 * 1024) {
          toast(lang() === 'en' ? 'Image is large — consider a smaller one (storage limit ~5 MB)' : '图片偏大（已压缩），可能占用较多本地空间；建议换一张更小的', 'err');
        }
        state.settings.bgImage = data;
        applyBg(); buildAppearance(); save();
        toast(lang() === 'en' ? 'Custom background applied' : '自定义背景已应用', 'ok');
      }).catch(function () {
        toast(lang() === 'en' ? 'Could not read this image' : '无法读取这张图片', 'err');
      });
      bgInput.value = '';
    });
    var bgClear = $('#bgClearBtn');
    if (bgClear) bgClear.addEventListener('click', function () {
      state.settings.bgImage = '';
      state.settings.bg = 'auto';
      applyBg(); buildAppearance(); save();
      toast(lang() === 'en' ? 'Background cleared' : '已清除自定义背景', 'ok');
    });

    // 名单库
    var libBox = $('#libList');
    if (libBox) libBox.addEventListener('click', function (e) {
      var sw = e.target.closest ? e.target.closest('[data-libswitch]') : null;
      if (sw) { switchLib(sw.dataset.libswitch); return; }
      var rn = e.target.closest ? e.target.closest('[data-librename]') : null;
      if (rn) { renameLib(rn.dataset.librename); return; }
      var cp = e.target.closest ? e.target.closest('[data-libcopy]') : null;
      if (cp) { copyLib(cp.dataset.libcopy); return; }
      var dl = e.target.closest ? e.target.closest('[data-libdel]') : null;
      if (dl) { delLib(dl.dataset.libdel); return; }
    });
    var libNew = $('#libNewBtn');
    if (libNew) libNew.addEventListener('click', function () { newLib(); });

    // 皮肤
    var skinBox = $('#skinGrid');
    if (skinBox) skinBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-skin]') : null;
      if (!b) return;
      state.settings.skin = b.dataset.skin;
      applySkin(); buildSkins(); save();
      Sfx.play('click', 0.5);
    });

    // 语言
    var langBox = $('#langSeg');
    if (langBox) langBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-lang]') : null;
      if (!b) return;
      state.settings.lang = b.dataset.lang;
      save(); applyLang(); renderSettings();
      Sfx.play('click', 0.5);
    });

    // 星级权重（1–5 倍）
    var we = $('#weightEnable');
    if (we) we.addEventListener('change', function () {
      state.settings.weights.enabled = we.checked;
      save(); syncStarInputs(); syncWeightPct();
      toast(we.checked
        ? (lang() === 'en' ? 'Weight mode on: 1–5★ acts as a multiplier' : '已启用 1–5 倍权重：星级作为倍率参与概率')
        : (lang() === 'en' ? 'Weight mode off' : '已关闭权重模式'), 'ok');
    });
    var wg = $('#weightGrid');
    if (wg) wg.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.dataset || !t.dataset.w) return;
      state.settings.weights.mult[Number(t.dataset.w)] = Math.max(0, Math.min(5, Number(t.value) || 0));
      save(); syncWeightPct();
    });

    // 动画速度 0.5x / 1x / 1.5x
    var spSeg = $('#speedSeg');
    if (spSeg) spSeg.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-speed]') : null;
      if (!b) return;
      state.settings.animSpeed = b.dataset.speed;
      save(); renderScope(); renderSettings();
      Sfx.play('click', 0.5);
    });

    // 幸运值
    var leEl = $('#luckyEnable'), lsEl = $('#luckyStep');
    if (leEl) leEl.addEventListener('change', function () {
      state.settings.pity.lucky = leEl.checked;
      save(); renderSettings(); renderPity(); syncWeightPct();
    });
    if (lsEl) lsEl.addEventListener('input', function () {
      state.settings.pity.luckyStep = Math.max(0, Math.min(5, Number(lsEl.value) || 0));
      save(); renderSettings(); renderPity(); syncWeightPct();
    });

    // 快捷键总开关 / 空格抽卡 / 自定义 / 复位
    var sceEl = $('#scEnable'), scsEl = $('#scSpace');
    if (sceEl) sceEl.addEventListener('change', function () {
      state.settings.shortcuts.enabled = sceEl.checked;
      recordingKb = null;
      save(); renderSettings();
      toast(sceEl.checked ? (lang() === 'en' ? 'Shortcuts on' : '快捷键已开启') : (lang() === 'en' ? 'Shortcuts off' : '快捷键已全部关闭'), 'ok');
    });
    if (scsEl) scsEl.addEventListener('change', function () {
      state.settings.shortcuts.spaceDraw = scsEl.checked;
      save(); syncKb();
    });
    var kbList = $('#kbList');
    if (kbList) kbList.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-kb]') : null;
      if (!b) return;
      recordingKb = recordingKb === b.dataset.kb ? null : b.dataset.kb;
      syncKb();
    });
    var kbReset = $('#kbReset');
    if (kbReset) kbReset.addEventListener('click', function () {
      state.settings.shortcuts.keys = defaultShortcutKeys();
      state.settings.shortcuts.enabled = true;
      recordingKb = null;
      save(); renderSettings();
      toast(lang() === 'en' ? 'Shortcuts restored' : '快捷键已恢复默认', 'ok');
    });

    // 长按多选 + 右键菜单 + 虚拟滚动
    if (listEl) {
      var pressTimer = null, pressUid = null;
      var pressStart = null;
      var cancelPress = function () {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        pressStart = null;
      };
      listEl.addEventListener('pointerdown', function (e) {
        var row = e.target.closest ? e.target.closest('.p-row') : null;
        if (!row || row.classList.contains('editing')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var uid = row.dataset.uid;
        var holdMs = Math.max(200, Math.min(1200, Number(state.settings.longPressMs) || 480));
        pressStart = { x: e.clientX, y: e.clientY, top: listEl.scrollTop };
        pressTimer = setTimeout(function () {
          pressTimer = null;
          pressUid = uid;
          if (selected[uid]) delete selected[uid]; else selected[uid] = true;
          renderRoster();
          Sfx.play('tick', 0.5);
          toast(lang() === 'en' ? ('Selected ' + selectedUids().length) : ('已勾选 ' + selectedUids().length + ' 人'), 'ok');
        }, holdMs);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        listEl.addEventListener(ev, cancelPress, { passive: true });
      });
      // 长按后一旦滑动（超过 10px）或列表滚动，就取消长按选中，避免误选
      listEl.addEventListener('pointermove', function (e) {
        if (!pressStart) return;
        if (Math.abs(e.clientX - pressStart.x) > 10 || Math.abs(e.clientY - pressStart.y) > 10) cancelPress();
      }, { passive: true });
      listEl.addEventListener('scroll', function () {
        cancelPress();
        if (vsActive) vsSchedule();
      }, { passive: true });
      listEl.addEventListener('contextmenu', function (e) {
        var row = e.target.closest ? e.target.closest('.p-row') : null;
        if (!row) return;
        e.preventDefault();
        var p = state.participants.filter(function (x) { return x.uid === row.dataset.uid; })[0];
        if (p) openCtxMenu(e.clientX, e.clientY, p);
      });
    }

    // 输入聚焦自动滚动：避免软键盘 / 底部 Dock 遮住正在编辑的输入框
    document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (!t || !t.tagName || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (t.type === 'range' || t.type === 'color' || t.type === 'file' || t.type === 'checkbox') return;
      setTimeout(function () {
        try {
          var r = t.getBoundingClientRect(), vh = window.innerHeight || 0;
          if (r.bottom <= vh - 130 && r.top >= 8) return;
          var sc = t.closest ? t.closest('.modal-body, .roster-list, .settings-body') : null;
          if (sc && sc.scrollHeight > sc.clientHeight + 4) {
            var sr = sc.getBoundingClientRect();
            sc.scrollTop += (r.top - sr.top) - Math.max(40, sr.height * 0.32);
          } else if (t.scrollIntoView) {
            t.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        } catch (err) { }
      }, 240);
    }, true);

    // 多标签同步
    var syncTimer = 0;
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY || !e.newValue) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(function () {
        loadState();
        applyTheme(); applyAccent(); applyBg(); applySkin(); applySoundBtn(); applyLang();
        buildStarConfig(); renderAll(); renderSettings(); syncUndoBtns();
        toast(lang() === 'en' ? 'Synced changes from another tab' : '已同步其他标签页的改动', 'ok');
      }, 180);
    });

    // PK 面板
    var pkRun = $('#pkRunBtn');
    if (pkRun) pkRun.addEventListener('click', runPk);

    // 数据
    var ej = $('#exportJsonBtn');
    if (ej) ej.addEventListener('click', exportJson);
    var ij = $('#importJsonInput');
    if (ij) ij.addEventListener('change', async function () {
      var f = ij.files && ij.files[0];
      ij.value = '';
      if (!f) return;
      try {
        var text = await readFileText(f);
        var data = JSON.parse(text);
        if (!data || !Array.isArray(data.participants)) throw new Error('bad');
        var ok = await ask({
          title: lang() === 'en' ? 'Restore backup' : '恢复备份',
          msg: lang() === 'en'
            ? ('Replace the current data with the backup (<b>' + data.participants.length + '</b> participants, <b>' + ((data.history || []).length) + '</b> records)?')
            : ('将用备份覆盖当前数据（名单 <b>' + data.participants.length + '</b> 人，历史 <b>' + ((data.history || []).length) + '</b> 条）？'),
          ok: lang() === 'en' ? 'Restore' : '恢复', danger: true
        });
        if (!ok) return;
        pushUndo();
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { }
        state = freshState();
        loadState();
        afterStateReplace();
        toast(lang() === 'en' ? 'Backup restored' : '备份已恢复', 'ok');
      } catch (e) {
        toast(lang() === 'en' ? 'Invalid backup file' : '备份文件无法解析', 'err');
      }
    });

    // 导出
    var eg = $('#exportGrid');
    if (eg) eg.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-format]') : null;
      if (!b) return;
      doExport(b.dataset.format);
    });

    // 课堂积分
    var ptsBody = $('#pointsBody');
    if (ptsBody) {
      ptsBody.addEventListener('change', function (e) {
        var t = e.target;
        if (t && t.dataset && t.dataset.psel) {
          var row = t.closest ? t.closest('.pts-row') : null;
          if (!row) return;
          if (t.checked) pointSel[row.dataset.puid] = 1; else delete pointSel[row.dataset.puid];
          row.classList.toggle('on', t.checked);
          syncPointsUI();
          Sfx.play('tick', 0.35);
          return;
        }
        if (t && t.id === 'ptsScope') {
          state.settings.pointScope = ['recent1', 'recent10', 'recent20', 'all'].indexOf(t.value) >= 0 ? t.value : 'recent10';
          pointSel = {};
          save(); renderPoints();
          Sfx.play('click', 0.4);
          return;
        }
        if (t && t.id === 'ptsSort') {
          state.settings.pointSort = ['points', 'plus', 'minus', 'recent'].indexOf(t.value) >= 0 ? t.value : 'points';
          save(); renderPoints();
          Sfx.play('click', 0.4);
          return;
        }
        if (t && t.id === 'ptsLogUid') {
          state.settings.pointLogUid = t.value || 'all';
          save(); renderPoints();
          return;
        }
        if (t && t.id === 'ptsLogRange') {
          state.settings.pointLogRange = ['all', 'today', '7', '30'].indexOf(t.value) >= 0 ? t.value : 'all';
          save(); renderPoints();
        }
      });
      ptsBody.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'ptsDelta') syncPointsUI();
      });
      ptsBody.addEventListener('click', function (e) {
        var t = e.target; if (!t || !t.closest) return;
        if (t.closest('#ptsSelectAll')) {
          var cands = pointCandidates();
          var allOn = cands.length > 0 && cands.every(function (c) { return pointSel[c.p.uid]; });
          pointSel = {};
          if (!allOn) cands.forEach(function (c) { pointSel[c.p.uid] = 1; });
          syncPointsUI();
          return;
        }
        if (t.closest('#ptsClearSel')) { pointSel = {}; syncPointsUI(); return; }
        if (t.closest('#ptsApply')) { applyPoints(); return; }
        if (t.closest('#ptsUndoLast')) { undoLastPoints(); return; }
        if (t.closest('#ptsClearLog')) { clearPoints(); return; }
        var qb = t.closest('[data-delta]');
        if (qb) {
          var d = $('#ptsDelta'); if (d) d.value = qb.dataset.delta;
          syncPointsUI(); Sfx.play('tick', 0.35); return;
        }
        var rb = t.closest('[data-reason]');
        if (rb) { var r = $('#ptsReason'); if (r) { r.value = rb.dataset.reason; r.focus(); } return; }
      });
    }
    var lastQuick = $('#lastQuick');
    if (lastQuick) lastQuick.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-quick]') : null;
      if (!b) return;
      var last = state.last;
      if (!last || !last.uid) { toast(lang() === 'en' ? 'Draw someone first' : '先抽一次再快捷加减分', 'err'); return; }
      if (b.dataset.quick === 'more') { openPointsFor(last.uid); return; }
      var d = Number(b.dataset.quick) || 0;
      quickPoint(last.uid, d, lang() === 'en' ? 'Class performance' : '课堂表现');
    });

    var ptsExport = $('#ptsExportBtn');
    if (ptsExport) ptsExport.addEventListener('click', function () { exportPoints(); });

    // 错误日志（P0）
    var errBtn = $('#errLogBtn');
    if (errBtn) errBtn.addEventListener('click', function () {
      var L = lang();
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem(ERRKEY) || '[]') || []; } catch (_) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      if (!arr.length) { toast(L === 'en' ? 'Error log is empty 🎉' : '错误日志为空，一切正常', 'ok'); return; }
      download('错误日志_' + stamp() + '.json', JSON.stringify({
        exportedAt: new Date().toISOString(), count: arr.length, errors: arr
      }, null, 2), 'application/json;charset=utf-8');
      toast(L === 'en' ? ('Error log exported (' + arr.length + ')') : ('错误日志已导出（' + arr.length + ' 条）'), 'ok');
    });
    var errClr = $('#errLogClear');
    if (errClr) errClr.addEventListener('click', async function () {
      var L = lang();
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem(ERRKEY) || '[]') || []; } catch (_) { arr = []; }
      if (!Array.isArray(arr) || !arr.length) { toast(L === 'en' ? 'Error log is empty' : '错误日志为空', 'ok'); return; }
      var ok = await ask({
        title: L === 'en' ? 'Clear error log' : '清空错误日志',
        msg: (L === 'en' ? 'Remove ' : '删除 ') + arr.length + (L === 'en' ? ' entries?' : ' 条日志？'),
        ok: L === 'en' ? 'Clear' : '清空', danger: true
      });
      if (!ok) return;
      try { localStorage.removeItem(ERRKEY); } catch (_) { }
      toast(L === 'en' ? 'Error log cleared' : '错误日志已清空', 'ok');
    });

    // 座位表：模式 / 2D / 拖拽 / 自动排座 / 抽座位
    var seatBody = $('#seatBody');
    if (seatBody) {
      seatBody.addEventListener('click', function (e) {
        if (!e.target.closest) return;
        var mb = e.target.closest('[data-seatmode]');
        if (mb) {
          seatEdit = mb.dataset.seatmode === 'edit';
          seatSel = null;
          renderSeatMap();
          Sfx.play('click', 0.45);
          return;
        }
        if (e.target.closest('#seatFlatBtn')) {
          state.settings.seatFlat = !isSeatFlat();
          save(); renderSeatMap();
          Sfx.play('click', 0.45);
          return;
        }
        if (e.target.closest('#seatApplyLayout')) {
          var ri = $('#seatRowsInput'), ci = $('#seatColsInput');
          applySeatLayout(ri ? ri.value : 0, ci ? ci.value : 0);
          return;
        }
        if (e.target.closest('#seatAutoLayout')) { autoLayoutSeats(); return; }
        if (e.target.closest('#seatAutoNumber')) { autoNumberSeats(); return; }
        if (e.target.closest('#seatImportBtn')) { importSeatExcel(); return; }
        if (e.target.closest('#seatExportBtn')) { exportSeatXlsx(); return; }
        var seat = e.target.closest('.seat');
        if (seat && seatEdit) { seatClick(Number(seat.dataset.seat)); return; }
        var slot = e.target.closest('.seat-slot');
        if (slot && seatEdit && seatSel != null && state.seatmap.grid[seatSel]) {
          moveSeatTo(state.seatmap.grid[seatSel], Number(slot.dataset.cell));
        }
      });
      seatBody.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var s = e.target.closest ? e.target.closest('.seat') : null;
        if (s && seatEdit) { e.preventDefault(); seatClick(Number(s.dataset.seat)); }
      });
      seatBody.addEventListener('dragstart', function (e) {
        if (!seatEdit) return;
        var t = e.target.closest ? e.target.closest('[data-uid]') : null;
        if (!t) return;
        try { e.dataTransfer.setData('text/plain', JSON.stringify({ uid: t.dataset.uid })); e.dataTransfer.effectAllowed = 'move'; } catch (err) { }
      });
      seatBody.addEventListener('dragover', function (e) {
        var st = e.target.closest ? e.target.closest('.seat-slot') : null;
        if (!st || !seatEdit) return;
        e.preventDefault();
        st.classList.add('over');
      });
      seatBody.addEventListener('dragleave', function (e) {
        var st = e.target.closest ? e.target.closest('.seat-slot') : null;
        if (st) st.classList.remove('over');
      });
      seatBody.addEventListener('drop', function (e) {
        var st = e.target.closest ? e.target.closest('.seat-slot') : null;
        if (!st || !seatEdit) return;
        e.preventDefault();
        st.classList.remove('over');
        var raw = '';
        try { raw = e.dataTransfer.getData('text/plain'); } catch (err) { }
        var d = null;
        try { d = JSON.parse(raw); } catch (err) { }
        if (d && d.uid) moveSeatTo(d.uid, Number(st.dataset.cell));
      });
    }
    var seatFile = $('#seatImportFile');
    if (seatFile) seatFile.addEventListener('change', function () {
      var f = seatFile.files && seatFile.files[0];
      if (f) handleSeatImportFile(f);
      seatFile.value = '';
    });
    var seatExportBtn = $('#seatExportBtn');
    if (seatExportBtn) seatExportBtn.addEventListener('click', function () { exportSeatXlsx(); });
    var seatDrawBtn = $('#seatDrawBtn');
    if (seatDrawBtn) seatDrawBtn.addEventListener('click', function () {
      if (seatEdit) { toast(lang() === 'en' ? 'Switch to draw mode first' : '请先切回抽奖模式', 'err'); return; }
      if (!poolSeats().length) { toast(lang() === 'en' ? 'No seats yet' : '还没有座位', 'err'); return; }
      state.settings.drawMode = 'seat';
      save(); syncDrawModeUI();
      drawSingle('seat');
    });

    // 引导
    var gs = $('#guideStart');
    if (gs) gs.addEventListener('click', function () {
      state.settings.guideSeen = true;
      save();
      closeEl($('#guideModal'));
    });

    // 首次交互解锁音频
    document.addEventListener('pointerdown', function once() {
      Sfx.sync();
      Sfx.ensure();
      document.removeEventListener('pointerdown', once);
    });

    // 快捷键
    window.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      var k = e.key;

      // 键位录制中
      if (recordingKb) {
        var rid = recordingKb;
        var got = keyFromEvent(e);
        if (!got) return;
        e.preventDefault();
        recordingKb = null;
        if (got !== 'escape') {
          state.settings.shortcuts.keys[rid] = got;
          save(); syncKb(); renderSettings();
          toast(lang() === 'en' ? ('Bound to ' + keyLabel(got)) : ('已绑定：' + keyLabel(got)), 'ok');
        } else syncKb();
        return;
      }

      if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === 'Escape') {
        if (anyLayerOpen()) { e.preventDefault(); closeTop(); return; }
        if (skipWaiters.length) { doSkip(); return; }
        return;
      }

      // 十连卡堆键盘：→ / 空格 / 回车 推进，← 退回；全部展示后任意键关闭
      var tenOv = $('#tenOverlay');
      if (tenOv && tenOv.classList.contains('active')) {
        if (k === 'ArrowRight' || k === ' ' || k === 'Spacebar' || k === 'Enter') {
          e.preventDefault();
          if (tenState.open && tenState.shown < tenState.items.length) tenAdvance();
          else hideTenOverlay();
          return;
        }
        if (k === 'ArrowLeft') { e.preventDefault(); tenBack(); return; }
        return;
      }

      var t = e.target;
      var typing = false;
      if (t) {
        var tag = (t.tagName || '').toLowerCase();
        typing = tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
      }
      if (typing) return;
      if (anyLayerOpen()) return;

      var sc = state.settings.shortcuts;
      if (!sc.enabled) return;
      var pressed = keyFromEvent(e);
      if (!pressed || pressed === 'shift') return;
      if (pressed === ' ' && !sc.spaceDraw) return;

      var keys = sc.keys, hit = null;
      for (var i = 0; i < ACTIONS.length; i++) {
        if (keys[ACTIONS[i].id] === pressed) { hit = ACTIONS[i].id; break; }
      }
      if (!hit) return;
      e.preventDefault();
      runAction(hit);
    });

    // 移动端：键盘弹出时隐藏 Dock
    if (window.visualViewport) {
      var vv = window.visualViewport;
      var onVV = function () {
        var open = (window.innerHeight - vv.height) > 160;
        document.body.classList.toggle('kb-open', open);
      };
      vv.addEventListener('resize', onVV);
      vv.addEventListener('scroll', onVV);
    }

    // 离开前保存
    window.addEventListener('beforeunload', function () { save(); });
  }

  /* ---------------- 模式切换 ---------------- */
  function runAction(id) {
    if (id === 'single') drawSingle();
    else if (id === 'ten') drawTen();
    else if (id === 'import') openModal($('#importModal'));
    else if (id === 'history') openModal($('#historyModal'));
    else if (id === 'stats') openModal($('#statsModal'));
    else if (id === 'settings') openModal($('#settingsModal'));
    else if (id === 'pk') { openModal($('#pkModal')); renderPk(); }
    else if (id === 'reset') resetAll();
  }

  async function switchMode(mode) {
    if (mode !== 'unique' && mode !== 'repeat') return;
    if (mode === state.settings.mode) { syncModeUI(); return; }
    var L = lang();
    var toRepeat = mode === 'repeat';
    var msg = toRepeat
      ? (L === 'en'
        ? 'Repeatable mode: every draw picks from the <b>full roster</b>. Winners are <b>not</b> marked as drawn, the 1–5★ star is still a <b>rating after the draw</b>, and the ranking switches to “most drawn”.'
        : '可重复模式：每次都从 <b>全量名单</b> 抽取，抽中者 <b>不会</b> 被标记为已抽中；1–5★ 仍只是 <b>抽中后的评级</b>；排行榜改为按「抽中次数」排序。')
      : (L === 'en'
        ? 'No-repeat mode: winners are <b>removed from the pool</b> until you return them. The ranking switches to “best stars”.'
        : '不重复模式：抽中者会 <b>移出候选池</b>，直到你手动放回；排行榜改为按「星级」排序。');
    var ok = await ask({
      title: L === 'en' ? 'Switch draw mode' : '切换抽取模式',
      msg: '<p style="line-height:1.8">' + msg + '</p>' +
        '<p style="margin-top:8px;opacity:.72;font-size:12px">' + (L === 'en'
          ? ('Currently ' + drawnCount() + ' of ' + state.participants.length + ' marked as drawn. History is kept, and the switch can be undone.')
          : ('当前已抽中 ' + drawnCount() + ' / ' + state.participants.length + ' 人，切换不会清空历史，且可撤销。')) + '</p>',
      ok: L === 'en' ? 'Switch' : '确认切换',
      cancel: L === 'en' ? 'Cancel' : '取消'
    });
    if (!ok) { syncModeUI(); return; }
    // 切回「不重复」时，让用户决定已抽标记：按历史标记 / 全部重置 / 保持现状
    var choice = null;
    if (!toRepeat) {
      choice = await ask({
        title: L === 'en' ? 'Drawn marks' : '已抽标记怎么处理',
        msg: '<p style="line-height:1.8">' + (L === 'en'
          ? 'Back to no-repeat: pick how the pool should start. <b>Mark from history</b> marks everyone who already appears in the draw history; <b>Reset all</b> puts everybody back; <b>Keep as is</b> leaves the current marks untouched.'
          : '切回「不重复」前，先决定候选池：<b>按历史标记已抽中</b>会把历史上抽到过的人标记为已抽；<b>全部重置为未抽</b>让所有人回到候选池；<b>保持现状</b>则沿用当前标记。') + '</p>' +
          '<p style="margin-top:8px;opacity:.72;font-size:12px">' + (L === 'en'
            ? 'History is kept in every case, and this step can be undone.'
            : '三种选择都不会清空历史，且这一步可以撤销。') + '</p>',
        extra: [{ label: L === 'en' ? 'Reset all to undrawn' : '全部重置为未抽', value: 'reset', danger: true }],
        ok: L === 'en' ? 'Mark from history' : '按历史标记已抽中',
        cancel: L === 'en' ? 'Keep as is' : '保持现状'
      });
      if (choice === false || choice == null) choice = 'keep';
    }
    pushUndo();
    state.settings.mode = mode;
    if (toRepeat) { state.settings.filter = 'all'; }
    if (choice === 'reset') {
      var resetN = 0;
      state.participants.forEach(function (p) { if (p.drawn) { p.drawn = false; p.drawnAt = 0; resetN++; } });
      logAction('mode', (L === 'en' ? 'Reset ' : '全部重置为未抽：') + resetN + (L === 'en' ? ' drawn marks' : ' 人'));
    } else if (choice === 'history') {
      var hm = {}, hts = {};
      state.history.forEach(function (h) {
        var k = h.uid || ('name:' + h.name);
        hm[k] = 1;
        if ((h.ts || 0) > (hts[k] || 0)) hts[k] = h.ts || 0;
      });
      var markedN = 0;
      state.participants.forEach(function (p) {
        var k = hm[p.uid] ? p.uid : ('name:' + p.name);
        if (hm[k]) {
          if (!p.drawn) markedN++;
          p.drawn = true;
          p.drawnAt = Math.max(Number(p.drawnAt) || 0, hts[k] || Date.now());
        }
      });
      logAction('mode', (L === 'en' ? 'Marked from history: ' : '按历史标记已抽中：') + markedN + (L === 'en' ? ' people' : ' 人'));
    } else if (!toRepeat) {
      logAction('mode', L === 'en' ? 'Kept existing drawn marks' : '保持原有已抽标记');
    }
    save();
    syncModeUI();
    renderAll();
    renderSettings();
    Sfx.play('click', 0.6);
    logAction('mode', (L === 'en' ? 'Mode → ' : '模式切换为 ') + (toRepeat ? (L === 'en' ? 'repeatable' : '可重复') : (L === 'en' ? 'no-repeat' : '不重复')));
    toast(L === 'en'
      ? (toRepeat ? 'Mode: repeatable · filter 未抽/已抽 disabled · ranking by count' : 'Mode: no-repeat · ranking by stars')
      : (toRepeat ? '已切换到可重复模式：未抽/已抽筛选已禁用，排行按次数' : '已切换到不重复模式：排行按星级'), 'ok');
  }

  function syncModeUI() {
    var repeat = state.settings.mode === 'repeat';
    $$('#modeSeg button, #modeSeg2 button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === state.settings.mode);
    });
    var fs = $('#filterSelect');
    if (fs) {
      $$('option', fs).forEach(function (o) {
        if (o.value === 'undrawn' || o.value === 'drawn') o.disabled = repeat;
      });
      if (repeat && state.settings.filter !== 'all') {
        state.settings.filter = 'all';
        fs.value = 'all';
      }
    }
    var badge = $('#modeSeg');
    if (badge) badge.title = repeat
      ? (lang() === 'en' ? 'Repeatable: drawn marks are ignored' : '可重复抽取：不标记已抽中')
      : (lang() === 'en' ? 'No-repeat: winners leave the pool' : '不重复抽取：抽中者移出候选池');
  }

  /* ---------------- 分组 PK ---------------- */
  var pkLast = null;
  function renderPk() {
    var body = $('#pkBody'); if (!body) return;
    var L = lang(), gs = groups();
    if (!pkLast) pkLast = { a: '', b: '', rounds: 10, scoreA: 0, scoreB: 0, rows: [], msg: '' };
    var a = pkLast.a || gs[0] || '';
    var b = pkLast.b || gs[1] || '';
    function opt(cur) {
      if (!gs.length) return '<option value="">' + (L === 'en' ? 'no groups in roster' : '名单里还没有分组') + '</option>';
      return gs.map(function (g) {
        return '<option value="' + esc(g) + '"' + (g === cur ? ' selected' : '') + '>' + esc(g) + '</option>';
      }).join('');
    }
    var rows = pkLast.rows.slice(-10).map(function (r) {
      return '<div class="pk-hist"><span>' + stars(r.sa) + '</span><b>' + esc(r.wa) + ' / ' + esc(r.wb) + '</b><span>' + stars(r.sb) + '</span></div>';
    }).join('');
    body.innerHTML =
      '<div class="pk-grid">' +
        '<div class="pk-side"><span class="pk-sub">' + (L === 'en' ? 'SIDE A' : 'A 组') + '</span>' +
          '<select class="pk-select" id="pkA">' + opt(a) + '</select>' +
          '<b class="pk-score">' + pkLast.scoreA + '</b></div>' +
        '<div class="pk-vs">VS</div>' +
        '<div class="pk-side"><span class="pk-sub">' + (L === 'en' ? 'SIDE B' : 'B 组') + '</span>' +
          '<select class="pk-select" id="pkB">' + opt(b) + '</select>' +
          '<b class="pk-score">' + pkLast.scoreB + '</b></div>' +
      '</div>' +
      '<div class="pk-result">' + (pkLast.msg || (L === 'en' ? 'Pick two groups, then run 10 rounds. Higher star wins the round.' : '选择 A/B 两个分组，跑 10 轮，星级高者胜一轮。')) + '</div>' +
      (rows ? '<div>' + rows + '</div>' : '');
    var sa = $('#pkA'), sb = $('#pkB');
    if (sa) sa.addEventListener('change', function () { pkLast.a = sa.value; });
    if (sb) sb.addEventListener('change', function () { pkLast.b = sb.value; });
    if (a) pkLast.a = a;
    if (b) pkLast.b = b;
  }

  function runPk() {
    var L = lang();
    var sa = $('#pkA'), sb = $('#pkB');
    var a = sa && sa.value, b = sb && sb.value;
    if (!a || !b) { toast(L === 'en' ? 'Pick two groups first' : '请先选择 A / B 两个分组', 'err'); return; }
    if (a === b) { toast(L === 'en' ? 'A and B must differ' : 'A / B 不能是同一个分组', 'err'); return; }
    function members(g) {
      return state.participants.filter(function (p) { return (p.group || '__none') === g && !p.excluded; });
    }
    var A = members(a), B = members(b);
    if (!A.length || !B.length) { toast(L === 'en' ? 'One side has no available participants' : '有一组没有可抽取的成员', 'err'); return; }
    var rounds = 10, scoreA = 0, scoreB = 0, rows = [];
    for (var i = 0; i < rounds; i++) {
      var pa = A[Math.floor(Math.random() * A.length)];
      var pb = B[Math.floor(Math.random() * B.length)];
      var x = pickStar(), y = pickStar();
      if (x > y) scoreA++;
      else if (y > x) scoreB++;
      rows.push({ wa: pa.name, wb: pb.name, sa: x, sb: y });
    }
    var msg;
    if (scoreA > scoreB) msg = (L === 'en' ? 'Winner: ' : '本轮胜者：') + esc(a) + ' · ' + scoreA + ' : ' + scoreB;
    else if (scoreB > scoreA) msg = (L === 'en' ? 'Winner: ' : '本轮胜者：') + esc(b) + ' · ' + scoreA + ' : ' + scoreB;
    else msg = (L === 'en' ? 'Draw ' : '平局 ') + scoreA + ' : ' + scoreB;
    pkLast = { a: a, b: b, rounds: rounds, scoreA: scoreA, scoreB: scoreB, rows: (pkLast ? pkLast.rows : []).concat(rows).slice(-60), msg: msg };
    renderPk();
    logAction('pk', 'PK ' + a + ' ' + scoreA + ':' + scoreB + ' ' + b);
    Sfx.play(scoreA === scoreB ? 'result' : 'five', 0.8);
    toast(msg, 'ok');
  }

  /* ---------------- 右键菜单 ---------------- */
  var ctxEl = null;
  function ensureCtx() {
    if (ctxEl) return ctxEl;
    ctxEl = document.createElement('div');
    ctxEl.className = 'ctx-menu';
    document.body.appendChild(ctxEl);
    document.addEventListener('click', function () { ctxEl.classList.remove('open'); });
    window.addEventListener('scroll', function () { ctxEl.classList.remove('open'); }, true);
    return ctxEl;
  }
  function openCtxMenu(x, y, p) {
    var el = ensureCtx(), L = lang();
    var items = [
      ['edit', L === 'en' ? 'Edit' : '编辑', 0],
      [p.excluded ? 'include' : 'exclude', p.excluded ? (L === 'en' ? 'Restore' : '恢复参与') : (L === 'en' ? 'Exclude temporarily' : '临时排除'), 0],
      ['return', L === 'en' ? 'Return to pool' : '放回候选池', 0],
      ['del', L === 'en' ? 'Delete' : '删除', 1]
    ];
    el.innerHTML = items.map(function (it) {
      return '<button type="button"' + (it[2] ? ' class="danger"' : '') + ' data-cact="' + it[0] + '">' + it[1] + '</button>';
    }).join('');
    el.style.left = Math.min(x, Math.max(8, window.innerWidth - 180)) + 'px';
    el.style.top = Math.min(y, Math.max(8, window.innerHeight - 180)) + 'px';
    el.classList.add('open');
    $$('[data-cact]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        el.classList.remove('open');
        var act = b.dataset.cact;
        if (act === 'edit') { editingUid = p.uid; renderRoster(); return; }
        if (act === 'exclude' || act === 'include') {
          pushUndo();
          p.excluded = act === 'exclude';
          save(); renderAll();
          toast(L === 'en' ? (p.excluded ? (p.name + ' excluded') : (p.name + ' restored')) : (p.excluded ? ('已临时排除 ' + p.name) : ('已恢复 ' + p.name)), 'ok');
          return;
        }
        if (act === 'return') {
          pushUndo();
          p.drawn = false; p.drawnAt = 0;
          save(); renderAll();
          toast(L === 'en' ? (p.name + ' returned') : ('已把 ' + p.name + ' 放回候选池'), 'ok');
          return;
        }
        if (act === 'del') {
          pushUndo();
          state.participants = state.participants.filter(function (x) { return x.uid !== p.uid; });
          var ds2 = {}; ds2[p.uid] = 1; unseatUids(ds2);
          syncSeatmap();
          delete selected[p.uid];
          save(); renderAll();
          toast(L === 'en' ? 'Deleted' : '已删除', 'ok');
        }
      });
    });
  }

  /* ---------------- PWA 清单（file:// 下跳过） ---------------- */
  function initPwa() {
    // manifest 已改为静态文件（index.html 的 <link rel="manifest">），这里只注册 Service Worker
    if (location.protocol === 'file:') return;
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    } catch (e) { }
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadLibs();
    loadState();
    applyTheme();
    applyAccent();
    applyBg();
    applySkin();
    applySoundBtn();
    buildStarConfig();
    buildPresets();
    buildSkins();
    buildWeightGrid();
    buildKbList();
    syncKb();
    buildAppearance();
    buildLibList();
    renderGuide();

    var s = state.settings;
    var se = $('#filterSelect'), so = $('#sortSelect'), si = $('#searchInput');
    if (se) se.value = s.filter;
    if (so) so.value = s.sort;
    if (si) si.value = s.search || '';

    applyLang();

    var lbl = $('#animLabel');
    if (lbl) lbl.textContent = ANIMS[s.animation] || ANIMS.classic;
    $$('#animMenu button').forEach(function (b) { b.classList.toggle('active', b.dataset.anim === s.animation); });

    syncModeUI();
    renderScope();
    renderAll();
    restoreUndo();
    updateStorageInfo(storageBroken);
    if (storageBroken) showUnsavedBanner();
    if (state.history.length > HIST_SOFT) setTimeout(maybeHistoryHint, 2600);
    bind();
    if (LOW_END) document.body.classList.add('low-spec');
    if (!LOW_END) initStarfield();
    if (!LOW_END) initGlow();
    if (!LOW_END) initTilt();
    initPwa();

    if (!s.guideSeen) setTimeout(function () { openModal($('#guideModal')); }, 420);

    if (s.mode === 'repeat') {
      setTimeout(function () {
        toast(lang() === 'en'
          ? 'Repeatable mode: drawn marks are ignored, ranking uses draw counts'
          : '当前为可重复模式：忽略已抽中标记，排行榜按抽中次数', 'ok');
      }, 2200);
    }
  }

  /* 回归测试钩子：与 core.js 共用实现，浏览器控制台可用 window.__test__ 调试 */
  window.__test__ = Object.assign({}, window.__core__ || {}, {
    version: 'test-1',
    lowEnd: LOW_END,
    flushSave: flushSave,
    stateBytes: stateBytes,
    seatSheetAoa: seatSheetAoa,
    handleSeatImportFile: handleSeatImportFile,
    syncSeatmap: syncSeatmap,
    autoNumberSeats: autoNumberSeats,
    applySeatLayout: applySeatLayout,
    seatStats: seatStats,
    recountPoints: recountPoints,
    aggregate: function () { return __core__.aggregatePoints(state.pointLog || []); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


