

Thinking...
The user wants me to redo the proposal incorporating all the clarifications. Let me also think about recommendations for the speech analysis/comparison component (point 5). Let me think about what libraries/approaches would be suitable for pronunciation training that focuses on accurate pronunciation without being overly scientific:
Praat/Parselmouth - Praat is the gold standard for phonetic analysis (pitch, formants, intensity, spectrograms). Parselmouth is the Python wrapper. Good for pitch tracking, intensity analysis, spectrogram generation.
Dynamic Time Warping (DTW) - specifically libraries like librosa (Python) or dtw-python - for aligning two utterances of different lengths and comparing their spectral features.
This handles stuttering and pauses. For forced alignment at the phoneme level, I could use Kaldi, Wav2Vec 2.0, or Whisper to map audio to phonemes and words, which would let me compare at a granular level. Montreal Forced Aligner is another solid option specifically designed for this task. For pitch tracking, CREPE or PYIN would give me more robust results than basic autocorrelation methods.
The most practical approach for pronunciation training would focus on spectral comparison—I need to align the reference and learner audio, extract comparable acoustic features, and provide meaningful feedback without overwhelming the user with technical details.
My top recommendations are Librosa for general audio analysis and feature extraction, Parselmouth or Praat for pitch and intensity tracking (the gold standard in phonetics), Dynamic Time Warping to align utterances despite timing differences and disfluencies, and Montreal Forced Aligner for phoneme-level segmentation so I can pinpoint exactly which sounds need improvement.
I should also add voice activity detection using WebRTC VAD or Silero VAD to handle the 3-second timer accurately and manage pauses or stuttering gracefully. Now I'm ready to put together the full proposal with all these clarifications incorporated.
Technical Proposal: "Companion" — Language Training Script Engine

1. Overview
Companion is a script-driven language training engine that delivers interactive audio-based lessons to learners. It operates by reading an Excel spreadsheet (the "script") row by row, executing instructions that result in playing audio files, displaying text, and capturing learner voice input for pronunciation evaluation. Each row represents a single instructional step — typically the playback of one audio segment — and the learner experiences the lesson as a guided, semi-interactive conversation.
Companion functions as a subordinate module within a larger software ecosystem referred to as "Augenblick" (also known as "至言"), which manages navigation between units and courses at higher tiers. The Augenblick system will be specified in a separate proposal. For the purposes of this document, it is sufficient to know that Companion receives a script file and a starting point (optionally a checkpoint number), executes the script, and upon completion returns control to the calling tier. When the last checkpoint called for by the superstructure has been completed, the software does not simply vanish — it presents a clearly visible button labeled "Click to continue" and waits for the learner to press it before returning control to the higher-tier system.

2. Script Structure
The script is an Excel spreadsheet (.xlsx or .xls) in which each row constitutes one instruction and each column serves a dedicated purpose. The software processes rows sequentially from top to bottom unless directed otherwise by the higher-tier system.

3. Pre-Execution Validation
Before beginning playback of any row, the software must scan the entire script and verify that all referenced audio files exist in the lesson folder. If any file is missing, the software reports the error to the course designer — identifying the row number and the missing filename — and does not begin execution until the issue is resolved. Similarly, if any row contains audio references in more than one of the mutually exclusive columns (E, G, J, L, N, P), this is reported as an inconsistency at this stage.

