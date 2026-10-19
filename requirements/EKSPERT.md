

EKSPERT — Detailed Project Proposal
Design Document for Developer

1. GENERAL OVERVIEW
Ekspert is a learning program for multi-axis classification of natural, archaeological, and geological objects. The user views an object (SVG, diagram, or photo) and must characterize it across several independent axes simultaneously.
The program consists of four initial modules: Animal Tracking, Teeth, Archaeological Ceramics, and Fossils. The engine is universal — each new module is simply a new data file, requiring no changes to the core code.

2. ARCHITECTURE
2.1 Technology Stack (suggestion, developer's decision):
Frontend: React + Tailwind (or any framework), inline SVG for graphics. Backend: optional — the application can be fully offline, data stored in JSON. Persistence: localStorage or SQLite (for user statistics). Target: PWA (offline on phone in the field).
2.2 Directory Structure:
ekspert/
├── engine/
│   ├── quiz-engine.js        (quiz logic, randomization, evaluation)
│   ├── spaced-repetition.js  (repetition algorithm)
│   ├── decision-tree.js      (decision tree engine)
│   └── scoring.js            (per-axis scoring)
│
├── modules/
│   ├── tracking/
│   │   ├── data.json
│   │   ├── trees.json        (decision trees)
│   │   └── svg/              (track graphics)
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
│   ├── atlas.js              (browsing mode)
│   ├── quiz-single.js        (single-axis quiz)
│   ├── quiz-multi.js         (multi-axis quiz)
│   ├── comparison.js         (comparison mode)
│   ├── elimination.js        (interactive decision tree)
│   └── statistics.js         (user results)
│
└── config/
    └── modules.json           (module registry, axes, metadata)
2.3 Modularity Principle:
Each module declares its axes in a configuration file, their type (enum / numeric / boolean), and permissible values. The quiz engine knows nothing about tracks or teeth — it operates on abstract axes and values. Adding a new module = adding a directory with JSON + SVG, zero changes to the engine.

3. DATA MODEL
3.1 Module Configuration (meta):
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
3.2 Single Record (learning object):
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
3.3 Decision Tree (tree file):
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

4. LEARNING MODES (UI)
4.1 Atlas (Browsing)
A list view with filters. The user can filter by any axis (e.g., "show only canids" or "show only tracks in snow"). Clicking opens a detailed card with SVG graphic, feature description, and a "confuse with" section.
Card layout:
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
4.2 Single-Axis Quiz
Simple flashcard: the program shows an object (SVG + descriptive features), asks about one selected axis. E.g., "Whose track is this?" → user selects species. Or: "This is a fox. What type of sign do you see?" → user selects "track / scat / pellet."
Answer variants: multiple choice (4–6 options) or typed input (harder). Options selected intelligently: always include objects from the "confuse_with" field of the given record.
4.3 Multi-Axis Quiz
The program shows an object. The user must determine ALL axes. Interface: a series of dropdowns or buttons, one for each axis. Scoring: per axis separately. You can get the species right but confuse the side (in teeth). Result: e.g., "3/4 axes correct."
Layout:
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
4.4 Comparison Mode
The program displays 2 objects side by side. Question: "How do they differ?" or "Which one is X?" E.g., two tracks side by side: "Which belongs to the fox?" Or: two teeth: "Which is the upper P4 and which is the lower M1?"
This mode is particularly important for frequently confused objects (pairs from the "confuse_with" field).
4.5 Elimination Mode (Decision Tree)
Two sub-modes:
A) Guided: The program leads the user step by step through the tree. At each stage it asks a question and offers options. At the end it gives the result. The user learns diagnostic logic.
B) Independent: The program shows an object. The user must reconstruct the decision path themselves — entering the criteria they applied in sequence. The program checks whether they used the correct steps in the correct order.
4.6 Field Mode (future)
The user opens the app in the field, sees the decision tree, answers questions while looking at a real object in front of them. The program suggests a diagnosis. Requires offline mode (PWA + data cache).

