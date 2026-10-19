# Companion practice stage (2026-10-19)

This stage implements ADR-0015 and is **not complete phoneme-scoring acceptance**.

## Authoring

Upload a ZIP containing `course.json`, an XLSX script and audio next to that script. Manifest: `{"engine":"companion","title":"My lesson","languageCode":"en","source":"script.xlsx"}`. Use A–Q column order from `requirements/COMPANION.md`. An optional header has `Checkpoint` in B1. Legacy XLS must be converted to XLSX.

B is a unique positive checkpoint integer; C is a finite 0–300 second delay. E/G/J/L/N/P are mutually exclusive audio references. H accepts Y or empty and Y requires audio. Audio starts with its column letter and four digits, such as J0001.wav; prefix references match a single file, ambiguity fails import. WAV, MP3, OGG and M4A are supported; compressed files require ffmpeg. All references are decoded at import, including rows outside the selected checkpoint. WAV must be 16-bit PCM, mono/stereo, 8–48 kHz; prefer mono 16 kHz. Maximum reference length is 30 seconds, or 20 seconds for voice rows. Source errors include row location for authors.

Q supports `[bold]`, red/green/blue/yellow/orange/purple tags, leading `*` continuation and exact `WIPE CLEAN`. Unknown tags stay literal; HTML is never executed. Prior Q operations reconstruct the checkpoint transcript and each reference-bearing segment remains replayable. The platform retains ordered rows and handles checkpoint selection.

`templates/create_example.py` generates a working import fixture. Its synthetic tone is clearly labelled a UI/microphone demonstration, not a spoken-language training course. Authors must replace it with their own reference speech.

## Recording and diagnostics

The learner starts each script step explicitly, compatible with browser playback permissions and the platform Next control. Nonvoice rows play audio and acknowledge completion; voice rows request microphone permission before the 3-second onset window, then capture up to 1.5 times reference duration. Browser onset detection uses a simple local RMS threshold, not a learned speech classifier. Background noise can trigger it. Pausing cancels recording and releases the device; continuing restarts that row's recording. Replay requires no microphone. Repeat practice calls a non-persistent platform analysis endpoint and leaves progress/history unchanged.

The server accepts bounded PCM WAV (2 MiB, at most 30 seconds), validates duration, and computes locally with numpy: frame spectra, energy, autocorrelation pitch, bounded DTW alignment, duration/pause and relative intonation similarity. Reference features are precomputed at import. Raw uploads are ephemeral; the platform stores only request digests, sanitized submission labels and diagnostic results. No hosted API, browser recognition, cloud TTS, external model download or secret key is used.

The displayed metrics are experimental acoustic comparisons, **not phoneme correctness or pronunciation accuracy**. Device/noise/speaker differences affect them, and poor recordings cannot establish linguistic errors. Silence receives no-response status. A completion score of 1 means the script row was completed, including a timed-out response; it must never be labelled a correct pronunciation. Formal tests are blocked by the platform. Real phoneme assessment, language-specific models, human calibration and accuracy thresholds remain a later stage.

This implementation writes its own bounded signal processing; no GitHub implementation was copied. numpy remains a separately installed dependency. Research references: librosa (ISC), Silero VAD (MIT), MFA (MIT) and Kaldi GOP recipe (Apache 2.0) are potential later components, not currently installed models.

## Verified and pending

12 backend tests cover exact row/checkpoint order, duplicate checkpoints, file conflicts, unsafe references, workbook budgets/corruption, missing voice audio, display reconstruction, PCM validation, bounded input, no-response and identical-audio comparison. A real API round trip covers checkpoint start, recording, non-persistent repeat practice, finish/history and no raw audio retention. Eight frontend tests cover PCM encoding, native controls in all five platform locales, readonly replay, repeat practice, no-response cleanup, permission denial and cancellation before a delayed permission grant or during suspended audio initialization. Browser microphone behavior still needs a real device/permission interaction acceptance; synthetic tests are not a pronunciation-accuracy validation.
