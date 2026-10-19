

AUGENBLICK both “Polyglot” and “Savant” – twin products) 
Integration & Platform Proposal
A specification for the developer
Document purpose: Augenblick is an online, subscription-based language-training platform. Six teaching engines already exist and work as independent programs with a finished visual skin. This document does not re-specify the engines. It specifies the platform that surrounds them: user accounts, the course catalogue, the spreadsheet-driven scripting system that decides what runs and when, the shared progress display, scoring, validation, and administration.
Everything below is written to be read by a programmer. Where a decision has been deliberately left open for the developer, it is marked [developer's call]. Where I have filled a gap with an assumption, it is marked [assumption — confirm].

1. Scope of this document
In scope: the Orchestrator (the "conductor" that reads the spreadsheets and drives the engines), the learner-facing shell, accounts and payment, the admin/authoring back office, validation and error reporting, progress tracking and scoring, data storage.
Out of scope (covered by separate per-engine proposals): the internal logic and data formats of Znawca, Anvil, Ekspert, Sokole Oko, Companion and Direct; question-type catalogues; audio recording, text-to-speech and pronunciation assessment; artwork and media production.
Critical dependency: the engines exist but their implementation technology is not documented here. Before coding begins, the developer must inventory each engine (language, framework, how it loads data, whether it can be embedded in a page) and confirm which of the two integration strategies in §4 applies.

2. Platform decisions
| Item | Decision |
| Delivery | Web application, browser-based, responsive. |
| Future | A native mobile app is planned. Therefore all content and progress must be served through an API, so a future app is a new front end over the same back end. No logic may live only in the browser. |
| Offline use | Not required for version 1. |
| Content format | Microsoft Excel (.xlsx). Non-negotiable. |
| Scale | Dozens to a few hundred active learners initially; must not be architecturally capped there. |
| Media volume | Thousands of files per course. Media must be served from object storage / CDN, not from the application server. |
| Hosting, framework, database, payment provider | [developer's call] |


3. Content model: the three tiers
3.1 Course discovery (First-tier file)
A course exists if a first-tier .xlsx file exists in the main content folder. The filename is both the course name and the name of the course folder holding all its files and subfolders.
First-tier columns: A notes · B unit number · C unit title · D filename of the second-tier lesson file (and of the matching subfolder).
Publication state. Presence of the file makes a course a candidate, not a live product. Each course has a state: Draft (visible only to administrators) or Published (visible to learners). A course cannot be published while it contains blocking errors (§7). This satisfies the requirement that incomplete courses can be uploaded and worked on invisibly.
Unit locking. Units are sequential: Unit n+1 unlocks when Unit n is completed. Completion = the last row of the lesson script was executed. [assumption — confirm] No minimum score is required to advance; scores are recorded but do not gate progress. If score gating is wanted later, the cleanest route is an optional extra column in the first-tier file (pass mark), which older files can leave blank.
3.2 The lesson script (Second-tier file)
Row 1 = column titles. Row 2 = permanent guidelines for the course designer (ignored by the software, never deleted). Row 3 onwards = the script, executed strictly top to bottom. One row = one Activity.
| Col | Name | Applies to | Behaviour |
| A | Step | all | Step identifier / ordering. |
| B | Engine Called | all | One of: Znawca, Anvil, Ekspert, Sokole Oko, Companion, Direct, or the reserved keyword REVIEW (§6). |
| C | File Called | all | Name of the engine data file; the media subfolder carries the same name. |
| D | Package / Checkpoint | all | Randomised engines (Znawca, Anvil, Ekspert, Sokole Oko): blank = draw from the entire pool; a number = only items bearing that package designation. Progressive engines (Companion, Direct): blank = play the whole script from the beginning; a number = start from that checkpoint. In every case, a blank cell raises a designer warning — the lesson still runs, but the omission is reported. |
| E | Scope | Znawca, Ekspert only | Which columns of the target file participate. See §3.3. |
| F | Question Type | Znawca, Anvil, Ekspert only | One or more types, ;-separated. Blank = the software combines available types at random. The authoritative list of types lives in row 2 as a designer cheat-sheet and is validated against each engine's declared capabilities. |
| G | Number of Questions | Znawca, Anvil, Ekspert, Sokole Oko | How many items to draw from the pool. If the number exceeds the pool, all items are used and the designer is warned of the shortfall. Blank = whole pool. |
| H | Learning / Testing | all scored engines | L or T. See §5. |

A cell filled in for an engine that does not use it (e.g. Scope for Sokole Oko) is a designer warning, not an error; the value is ignored.
3.3 Column E — Scope notation
Two token forms, freely mixed and separated by ;:
Loose column — C · the column joins the pool and the engine may use it as prompt or as answer.
Directed pair — K --> J · column K is the prompt, column J is the answer. Direction is fixed.
Optional explicit bidirectional — J <--> K · both directions allowed, but only between these two columns.
Example: C; F; K --> J = C and F are freely combinable, plus a fixed K-prompts-J question. [assumption — confirm] If at least one directed pair is present, loose columns still generate their own questions; directed pairs constrain only themselves. Whitespace around arrows is ignored; -> is accepted as a synonym.
For Ekspert, whose data is JSON rather than tabular, the same notation addresses named attributes instead of column letters; the mapping is internal to Ekspert and out of scope here.
3.4 Third-tier files
Already defined and owned by the individual engines. The Orchestrator treats them as opaque, with three exceptions it must understand generically: the package/checkpoint designator column, the item count, and (for Companion) the _M / _F filename convention (§4.3).

4. Architecture
4.1 Components
Shell — the learner-facing frame: menu, course list, interface-language selector, both progress bars, feedback screens. The shell, not the engines, owns all progress display.
Orchestrator — reads the compiled lesson script, resolves each row into a call packet, launches the correct engine, receives results, advances.
Engines ×6 — existing software, embedded.
Content pipeline — upload → parse → validate → compile → publish.
Back office — course states, validation reports, runtime warning log, learner and teacher administration.
API + database + media storage.
4.2 The Engine Contract
This is the heart of the integration and must be defined before anything else is built. Each engine is wrapped so it exposes an identical interface:
In — call packet (JSON): engine name, resolved data file path, package/checkpoint, scope expression, question types, item count, mode (L/T), learner sex, interface language, resume token.
Out — events, emitted live: activityReady { itemCount } · itemStarted { index } · itemResolved { index, score 0…1 } · activityFinished { totalScore, perItemDetail[] }.
score as a fraction covers all three grading realities with one field: Znawca/Anvil are 0 or 1; Ekspert returns its partial fraction; Sokole Oko returns found-regions ÷ total-regions (3 of 4 = 0.75).
activityReady { itemCount } is what lets the shell draw the Questions bar before the first question appears, including for engines whose item count is not knowable from column G.
Two integration strategies, to be chosen after the engine inventory:
(A) Embed and wrap — each engine runs in a sandboxed frame; a thin adapter per engine translates the contract into whatever the engine already understands, and translates its internal events back out. Preserves the existing, working code and the finished skin. Recommended default.
(B) Port — rebuild an engine against the contract natively. Only for engines that cannot be embedded or cannot emit per-item events.
The realistic risk is that an engine currently keeps its results to itself and reports only at the end. The minimum acceptable adaptation is per-item event emission; without it, the Questions bar cannot animate.
4.3 Learner sex and Companion file resolution
Sex is declared once at registration. Its only function is file selection for the Companion engine: the base name in column C is resolved to <name>_M.xlsx or <name>_F.xlsx with the matching media subfolder.
Learners cannot change this themselves. An administrator may correct a genuine registration mistake.
If the required variant is missing, the Orchestrator falls back to the available variant, continues the lesson, and raises a blocking error against the course so the gap is fixed. The learner sees nothing unusual.
The validator checks that both variants exist for every Companion call in a course before publication.

5. Modes, mastery and scoring
5.1 Learning mode (L)
Items cycle until mastered. An item answered correctly on first encounter is mastered immediately. An item ever failed requires two consecutive correct answers; a failure at any point resets that counter to zero. Unmastered items are re-drawn in random order, mixed with the remaining pool.
Escape hatch. A visible opt-out ("I give up — next activity"), available after a configurable number of full cycles [assumption — confirm: 3]. Using it ends the activity, records it as abandoned, and writes the unmastered items into the learner's Failed-Item Ledger so REVIEW can retrieve them.
5.2 Testing mode (T)
Each activity is attempted once and yields a percentage from the summed item fractions. Tests are not retakeable. Every failed or partially failed item is written to the Failed-Item Ledger (learner, course, unit, engine, file, item id, date, score).
5.3 Feedback
After each testing activity: the score plus a list of what went wrong, item by item.
At the end of the unit: a total score across the unit's testing activities, the per-activity breakdown, and a proficiency title.
Proficiency titles are not hard-coded. Each interface language has a plain-text file, one line per band, e.g. 0-10: Total Noob … 91-100: Straight A Student. Adding or editing bands is a file edit, not a code change. Missing file = score shown without a title.
5.4 Interruption and resume
Lessons may be interrupted freely. On return, the learner restarts the current activity from its beginning; all previously completed activities and their scores stand. Learning-mode mastery progress inside the interrupted activity is discarded; testing scores of completed activities are never lost. An interrupted testing activity counts as not yet attempted and is re-served in full [assumption — confirm].

6. REVIEW
REVIEW in column B is not an engine but an instruction to the Orchestrator: rebuild an activity from the learner's own past failures.
Column C / D, if filled, narrow the retrieval to a specific file or package; blank = all recorded failures in the current course.
Column G caps the number of items retrieved.
Column H is forced to L: review is for learning, and its results never produce a test score.
An item leaves the Ledger once it has been mastered in review (two consecutive correct). Its history is retained for statistics.
If a learner has no recorded failures, the step is skipped silently — this is normal, not an error, and no warning is raised.

7. Validation and error reporting
The learner must never see a technical problem. The course designer must be able to see every problem in advance. Three layers:
Layer 1 — Upload validation (pre-publication). On upload, the file is parsed and checked, and a cell-specific report is produced. Every finding names course, unit, file, row, column and cell, e.g.
ERROR — Deutsch_A1 / Unit 4 / U04_lesson.xlsx / row 12, column C: file "Dialog_Bahnhof" not found in unit folder.
WARNING — Deutsch_A1 / Unit 4 / U04_lesson.xlsx / row 17, column D: no checkpoint given for Companion; whole script will play.
WARNING — Deutsch_A1 / Unit 7 / U07_lesson.xlsx / row 5, column G: 30 items requested, 18 available; all 18 will be used.
Severities: ERROR blocks publication · WARNING permits publication and is logged · INFO is advisory. Checks include: unknown engine name, missing data file or media folder, non-existent package or checkpoint, malformed Scope expression, unknown question type for that engine, item-count shortfall, missing _M/_F Companion variant, broken unit numbering in the first-tier file, empty lesson script.
Layer 2 — Pre-flight resolution at lesson start. Immediately before a lesson runs, every row is resolved. Steps that cannot run are excluded before the Activities bar is drawn, so the bar is always truthful and never shrinks mid-lesson.
Layer 3 — Runtime warning log. If a step still fails during play, the Orchestrator skips it and continues, logging a full diagnostic to the admin panel. The learner sees an uninterrupted lesson.
Reports are available in the back office and, optionally, by e-mail digest on upload.

8. Progress display
Two bars, always visible at the very top of the screen, owned by the shell.
Activities   -----  -----  -----  -----  -----  -----  -----
Questions    -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
Activities bar: one segment per executable row of the lesson script.
Questions bar: one segment per item in the current activity. Sources: column G, or the resolved pool size when G is blank; for Direct, one segment per scripted step; for Companion, one segment per section between one vocal input and the next.
States and colours (drawn from the established palette):
| State | Appearance |
| Not yet reached | dark goldish-brownish green |
| Current | bright green, segment enlarged and gently glowing |
| Completed / answered correctly | golden-yellow |
| Answered incorrectly (Znawca, Anvil, Ekspert, Sokole Oko) | ominous red |

Learning-mode behaviour: the bar does not grow with each cycle. Failed items stay red in place; when re-served and finally mastered they turn golden-yellow. Recycling of red items is random. An activity is finished when no red segments remain, or when the escape hatch is used.
Partial scores (Ekspert, Sokole Oko) [assumption — confirm] render as a partially filled segment: gold up to the fraction earned, red beyond it.

9. Accounts, access, commerce
Registration: e-mail, password, declared sex, interface language.
Interface language is independent of course language. A course teaches in its own fixed language regardless of UI setting. UI strings live in per-language resource files, as do the proficiency-title files.
Access control: courses require an active paid entitlement; unit locking applies inside a course.
Payment: [developer's call] — model (single subscription / per-course / trial) and provider both to be agreed. A provider with strong recurring-billing support and coverage of local Polish methods is the practical starting point.
Minors. Many learners are under 16; access is arranged and paid for by a parent or guardian, which constitutes consent. The developer should record consent evidence (who paid, when, for which learner), collect the minimum data necessary, and keep learner records deletable on request.
Teacher / observer role
A read-only account, linked to a learner by an invitation code the learner or guardian issues and can revoke. The observer sees: last activity date, time on task, units completed, test scores and trend. The observer sees no personal data beyond the learner's display name and cannot alter anything.

10. Data to be stored
Users (incl. declared sex, interface language, entitlements) · courses and units, with publication state and compiled script cache · enrolments and unit unlock state · activity results (mode, score, timestamps, abandoned flag) · item-level results · Failed-Item Ledger · resume checkpoints · validation reports per upload · runtime warning log · observer links.
Raw .xlsx files are the single source of truth for authoring, but the runtime reads a compiled cache produced at publish time. Uploading a file never changes what a mid-lesson learner is currently experiencing; changes take effect on the next lesson start.

11. Open items for the developer
Engine inventory: technology, embeddability, and whether each can emit per-item events (§4.2). This determines the whole integration approach and should be answered first.
Confirmation of the Scope grammar in §3.3, and of the mixed loose/directed rule.
Where content files live: admin upload, synced folder, or bundled — chosen freely, provided the compiled-cache and publication-state model in §7 and §10 is preserved.
Payment model and provider; hosting, framework, database.
Confirmation of the assumptions flagged throughout: no score gate on unit unlock; escape hatch after three cycles; interrupted tests re-served in full; partial-score segment rendering.
Per-engine proposals still to be supplied by me: question-type catalogues, audio and pronunciation handling, media production and naming conventions.
Guiding principle: the learner is entitled to a flawless experience; the course designer is entitled to know, cell by cell, exactly what is wrong before any learner ever meets it.


