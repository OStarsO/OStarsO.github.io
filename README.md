# OStarsO.github.io

> 一个托管在 GitHub Pages 上的个人趣味站点：小游戏合集 + 搜索导航 + 各种前端小实验。
> 本文从代码与工程角度拆解它的结构、技术选型与实现细节。

| 项目 | 信息 |
| --- | --- |
| 线上地址 | <https://ostarso.github.io> |
| 仓库地址 | <https://github.com/OStarsO/OStarsO.github.io> |
| 创建时间 | 2023-05-21 |
| 部署方式 | GitHub Pages（`main` 分支直推即上线） |
| 技术栈 | 原生 HTML / CSS / JavaScript（主要语言 JavaScript） |
| 构建流程 | 无。零构建、零后端、零 CI，push 即发布 |
| License | 已添加 LICENSE（2026-10-19） |

---

## 一、整体架构：一个「没有框架」的静态站

整个仓库就是一个典型的 GitHub Pages 用户站点（`<username>.github.io`），没有任何 `package.json`、没有打包工具、没有服务端代码。所有能力由三类东西拼出来：

1. **手写的原生 HTML/CSS/JS**——站点的骨架和大部分逻辑；
2. **CDN 引入的第三方库**——jQuery、Typed.js、UAParser.js、Font Awesome、instant.page 等；
3. **第三方免费服务**——一言、今日诗词、不蒜子访问统计、IP 地理查询、讯飞音乐播放器等。

这种「复古」选型本身就是一种工程立场：**用最低的维护成本换最快的上线速度**。对个人站点来说，这是非常务实的选择——没有依赖升级地狱，没有构建挂掉的凌晨，GitHub 挂了站才挂。

### 目录结构

```text
OStarsO.github.io/
├── index.html              # 首页：全屏「加载门户」动画（iframe 嵌入 Introduction.html）
├── Introduction.html       # 真正的「关于/主页」内容页
├── 404.html                # 自定义 404
├── beian.html              # 备案调侃页（「这网站不用备案的你不知道？」）
├── api.css / api.js        # 维护页样式与打字机动画
├── ip.json                 # IP 相关静态数据
├── favicon.ico / OStarsO.jpg / server-icon.png
├── 小游戏/                 # 核心板块：约 25 款网页小游戏 + 工具
│   ├── index.html          # 游戏大厅（HTML5 UP Phantom 模板 + jQuery）
│   ├── 2048/ pacman/ 五子棋/ 推箱子/ 国际象棋/ 消消乐/ ...
│   └── 切方块.html 猜数字.html 盖塔楼.html 逗猫.html ...
├── 搜索/                   # 「ST导航」v1.50 搜索起始页（RequireJS + Service Worker）
├── 网页导航/               # 网址导航栏目（当前维护中）
├── 测试/                   # 站长的前端实验田
└── github墙/               # 装饰性目录
```

## 二、代码走读：首页加载器（index.html）是这个仓库技术含量最高的文件

如果只读一个文件来理解这个站，读 `index.html`。它不是一个普通的首页，而是一个**全屏加载动画壳**：用 iframe 把真正的内容页（`Introduction.html`）嵌进来，外加一层电影级的入场编排。几个实现细节很有「开发者味」：

### 1. Canvas 星空：手写的 3D 投影动画

约 340 个白色像素点，用 `FOV / z` 做透视投影，让星星从远处朝观察者飞来，配合半透明底色填充（`rgba(4,6,12,0.42)`）做出拖影。没有引入任何动画库，原生 `requestAnimationFrame` + 简易粒子结构，代码不到 100 行。工程细节也到位：

- `devicePixelRatio` 截断到 2（`Math.min(window.devicePixelRatio || 1, 2)`），避免高分屏过度渲染；
- 帧间隔 `dt` 做了 120ms 封顶，切后台回来不会「瞬移」；
- 星星飞出屏幕或 `z <= 14` 时回收复用，无 GC 压力。

### 2. iframe 加载编排：把「等待」做成了体验

- iframe `load` 事件触发后，还要补足 `MIN_SHOW = 1900ms` 的最短展示时间——避免动画一闪而过的廉价感；
- 有 20 秒硬超时兜底（`hardTimer`），内容页再慢也能强制进入；
- 入场动画分三段编排：`scale(0.28) → 1.06 → 1`，配合 `cubic-bezier(0.22, 0.9, 0.28, 1)` 缓动、圆角与阴影的渐变淡出，最后 toast 显示「本次加载耗时 x.x 秒」；
- 遮罩层 `.veil` 拦截点击/touch，弹出「网页正在努力加载中」提示并实时刷新已等待秒数——把用户的焦虑接住了。

### 3. 环境探测与降级链

