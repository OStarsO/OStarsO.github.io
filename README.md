# OStarsO.github.io

> 一个零构建、零后端、零依赖锁定（核心页）的静态个人站：**手写 Canvas 星空 + 五个独立子站 + 22 款网页游戏**。
> 本文从代码出发，讲它的结构、手法、取舍和欠账；所有结论都能在 `main` 分支的对应文件里找到出处（核对时间：2026-10-28，commit `8f23783`）。

---

## 0. 速览

| 项 | 值 |
|---|---|
| 仓库 | <https://github.com/OStarsO/OStarsO.github.io> |
| 线上 | <https://ostarso.github.io> |
| 创建 / 最近提交 | 2023-05-21 / 2026-10-28 |
| 部署 | GitHub Pages，`main` 直推即上线（无 CI、无预览环境） |
| 构建 | **无**。没有打包、没有 `node_modules`、没有构建产物目录 |
| License | MIT |
| 文件数 / 跟踪体积 | 597 个 / 约 31 MB（其中 `.ttf` 字体 12.5 MB，占四成） |
| 语言构成 | 76 个 HTML/HTM、112 个 JS、43 个 CSS、26 个 SCSS |
| 默认分支标注语言 | HTML（GitHub 统计口径，实际 JS 才是主体） |

---

## 1. 一句话定位

这不是一个"博客"，而是一个**用静态文件堆出来的前端游乐场**：入口是一段入场动画，主页是个人名片，剩下四个子站分别是游戏大厅、导航搜索、项目墙和 404 彩蛋。它没有框架、没有服务端、没有数据持久化之外的基础设施——`localStorage` 就是它的数据库。

对开发者来说，它最有价值的地方不是"做了什么功能"，而是**在没有构建工具的情况下，一个人怎么把动画、降级、状态管理和性能兜底写完**。

---

## 2. 架构：目录即路由

整个站没有任何路由层。URL 就是文件路径，`小游戏/` 目录下的 `index.html` 就是 `/小游戏/` 的页面。这是 GitHub Pages 的原生行为，也是全站组织方式的根基。

```text
请求链路
──────────────────────────────────────────────────────────
GET /                     → index.html（纯外壳，空 body）
      │  JS 创建 <iframe src="Introduction.html">
      ▼
   Introduction.html（真正的首页：109.7 KB，全内联）
      │
      ├─ 小游戏/            → 大厅（22 张卡片）→ 各游戏目录
      ├─ 搜索/              → ST 导航（173 KB 单文件）
      ├─ github墙/          → 3D 项目卡片墙（26 KB）
      ├─ 404.html           → 自定义 404（Pages 自动接管）
      └─ beian.html         → 330 字节的段子
```

**代价**：首页是"两倍成本"的——`index.html` 的 HTML 解析完，还要再发一次请求把 `Introduction.html` 整个解析一遍。浏览器无法把两个文档的 CSS/JS 合并复用，`Introduction.html` 也没法被单独缓存成"首页资源包"。**收益**：`index.html` 可以做到 17 KB 就出画面（星空 + 加载提示），内容页再慢慢到——这是一个用 iframe 换首屏感知速度的土办法，但确实有效。

---
# AI解析
---
## 3. 五层拆解

### 3.1 `index.html`：入场编排器（全站技术浓度最高的一段）

它不是首页，是**一段有始有终的等待体验**。剥掉 CSS 后逻辑只有 290 行，但每个分支都是为"用户可能等不及"设计的。

**① 星空：手写透视投影**

```js
var FOV = 520, FAR = 1400, SPEED = 10, COUNT = 340;
var k  = FOV / s.z;          // 透视缩放
var sx = CX + s.x * k;       // 投影到屏幕
```

星星在 `(x, y, z)` 三维空间里按 `z` 递减飞向观察者，`z <= 14` 或飞出屏幕就重新 `spawn`——**对象池思想**，粒子数组长度恒定，跑一小时也不会触发 GC。

工程细节是对的：
- `var f = dt / 16.667`，按帧率归一化位移，60Hz / 120Hz / 掉帧设备速度一致；
- `if (dt > 120) dt = 120`，切后台回来不会"瞬移"；
- `DPR = Math.min(devicePixelRatio, 2)`，高分屏不糊，也不做无意义的 3 倍超采样；
- 不清屏，每帧盖一层 `rgba(4,6,12,0.42)`，靠叠加产生拖尾。

