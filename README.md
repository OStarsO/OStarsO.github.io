# OStarsO.github.io

> 一个托管在 GitHub Pages 上的个人趣味站点：全屏星空入口层 + 个人主页 + 22 款网页小游戏 + 星空搜索 + GitHub 项目墙。
> 本文从代码与工程角度拆解它的结构、技术选型与实现细节，全部依据 `main` 分支真实代码整理（截至 2026-10-22）。

| 项 | 值 |
|---|---|
| 仓库 | <https://github.com/OStarsO/OStarsO.github.io> |
| 线上地址 | <https://ostarso.github.io> |
| 创建时间 | 2023-05-21 |
| GitHub 标注主语言 | JavaScript |
| 部署方式 | GitHub Pages，`main` 分支直推即上线 |
| 构建流程 | 无（零构建、零后端、零 CI） |
| License | MIT（2026-10-19 补加） |
| 仓库体积 | 约 41 MB（小游戏资源占大头） |

---

## 整体架构：一个"三无"静态站

整个仓库可以用三个"无"概括：**无后端、无构建、无包管理器**。没有 `package.json`（仅 pacman 子目录里躺着一个孤岛）、没有 `node_modules`、没有 CI 配置，所有页面都是"扔上去就能跑"的 HTML/CSS/JS，靠 GitHub Pages 直接发布。

组织方式是**目录即路由**，每个栏目一个中文目录，各自携带完整的 `index.html` 与资源：

```text
OStarsO.github.io/
├── index.html            # 入口引导层：星空动画 + iframe 装载主页（约 630 行）
├── Introduction.html     # 个人主页（83 KB，被 index.html 以 iframe 嵌入）
├── css/index.css         # 主页手写样式（Butterfly 风格，#49b1f5 主题色 + card-widget）
├── 小游戏/               # 小游戏大厅：22 款游戏入口 + 约 25 个游戏目录/单文件
├── 搜索/                 # ST导航 · 星空搜索页（零依赖单文件）
├── github墙/             # GitHub 项目墙（3D  tilt 卡片）
├── 404.html / beian.html # 自定义 404 / 备案调侃页
├── favicon.ico / OStarsO.jpg / server-icon.png / ip.json
├── README.md / LICENSE
```

值得一提的是入口层的**分层设计**：`index.html` 本身不承载内容，而是一个全屏的"加载舞台"——Canvas 星空背景 + 一个缩放的 `iframe`，加载完成后通过 CSS transform 把 `Introduction.html` "推"到全屏。这种"引导页包装内容页"的模式，相当于用不到 50 行 JS 实现了一个轻量级 SPA 过渡效果。

---
# AI解析
## 一、入口层 `index.html`：全仓库技术含量最高的单文件

如果只读一个文件来理解这个站，读 `index.html`。它不是普通首页，而是一套完整的"入场仪式"编排。

### 1. Canvas 星空：手写的透视投影粒子系统

```js
var FOV = 520, FAR = 1400, SPEED = 10, COUNT = 340;
// 每颗星在 (x, y, z) 三维空间中，z 逐帧递减（朝观察者飞来）
var k = FOV / s.z;              // 透视缩放因子
var sx = CX + s.x * k;          // 投影到屏幕坐标
```

工程细节全部到位：

- **帧率无关动画**：`dt / 16.667` 归一化每帧位移，且 `dt` 封顶 120ms——切后台回来不会"瞬移"；
- **DPR 适配**：`Math.min(window.devicePixelRatio || 1, 2)` 截断到 2，高分屏不糊也不过渲染；
- **拖尾效果**：不清屏，每帧用半透明底色 `rgba(4, 6, 12, 0.42)` 覆盖，星星自然拉出尾迹；
- **越界回收**：飞出屏幕或 `z <= 14` 时重新 `spawn`，粒子数恒定，无 GC 压力。

### 2. iframe 加载编排：把"等待"做成了体验

