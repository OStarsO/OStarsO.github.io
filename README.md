# OStarsO.github.io

> 一个托管在 GitHub Pages 上的个人趣味站点：小游戏门户 + 星空搜索 + 个人主页引导层。
> 本文从代码与工程角度拆解它的结构、技术栈与实现亮点。
> 信息依据 `main` 分支整理，截至 2026-10-21。

| 项 | 值 |
|---|---|
| 仓库 | <https://github.com/OStarsO/OStarsO.github.io> |
| 线上地址 | <https://ostarso.github.io> |
| 创建时间 | 2023-05-21 |
| GitHub 标注主语言 | JavaScript |
| 托管方式 | GitHub Pages，纯静态，无构建流程 |
| 最近活跃 | 2026-10（首页与两个核心栏目均有更新） |

---

## 一、整体架构：一个"三无"静态站

整个仓库可以用三个"无"概括：**无后端、无构建、无包管理器**。没有 `package.json`、没有 `node_modules`、没有 CI 配置，所有页面都是"扔上去就能跑"的 HTML/CSS/JS，靠 GitHub Pages 直接发布。

架构上采用**目录即路由**的组织方式，每个栏目一个中文目录，各自携带完整的 `index.html` 与资源：

```text
OStarsO.github.io/
├── index.html            # 入口引导层（星空动画 + iframe 嵌入主页）
├── Introduction.html     # 个人主页（被 index.html 以 iframe 装载）
├── css/
│   └── index.css         # 主页手写样式
├── 小游戏/                # 小游戏门户（23 款入口）
├── 搜索/                  # ST导航 · 星空搜索页
├── 网页导航/              # 网址导航（当前维护中）
├── 404.html / beian.html  # 自定义错误页 / 备案调侃页
├── favicon.ico / OStarsO.jpg / server-icon.png / ip.json
├── github墙/             # 新增栏目（2026-10）
├── README.md / LICENSE
```

值得一提的是入口层的**分层设计**：`index.html` 本身不承载内容，而是一个全屏的"加载舞台"——Canvas 星空背景 + 一个缩放的 `iframe`，页面加载完成后通过 CSS transform 动画把 `Introduction.html` "推"到全屏。这种"引导页包装内容页"的模式在纯静态站点里算是一个轻量级的 SPA 过渡效果替代方案。

---

## 二、各页面技术栈明细

| 页面 | 实现方式 | 外部依赖 |
|---|---|---|
| `index.html` 入口引导层 | 原生 JS + Canvas 2D + CSS transform 动画 | UAParser.js（jsdelivr，锁版本 `@2.0.9`） |
| `Introduction.html` 个人主页 | 类 Hexo Butterfly 主题风格的手写布局 | typed.js、jQuery、busuanzi、instant.page、hitokoto、今日诗词 SDK、FontAwesome、讯飞音乐播放器、百度统计 |
| `css/index.css` | 手写 CSS，Butterfly 风格的 `#49b1f5` 主题色、`card-widget` 卡片体系 | 无 |
| `小游戏/` 门户 | 零依赖单文件：手写 CSS（Grid + 动画 + CSS 变量）+ 原生 JS | **零**（无 CDN、无框架） |
| `搜索/` 星空搜索 | 零依赖单文件：约 500 行内联 CSS + 约 200 行原生 JS | **零** |

一个有意思的现象：站点呈现**两种并存的工程风格**——入口层和个人主页走"CDN 小部件拼装"路线（统计、一言、诗词、音乐播放器说加就加）；而 2026 年 10 月重写的两个核心栏目（小游戏、搜索）则彻底转向"零依赖原生实现"。后者显然更能代表站长现在的技术偏好。

---

## 三、亮点实现解读（代码级）

### 1. 入口页的 3D 星空：教科书式的 Canvas 粒子

`index.html` 里的星空不是随机抖动的小白点，而是一个真正的**透视投影粒子系统**：

```js
var FOV = 520, FAR = 1400, SPEED = 10, COUNT = 340;
// 每颗星在 (x, y, z) 三维空间中，z 逐帧递减（朝观察者飞来）
var k = FOV / s.z;                    // 透视缩放因子
var sx = CX + s.x * k;                // 投影到屏幕坐标
var sy = CY + s.y * k;
```

几个值得学习的工程细节：

- **帧率无关动画**：用 `dt / 16.667` 归一化每帧位移，高刷屏和低帧机表现一致；
- **DPR 适配**：`canvas.width = W * devicePixelRatio`（上限锁 2），高分屏不糊；
- **拖尾效果**：不清屏，每帧用半透明底色 `rgba(4,6,12,0.42)` 覆盖，星星自然拉出尾迹；
- **越界回收**：星星飞出屏幕或 `z <= 14` 时重新 `spawn`，粒子数恒定，无 GC 压力。

### 2. iframe 缩放揭示 + 加载 veil

入口页把 `Introduction.html` 装进一个 `scale(0.28)` 的 `iframe` 容器，加载完成后：

1. `iframe` 的 `load` 事件触发，先保证最短展示时长（`MIN_SHOW`），避免动画闪没；
2. 通过 `cubic-bezier(0.22, 0.9, 0.28, 1)` 曲线把容器放大到 100vw/100vh；
3. 盖在页面上的 `veil`（径向渐变暗纱 + scanline 扫描线）淡出并让出点击事件；
4. 弹出"本次加载耗时 X 秒"toast，4 秒后自动隐藏。