**② 时序编排：把"最短等待"也写进了代码**

```js
var MIN_SHOW  = 1900;                              // 最短展示 1.9s
var hardTimer = setTimeout(reveal, 20000);         // 20s 硬兜底
iframe.onload → setTimeout(reveal, MIN_SHOW - elapsed)
```

两个定时器互相钳制：快网不至于"闪一下就没了"（廉价感），慢网/挂掉的 CDN 也不会把用户永久困在加载页。

入场动画是三段式：`scale(0.28)` → `scale(1.06)`（980ms）→ `scale(1)`（550ms），随后圆角与阴影淡出成全屏。缓动曲线 `cubic-bezier(0.22, 0.9, 0.28, 1)` 是常见的"快出慢收"，视觉上像被推出去而不是弹出来。

**③ 遮罩层兜住焦虑**

`.veil` 盖在 iframe 之上（`pointer-events: auto`），点击/触摸不穿透，而是弹出一个每 100ms 刷新的计时提示：

> 网页正在努力加载中，请稍候… 已等待 3.4 秒

加载完成后 `.frame.reveal .veil` 把 `opacity` 归零并交出点击权——不删 DOM，不重排。

**④ 环境探测的降级链**

```text
设备/浏览器：ua-parser-js@2.0.9（CDN，版本锁死）→ 解析失败则显示"未知设备"
IP/地区：   ipwho.is → 失败 → ip-api.com → 再失败 → "获取失败"
```

两段 `fetch` 用 `.catch()` 串成链，只有全部失败才降级到文案。顶部信息栏 `pointer-events: none`，纯粹展示不抢交互；`@media (max-width: 600px)` 下隐藏 `.label` 只留值。

**小瑕疵**：`ua-parser-js` 是同步 `<script>`，阻塞在 `<head>` 里。它只影响顶部那行小字，却挡在动画启动之前——加个 `defer` 就能白赚一次首帧。

### 3.2 `Introduction.html`：自包含的主页（2652 行 / 109.7 KB）

它已经**不再引用本站任何样式表**（`css/index.css` 因此成了死文件），全部样式内联，外链只剩一个 FontAwesome CDN。视觉语言从早年的 Butterfly 博客皮（`#49b1f5`）换成了霓虹赛博：主色 `#6ee7ff`（青）+ `#a78bfa`（紫），背景是三层 `nebula` 径向渐变 + Canvas 星空 + 流星。

**内联脚本做了七件事**：

| # | 功能 | 实现要点 |
|---|---|---|
| 1 | 背景星空 | 按面积算粒子数 `min(340, max(110, w*h/7200))`，0.22 概率给星点加冷色偏移，随机间隔生成流星 |
| 2 | 光标辉光 | `pointermove` 更新 CSS 变量，`requestAnimationFrame` 里做插值缓动，不直接跟随鼠标（避免生硬） |
| 3 | 3D 卡片倾斜 | `pointermove` 算相对中心的偏移 → 写入 `rotateX/rotateY`，`pointerleave` 复位 |
| 4 | 旋转标题 | 8 句文案轮播（含"你离开打开标签页网站会改名字哦"），配合 `visibilitychange` 整活 |
| 5 | **访客地图** | 见下 |
| 6 | 自定义右键菜单 | 8 项 + 二级菜单，键盘 `↑↓/Enter/Esc` 可操作，含"复制/粘贴/剪切/全屏/回到顶部" |
| 7 | 控制台彩蛋 | ASCII 签名 + "已安全运行 N 天" + 冷笑话 API + `OStarsO.hack()` |

**访客地图**是这页最"工程"的一块：`ipapi.co` 定位失败自动降级 `freeipapi.com`，拿到经纬度后用等距圆柱投影 `x=(lon+180)/360*w, y=(90-lat)/180*h` 打到一块 200px 高的 Canvas 上，画网格、呼吸光点、三秒扩散涟漪，并在角落标注城市与国家。文案还老实写着"基于 IP 定位，精度约为城市级"——**没有假装是 GPS**。

