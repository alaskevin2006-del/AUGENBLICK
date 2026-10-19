

EKSPERT — 详细项目提案
开发者设计文档

1. 总体概述
Ekspert是一个用于自然、考古和地质物体多轴分类的学习程序。用户查看一个物体（SVG、图表或照片），必须同时沿多个独立轴对其进行表征。
该程序由四个初始模块组成：动物追踪、牙齿、考古陶瓷和化石。引擎是通用的——每个新模块只是一个新数据文件，无需更改核心代码。

2. 架构
2.1 技术栈（建议，由开发者决定）：
前端：React + Tailwind（或任何框架），内联SVG用于图形。后端：可选——应用程序可以完全离线，数据存储在JSON中。持久化：localStorage或SQLite（用于用户统计）。目标：PWA（在现场手机上离线使用）。
2.2 目录结构：
ekspert/
├── engine/
│   ├── quiz-engine.js        （测验逻辑、随机化、评估）
│   ├── spaced-repetition.js  （重复算法）
│   ├── decision-tree.js      （决策树引擎）
│   └── scoring.js            （按轴评分）
│
├── modules/
│   ├── tracking/
│   │   ├── data.json
│   │   ├── trees.json        （决策树）
│   │   └── svg/              （足迹图形）
│   ├── teeth/
│   │   ├── data.json
│   │   ├── trees.json
│   │   └── svg/
│   ├── ceramics/
│   │   ├── data.json
│   │   ├── trees.json
│   │   └── svg/
│   └── fossils/
│       ├── data.json
│       ├── trees.json
│       └── svg/
│
├── ui/
│   ├── atlas.js              （浏览模式）
│   ├── quiz-single.js        （单轴测验）
│   ├── quiz-multi.js         （多轴测验）
│   ├── comparison.js         （比较模式）
│   ├── elimination.js        （交互式决策树）
│   └── statistics.js         （用户结果）
│
└── config/
    └── modules.json           （模块注册表、轴、元数据）
2.3 模块化原则：
每个模块在配置文件中声明其轴、类型（枚举/数值/布尔）和允许的值。测验引擎对足迹或牙齿一无所知——它在抽象的轴和值上操作。添加新模块 = 添加一个包含JSON + SVG的目录，对引擎零更改。