5. SCORING AND REPETITION SYSTEM
5.1 Per-Axis Scoring:
Each axis of each record has a separate mastery coefficient (0.0 – 1.0). Rises after a correct answer, drops after an error.
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
5.2 Error Analysis:
The program tracks a confusion matrix. If the user regularly confuses fox with raccoon dog, the program detects this and deliberately serves fox–raccoon dog comparisons.
Structure:
{
  "confusion": {
    "tracking.species": {
      "red_fox": {"raccoon_dog": 3, "dog": 1},
      "wolf": {"large_dog": 4},
      "lynx": {"wildcat": 2}
    }
  }
}
5.3 Spaced Repetition:
SM-2 type algorithm (or simplified). Each record has a next-review date. Records with low coefficients return more frequently. Priority: objects where the user confuses specific axes.
5.4 Difficulty Levels:
The program automatically adjusts difficulty. Initially: single-axis quiz with 4 options (easy). After mastery: multi-axis quiz with 6 options. After further mastery: typed input with no hints. Transition thresholds configurable.

6. SVG GRAPHICS — GENERATION PRINCIPLES
6.1 Tracks:
Each track is an SVG with a normalized viewBox (e.g., 100×100). Elements: toe pad outlines (ellipses), metatarsal pad (polygon), claws (lines/triangles). Colors: grey fill, black stroke. Scale line alongside.
6.2 Teeth:
Views: occlusal (from above), lateral (buccal/lingual), cross-section. Elements: crown outline (path), roots (paths), cusps marked with dots, numbering per FDI system.
6.3 Ceramics:
Vessel profile (cross-section — standard archaeological convention: left side = cross-section, right side = exterior view). Ornaments as repeatable patterns.
6.4 Fossils:
Simplified silhouettes with diagnostic features highlighted (e.g., suture line in ammonites, ribbing in brachiopods, septation in graptolites).

7. DATABASES — CONTENT

7.1 MODULE: ANIMAL TRACKING
Axes:
species (50 values)
sign_type (7 values: track, scat, pellet, feeding_sign, den/bed, bark_sign, other_signs)
substrate (6 values: snow, mud, sand, grass, bark, water)
Species List (50):
UNGULATES (7): red deer, roe deer, moose, fallow deer, wild boar, mouflon, chamois
LARGE CARNIVORES (4): wolf, lynx, wildcat, brown bear
MEDIUM CARNIVORES — CANIDS (2): red fox, raccoon dog
MEDIUM CARNIVORES — MUSTELIDS (8): badger, pine marten, stone marten, European polecat, otter, American mink, stoat, least weasel
CARNIVORES — OTHER (1): raccoon
RODENTS AND LAGOMORPHS (5): European beaver, European hare, wild rabbit, muskrat, red squirrel
INSECTIVORES (2): hedgehog, European mole
OWLS (5): eagle owl, tawny owl, long-eared owl, barn owl, Tengmalm's owl
DIURNAL RAPTORS (7): common buzzard, goshawk, sparrowhawk, white-tailed eagle, golden eagle, peregrine falcon, kestrel
CORVIDS (3): raven, magpie, jay
WOODPECKERS (3): great spotted woodpecker, black woodpecker, green woodpecker
LARGE GROUND/WATER BIRDS (3): crane, white stork, grey heron
Total Record Count:
Not every species has every sign type. Estimate: 50 species × average 3 sign types = ~150 records. Full breakdown:
Tracks (paw/hoof/foot prints): 50 species — 50 records
Scat: 45 species (excluding mole and some non-diagnostic birds) — 45 records
Pellets: 12 species (owls + diurnal raptors) — 12 records
Feeding signs: 25 species (beaver, boar, woodpeckers, deer, rodents...) — 25 records
Dens/beds: 20 species (badger, fox, rabbit, raccoon dog, beaver...) — 20 records
Bark signs: 10 species (deer, boar, bear, beaver, woodpeckers) — 10 records
Other signs (otter slides, boar wallows, lynx scratching posts...): 15 records
TOTAL: ~177 records
Features per record (JSON fields):
size (dimensions in cm)
shape (verbal description)
color (for scat)
contents (for scat/pellets)
season (when easiest to find)
habitat (where to look)
diagnostics (key distinguishing feature)
confuse_with (list of frequently confused species)
differences (per confused species — what distinguishes them)
fun_fact (additional information)