**主题与彩蛋开关**：右上角两个按钮，一个切 `body.light`（星空隐去、换成日照背景、辉光与星云重新调色），一个下雪花（动态创建 DOM 雪花 + `animationend` 回收）。两者状态都不持久化，刷新即还原——个人站可以接受，产品站不行。

**控制台那段值得单独看**，它是把"安全提示"做成了互动：

```js
console.log('%c⚠️ 安全警告', ...);
console.log('%c请不要在此粘贴任何代码…如果你是真正的极客，请在控制台输入：OStarsO.hack()', ...);
window.OStarsO = { hack: () => { /* 星空爆闪 */ } };
```

先劝退（防 self-XSS），再给糖（彩蛋）。这比单纯一句"请勿粘贴代码"有效得多。

### 3.3 `小游戏/`：大厅是一个小型状态机

大厅本身（54 KB，零依赖）比很多游戏写得好。它的 `Starfield3D` class 比入口层那套更进了一步：

- 280 颗星，**焦距与速度都是可插值的目标值**（`focalLength += (target - current) * 0.08`），所以"加速"是渐变不是跳变；
- 只有 `speedMultiplier > 2.5` 才画拖尾，静止时不浪费描边；
- `size > 3.5 && alpha > 0.65` 才加十字星芒——**按视觉重要性分级渲染**，省掉大量无感绘制；
- `resize` 时不重建星星，而是按 `star.z / zFar` 比例平移，保持视差连续（这个细节大部分教程都漏）。

**跳转前的"体检"**是最实用的一处：

```js
const response = await fetch(url, { method: 'HEAD', cache: 'no-cache', signal });
// 5000ms 超时用 Promise.race 兜底
// 失败 → 进度条变红 → 显示 "目标门户 xxx 不存在或无法访问" → 2.2s 后回退
```

因为游戏入口混着三种形态——目录（`2048/`）、单文件（`猜数字.html`）、甚至只有 `start.html` 没有 `index.html` 的（`股大爷/`）——不预检就一定会撞 404。这段代码顺手把"跳转失败"从浏览器白屏变成了站内的可控错误态。

配套还有：28 颗 CSS 变量驱动的星爆粒子（`--dx/--dy` 让 CSS 做动画，JS 不参与逐帧）、伪造的量子跃迁进度（检测未返回前锁在 65%，文字分四段变：建立连接 → 检测门户 → 压缩时空 → 等待响应）、以及 `resetAllState()` 统一清理 `interval / timeout / AbortController / class` 防止连点错乱。

**游戏本身是"前端考古层"**，逐目录翻能看到完整断代：

- `2048/`：ES5 时代遗产，`animframe_polyfill` `bind_polyfill` `classlist_polyfill` 三件套，还带 `Rakefile`；
- `pacman/`：入口是 **`index.htm`** 不是 `.html`；带 `cache.manifest`（已废弃的 AppCache）、`data/db-handler.php`（PHP 后端在 Pages 上等于死代码）、`webpack.config.js` + `server.js` + `package.json`（整个仓库唯一的 npm 项目）；
- `赛车游戏/`：`v1.straight → v2.curves → v3.hills → v4.final` 四个版本全部保留，跟着教程一步步敲的痕迹，连 `stats.js`（FPS 监视器）都在；
- `球跑者/`：`src/scripts/modules/main.ts` + `main.min.js`，全站唯一出现过"编译"的地方；
- `盖塔楼.html` / `逗猫.html`：`three.js r83 / r70` + `gsap`，`逗猫` 甚至直接从 `s3-us-west-2.amazonaws.com/cdpn.io` 拉模型和控制器——CodePen 的沙盒资源，随时可能 404。

这份"未清理的演化史"既是技术债，也是这个仓库最真实的档案价值。

### 3.4 `搜索/`：从玩具长成了真正能用的起始页（173 KB）

这一页是**过去一年变化最大**的地方。它现在是一个功能完整的新标签页式导航站，而且是全站唯一做了**运行时性能自检**的页面。

**搜索能力**：多引擎（百度 / Bing / Google / B站 / 知乎 / 淘宝 / MDN / Wiki / GitHub / YouTube）+ `!bang` 直达语法（`!gh react`）。输入框有实时建议。