3. 数据模型
3.1 模块配置（元数据）：
{
  "id": "tracking",
  "name": "Animal Tracking",
  "description": "Identifying animal signs and traces",
  "axes": [
    {
      "id": "species",
      "name": "Species",
      "type": "enum",
      "values": ["red_fox", "wolf", "raccoon_dog", "badger", "..."],
      "primary": true
    },
    {
      "id": "sign_type",
      "name": "Sign Type",
      "type": "enum",
      "values": ["track", "scat", "pellet", "feeding_sign", "den", "bark_sign", "other"]
    },
    {
      "id": "substrate",
      "name": "Substrate / Context",
      "type": "enum",
      "values": ["snow", "mud", "sand", "grass", "bark", "water"],
      "optional": true
    }
  ],
  "axis_difficulty": {
    "species": 3,
    "sign_type": 1,
    "substrate": 1
  }
}
3.2 单条记录（学习对象）：
{
  "id": "red_fox_track_001",
  "module": "tracking",
  "axes": {
    "species": "red_fox",
    "sign_type": "track",
    "substrate": "snow"
  },
  "features": {
    "size": "5×4 cm",
    "shape": "oval, elongated",
    "claws": "visible, thin, converging",
    "description": "Toes II and III pressed together — a matchstick fits between them. Print narrow, distinctly smaller than a dog of the same body mass.",
    "diagnostics": "Narrow print + converging claws + straight-line trail",
    "confuse_with": ["small_dog", "raccoon_dog"],
    "difference_from_small_dog": "Dog has splayed toes, rounder print, zigzag trail",
    "difference_from_raccoon_dog": "Raccoon dog smaller (4×3.5cm), rounder, shorter claws"
  },
  "media": {
    "svg": "red_fox_track_snow.svg",
    "img": null,
    "comparative_diagram": "fox_vs_dog.svg"
  },
  "difficulty": 2,
  "tags": ["common", "winter", "year_round", "canidae"]
}
3.3 决策树（树文件）：
{
  "id": "tracks_main_tree",
  "module": "tracking",
  "title": "Whose track is this?",
  "root": {
    "question": "How many toes visible in the print?",
    "options": [
      {
        "answer": "2 (hooves/cleaves)",
        "next": {
          "question": "Print size?",
          "options": [
            {
              "answer": ">10 cm",
              "next": {
                "question": "Cleaves splayed?",
                "options": [
                  {"answer": "Yes, widely", "result": "moose"},
                  {"answer": "No, parallel", "result": "red_deer"}
                ]
              }
            },
            {
              "answer": "5–7 cm",
              "next": {
                "question": "Cleave shape?",
                "options": [
                  {"answer": "Rounded, wide", "result": "wild_boar"},
                  {"answer": "Narrow, pointed", "result": "roe_deer"}
                ]
              }
            },
            {"answer": "<5 cm", "result": "fallow_deer_or_mouflon"}
          ]
        }
      },
      {
        "answer": "4",
        "next": {
          "question": "Claws visible?",
          "options": [
            {
              "answer": "Yes",
              "next": {
                "question": "Overall print shape?",
                "options": [
                  {"answer": "Oval, narrow", "result": "red_fox"},
                  {"answer": "Round, wide", "result": "dog_or_raccoon_dog"},
                  {"answer": "Large >9cm", "result": "wolf"}
                ]
              }
            },
            {
              "answer": "No",
              "next": {
                "question": "Size?",
                "options": [
                  {"answer": ">7cm", "result": "lynx"},
                  {"answer": "4–6cm", "result": "wildcat_or_domestic_cat"},
                  {"answer": "<3cm", "result": "marten_or_polecat"}
                ]
              }
            }
          ]
        }
      },
      {
        "answer": "5",
        "next": {
          "question": "Webbing visible?",
          "options": [
            {"answer": "Yes", "result": "otter_or_beaver"},
            {
              "answer": "No",
              "next": {
                "question": "Size?",
                "options": [
                  {"answer": ">6cm", "result": "badger"},
                  {"answer": "3–5cm", "result": "marten_or_polecat"},
                  {"answer": "<2cm", "result": "weasel_or_stoat"}
                ]
              }
            }
          ]
        }
      },
      {
        "answer": "3 toes (bird)",
        "next": {
          "question": "Print size?",
          "options": [
            {"answer": ">12cm", "result": "crane_or_heron"},
            {"answer": "7–12cm", "result": "stork_or_buzzard"},
            {"answer": "<7cm", "result": "small_birds_see_subtree"}
          ]
        }
      }
    ]
  }
}