7.2 MODULE: TEETH
Axes:
species (15 values)
tooth_type (5 values: incisor, canine, premolar, molar, wolf_tooth — in horses)
tooth_number (specific tooth per nomenclature, e.g., I1, I2, C, P1, P2, P3, P4, M1, M2, M3)
jaw (2 values: upper/maxilla, lower/mandible)
side (2 values: left, right)
dentition (2 values: permanent, deciduous) — where relevant
Species List (15):
CARNIVORES (4): dog/wolf, cat, fox, bear
UNGULATES (5): horse, cow, pig, sheep, roe deer/red deer
RODENTS (3): beaver, rat, rabbit/hare (technically lagomorph)
PRIMATES (1): human
OTHER (2): hedgehog, mole
Dental Formulae (permanent):
Dog: I 3/3, C 1/1, P 4/4, M 2/3 = 42
Cat: I 3/3, C 1/1, P 3/2, M 1/1 = 30
Fox: I 3/3, C 1/1, P 4/4, M 2/3 = 42
Bear: I 3/3, C 1/1, P 4/4, M 2/3 = 42
Horse: I 3/3, C 1/1, P 3-4/3, M 3/3 = 40-42
Cow: I 0/3, C 0/1, P 3/3, M 3/3 = 32
Pig: I 3/3, C 1/1, P 4/4, M 3/3 = 44
Sheep: I 0/3, C 0/1, P 3/3, M 3/3 = 32
Roe deer: I 0/3, C 0/1, P 3/3, M 3/3 = 32
Beaver: I 1/1, C 0/0, P 1/1, M 3/3 = 20
Rat: I 1/1, C 0/0, P 0/0, M 3/3 = 16
Rabbit: I 2/1, C 0/0, P 3/2, M 3/3 = 28
Human: I 2/2, C 1/1, P 2/2, M 3/3 = 32
Hedgehog: I 3/2, C 1/1, P 3/2, M 3/3 = 36
Mole: I 3/3, C 1/1, P 4/4, M 3/3 = 44
Total Record Count:
Each unique tooth (type × position) per species, but only one side (left and right are mirror images — side is tested separately as an axis). So: dog = 21 unique teeth (11 upper + 10 lower — bilateral counted once). Simplified: count tooth types per species × jaw.
Estimate: ~15 species × average 16 tooth types = ~240 records
Not all are diagnostically interesting. Priority on: carnassial teeth (upper P4 / lower M1 in carnivores), ruminant incisors (no upper ones!), canines, characteristic molars. Core: ~120 most important records with full descriptions. Remainder as supplementary.
Features per record:
crown_shape (description + type: bunodont / selenodont / secodont / lophodont)
root_count (1, 2, 3)
cusps (names: protocone, metacone, paracone, hypocone — for molars)
relative_size (relative to adjacent teeth in the jaw)
function (cutting / crushing / grasping / chisel-like)
wear (attrition pattern — diagnostic in ungulates)
age_indicators (how to estimate animal age from the tooth)
diagnostics (what distinguishes it from adjacent teeth)
confuse_with (list)
Additional data per species (independent of specific tooth):
dental_formula
dentition_type (hetero/homodont)
dietary_specialization
general_dentition_description
jaw_diagram_svg (entire jaw with teeth marked)

