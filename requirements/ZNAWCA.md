
App Name: Znawca
General Concept:
Educational tool: shows picture (or text), asks question, user answers, gets score
Two modes: Learning and Testing
Modes:
Learning Mode:
User sets the scope (between 3 and some upper limit)
Questions they answer correctly get removed from the pool
Wrong answers need two consecutive correct attempts before they're accepted
The session continues until all questions pass or the user exits, with an option to resume or start fresh
Partial credit is possible for answers separated by semicolons, though the question still requires a retry
Testing Mode:
Each question displays once
Final score shown as a percentage
Optional timer available for a harder challenge
Previous scores are tracked to show learning progress
Question Types:
Free-form text entry
Multiple choice with either 4 buttons or 3 if there aren't enough unique options
Image selection where the user picks the correct picture from 4 shown
Text-only mode with three variations: show the item name and ask about properties, show a property and ask which item matches, or present both directions
The data lives in a "Znawca" folder with topic subfolders like "rocks" and "plants," each containing an Excel file named after the course. Each row represents an item with its name in column A, and other columns contain property questions. Columns marked with # are filters only and never appear as questions. Cells can have semicolon-separated values representing multiple correct answers in any order. Item folders within each topic contain images, and if no image subfolders exist, the app switches to text-only mode.
For filtering, users check boxes to select a column and its values, stacking multiple filters with AND logic. The app intelligently skips columns where all filtered items share the same value. Teaching style can be strict (wrong answers from filtered scope only) or lenient (wrong answers from the full dataset). Questions are selected randomly across items and column types, with options to randomize, set a specific scope, or use difficulty-based selection that increases frequency of historically challenging items. Difficulty is tracked per item and persists unless contradicted by further wrong answers over the next two sessions.
The interface supports multiple languages (Polish, English, Mandarin, Arabic, Russian) via flag icons for UI labels, while content uses whatever language the Excel file contains. The visual design uses velvety green with gold frames and metallic buttons. When users answer incorrectly, the correct answer displays. The app handles any common image format and runs as a desktop application with potential web-based options. The workflow starts with opening the app to see available courses from folders or Excel filenames, then selecting a course and choosing between Learning or Testing mode, configuring options like question type, scope, filtering, teaching style, and timer (for testing), before beginning the session.
I think I have everything I need. Let me write the full proposal now. Here it is:

ZNAWCA — Software Design Proposal
1. Overview
Znawca is an educational flashcard-style application that quizzes the user based on images and data they provide themselves. The user creates topic folders (e.g., rocks, plants, human skeleton, maps) and populates them with an Excel file and optional image subfolders. The software reads this data and generates interactive learning and testing sessions.
The app name is Znawca. The interface should have a rich, elegant appearance: velvety green backgrounds, gold decorative frames, and metallic-looking buttons. (The programmer is invited to interpret this with taste.)

2. File and Folder Structure
The application is installed in a root folder. Inside that folder, the user creates topic subfolders freely. The structure looks like this:
Znawca/
├── rocks/
│   ├── Igneous and Sedimentary Rocks.xlsx
│   ├── granite/
│   │   ├── photo1.jpg
│   │   ├── photo2.png
│   │   └── photo3.bmp
│   ├── basalt/
│   │   └── image.jpg
│   └── limestone/
│       ├── sample1.png
│       └── sample2.jpg
├── plants/
│   ├── Poisonous Plants of Europe.xlsx
│   ├── belladonna/
│   │   └── ...
│   └── hemlock/
│       └── ...
└── maps/
    └── European Capitals.xlsx   ← (no image subfolders = text-only mode)
Key rules:
The filename of the Excel file becomes the displayed course title (e.g., "Igneous and Sedimentary Rocks").
Column A always contains the item name. This name must match the corresponding image subfolder name exactly (e.g., if cell A2 says "granite," there should be a subfolder called "granite").
Other columns contain questions and answers about each item. The column header is the question text (e.g., "What is the origin of this rock?") and each cell in that column is the correct answer for that row's item.
Columns marked with # in the header (e.g., #Kingdom, #Class) are used only for filtering and scope selection — they are never asked as quiz questions.
Semicolon-separated values in a cell (e.g., "quartz; feldspar; mica") mean the answer consists of multiple parts. The user may type them in any order and all are required for a fully correct answer. Partial credit is possible (see scoring section).
If a topic folder contains no image subfolders, the quiz operates in text-only mode.
The software should accept any common image file format found in the subfolders (JPG, PNG, BMP, GIF, WEBP, etc.).

3. Application Flow
On launch, the user sees:
A list of available courses (detected from the topic folders and their Excel filenames).
They select a course.
They choose a mode: Learning or Testing.
They configure session options (scope, question type, filters, teaching style, timer).
The session begins.