**快捷方式系统**：`DEFAULT_SHORTCUTS` 起步 5 个，支持新增/编辑/删除、自定义 Emoji 或图片图标、自定义主题色、**拖拽排序**、**文件夹归组**（`folder-viewer` 弹层），全部落到 `localStorage`。

**信息面板**：时钟 + 公历 + 星期 + **农历**（`lunar-javascript`）+ 天气（`open-meteo`）+ 定位（`ipapi.co` → `bigdatacloud` 反查城市名）。天气结果按 `{ts, data}` 写进缓存，避免每次刷新都打接口。

**小工具箱**（抽屉式 5 个 tab）：计算器、单位换算、二维码生成 + 图片识别（`qrcodejs` + `jsQR`）、中英翻译（MyMemory 公开接口）、番茄钟。

**最见功力的是性能自检**：

```js
const PERF_FPS_THRESHOLD = 30;      // 低于 30fps 判定"设备吃力"
const PERF_FPS_WINDOW_MS = 1000;    // 采样窗口 1 秒
// 首次打开、首屏稳定 600ms 后才开始计数
// 只在页面可见时计数（visibilityState !== 'visible' 就重置）
// 采样完成 → 弹 FPS 徽标 → 低于阈值才问一次"是否开启低性能模式"
// 低性能模式：粒子上限 200（默认 800）、关背景动画、关 backdrop-filter
```

它做对了三件常被忽略的事：**采样避开初始化高峰**、**只在可见时计时**（后台标签页的 rAF 不算数）、**只问一次**（`st_nav_perf_checked_v1` 打标，不会每次刷新都骚扰）。800 粒子 + 16 处 `backdrop-filter` 确实吃 GPU，这个兜底是必要的而不是炫技。

**状态管理**也规矩：`st_nav_settings_v2` / `st_nav_presets_v2` / `st_nav_shortcuts_v3` / `st_nav_focus_mode` / `st_nav_weather_cache_v1`，全部带版本号后缀；`loadSettings()` 做默认值深合并 + 字段校验（引擎 id 失配自动回退），所有 `localStorage` 读写都包 `try/catch`（Safari 无痕模式会直接抛）。

### 3.5 `github墙/`：静态数据 + 纯 CSS 3D

26 KB，10 张仓库卡片（OStarsO.github.io、bet-lite、HoloISO-China、OStarsO、Hit-the-squares、Entertainment、Snakes、Message-prompt-plug-in、Fruit-Ninja、2848-OStarsOedition）。`transform-style: preserve-3d` + 每层独立 `--z` 深度 + glare 高光层，鼠标移动产生视差。

**没有调 GitHub API**——数据是手写死在 HTML 里的。取舍很明确：零请求、不会被限流、不会因为 token 过期而白屏；代价是加一个仓库要手动改一次 HTML。它还顺手带了全站唯一一处 `prefers-reduced-motion` 降级，动效敏感用户在这里不会被强行摇晃。

### 3.6 边角料

| 文件 | 说明 |
|---|---|
| `404.html` | 13.7 KB，星空 + "页面迷失在星空中"，返回按钮指向 `Introduction.html`（早前指向已改名的 `pc.html`，已修） |
| `beian.html` | 330 字节，一句"这网站不用备案的你不知道？不知道就算了！滚！" |
| `ip.json` | 内容是 `_github-pages-challenge-OStarsO` 的 TXT 记录 —— 绑定自定义域名时的 ACME 挑战文件，是某次自定义域名尝试的**残留文物** |
| `css/index.css` | 7.4 KB，Butterfly 时代的手写样式（`#49b1f5` 主题色），现已无人引用 |
| `favicon.ico` | 264 KB —— 一个 ico 不该有这么大，里面塞了多尺寸位图 |

---

## 4. 值得学的八个手法