- iframe `load` 后补足 `MIN_SHOW = 1900ms` 最短展示时间，避免动画一闪而过的廉价感；
- 20 秒硬超时兜底（`hardTimer`），内容页再慢也能强制进入；
- 入场分三段：`scale(0.28) → 1.06 → 1`，配合 `cubic-bezier(0.22, 0.9, 0.28, 1)` 缓动，圆角与阴影渐变淡出；
- 完成后弹出"本次加载耗时 x.x 秒"toast，4 秒自动隐藏；
- 遮罩层 `.veil`（径向渐变暗纱 + scanline 扫描线）拦截点击/touch，弹出"网页正在努力加载中"并实时刷新已等待秒数——把用户的焦虑接住了。

### 3. 环境探测与降级链

- **设备/浏览器**：CDN 引入 `ua-parser-js@2.0.9`（锁了版本），解析设备类型、厂商、型号与浏览器主版本，渲染在顶部信息栏；
- **IP/地区**：主用 `ipwho.is`，失败自动降级 `ip-api.com`，再失败显示"获取失败"——典型的 fetch 降级链；
- **响应式**：≤600px 时信息栏只保留核心信息（隐藏 label）。

---

## 二、`Introduction.html`：博客主题皮 + 整活合集

真正的内容页能看出站长的审美来源——布局、`card-widget` 卡片体系、`#49b1f5` 主题色、页脚版权，都是 Hexo **Butterfly** 主题的经典结构，属于"拿博客主题的皮，填个人主页的瓤"。

**外部依赖清单**（CDN 拼装路线）：

| 依赖 | 用途 | 版本锁定 |
|---|---|---|
| jQuery 3.4.1 | DOM 操作 / 雪花等 | 锁 |
| FontAwesome 4.7.0 | 图标 | 锁 |
| instant.page 3.0.0 | 链接预加载 | 锁 |
| busuanzi | 访客统计 | 未锁 |
| hitokoto | 一言 | 未锁 |
| 今日诗词 SDK | 诗词 | 未锁 |
| honjun CDN 光标 | 自定义鼠标指针 | 未锁 |

**内容与彩蛋**：

- **技能条**：Python 20% / 我的世界开服 80% / HTML 40% / JavaScript 5% / AI 40% / 摄影 40%——js 5% 非常诚实，也解释了为什么核心栏目在往"零依赖原生"转；
- **控制台彩蛋**：ASCII 艺术签名、"已安全运行 N 天"（从 2023-05-21 起算）、冷笑话 API（失败时回退到 "Oct 31 == Dec 25" 程序员梗）、以及一个"安全警告"钓鱼式彩蛋——提示不要粘贴代码，同时邀请你在控制台输入 `OStarsO.hack()`，触发星空爆闪；
- **标题把戏**：`visibilitychange` 监听，切走标签页标题变"点我"，回来变"当我没说 …"，2 秒后恢复；
- **3D 倾斜卡片**：纯 CSS `translateZ` + `perspective` 实现的视差卡片；
- **自定义右键菜单**：手写 ctxMenu + toast，替代浏览器默认菜单。

---

## 三、`小游戏/`：22 款游戏的"陈列柜"组织法

核心板块。当前 `小游戏/index.html`（53 KB）是 2026 年重写的**零依赖单文件**，手写 CSS + 原生 JS，没有任何 CDN。

### 大厅页面的实现亮点

- **`Starfield3D` class**：280 颗星的粒子系统，含透视投影、闪烁（`twinkleSpeed/twinkleOffset`）、色相偏移（`hueShift`）、焦距/速度插值，resize 时按 `star.z / zFar` 比例平移星星保持视差连续；
- **CSS Grid 卡片宫格**：`repeat(auto-fit, minmax(220px, 1fr))` 自适应，400px/768px 两档响应式断点；
- **点击星爆过渡**：点击卡片先播放 CSS 变量（`--dx/--dy`）驱动的 28 颗粒子飞散，再显示"量子过渡层"（进度条 + "正在建立量子连接..."），最后才跳转；
- **目标存活探测**（最实用的一处）：跳转前用 `fetch(url, { method: 'HEAD' })` 检测目标页面是否存在，配合 `AbortController` + `Promise.race` 超时判定，失败则播放错误动画并提供重试——因为游戏入口里混着单文件（`猜数字.html`）和目录（`2048/`），还有大厅自己标注"入口缺失"的（股大爷），这种"跳转前体检"很贴心；
- **完整的复位逻辑**：`resetAllState()` 统一清理定时器、abort 请求、恢复动画状态，防止连点导致的状态错乱。