4. 学习模式（UI）
4.1 图谱（浏览）
带筛选器的列表视图。用户可以按任何轴筛选（例如"只显示犬科动物"或"只显示雪地上的足迹"）。点击打开详细卡片，包含SVG图形、特征描述和"易混淆"部分。
卡片布局：
┌─────────────────────────────────────┐
│  [SVG / image]      [comparative SVG]   │
│                                         │
│  SPECIES: Red fox                       │
│  TYPE: Track                            │
│  SIZE: 5×4 cm                           │
│  ─────────────────────                  │
│  DIAGNOSTIC FEATURES:                   │
│  • Oval, narrow shape                   │
│  • Converging claws...                  │
│  ─────────────────────                  │
│  CONFUSE WITH:                          │
│  [small dog] [raccoon dog]  ← clickable │
│  ─────────────────────                  │
│  TREE: Show decision path →             │
└─────────────────────────────────────┘
4.2 单轴测验
简单的抽认卡：程序展示一个物体（SVG + 描述性特征），询问一个选定轴。例如，"这是谁的足迹？"→用户选择物种。或："这是狐狸。你看到的是什么类型的痕迹？"→用户选择"足迹/粪便/食丸。"
答案变体：选择题（4-6个选项）或打字输入（更难）。选项智能选择：始终包含给定记录"confuse_with"字段中的对象。
4.3 多轴测验
程序展示一个物体。用户必须确定所有轴。界面：一系列下拉菜单或按钮，每个轴一个。评分：按轴分别评分。你可能选对了物种但搞错了侧别（牙齿中）。结果：例如"4轴中3轴正确。"
布局：
┌─────────────────────────────────────┐
│  [SVG of tooth]                         │
│                                         │
│  Species:  [▼ select ]                  │
│  Type:     [▼ select ]                  │
│  Jaw:      [upper] [lower]             │
│  Side:     [left]  [right]             │
│                                         │
│  [CHECK]                                │
│                                         │
│  Result:                                │
│  Species:  ✓ dog                        │
│  Type:     ✓ premolar                   │
│  Jaw:      ✓ upper                      │
│  Side:     ✗ right (correct: left)      │
│                                         │
│  Score: 3/4 — Accuracy: 75%            │
└─────────────────────────────────────┘
4.4 比较模式
程序并排显示2个物体。问题："它们有何不同？"或"哪个是X？"例如，两个足迹并排："哪个属于狐狸？"或：两颗牙齿："哪个是上P4，哪个是下M1？"
此模式对于经常混淆的物体（来自"confuse_with"字段的对）特别重要。
4.5 消除模式（决策树）
两个子模式：
A）引导式：程序逐步引导用户通过决策树。每个阶段提出问题并提供选项。最后给出结果。用户学习诊断逻辑。
B）独立式：程序展示一个物体。用户必须自行重建决策路径——按顺序输入他们应用的标准。程序检查他们是否使用了正确的步骤和正确的顺序。
4.6 田野模式（未来）
用户在现场打开应用，查看决策树，一边观察面前的真实物体一边回答问题。程序给出诊断建议。需要离线模式（PWA + 数据缓存）。

5. 评分和重复系统
5.1 按轴评分：
每条记录的每个轴都有一个单独的掌握系数（0.0 – 1.0）。答对后上升，答错后下降。
{
  "user_stats": {
    "tracking": {
      "species": {
        "red_fox": {"correct": 12, "wrong": 2, "coefficient": 0.85},
        "raccoon_dog": {"correct": 3, "wrong": 5, "coefficient": 0.37}
      },
      "sign_type": {
        "track": {"correct": 20, "wrong": 1, "coefficient": 0.95},
        "scat": {"correct": 5, "wrong": 8, "coefficient": 0.38}
      }
    }
  }
}
5.2 错误分析：
程序跟踪一个混淆矩阵。如果用户经常将狐狸与貉混淆，程序会检测到这一点，并有针对性地提供狐狸-貉比较。
结构：
{
  "confusion": {
    "tracking.species": {
      "red_fox": {"raccoon_dog": 3, "dog": 1},
      "wolf": {"large_dog": 4},
      "lynx": {"wildcat": 2}
    }
  }
}
5.3 间隔重复：
SM-2型算法（或简化版）。每条记录有一个下次复习日期。低系数的记录更频繁地返回。优先级：用户混淆特定轴的物体。
5.4 难度等级：
程序自动调整难度。初始：4个选项的单轴测验（简单）。掌握后：6个选项的多轴测验。进一步掌握后：无提示的打字输入。过渡阈值可配置。

6. SVG图形 — 生成原则
6.1 足迹：
每个足迹是一个具有标准化viewBox（例如100×100）的SVG。元素：趾垫轮廓（椭圆）、跖垫（多边形）、爪（线/三角形）。颜色：灰色填充，黑色描边。旁边有比例尺。
6.2 牙齿：
视图：咬合面（从上方）、侧面（颊侧/舌侧）、横截面。元素：牙冠轮廓（路径）、牙根（路径）、用点标记的牙尖、按FDI系统编号。
6.3 陶瓷：
器皿剖面（截面——考古学标准惯例：左侧=截面，右侧=外视图）。纹饰作为可重复图案。
6.4 化石：
带有高亮诊断特征的简化轮廓（例如菊石的缝合线、腕足动物的肋纹、笔石的隔壁）。