7.3 MODULE: ARCHAEOLOGICAL CERAMICS
Axes:
chronology (7 values: early Neolithic, middle Neolithic, late Neolithic, Bronze Age, Iron Age, medieval, post-medieval)
culture (25 values — see list below)
vessel_type (12 values: pot, bowl, beaker, amphora, cup, vase, jug, plate, spindle whorl, loom weight, lid, special form)
forming_technique (4 values: hand-built, coil-built, slow wheel, fast wheel)
firing (3 values: oxidizing, reducing, mixed)
temper (6 values: crushed stone, grog/chamotte, fine sand, coarse sand, shell, organic)
decoration (10 values: plain, stamped, incised, painted, applied_cordons, applied_knobs, cord-impressed, fingernail, comb-stamped, barbotine)
vessel_part (6 values: rim, neck, body, base, handle/lug, complete_vessel)
Culture List (25):
EARLY NEOLITHIC: Linear Pottery (LBK), Stroke-Ornamented Ware (SBK)
MIDDLE NEOLITHIC: Lengyel, Polgár, Rössen, Malice
LATE NEOLITHIC: Funnel Beaker (TRB), Globular Amphora (GAC), Corded Ware (CWC), Pit-Comb Ware, Baden
EARLY BRONZE AGE: Únětice, Trzciniec, Mierzanowice
LATE BRONZE AGE / EARLY IRON AGE: Lusatian, Pomeranian
IRON AGE: Przeworsk, Oksywie, Wielbark, Jastorf, La Tène (Celtic)
MEDIEVAL: Early Medieval Slavic (Prague type, Sukow-Dziedzice, Tornow, Feldberg), grey stoneware (late medieval)
POST-MEDIEVAL: glazed ware, majolica, stoneware
Total Record Count:
25 cultures × average 4 characteristic forms = ~100 base records. But technological and decorative features may generate variants. Target: ~120 records with full descriptions.
Features per record:
absolute_dating (e.g., "4500–4000 BC")
geographic_range (e.g., "southern Poland, Moravia, Lower Silesia")
vessel_profile (cross-section description: S-shaped, barrel-shaped, biconical, globular...)
rim (description: straight, everted, thickened, faceted)
base (flat, defined, footed, omphalos)
wall_thickness (thin <5mm, medium 5-10mm, thick >10mm)
surface_color (orange, brown, grey, black, mottled)
surface_treatment (smoothed, burnished, rough, coarse)
ornament_description (detailed decoration description)
ornament_motif (lines, zigzags, meanders, herringbone, circles, pits)
analogies (other cultures with similar ceramics)
diagnostics (key feature — "how you recognize it")
confuse_with (list of similar cultures/forms)

7.4 MODULE: FOSSILS
Axes:
organism_type (8 values: marine_invertebrate, terrestrial_invertebrate, fish, amphibian, reptile, mammal, plant, trace_fossil)
class_order (35 values — see list)
era (6 values: Precambrian, early_Paleozoic, late_Paleozoic, early_Mesozoic, late_Mesozoic, Cenozoic)
period (12 values: Cambrian, Ordovician, Silurian, Devonian, Carboniferous, Permian, Triassic, Jurassic, Cretaceous, Paleogene, Neogene, Quaternary)
environment (5 values: shallow_marine, deep_marine, reef, terrestrial, freshwater)
preservation_type (5 values: original_shell_bone, impression, cast/mold, mineral_replacement, trace)
Class/Order List (35):
MARINE INVERTEBRATES — SHELLED:
bivalves (Bivalvia), gastropods (Gastropoda), cephalopods — ammonites (Ammonoidea), cephalopods — belemnites (Belemnitida), cephalopods — nautiloids (Nautiloidea), brachiopods (Brachiopoda)
MARINE INVERTEBRATES — OTHER:
solitary corals (Rugosa), colonial corals (Tabulata), modern corals (Scleractinia), trilobites (Trilobita), echinoids (Echinoidea), crinoids (Crinoidea), sponges (Porifera), bryozoans (Bryozoa), graptolites (Graptolithina)
TERRESTRIAL INVERTEBRATES:
insects in amber, land snails
FISH:
armored fish (Placodermi), bony fish (Osteichthyes), sharks — teeth (Chondrichthyes)
REPTILES:
dinosaurs — theropods, dinosaurs — sauropods, dinosaurs — ornithopods, pterosaurs, ichthyosaurs, plesiosaurs
MAMMALS:
Pleistocene megafauna (mammoth, woolly rhinoceros, Irish elk)
PLANTS:
ferns (Carboniferous), lycopods — Sigillaria and Lepidodendron, angiosperm leaves, petrified wood, seeds and cones
TRACE FOSSILS (ichnofossils):
dinosaur trackways, burrows, feeding traces
Total Record Count:
35 groups × average 4 example genera/species = ~140 records. Emphasis on fossils found in Poland and Central Europe (Kraków Jurassic, Holy Cross Mountains Devonian, Baltic Cretaceous, Silesian Carboniferous, Baltic amber...).
Features per record:
genus_species (e.g., "Dactylioceras commune")
common_name (e.g., "finger ammonite")
typical_size (e.g., "5–15 cm diameter")
shape (description: spiral, conical, bivalved, colonial...)
symmetry (bilateral, radial, asymmetric)
ornamentation (ribs, tubercles, spines, suture lines, growth lines)
suture_line (for ammonites: goniatitic, ceratitic, ammonitic)
cross_section (circular, oval, triangular, rectangular — e.g., for ammonite whorls)
mode_of_life (benthos/nekton/plankton, herbivore/predator, sessile/mobile)
localities_in_poland (where it can be found)
stratigraphic_value (whether it is an index fossil)
diagnostics (key feature)
confuse_with (list)
differences (per confused taxon)