### 游戏清单（22 个入口）

经典复刻：2048、吃豆人、五子棋、推箱子（100 关地图）、国际象棋（bot 公测）、消消乐、打方块、贪吃蛇；
敏捷/手速：水果忍者、切方块、盖塔楼、跑酷、赛车、球跑者（摸鱼版）；
休闲/整活：石头剪刀布、猜数字、翻牌消除、今天吃什么、电脑蓝屏模拟器、st方棋动物游戏、趣味闯关；
另有 2 个大厅未收录的"孤儿"：`画画/`（一个相当完整的网页版画图，含 FileSaver、gif.js worker、imgur 上传）和 `逗猫.html`。

### 一个意外的收获：小游戏目录是"前端历史博物馆"

逐个翻子目录能看到完整的技术断代史：

- `2048/`：ES5 时代遗产——`animframe_polyfill`、`bind_polyfill`、`classlist_polyfill`，还有 `Rakefile`；
- `pacman/`：`cache.manifest`（HTML5 AppCache，已被标准淘汰）、`data/db-handler.php`（PHP 后端，在 Pages 上等于死代码）、`ads.txt`、`googlee6aee5a894225e60.html`（Google 站点验证）、孤岛 `package-lock.json`；
- `赛车游戏/`：`v1.straight.html → v2.curves.html → v3.hills.html → v4.final.html` 四个迭代版本全部保留，基本是跟着 Jake Gordon 的赛车游戏教程一步步敲的，连 `stats.js`（mrdoob 的 FPS 监视器）都在；
- `球跑者/`：`src/scripts/modules/main.ts` TypeScript 源码 + `main.min.js` 构建产物，是全站唯一出现"编译"痕迹的地方；
- `画画/`：还引着 `firebase.js`（旧版 SDK）和 `FontList.swf`（Flash 时代的残留）。

这些"文物"本身不影响运行，但很直观地展示了站长（以及很多前端爱好者）从"拷模板"到"写代码"的完整轨迹。

---

## 四、`搜索/`：ST导航，唯一带"现代工程味"的子站

`搜索/index.html`（23 KB）同样零依赖，但手法比入口层更现代：

- **800 颗星的三态粒子引擎**：`idle → prepare → warp` 三档速度（0.5 / 4 / 60），聚焦输入框加速、搜索时跃迁，warp 态降低清屏透明度拉出长尾迹；
- **`backdrop-filter` 毛玻璃 UI**：`blur(16px) saturate(180%)`；
- **Web Animations API 流星砸卡片**：搜索结果不是直接显示，而是用 `element.animate()` 发射小流星依次"砸"中卡片位置，每张卡片错开 180ms；
- **按时段问候语**："夜深了/早上好/中午好/下午好/晚上好，现在是 HH:MM"；
- **快搜入口**：哔哩哔哩 / 知乎 / 微博 / GitHub / 豆瓣。

需要说明的是：结果卡片是**本地生成的 mock 数据**（标题拼上 query，描述是写死的模板文案），部分链接指向 `news.example.com`、`download.example.com` 这类占位域名——它更接近一个"搜索主题的玩具页"，而不是可用搜索引擎。好处是纯前端零请求，坏处是搜索结果没有真实意义。

---

## 五、`github墙/`：3D 倾斜项目卡片

2026 年 10 月新增的栏目。用手写 CSS 3D（`transform-style: preserve-3d` + 每层独立 `--z` 深度变量 +  glare 高光层）把站长的 GitHub 仓库做成倾斜卡片墙，鼠标移动时有视差。内容是**静态手写**的（OStarsO.github.io、bet-lite、HoloISO-China、Hit-the-squares、Entertainment、Snakes 等），没有调 GitHub API——好处是零请求、不会挂，代价是新增仓库要手动改 HTML。

---

## 六、部署与运维