4. Column Definitions
Column A — Notes (Inactive)
This column exists solely for the benefit of the course designer. It may contain any organizational notes, structural comments, or reminders. The software ignores Column A entirely and never reads or processes its contents during execution.
Column B — Checkpoint
A checkpoint is a simple integer (1, 2, 3, etc.) marking the beginning of a named section within the script. Checkpoints serve as navigation anchors for the Augenblick superstructure, which may direct Companion to begin playback at a specific checkpoint rather than at row 1. When the higher-tier system issues a command such as "play section 4," Companion locates the row where Column B contains the value 4 and begins execution from that row.
Column C — Pause (in seconds)
This column controls the timing between consecutive rows. An empty cell is equivalent to a value of 0, meaning the current row's action follows the previous row's action with no gap. If the course designer wishes to insert silence before a row's action, they enter a numeric value representing the duration in seconds (e.g., 2 for a two-second pause, or 0.3 for a brief 300-millisecond pause). The pause occurs before the current row's action is executed — silence first, then playback.
Column D — Guidance in Mother Tongue (Text)
This column contains the textual content of instructions delivered to the learner in their native language. It serves primarily as a reference for the course designer to understand the intent of the row. For example, in a course teaching English to Chinese speakers, it might read: "欢迎参与至言纽约美式英语课程……". The software does not directly use Column D for playback — it uses Column E for that — but Column D documents the meaning of the associated audio.
Column E — Guidance in Mother Tongue (Audio)
This column contains the filename of the audio file corresponding to the mother-tongue guidance described in Column D. When the software reaches this row, it plays this audio file. The file resides in the lesson's dedicated folder. Filenames follow a standardized pattern: the column letter ("E"), followed by a four-digit sequential number (e.g., E0001, E0024), optionally followed by additional descriptive text that the software disregards beyond identifying the file (e.g., "E0003_welcome_intro.mp3").
Column F — Guidance in Target Language (Text)
As the learner advances in proficiency, the course designer may shift instructional guidance into the target language. Column F holds the textual content of such guidance. This column functions analogously to Column D but in the language being taught.
Column G — Guidance in Target Language (Audio)
This column holds the filename for the audio file corresponding to Column F. Naming convention: files begin with the letter "G" followed by a four-digit number (e.g., G0012_repeat_after_me.mp3). Playback behavior is identical to Column E.
Column H — Voice Input (Speech Production and Evaluation)
This column is a behavioral flag — not an audio reference. A "Y" in this column signals that the learner is expected to produce speech into a microphone. The learner's utterance is then compared against the reference audio file that exists elsewhere in the same row (in whichever one of the audio columns E, G, J, L, N, or P contains a filename on that row). Column H does not have its own dedicated audio files.
Timing and flow:
Upon reaching a row with "Y" in Column H, the software presents a visual countdown indicator (a shrinking progress bar, clock animation, or equivalent) giving the learner a sense of time pressure. The learner has 3 seconds to begin speaking. If no speech onset is detected within 3 seconds, the software plays the reference audio instead, logs this as a failure to respond, and advances to the next row. If the learner does begin speaking within the 3-second window, they are allowed a total duration of 1.5× the length of the reference audio file to complete their utterance. Once this time elapses — whether or not the learner has finished — the reference audio is played, and the software advances to the next row.
Visual feedback:
After the learner speaks, the software displays a composite spectral visualization consisting of the following elements. First, the learner's spectral image is overlaid on the reference spectral image, with color coding indicating the degree of match: green regions denote close correspondence and red regions denote significant divergence. Second, a winding, curvy line represents the pitch contour (intonation pattern), with the line's thickness varying according to volume (louder/stressed syllables produce a thicker line). Third, thin vertical dotted lines segment the utterance based on stress pattern (rhythm), with the reference rhythm shown above the spectral image and the learner's rhythm shown below.
Intelligent comparison:
The matching algorithm must be tolerant of hesitations, pauses, and minor stuttering on the part of the learner. The system should still be able to judge overall pronunciation accuracy despite such disfluencies.
Practice mode:
If the learner clicks on the feedback visualization, the course progression freezes and the learner enters a practice loop where they can repeat the utterance as many times as desired, each time receiving updated visual feedback showing how closely their pronunciation, rhythm, and intonation match the model. During this paused state, a clearly visible button labeled "Course paused. Press to continue." is displayed. Pressing this button resumes execution at the next row.
Global pause:
The learner may pause the course at any point during execution (not only during voice input) to attend to other matters. A universal pause control must be accessible at all times.
Column I — Target Language: Male Speaker 1 (Text)
Contains the dialogue text spoken by the primary male character. This serves as a reference for the course designer and may be used for display (see Column Q).
Column J — Target Language: Male Speaker 1 (Audio)
Contains the filename of the audio file for Male Speaker 1. Naming convention: files begin with the letter "J" followed by a four-digit number (e.g., J0005_ordering_coffee.mp3).
Column K — Target Language: Female Speaker 1 (Text)
Contains the dialogue text spoken by the primary female character.
Column L — Target Language: Female Speaker 1 (Audio)
Contains the filename for Female Speaker 1's audio. Files begin with the letter "L" (e.g., L0007_greeting.mp3).
Column M — Target Language: Male Speaker 2 (Text)
Contains dialogue text for an optional secondary male character, used when the scenario requires more than one male voice.
Column N — Target Language: Male Speaker 2 (Audio)
Audio filename for Male Speaker 2. Files begin with the letter "N" (e.g., N0002_bystander.mp3).
Column O — Target Language: Female Speaker 2 (Text)
Contains dialogue text for an optional secondary female character.
Column P — Target Language: Female Speaker 2 (Audio)
Audio filename for Female Speaker 2. Files begin with the letter "P" (e.g., P0003_receptionist.mp3).
Column Q — Display (On-Screen Text)
This column controls what text is shown on screen during the lesson. When the software finishes executing a row's audio action, it checks Column Q. If the cell contains text, that text is displayed on screen.
Formatting conventions:
Bold emphasis is indicated by wrapping a word or phrase in [bold]...[/bold] tags. This is used to highlight non-typical stress patterns. Color highlighting is indicated by tags such as [red]...[/red], [green]...[/green], etc. This is used to draw attention to lexical or grammatical features, or for contrastive comparisons (e.g., showing that noun-adjective order differs between French and English by color-coding the parts of speech).
Continuation vs. new line:
If a cell in Column Q begins with an asterisk (*), its content (minus the asterisk) is appended to the end of the previously displayed text as a continuation of the same speaker's utterance — no new line is created. If the cell does not begin with an asterisk, the text is displayed as a new line in the growing dialogue transcript.
Clickable playback:
Each displayed line of dialogue is interactive. The software internally tracks which audio segments contributed to each displayed line (including lines assembled from multiple asterisk-continuations). When the learner hovers over any portion of a composite line, the relevant sub-segment gently highlights to indicate the boundaries of what will be played. Clicking plays that sub-segment's associated audio. Each element that was glued together remains independently clickable, even though the line appears visually continuous.
Clearing the display:
If a cell contains the exact capitalized string "WIPE CLEAN", all previously displayed dialogue text is removed from the screen.
Checkpoint navigation and display state:
If the Augenblick superstructure directs Companion to begin at a checkpoint, the software must first reconstruct the display state as it would exist at that point. It scans all rows from the beginning of the script up to the target checkpoint row, processing all Column Q logic (continuation, new-line, and wipe-clean operations) without playing any audio, and presents the resulting accumulated text on screen when execution begins. Any lines visible at that point remain clickable with their associated audio files.

