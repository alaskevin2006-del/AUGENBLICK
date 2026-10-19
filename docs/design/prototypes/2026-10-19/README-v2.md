# 精简版原型 v2

用户修正：只显示必要信息，减少背景和宣传文字；不添加没有对应需求或功能的页面。此规则优先于首版原型中自行增加的栏目与文案。首版仅留存对照，不作为实现要求。

- 开发者独立页面：课程上传、课程名称、发布状态、试学、发布。
- 用户选择课程：已发布课程、必要课程信息、加入我的课程。
- 用户我的课程：已加入课程、学习与测试入口。
- 移除首版素材库、预览记录、设置、宣传区域、装饰图片、虚构统计与未确认的进度/历史栏目。
- 草稿不对普通用户可见；开发者试学不改变用户正式学习记录。

v2 图片：01-developer-studio-v2.png、02-select-courses-v2.png、03-my-courses-v2.png。内置 image_gen 编辑生成，静态原型，尚未上线。生成图片中的尺寸差异不构成额外需求，实现时统一顶栏、字号和间距。

## 本次提示词

### 1

Edit the supplied AUGENBLICK developer prototype into a radically simpler FUNCTIONAL desktop UI screenshot. User explicitly rejects decorative backgrounds, marketing copy, and invented pages. Keep only solid dark forest green, muted gold small action buttons, ivory text; use clean compact sans-serif Chinese typography. Remove ALL illustrations, photos, textures, gradients, oversized title, promotional subtitle, decorative monogram, entire sidebar, right preview panel, all metrics and invented validation checklists. No 素材库, 预览记录, 设置, 工作台 navigation. Single compact header: AUGENBLICK | 开发者, right Kevin and 退出登录. Main title 课程管理 small and functional, right 上传课程. A simple full-width course table with just columns 课程, 状态, 操作. Two rows only: 基础词汇（演示） with status 未发布 and actions 试学, 发布; 示例课程 with status 已发布 and action 试学. No edit button, no more menu, no dates, no version numbers, no additional features, no search, no filters. Below table ONE quiet necessary sentence: 未发布课程仅开发者可见，试学不计入用户记录。 Bottom tiny 原型示意. Balanced whitespace around a compact work area, no need to fill screen with content. Flat professional screen in landscape 16:10. Preserve only brand palette, redesign arrangement completely. This is the developer's own page, no student navigation.

### 2

Edit supplied AUGENBLICK learner discovery prototype into a radically simplified FUNCTIONAL desktop UI screenshot. User rejects backgrounds, decorative cover art, marketing copy, and unrequested pages/features. Remove ALL photos, illustrations, hero, slogans, promotional text, categories, levels, filters, search, stats, badges, decorative monogram. Solid dark forest green #071a13 background with subtly lighter flat green containers, restrained muted gold actions, ivory text. Compact clean sans-serif Chinese typography, not grand serif headings. Header AUGENBLICK left, exactly two learner tabs 选择课程 (active), 我的课程; right Kevin / 退出登录. Main title 选择课程. Only one necessary course tile on left, compact rectangle without image: title 基础词汇（演示）, one small metadata line 中文 · 5 个对象, primary small button 加入我的课程. No more panels or features, no developer controls, no pricing, no course-detail page link, no arbitrary catalog data, no onboarding or recommendation section. Fill remainder with quiet plain solid space. Bottom tiny 原型示意. Landscape 16:10 desktop screenshot. Restrained utilitarian course selection screen, legible proportions, no giant type. Match minimal developer screen palette.

### 3

Edit supplied AUGENBLICK personal learning library prototype into a radically simplified FUNCTIONAL desktop UI screenshot. User explicitly asks only necessary information and forbids unrequested pages/features. Remove every image, illustration, decorative background, hero, marketing sentence, stat, percentage bar, status-filter tabs, search, completion dates, learning-record links, decorative monogram, and invented modules. Use solid dark forest green #071a13 and simple flat slightly lighter forest panel, thin muted borders, small muted gold buttons, ivory text, compact clean sans-serif Chinese. Header AUGENBLICK on left, exactly two learner navigation tabs 选择课程, 我的课程 (active), right Kevin / 退出登录. Main title 我的课程, modest 24px equivalent. One compact course rectangle without cover: 基础词汇（演示）; small metadata 中文 · 5 个对象; two explicit actions 学习 and 测试, as the existing app supports both. No course progress statistics, no invented history page, no unsupported management links, no badges. Remaining space plain and uncluttered, well aligned. Bottom tiny 原型示意. Landscape 16:10 full desktop screen. This is an owned course shelf, not a marketing dashboard; preserve brand palette alone and simplify all composition.

