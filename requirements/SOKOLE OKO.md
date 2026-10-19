

Sokole Oko — Software Specification Document
General Concept
Sokole Oko is an educational tool built around visual recognition. The software shows the user an image and asks a question. The user answers by clicking on a specific region of the image. The software determines correctness by comparing the click location against a pre-made black-and-white mask file. The tool has two versions: a standalone Windows desktop application and a web-based online version. Course content (images, masks, and text files) is created by the content author and organized into folders. Users can also create their own course folders.

Platform
The desktop version runs on Windows and is installed locally. Course content resides in subfolders within the installation directory. The web version is accessed through a browser, requires user registration with username and password, and includes a payment/subscription system (details of payment integration, such as QR code or other methods, to be discussed separately). Both versions share the same core logic and interface design.

Course Structure
The main application folder contains subfolders, each representing a course module. Example subfolder names include "Constellations 1 - ecliptical (basic)", "Constellations 2 - ecliptical (intermediate)", "Constellations 3 - ecliptical (advanced)", "Maps 1 - countries", "Maps 2 - major cities", "Lunar topography", "Mimicry", and so on.
The software reads the folder name and parses it for two pieces of information: a base course name (everything except the number) and a difficulty level (the number in the name). When folders share the same base name but different numbers, the software groups them into a single course with a difficulty toggle. For example, "Constellations 1 - ecliptical (basic)" and "Constellations 2 - ecliptical (intermediate)" would appear to the user as one course called "Constellations - ecliptical" with difficulty levels 1 and 2. Folders without a number in their name (such as "Mimicry") are treated as standalone courses with no difficulty selection.
Folder naming must follow a consistent pattern for the grouping to work. The programmer should define and document the exact expected pattern (suggested format: "CourseName Number - description").

File Naming Convention
Within each course folder, there are three types of files: image files, mask files, and text files.
Image files are named with the course identifier followed by a number, for example: nightsky01.png or muddypuddle03.jpg. Accepted image formats should be generous — at minimum PNG, JPG, BMP, and WEBP.
Mask files are always PNG (to avoid compression artifacts blurring the black/white boundary). A mask file is named using the corresponding image file's name, followed by a double-hyphen separator (--), followed by the answer label and a number. For example: nightsky01--Orion1.png, nightsky01--Gemini1.png, muddypuddle03--Frog1.png, muddypuddle03--Frog2.png, muddypuddle03--Frog3.png. The mask is the same pixel dimensions as its corresponding image. Black pixels represent the correct click zone; white pixels represent incorrect zones.
Text files contain the question to be displayed. They can be named either after the image (e.g., muddypuddle03.txt) or after a specific mask (e.g., nightsky01--Orion1.txt). This naming choice also determines the question type and failure behavior, as explained below. Inside the text file, each line begins with a language code followed by a colon and the question text. The software should accept both short codes and full language names. An example text file might look like this:
EN: Show me the constellation Orion.
PL: Wskaż konstelację Oriona.
AR: أرني كوكبة الجبار
RU: Покажи мне созвездие Ориона.
ZH-S: 请指出猎户座。
ZH-T: 請指出獵戶座。
Accepted language codes: EN / English, PL / Polish, AR / Arabic, RU / Russian, ZH-S / Simplified Chinese, ZH-T / Traditional Chinese.

Two Question Types
The software supports two question types, determined automatically by the naming of the text file.
Knowledge questions have a text file named after a specific mask (e.g., nightsky01--Orion1.txt). The software shows the image, asks the question (e.g., "Show me Orion"), and expects a single click. On a correct click, the mask region glows green. On a wrong click, the mask region glows red — thus revealing the correct answer to help the user learn.
Observation questions have a text file named after the image itself (e.g., muddypuddle03.txt). The software shows the image, asks the question (e.g., "Find all the creatures hiding here"), and expects the user to click on all targets associated with that image (one click per mask). The user can find them in any order. Each correct click produces a green glow in the shape of that mask. If the user misclicks at any point, the entire image glows red without revealing the locations of unfound targets, and the question is marked as failed.
A given course folder will typically use one style or the other, but the system should handle both styles coexisting in the same folder without conflict.