7. 数据库 — 内容

7.1 模块：动物追踪
轴：
species（50个值）
sign_type（7个值：track, scat, pellet, feeding_sign, den/bed, bark_sign, other_signs）
substrate（6个值：snow, mud, sand, grass, bark, water）
物种列表（50）：
有蹄类（7）：马鹿、狍子、驼鹿、黇鹿、野猪、欧洲盘羊、岩羚羊
大型食肉动物（4）：狼、猞猁、野猫、棕熊
中型食肉动物 — 犬科（2）：赤狐、貉
中型食肉动物 — 鼬科（8）：獾、松貂、石貂、欧洲林鼬、水獭、美洲水鼬、白鼬、伶鼬
食肉动物 — 其他（1）：浣熊
啮齿类和兔形类（5）：欧洲河狸、欧洲野兔、穴兔、麝鼠、欧亚红松鼠
食虫类（2）：刺猬、欧洲鼹鼠
猫头鹰（5）：雕鸮、灰林鸮、长耳鸮、仓鸮、鬼鸮
昼行性猛禽（7）：普通鵟、苍鹰、雀鹰、白尾海雕、金雕、游隼、红隼
鸦科（3）：渡鸦、喜鹊、松鸦
啄木鸟（3）：大斑啄木鸟、黑啄木鸟、绿啄木鸟
大型地面/水鸟（3）：鹤、白鹳、苍鹭
总记录数：
并非每个物种都有每种痕迹类型。估计：50个物种 × 平均3种痕迹类型 = ~150条记录。完整明细：
足迹（爪/蹄/脚印）：50个物种 — 50条记录
粪便：45个物种（排除鼹鼠和一些非诊断性鸟类）— 45条记录
食丸：12个物种（猫头鹰 + 昼行性猛禽）— 12条记录
取食痕迹：25个物种（河狸、野猪、啄木鸟、鹿、啮齿类...）— 25条记录
巢穴/卧迹：20个物种（獾、狐狸、穴兔、貉、河狸...）— 20条记录
树皮痕迹：10个物种（鹿、野猪、熊、河狸、啄木鸟）— 10条记录
其他痕迹（水獭滑道、野猪泥浴、猞猁抓挠柱...）：15条记录
总计：~177条记录
每条记录的特征（JSON字段）：
size（以厘米为单位的尺寸）
shape（文字描述）
color（对于粪便）
contents（对于粪便/食丸）
season（最容易找到的时期）
habitat（在哪里寻找）
diagnostics（关键区分特征）
confuse_with（经常混淆的物种列表）
differences（按混淆物种 — 区分它们的特征）
fun_fact（附加信息）