- **设备/浏览器**：CDN 引入 `ua-parser-js@2.0.9`，解析出设备类型、厂商、型号和浏览器主版本号，渲染在顶部信息栏（移动端通过媒体查询只保留核心信息）；
- **IP/地区**：主用 `ipwho.is`，失败自动降级 `ip-api.com`，再失败显示「获取失败」——典型的 fetch 降级链写法；
- **兼容性彩蛋**：检测到 IE 直接 `alert('朋友，上古浏览器不支持呢~')`。

## 三、Introduction.html：一个「博客主题残留」+ 整活合集

真正的内容页能看出站长的审美来源——布局、卡片组件（`card-widget`）、技能条、页脚版权，都是 Hexo **Butterfly** 主题的经典结构，可以理解为「拿博客主题的皮，填个人主页的瓤」：

- **技能条**：python 20% / 我的世界开服 80% / html 40% / js 5% / AI 40% / 摄影 50%——js 5% 非常诚实，也解释了为什么全站几乎不用框架；
- **第三方内容**：一言（hitokoto）、今日诗词（jinrishici SDK）、不蒜子（busuanzi）访客统计；
- **整活代码**：
  - `visibilitychange` 监听：切走标签页标题变「点我」，回来变「当我没说…」，2 秒后恢复；
  - jQuery 雪花插件，`newOn: 800` 控制密度；
  - `console.log` 里藏了句「有朋自远方来，不亦说乎。」；
- **性能与预取**：`instant.page` 链接预加载、`typed.js` 打字机标题轮播。

## 四、小游戏大厅：25+ 游戏的「陈列柜」组织法

核心板块 `小游戏/` 用 **HTML5 UP 的 Phantom 模板**（`assets/css/main.css` + jQuery）做大厅首页，以按钮宫格罗列全部游戏，每个游戏一个独立子目录或单文件 HTML：

- **经典复刻**：2048、吃豆人、贪吃蛇、五子棋、推箱子、国际象棋（带 bot 公测）、消消乐、打方块；
- **敏捷/手速**：水果忍者、切方块、盖塔楼、跑酷、赛车、球跑者；
- **休闲/整活**：石头剪刀布、猜数字、翻牌消除、今天吃什么、电脑蓝屏模拟器、逗猫、画画、股大爷；
- **工具向**：密码安全度检测（标注公测）。

每个游戏完全独立、自包含（HTML + CSS + JS 塞在一个目录里），这种「目录即游戏」的组织方式复制粘贴即可上线，维护成本极低，也方便逐个迭代。

## 五、搜索页「ST导航」：唯一带现代工程实践的子站

`搜索/` 目录虽然目前只有一个 `index.html`，但按仓库 README 描述，它是站内技术味最浓的模块（v1.50）：

- **RequireJS** 做 JS 模块化加载；
- **Service Worker（`sw.js`）** 实现离线缓存——静态站做 PWA 化的标准姿势；
- **夜间模式**独立 `night.css`；
- 功能上有搜索历史、搜索建议、快搜（百科/视频/豆瓣/微博/知乎/小说/新闻）、网址输入快捷后缀栏。

## 六、部署与运维：GitHub Pages 全家桶

- **发布流程**：本地改文件 → `git push` → GitHub Pages 自动部署。没有 CI/CD，没有预览环境，main 即生产；
- **可观测性**：接入 UptimeRobot 状态页、`count.getloli.com` 访问计数器、百度统计（`hm.baidu.com`）、不蒜子；
- **备案**：用 `beian.html` 一句调侃带过，态度很站长；
- **README 头图**：capsule-render 动态生成，GitHub 门面工程。

## 七、开发者评论：亮点与可改进点

**亮点**

- 首页加载器的动画编排和降级链（双 IP API、最短展示时间、硬超时）超出了「个人玩具站」的平均水准；
- 全站零构建零依赖锁定，十年后 clone 下来照样能跑；
- 「测试/」实验田 + 「目录即游戏」的组织，是非常健康的个人项目迭代节奏。

**可改进点**

- **无版本锁定**：CDN 依赖（jQuery、UAParser 等）浮动版本，上游发布 breaking change 时站点会无声挂掉；
- **无 README 级文档**：仓库 README 只有头图和计数器，新人（包括三个月后的自己）上手全靠翻源码；
- **首页 iframe 全屏壳**：对 SEO 和首屏性能都不友好，内容页完全靠 `Introduction.html` 单打独斗；
- **中文目录名**：`小游戏/`、`搜索/` 在跨平台、CI 脚本、部分工具链下容易踩编码坑；
- **技能自评 js 5% 但游戏全是 JS**——建议站长重估这项（笑）。

## 八、本地运行

无需任何安装，任选其一：

```bash
# 方式 1：直接在浏览器打开
start https://ostarso.github.io

# 方式 2：clone 后本地起静态服务
git clone https://github.com/OStarsO/OStarsO.github.io.git
cd OStarsO.github.io
python -m http.server 8000
# 访问 http://localhost:8000
```

---

*本文依据 GitHub 仓库公开代码整理，信息截至 2026-10-21。*