8. DECISION TREES — ONE PER MODULE (summary)
8.1 Tracking — "Whose track is this?"
Key: number of toes → claws visible? → size → shape → species
8.2 Tracking — "What scat is this?"
Key: shape (cylindrical/spherical/pellets/liquid) → size → contents (hair/bones/seeds/chitin) → location → species
8.3 Teeth — "Which species does this tooth belong to?"
Key: dentition type (homo/heterodont) → canines present? → molar cusp type → dental formula → species
8.4 Teeth — "Which tooth is this?"
Key: position in jaw (front/side/back) → crown shape → root count → relative size → specific tooth
8.5 Ceramics — "Which culture is this from?"
Key: forming technique → firing → ornamentation → vessel form → dating → culture
8.6 Fossils — "What fossil is this?"
Key: symmetry → material (calcite/chitin/silica/phosphate) → construction (single/bivalved/colonial/segmented) → ornamentation → taxon

9. INTERFACE — SCREENS
9.1 Main Screen:
EKSPERT
─────────────────
[Animal Tracking]     [177 objects | 23% mastered]
[Teeth]               [240 objects | 0%]
[Ceramics]            [120 objects | 0%]
[Fossils]             [140 objects | 0%]
─────────────────
[+ Add custom module]
[Global statistics]
9.2 Module Screen:
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
9.3 Statistics Screen:
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

10. EXTENSIBILITY
10.1 User-Added Modules:
An advanced user can create their own module: defining axes and their values, then adding records. Interface: step-by-step form or JSON import.
10.2 Photo Import:
Each record has an "img" field (null by default). The user can add their own photo (from phone in the field). Photo stored locally (in app folder or base64 in database).
10.3 Database Sharing:
Export/import of a module as a .json file + SVG folder. Users can share databases (e.g., "my Lusatian culture ceramics database from excavations at Biskupin").
10.4 Future Modules (ready to add later):
Bones (comparative osteology)
Feathers
Skulls
Flint tools
Coins
Thin sections (petrography)
Soils (profiles)

11. IMPLEMENTATION PRIORITIES
Phase 1 (MVP):
Single-axis + multi-axis quiz engine
Atlas with filtering
Tracking module (50 species × tracks — paw prints only, 50 records)
Teeth module (5 species × full dentition, ~80 records)
Basic statistics
SVG for tracks and tooth diagrams
Phase 2:
Comparison mode
Decision tree mode
Spaced repetition
Confusion matrix
Expand tracking to include scat and pellets (~100 records)
Expand teeth to remaining 10 species
Phase 3:
Ceramics module (full)
Fossils module (full)
Photo import
PWA / offline mode
Custom module editor