7.2 模块：牙齿
轴：
species（15个值）
tooth_type（5个值：门齿、犬齿、前臼齿、臼齿、狼齿 — 马的）
tooth_number（按命名法的特定牙齿，例如I1, I2, C, P1, P2, P3, P4, M1, M2, M3）
jaw（2个值：上颌/上颌骨、下颌/下颌骨）
side（2个值：左、右）
dentition（2个值：恒齿、乳齿）— 相关时
物种列表（15）：
食肉动物（4）：狗/狼、猫、狐狸、熊
有蹄类（5）：马、牛、猪、羊、狍子/马鹿
啮齿类（3）：河狸、鼠、兔/野兔（严格来说是兔形类）
灵长类（1）：人
其他（2）：刺猬、鼹鼠
齿式（恒齿）：
狗：I 3/3, C 1/1, P 4/4, M 2/3 = 42
猫：I 3/3, C 1/1, P 3/2, M 1/1 = 30
狐狸：I 3/3, C 1/1, P 4/4, M 2/3 = 42
熊：I 3/3, C 1/1, P 4/4, M 2/3 = 42
马：I 3/3, C 1/1, P 3-4/3, M 3/3 = 40-42
牛：I 0/3, C 0/1, P 3/3, M 3/3 = 32
猪：I 3/3, C 1/1, P 4/4, M 3/3 = 44
羊：I 0/3, C 0/1, P 3/3, M 3/3 = 32
狍子：I 0/3, C 0/1, P 3/3, M 3/3 = 32
河狸：I 1/1, C 0/0, P 1/1, M 3/3 = 20
鼠：I 1/1, C 0/0, P 0/0, M 3/3 = 16
兔：I 2/1, C 0/0, P 3/2, M 3/3 = 28
人：I 2/2, C 1/1, P 2/2, M 3/3 = 32
刺猬：I 3/2, C 1/1, P 3/2, M 3/3 = 36
鼹鼠：I 3/3, C 1/1, P 4/4, M 3/3 = 44
总记录数：
每个物种的每个唯一牙齿（类型 × 位置），但只取一侧（左右是镜像 — 侧别作为轴单独测试）。所以：狗 = 21颗唯一牙齿（11颗上颌 + 10颗下颌 — 双侧只计一次）。简化：按物种 × 上下颌计算牙齿类型。
估计：~15个物种 × 平均16种牙齿类型 = ~240条记录
并非所有都有诊断意义。优先：裂齿（食肉动物的上P4 / 下M1）、反刍动物门齿（没有上颌门齿！）、犬齿、特征性臼齿。核心：~120条最重要记录含完整描述。其余作为补充。
每条记录的特征：
crown_shape（描述 + 类型：丘型 / 月型 / 切型 / 脊型）
root_count（1, 2, 3）
cusps（名称：原尖、后尖、前尖、次尖 — 对于臼齿）
relative_size（相对于相邻牙齿的大小）
function（切割 / 研磨 / 撕咬 / 凿形）
wear（磨耗模式 — 在有蹄类中有诊断意义）
age_indicators（如何从牙齿估计动物年龄）
diagnostics（与相邻牙齿的区分特征）
confuse_with（列表）
每物种的附加数据（与特定牙齿无关）：
dental_formula
dentition_type（异型/同型齿）
dietary_specialization
general_dentition_description
jaw_diagram_svg（标有牙齿的整个颌骨图）

7.3 模块：考古陶瓷
轴：
chronology（7个值：早期新石器时代、中期新石器时代、晚期新石器时代、青铜时代、铁器时代、中世纪、后中世纪）
culture（25个值 — 见下文列表）
vessel_type（12个值：罐、碗、杯、双耳瓶、小杯、花瓶、壶、盘、纺轮、织布坠、盖、特殊器形）
forming_technique（4个值：手制、泥条盘筑、慢轮、快轮）
firing（3个值：氧化、还原、混合）
temper（6个值：碎石、陶渣/熟料、细砂、粗砂、贝壳、有机物）
decoration（10个值：素面、压印、刻划、彩绘、附加堆纹、附加乳钉、绳纹、指甲纹、篦划纹、粗糙面）
vessel_part（6个值：口沿、颈部、腹部、底部、把手/鋬、完整器）
文化列表（25）：
早期新石器时代：线纹陶（LBK）、划纹陶（SBK）
中期新石器时代：伦格尔、波尔加尔、勒森、马利采
晚期新石器时代：漏斗颈陶（TRB）、球腹陶（GAC）、绳纹陶（CWC）、篦纹陶、巴登
早期青铜时代：乌涅蒂采、特茨涅茨、梅尔扎诺维采
晚期青铜时代/早期铁器时代：卢萨蒂亚、波美拉尼亚
铁器时代：普热沃尔斯克、奥克西维耶、维尔巴克、亚斯托夫、拉坦诺（凯尔特）
中世纪：早期中世纪斯拉夫（布拉格类型、苏科夫-杰济采、托尔诺夫、费尔德贝格）、灰炻器（晚期中世纪）
后中世纪：釉陶、马约利卡、炻器
总记录数：
25个文化 × 平均4种特征器形 = ~100条基础记录。但技术和装饰特征可能产生变体。目标：~120条含完整描述的记录。
每条记录的特征：
absolute_dating（例如"4500–4000 BC"）
geographic_range（例如"波兰南部、摩拉维亚、下西里西亚"）
vessel_profile（截面描述：S形、桶形、双锥形、球形...）
rim（描述：直口、外翻、加厚、多面）
base（平底、明显底、圈足、凹底）
wall_thickness（薄 <5mm、中 5-10mm、厚 >10mm）
surface_color（橙色、棕色、灰色、黑色、斑驳）
surface_treatment（修整、抛光、粗糙、粗劣）
ornament_description（详细装饰描述）
ornament_motif（线条、之字形、曲折纹、人字形、圆圈、凹点）
analogies（有类似陶瓷的其他文化）
diagnostics（关键特征 — "如何识别它"）
confuse_with（相似文化/器形列表）