一套完整的"加载仪式感"流程，全部用 CSS transition + 少量 JS 状态类完成。

### 3. 小游戏门户：带可用性检测的科幻导航

`小游戏/index.html` 是站长近期重写的页面，技术含量最高：

- **Canvas 3D 星空背景**：`Starfield3D` class 组织粒子逻辑，含投影、拖尾、光晕、十字星芒；
- **点击星爆过渡**：点击卡片先播放 CSS 变量（`--dx/--dy`）驱动的粒子飞散动画，再显示"量子过渡层"，最后才跳转；
- **目标存活探测**：跳转前用 `fetch(url, { method: 'HEAD' })` 检测目标页面是否存在，配合 `AbortController` 和 `Promise.race`（5 秒超时判定连接失败），失败则播放错误动画并回退——因为游戏入口里混着单文件（`猜数字.html`）和目录（`2048/`），这种"跳转前体检"很实用；
- **CSS Grid 卡片宫格**：`repeat(auto-fit, minmax(220px, 1fr))` 自适应布局，400px/768px 两档响应式断点。

### 4. 星空搜索页

`搜索/index.html`（ST导航）同样零依赖：800 颗星的 Canvas 粒子背景、`backdrop-filter` 毛玻璃 UI、Web Animations API（`element.animate()`）实现流星砸卡片的飞行动画，内置搜索历史与快搜（百科/视频/豆瓣/微博/知乎/小说/新闻）。

### 5. 个人主页的"整活"细节

`Introduction.html` 虽然依赖拼装，但彩蛋不少：Typed.js 轮播欢迎语、切标签页时 `document.title` 变成"点我"、回来时变成"当我没说"、jQuery 雪花插件（`$.fn.snow`，可配置密度/大小/颜色）、鼠标点击涟漪、讯飞浮空音乐播放器。这类代码体现了个人站的"玩"属性。

---

## 四、AI的观察与建议

**做得好的地方**

- 两个核心栏目重写为**零依赖单文件**，可移植性极强——拷走一个 html 到任何静态托管都能跑；
- 动画实现专业：帧率归一化、DPR 适配、粒子回收，都是对的做法；
- 现代 API 使用熟练：`AbortController`、`Promise.race`、Web Animations API、`backdrop-filter`；
- 移动端适配意识（viewport、响应式断点、小屏信息栏降级）。

**可以改进的地方**

1. **README 与代码已不同步**：README 描述搜索页使用 RequireJS / Service Worker / night.css，但当前 `搜索/` 目录只有一个零依赖的 `index.html`；README 还说首页是"系统维护中"，实际首页已改为引导层。建议以代码为准更新 README。
2. **CDN 依赖版本管理不统一**：有的锁了版本（`ua-parser-js@2.0.9`、`typed.js@2.0.11`），有的没有（busuanzi、音乐播放器）。建议统一锁定，避免上游漂移导致站点莫名白屏。
3. **第三方脚本偏多**：百度统计、busuanzi、一言、诗词 SDK、音乐播放器全堆在主页，对首屏速度和访客隐私都不算友好，可考虑按需加载或自建替代。
4. **中文目录名的双刃剑**：`小游戏/`、`搜索/` 这类目录在 URL 中需要 percent-encoding（`%E5%B0%8F%E6%B8%B8%E6%88%8F`），分享链接长且易错，部分工具链处理也不好。功能上没问题，但如果有 SEO 或分享诉求可以考虑英文目录 + 中文标题。
5. **可加一道自动化**：比如 GitHub Actions 定时 `curl` 各栏目做存活检查，或链接检查（lychee）——站内互相引用的链接很多，手维护容易断。

---

## 五、本地运行

无需任何安装，任选其一：

```bash
# 方式 1：Python
git clone https://github.com/OStarsO/OStarsO.github.io.git
cd OStarsO.github.io
python -m http.server 8000

# 方式 2：Node
npx serve .

# 方式 3：VS Code Live Server 插件直接打开 index.html
```

访问 <http://localhost:8000> 即可，入口动画 → 个人主页 → 小游戏/搜索全链路可体验。直接双击 `index.html`（file:// 协议）也能跑，但部分 fetch 探测类功能在 file:// 下可能受限，建议起本地服务器。

栏目直达：

| 栏目 | 地址 |
|---|---|
| 入口/个人主页 | <https://ostarso.github.io/> |
| 小游戏大厅 | <https://ostarso.github.io/%E5%B0%8F%E6%B8%B8%E6%88%8F/> |
| ST搜索 | <https://ostarso.github.io/%E6%90%9C%E7%B4%A2/> |
| 网页导航 | <https://ostarso.github.io/%E7%BD%91%E9%A1%B5%E5%AF%BC%E8%88%AA/>（维护中） |

---

## 六、一句话总结

OStarsO.github.io 是一个典型的"野生"个人站样本：入口层用 Canvas 和动画堆出仪式感，核心栏目用零依赖原生代码保证轻巧，个人主页用 CDN 小部件堆出趣味性——没有构建工具的束缚，也几乎没有工程约束，展示的是一个前端爱好者从"拼装"走向"手写"的完整技术轨迹。