5. Mutual Exclusivity Rule
Columns E, G, J, L, N, and P (the audio-bearing columns) are mutually exclusive within any single row. Each row may reference at most one audio file across these columns. Violations are caught during pre-execution validation (see Section 3).

6. Speaker Architecture
The system supports four speaker slots: Male 1, Female 1, Male 2, and Female 2. This is a fixed ceiling. Scenarios requiring more than two male or two female voices are not supported and must be restructured by the course designer.

7. Execution Flow
The software reads the script sequentially starting from row 1 (or from a checkpoint row, if directed by the higher-tier system). For each row, it performs the following steps in order. First, it applies the pause specified in Column C (silence before action). Second, it identifies which action column contains content for this row (one of E, G, J, L, N, or P) and whether Column H flags voice input. Third, it executes the action: if Column H is "Y," it initiates the voice capture sequence (countdown, recording, comparison, feedback, then reference playback); otherwise it plays the audio file. Fourth, it processes Column Q display logic (show text, append text, or wipe clean). Fifth, it advances to the next row.
Upon reaching the final row and completing its execution, the software displays a "Click to continue" button and waits for the learner to press it. Control then returns to the Unit-tier script within Augenblick. If the Unit-tier script is also complete, control passes up to the Course-tier script.

8. File Organization
Each unit (lesson) resides in its own dedicated folder. All audio files referenced in a given script are expected to exist within that folder. The standardized filename format is: [Column Letter][4-digit number][optional descriptive text].mp3. The software matches files by their column-letter prefix and four-digit identifier; any additional text in the filename is ignored for matching purposes but may aid the course designer in file management.

9. Recommended Libraries for Speech Analysis and Comparison
The voice input system (Column H) is the most technically demanding component. Below are five recommended libraries and tools, each addressing a key aspect of the pronunciation comparison pipeline. These are suitable for training accurate pronunciation effectively without venturing into the complexity of dialectological research.
1. Librosa (Python) — A widely-used audio analysis library providing spectrogram generation, onset detection, tempo estimation, and feature extraction (MFCCs, chroma, spectral contrast). It serves as the foundational layer for reading audio, computing spectral representations, and extracting the features needed for visual overlays and comparison metrics.
2. Parselmouth (Python interface to Praat) — Praat is the most trusted tool in phonetics for pitch tracking, intensity contours, and formant analysis. Parselmouth wraps it in a clean Python API. It would handle extraction of the pitch curve (the "winding, curvy line") and intensity envelope (line thickness / stress detection), providing reliable, research-grade measurements without requiring the developer to implement these algorithms from scratch.
3. DTW (Dynamic Time Warping) via dtw-python or fastdtw — Dynamic Time Warping is an algorithm that aligns two time-series of different lengths and speeds, making it ideal for comparing a learner's utterance (which may be slower, faster, or interrupted by hesitations) against a reference. It allows the system to find the best temporal alignment before computing match scores, and it naturally tolerates pauses and stuttering.
4. Montreal Forced Aligner (MFA) — This tool performs phoneme-level alignment of audio to text. Given the transcript (from columns I, K, M, or O) and the audio file, MFA produces precise timestamps for each phoneme and word boundary. This enables the system to segment the reference audio into stress-rhythm units (the dotted vertical lines), and once the learner's audio is similarly aligned, to compare pronunciation phoneme by phoneme and identify exactly which sounds are off.
5. Silero VAD (Voice Activity Detection) — A lightweight, fast neural network model for detecting when speech begins and ends. It would handle the critical task of detecting speech onset within the 3-second countdown window, and of distinguishing genuine pauses/stuttering from the end of an utterance, so the system can apply its timing rules accurately.
These five tools together cover the full pipeline: audio loading and spectral visualization (Librosa), pitch and intensity analysis (Parselmouth), temporal alignment despite disfluencies (DTW), phoneme-level segmentation for rhythm display and granular feedback (MFA), and real-time speech detection for timing control (Silero VAD).

10. Scope Boundaries
This proposal covers only the Companion engine itself — the row-by-row script executor. It does not cover the Augenblick/至言 superstructure (checkpoint navigation, unit sequencing, course management), which will be addressed in a separate proposal. It also does not cover authoring tools for creating scripts, the generation of audio files, or learner progress tracking and analytics, though these may be specified in future documents.

End of Proposal
