7.4 模块：化石
轴：
organism_type（8个值：海洋无脊椎动物、陆地无脊椎动物、鱼类、两栖动物、爬行动物、哺乳动物、植物、遗迹化石）
class_order（35个值 — 见列表）
era（6个值：前寒武纪、早古生代、晚古生代、早中生代、晚中生代、新生代）
period（12个值：寒武纪、奥陶纪、志留纪、泥盆纪、石炭纪、二叠纪、三叠纪、侏罗纪、白垩纪、古近纪、新近纪、第四纪）
environment（5个值：浅海、深海、礁、陆地、淡水）
preservation_type（5个值：原始壳/骨、印模、铸模/外模、矿物替换、遗迹）
纲/目列表（35）：
海洋无脊椎动物 — 有壳类：
双壳类（Bivalvia）、腹足类（Gastropoda）、头足类 — 菊石（Ammonoidea）、头足类 — 箭石（Belemnitida）、头足类 — 鹦鹉螺类（Nautiloidea）、腕足类（Brachiopoda）
海洋无脊椎动物 — 其他：
单体珊瑚（Rugosa）、群体珊瑚（Tabulata）、现代珊瑚（Scleractinia）、三叶虫（Trilobita）、海胆（Echinoidea）、海百合（Crinoidea）、海绵（Porifera）、苔藓虫（Bryozoa）、笔石（Graptolithina）
陆地无脊椎动物：
琥珀中的昆虫、陆生蜗牛
鱼类：
甲胄鱼（Placodermi）、硬骨鱼（Osteichthyes）、鲨鱼 — 牙齿（Chondrichthyes）
爬行动物：
恐龙 — 兽脚类、恐龙 — 蜥脚类、恐龙 — 鸟脚类、翼龙、鱼龙、蛇颈龙
哺乳动物：
更新世巨型动物群（猛犸象、披毛犀、爱尔兰大角鹿）
植物：
蕨类（石炭纪）、石松类 — 封印木和鳞木、被子植物叶片、硅化木、种子和球果
遗迹化石（痕迹化石）：
恐龙行迹、潜穴、取食痕迹
总记录数：
35个类群 × 平均4个代表属/种 = ~140条记录。重点放在波兰和中欧发现的化石上（克拉科夫侏罗系、圣十字山脉泥盆系、波罗的白垩系、西里西亚石炭系、波罗的琥珀...）。
每条记录的特征：
genus_species（例如"Dactylioceras commune"）
common_name（例如"指菊石"）
typical_size（例如"直径5-15厘米"）
shape（描述：螺旋形、圆锥形、双壳形、群体...）
symmetry（两侧对称、辐射对称、不对称）
ornamentation（肋、瘤、刺、缝合线、生长线）
suture_line（对于菊石：棱菊石式、齿菊石式、菊石式）
cross_section（圆形、椭圆形、三角形、矩形 — 例如菊石旋环）
mode_of_life（底栖/游泳/浮游、植食/捕食、固着/移动）
localities_in_poland（在哪里可以找到）
stratigraphic_value（是否为标准化石）
diagnostics（关键特征）
confuse_with（列表）
differences（按混淆分类群）