- **发布流程**：本地改文件 → `git push` → GitHub Pages 自动部署。没有 CI/CD，没有预览环境，`main` 即生产；
- **可观测性**：不蒜子访客统计 + 站内自建的加载耗时 toast（把性能数据直接亮给访客，态度很站长）；
- **备案**：`beian.html` 一句"这网站不用备案的你不知道？不知道就算了！滚！"带过；
- **`ip.json` 之谜**：根目录这个文件内容是 `_github-pages-challenge-OStarsO` 的 TXT 记录——这是 GitHub Pages 绑定**自定义域名**时的 ACME 挑战文件。站点现在用的是默认域名，它是一次自定义域名尝试的残留文物。

---

## 七、开发者评论：亮点与可改进点

**亮点**

1. 入口层的动画编排（三段缩放、最短展示时间、硬超时、veil 拦截）超出"个人玩具站"的平均水准；
2. 两个核心栏目（小游戏、搜索）重写为**零依赖单文件**，可移植性极强——拷走一个 html 到任何静态托管都能跑；
3. 动画实现专业：帧率归一化、DPR 适配、粒子回收、`AbortController` + `Promise.race`，都是对的做法；
4. "跳转前 HEAD 探测"解决了一个真实痛点（单文件/目录混合入口的 404）；
5. 全站零构建零依赖锁定（对核心栏目而言），clone 下来十年后照样能跑。

**可改进点**

1. **`404.html` 有死链**："返回首页"指向 `pc.html`，但该文件已改名为 `Introduction.html`，点了直接二段 404；
2. **大厅与目录不同步**：`画画/`、`逗猫.html`、`colorblock/` 存在但未收录；`股大爷/` 目录里只有 `start.html` 没有 `index.html`，大厅已自曝"入口缺失"；
3. **README 与代码已脱节**：仓库 README 还在描述已删除的"网页导航"栏目、已重写的 RequireJS 版搜索页、以及主页上并不存在的 typed.js/雪花/百度统计——建议以代码为准；
4. **CDN 依赖版本管理不统一**：jQuery 3.4.1、FontAwesome 4.7.0 偏旧且长期未升；busuanzi、一言、诗词 SDK 未锁版本，上游漂移可能导致静默白屏；
5. **搜索页 mock 数据的占位链接**（`*.example.com`）建议清理或改成真实可用的目标；
6. **中文目录名的双刃剑**：`小游戏/`、`搜索/` 在 URL 中需要 percent-encoding（`%E5%B0%8F%E6%B8%B8%E6%88%8F`），分享链接长且易错，部分工具链处理也不友好；
7. **可加一道自动化**：GitHub Actions 定时 `curl` 各栏目做存活检查（lychee 之类），站内互链很多，手维护容易断；
8. **技能自评 js 5% 但游戏全是 JS**——建议站长重估这项（笑）。

---

## 八、本地运行

无需任何安装，任选其一：

```bash
# 方式 1：Python
git clone https://github.com/OStarsO/OStarsO.github.io.git
cd OStarsO.github.io
python -m http.server 8000

# 方式 2：Node
npx serve .
```

访问 <http://localhost:8000>，入口动画 → 个人主页 → 小游戏/搜索全链路可体验。直接双击 `index.html`（file:// 协议）也能跑，但小游戏大厅的 HEAD 探测在 file:// 下会失败，建议起本地服务器。

栏目直达：

| 栏目 | 地址 |
|---|---|
| 入口/个人主页 | <https://ostarso.github.io/> |
| 小游戏大厅 | <https://ostarso.github.io/%E5%B0%8F%E6%B8%B8%E6%88%8F/> |
| ST搜索 | <https://ostarso.github.io/%E6%90%9C%E7%B4%A2/> |
| 项目墙 | <https://ostarso.github.io/github%E5%A2%99/> |

---

## 九、一句话总结

OStarsO.github.io 是一个典型的"野生"个人站样本：入口层用 Canvas 和动画堆出仪式感，核心栏目用零依赖原生代码保证轻巧，个人主页用 CDN 小部件堆出趣味性，小游戏目录里还藏着一座前端历史博物馆——它展示的是一个前端爱好者从"拼模板"走向"手写引擎"的完整技术轨迹。

*本文依据 GitHub 仓库公开代码整理，信息截至 2026-10-22。*