Click Detection and Tolerance
When the user clicks, the software checks whether the click coordinates fall within the black zone of the relevant mask. Because some targets are very small (e.g., a star of only a few pixels), the software applies a dynamic tolerance buffer.
The tolerance is inversely proportional to the size of the target. The software calculates the ratio of black pixels to total image pixels. A smaller ratio (tiny target) results in a larger forgiveness radius applied as an invisible expansion around the mask's edges. A larger ratio (big target) results in minimal or no expansion. The programmer should implement this as a pixel-inflation of the mask boundary before checking the click, and the exact formula should be tuneable through testing.

Visual and Audio Feedback
On a correct click, the mask area on the displayed image glows green. On an incorrect click, the behavior depends on question type: knowledge questions glow red in the shape of the correct answer; observation questions glow the entire image red. The glow appears for approximately half a second, then fades or disappears. In observation questions with multiple targets, after each successful click the green glow appears for half a second, then the image returns to normal and the user continues clicking for remaining targets.
After all feedback is displayed, the software auto-advances to the next question after half a second (measured from the moment the glow disappears or from the final click event).
Audio feedback is provided via sound files (MP3 or WAV) placed in the application's resources. One sound for correct, one for wrong. The content author will provide these files.

User Interface Flow
On launch (desktop): the user selects or creates a profile. On the web version: the user logs in.
After authentication, the user sees a single configuration screen with the following toggles and selectors: course selection (dropdown or list of available courses), difficulty level (if the selected course has multiple levels), mode selection (Learning or Testing), scope (a number input showing the upper limit of available questions, adjustable by the user from 3 up to that limit), interface language (flag icon toggle), question language (separate flag icon toggle), and an option to continue an interrupted session if one exists.
The interface language and question language are independent settings. A user can navigate menus in English while being quizzed in Polish, for example.

Learning Mode
The user chooses a scope (for example, 10). The software selects that many questions from the course and presents them in random order, cycling through the pool repeatedly.
When a question is answered correctly on the first attempt, it is removed from the pool. When a question is answered incorrectly, it remains in the pool but now requires two consecutive correct answers before being removed. If the user answers it correctly once but then incorrectly on a subsequent encounter, the counter resets — it must again be answered correctly twice in a row.
The session ends when all questions have been mastered (removed from the pool).
At the end of the session, a pie chart is displayed showing how many questions were mastered on the first try, how many required two rounds, three rounds, and so on — giving a visual overview of mastery.

Testing Mode
The user chooses a scope. The software selects that many questions randomly and presents each one exactly once. At the end, the user receives a score expressed as a percentage of correctly answered questions.

Problem Area Memory
The software automatically tracks which questions each user struggles with across sessions. Questions that are frequently answered incorrectly are silently given a higher probability of appearing in future learning and testing sessions. This weighting is automatic with no toggle — it is always active.

Session History
The software maintains a log of past session results per user, showing date, course, mode, scope, and score. This is accessible from a simple history screen so the user can track improvement over time.

Interrupted Sessions
If a user exits mid-session, progress is saved. On next launch, the configuration screen offers an option to continue the interrupted session from where it was left off.

Languages
The interface (all buttons, labels, menus, and system messages) is available in: English, Polish, Arabic, Russian, Simplified Chinese, and Traditional Chinese. Arabic and other RTL languages must display with a fully inverted/mirrored interface layout. The interface language and the question language are toggled independently via flag icons.

User Profiles
The desktop version supports multiple user profiles on one installation. A profile selection screen appears at launch. Each profile stores its own session history, problem area data, and interrupted session state.
The web version uses username/password accounts and stores the same data server-side.

Payment System (Web Version Only)
The online version includes a payment or subscription system. Integration method (QR code, card payment, etc.) to be discussed and decided between the content author and programmer.

Error Handling for Missing Translations
In the desktop version: if a text file lacks a translation line for the user's selected question language, the software displays an error message identifying which file is missing the translation. This helps the content author catch gaps during development.
In the web version: the software silently skips any question whose text file lacks a translation in the user's chosen language.

Summary of File Types in a Course Folder
Each course folder contains: image files (multiple formats accepted), mask files (PNG only, same dimensions as their parent image, pure black and white), and text files (plain text, one language per line, named after either the image or a specific mask).