8. 决策树 — 每个模块一棵（摘要）
8.1 追踪 — "这是谁的足迹？"
关键：趾数 → 爪可见？ → 大小 → 形状 → 物种
8.2 追踪 — "这是什么粪便？"
关键：形状（圆柱形/球形/颗粒/液态） → 大小 → 内容物（毛/骨/种子/几丁质） → 位置 → 物种
8.3 牙齿 — "这颗牙齿属于哪个物种？"
关键：齿型（同型/异型齿） → 有犬齿？ → 臼齿牙尖类型 → 齿式 → 物种
8.4 牙齿 — "这是哪颗牙？"
关键：颌骨位置（前/侧/后） → 牙冠形状 → 牙根数 → 相对大小 → 特定牙齿
8.5 陶瓷 — "这属于哪个文化？"
关键：成型技术 → 烧制 → 纹饰 → 器形 → 年代 → 文化
8.6 化石 — "这是什么化石？"
关键：对称性 → 材质（方解石/几丁质/硅质/磷酸盐） → 构造（单体/双壳/群体/分节） → 纹饰 → 分类群

9. 界面 — 屏幕
9.1 主屏幕：
EKSPERT
─────────────────
[Animal Tracking]     [177 objects | 23% mastered]
[Teeth]               [240 objects | 0%]
[Ceramics]            [120 objects | 0%]
[Fossils]             [140 objects | 0%]
─────────────────
[+ Add custom module]
[Global statistics]
9.2 模块屏幕：
ANIMAL TRACKING
─────────────────
[Atlas — browse]
[Single-axis quiz]
  → whose track?
  → what sign type?
[Multi-axis quiz]
[Comparison]
[Decision tree]
─────────────────
Progress: ████░░░░ 23%
Weakest axis: scat (18%)
Most confused: fox ↔ raccoon dog
9.3 统计屏幕：
YOUR RESULTS — TRACKING
─────────────────
Axis "species":
  Best: roe deer (98%), wild boar (95%), beaver (92%)
  Worst: raccoon dog (34%), pine marten (28%), stone marten (25%)

Axis "sign_type":
  Best: track (89%)
  Worst: scat (18%), pellets (22%)

Confusion matrix:
  pine marten → stone marten: 12 times
  fox → raccoon dog: 8 times
  wolf → large dog: 5 times

Suggestion: [Practice martens] [Practice fox vs raccoon dog]

10. 可扩展性
10.1 用户添加模块：
高级用户可以创建自己的模块：定义轴及其值，然后添加记录。界面：分步表单或JSON导入。
10.2 照片导入：
每条记录有一个"img"字段（默认为null）。用户可以添加自己的照片（在现场从手机拍摄）。照片本地存储（在应用文件夹或以base64存储在数据库中）。
10.3 数据库共享：
将模块导出/导入为.json文件 + SVG文件夹。用户可以共享数据库（例如"我在比斯库平遗址发掘的卢萨蒂亚文化陶瓷数据库"）。
10.4 未来模块（可后续添加）：
骨骼（比较骨骼学）
羽毛
头骨
燧石工具
硬币
薄片（岩相学）
土壤（剖面）

11. 实施优先级
阶段1（MVP）：
单轴 + 多轴测验引擎
带筛选的图谱
追踪模块（50个物种 × 足迹 — 仅爪印，50条记录）
牙齿模块（5个物种 × 完整齿系，~80条记录）
基础统计
足迹和牙齿图SVG
阶段2：
比较模式
决策树模式
间隔重复
混淆矩阵
扩展追踪以包括粪便和食丸（~100条记录）
扩展牙齿至其余10个物种
阶段3：
陶瓷模块（完整）
化石模块（完整）
照片导入
PWA / 离线模式
自定义模块编辑器