1. **帧率归一化 + dt 封顶**（`index.html`、`Introduction.html`）：任何 `requestAnimationFrame` 动画都该有 `dt / 16.667` 和 `dt > 120` 的钳制，否则高刷屏和切后台就是灾难。
2. **DPR 截断到 2**：`Math.min(devicePixelRatio, 2)` 是移动端 Canvas 的默认正确答案，3 倍屏多画 125% 的像素换不来可见提升。
3. **对象池而非重建**：粒子飞出就重置属性、不 `pop/push`，数组长度恒定。
4. **多级降级链**：IP（`ipwho.is → ip-api.com`）、定位（`ipapi.co → freeipapi.com`）、面板（接口失败 → 缓存 → 占位文案）。任何外部依赖都假设它明天会挂。
5. **`AbortController` + `Promise.race` 做超时**：`fetch` 本身没有超时，这是标准解法，`小游戏/` 里 5 秒判定写得干净。
6. **跳转前 HEAD 预检**：把"点进去 404"提前成"站内错误态 + 重试"。对有大量手写入口的站来说性价比极高。
7. **运行时性能自检 + 用户确认**：不靠 UA 猜设备，直接测 FPS；不自动降级，问一次然后记住（`搜索/`）。
8. **带版本号的 `localStorage` 键 + 默认值合并 + 全量 `try/catch`**：数据格式会变，无痕模式会抛异常，这两件事都必须提前扛住。

---

## 5. 技术债清单（按优先级）

### P0：现在就在拖性能

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 1 | **jQuery 3.4.1 全量加载但完全没用** | `Introduction.html:1841` 同步引入；全文 `$(`/`jQuery` 零命中 | 删掉，直接省 ~90 KB 阻塞下载 |
| 2 | **首页两套星空同时跑** | `index.html` 一套（340 星，投影）、iframe 里 `Introduction.html` 又一套（≤340 星 + 流星），两套 `rAF` 并发 | iframe 加载完成即停外层 `running = false`（代码里 2.6s 后确实停了，但入场那 2.6s 是双倍开销），或直接复用一套 |
| 3 | **字体资源 12.5 MB 的 `.ttf`** | 仓库体积构成：`ttf` 占 12.5 MB，另有 `.eot` / `.woff` 并存 | 只留 `woff2`，能砍掉九成 |
| 4 | **`ua-parser-js` 阻塞首帧** | `index.html:8` 无 `defer` | 加 `defer` 或改成动态 `import` |

### P1：一致性 / 可维护性

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 5 | 大厅说"23 款"，实际 22 张卡 | `小游戏/index.html:532` vs 22 个 `.portal-link` | 数字从数据生成，别手写 |
| 6 | 三个资源未收录：`画画/`、`逗猫.html`、`colorblock/`（后者只有 CSS，无 HTML） | 大厅内零引用 | 收录前两个，删掉 `colorblock/` |
| 7 | `股大爷/` 只有 `start.html` 没有 `index.html` | `ls` 结果 | 补一个 `index.html` 转发，或从大厅移除 |
| 8 | 统计 SDK 散落：`51.la` 只出现在 `切方块.html`、`趣味闯关.html`、`盖塔楼.html` | `sdk.51.la/js-sdk-pro.min.js` | 统一到一处，或全部移除 |
| 9 | `逗猫.html` 依赖 CodePen 的 S3 沙盒资源 | `s3-us-west-2.amazonaws.com/cdpn.io/264161/Cat.js` | 把 `Cat.js` / `OrbitControls.js` 落到仓库内 |
| 10 | 五套星空各写一遍（入口 / 主页 / 大厅 / 搜索 / 项目墙），零复用 | 5 个文件各有独立 `rAF` 循环 | 抽一个 `starfield.js`，各页 `<script>` 引入即可，不需要构建 |

### P2：打磨项

| # | 问题 | 建议 |
|---|---|---|
| 11 | `切方块.html` 里有 `href="https://ostarso.github.com"`（应为 `.io`） | 改字 |
| 12 | `css/index.css` 已是死代码（主页全内联） | 删，或反向抽出内联样式复用它 |
| 13 | 中文目录名 → URL 变成 `%E5%B0%8F%E6%B8%B8%E6%88%8F`，分享链接长且易错 | 加一层英文别名页 `games/` → redirect，中文名保留 |
| 14 | `localStorage` 键有版本号但**没有迁移函数** | 加 `migrate(v1→v2)`，否则改名即静默丢用户配置 |
| 15 | `prefers-reduced-motion` 只有 `github墙` 一处支持，而全站有 5 套动画 | 在入口层和主页补 `@media` 降级 |
| 16 | 无任何自动化 | 一个 GitHub Actions 定时跑链接存活检查（lychee）+ HTML 校验，成本极低 |
| 17 | 主页 109 KB 全内联、搜索页 173 KB 全内联 | 拆 `critical CSS` + 异步加载工具箱面板；单文件的好处要留着，但可以拆成"主文件 + 懒加载片段" |