4. Modes
4.1 Learning Mode
The user selects a scope: a number of questions from 3 up to the maximum available. The software then draws that many questions randomly from the available pool (random mix of items and question columns).
Mechanics during the session:
A question answered correctly is removed from the active pool.
A question answered incorrectly is shown the correct answer, then returned to the pool and now requires two consecutive correct answers to be removed.
For semicolon-separated answers: partial credit is acknowledged, but the question still counts as incorrect and must be fully redone.
The session ends when the pool is empty (all questions mastered) or the user quits manually.
If the user quits mid-session, on their next visit they are offered the choice: "Resume interrupted session" or "Start a new session."
4.2 Testing Mode
Each question appears exactly once. The user answers and at the end receives a percentage score (correct answers / total questions × 100%).
Optional: the user can enable a timer (e.g., 10, 15, or 20 seconds per question) to increase difficulty. If time runs out, the answer counts as incorrect.
The app should keep a score history per course so the user can track their progress over time (date, scope, percentage, whether timed).

5. Question Types
Before a session, the user chooses one of the following or selects "randomize" to mix them:
Type A — Text input: The software displays an image (or item name in text-only mode) and a question. The user types the answer into a blank field.
Type B — Multiple choice: The software displays an image (or item name) and a question, plus several answer buttons. One button is correct; the others are wrong answers pulled from the same column. If the column contains only 3 unique values, show 3 buttons. If 4 or more, show 4 buttons.
Type C — Pick the picture: The software displays four images and asks, for example, "Which picture shows a kangaroo?" One image is from the correct subfolder; the other three are from other items' subfolders.
In text-only mode (no image subfolders), Types A and B work in both directions, randomized: sometimes the item name is shown and the user is asked about a property, and sometimes a property value is shown and the user is asked which item it belongs to (multiple choice from the name column). Type C is not available without images.

6. Filtering and Scope Selection
Before starting a session, the user can optionally filter which items are included.
The interface presents the filterable columns (those marked with # in the header) as a set of checkboxes. The user picks a column (e.g., "Class"), then checks off the values they want to include (e.g., "Mammals"). Multiple filters can be stacked with AND logic (e.g., Class = Mammals AND Habitat = Aquatic → results in whales and dolphins only).
Smart skip rule: If, after filtering, all remaining items share the same value in a particular question column, that column is automatically excluded from the quiz for that session (since the question would be meaningless).

7. Teaching Style (Strict vs. Lenient)
When configuring a session, the user selects:
Strict: Wrong answers in multiple choice (Types B and C) are drawn only from items within the current filtered scope. This makes the quiz harder because the distractors are more similar to the correct answer.
Lenient: Wrong answers may be drawn from the entire dataset (all rows in the Excel file regardless of filter). This is easier because the distractors may be obviously different.

8. Difficulty Memory
The software remembers which items (rows) the user historically struggles with. This is tracked per item, not per specific question column.
Behavior:
When an item is answered incorrectly, it is flagged as a "difficulty item."
In future sessions, the user can opt to prioritize difficult items — this increases the probability of those items being selected when building the question pool.
If a difficulty item is answered correctly over the next two sessions without further errors, the difficulty flag is cleared.
This memory persists across sessions.
The user has three choices for how questions are selected: randomize, specify scope via filters, or prioritize difficulty items. These can also be combined (e.g., filter to marsupials AND prioritize difficulty).

9. Feedback
When the user answers a question incorrectly, the software immediately displays the correct answer before moving on to the next question.

10. Multilingual Interface
The user interface (buttons, labels, instructions, system messages) is available in five languages: Polish, English, Mandarin Chinese, Arabic, and Russian. Language is selected by clicking a flag icon, accessible from the main screen.
The quiz content (questions, answers, item names) is in whatever language the user writes in their Excel file — the software does not translate content.

11. Platform
Primary target: a desktop application running locally on the user's own computer (Windows). A web-based version remains a possibility for future consideration; in that case, images and Excel files would need to be hosted or uploaded, which adds complexity.

12. Summary of User-Configurable Options Per Session
Before each session, the user may configure: the mode (Learning or Testing), number of questions (scope), question type (text input, multiple choice, pick the picture, or randomized), filters (via checkboxes on #-marked columns), teaching style (strict or lenient), difficulty prioritization (on or off), and timer (Testing mode only, with selectable duration).

13. Data Provided by User vs. Developed by Programmer
User provides: all topic folders, Excel files with questions/answers, and image subfolders with photos.
Programmer develops: the application itself — reading and parsing Excel files, displaying images, generating quizzes, managing sessions, tracking scores and difficulty, and rendering the user interface.