---

## 6. 二次开发指南

**本地跑（不需要任何安装）**

```bash
git clone https://github.com/OStarsO/OStarsO.github.io.git
cd OStarsO.github.io
python -m http.server 8000        # 或 npx serve .
```

> 双击 `index.html` 用 `file://` 打开也能看到动画，但游戏大厅的 `fetch HEAD` 预检在 `file://` 下必然失败，所有入口都会报"门户不存在"。**必须起本地服务器**。

**加一个游戏（3 步）**

1. 把游戏目录丢进 `小游戏/`，确保根目录有 `index.html`（或 `index.htm`）；
2. 在 `小游戏/index.html` 的 `#portal-grid` 里复制一张 `.portal-link` 卡片，改三个属性：
   ```html
   <a href="新游戏/" class="portal-link"
      data-target-url="新游戏/" data-portal-name="新游戏" data-icon="🎮">
   ```
3. 顺手把标题里的"23 款"改成实际数量（`grep "小游戏大厅 ·"`）。

不需要注册路由、不需要改配置——这就是"目录即路由"的好处。

**换搜索默认引擎**：改 `搜索/index.html` 的 `DEFAULT_ENGINES` / `ENGINE_MAP`；用户已存配置在 `st_nav_settings_v2` 里，改默认值不影响老用户（`loadSettings` 会合并），要强制刷新记得升版本号到 `v3` 并在 `loadSettings` 里写迁移。

**想让星空代码只写一遍**：把 `Starfield3D` 从 `小游戏/index.html` 抽成独立 `starfield.js`，暴露 `new Starfield3D(canvas, {count, speed, trails})`。零构建也能用 `<script src>` 引，五个页面共享一份源码——这是当前收益最高的一次重构。

---

## 7. 演进史：三个阶段的技术痕迹

翻 Git 历史和目录结构，能清楚看到一条个人前端的成长曲线：

| 阶段 | 时间 | 特征 | 留下的痕迹 |
|---|---|---|---|
| **拼模板期** | 2023 | 拷 Butterfly 博客主题、扒 CodePen、装 CDN 小部件 | `css/index.css` 的 `#49b1f5`、`jQuery`、`FontAwesome 4.7`、`three.js r70` |
| **整活期** | 2024–2025 | 往页面里塞彩蛋、彩蛋、更多彩蛋 | 控制台钓鱼、改标题、蓝屏模拟器、`beian.html`、冷笑话 API |
| **手写引擎期** | 2026 | 核心页面逐个重写成零依赖单文件，自己写粒子系统 | 入口 17 KB 外壳、大厅 `Starfield3D`、搜索页 800 粒子 + FPS 自检、`prefers-reduced-motion` |

一个有意思的自证：主页技能条上 JavaScript 写着 **5%**，而全站 112 个 JS 文件里，最复杂的几段（透视投影、状态机、性能采样）都是手写的。这个数字本身也是"整活"的一部分。

---

## 8. 结语

如果用一句话评价这个仓库：

> **它是一个没有工程化外壳、但工程直觉相当在线的作品。** 动画该有的帧率处理、外部依赖该有的降级、跳转该有的预检、性能该有的兜底，一个都不缺；缺的是模块复用、依赖清理和自动化——恰好都是"一个人写、没有 review"最容易漏掉的部分。

它最大的价值不在"能玩 22 个游戏"，而在于它真实记录了一个人从**拷模板**到**手写引擎**的全过程，并且把中间产物（四个赛车版本、各种 polyfill、废弃的 PHP 后端）全都留在了仓库里。这种东西在清理干净的商业代码库里是看不到的。

---

*本文基于 `main` 分支 commit `8f23783`（2026-10-28）的源码逐文件核对整理。仓库内另有一份 2026-10-22 的旧版说明，其中"主题色 #49b1f5""搜索页是 mock 数据玩具""404 指向 pc.html 死链"等描述已与当前代码不符，请以本文为准。*
