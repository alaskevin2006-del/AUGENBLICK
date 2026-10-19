"""Bounded CPU acoustic diagnostics, deliberately NOT phoneme assessment."""
import io
import subprocess
import wave
import numpy as np

MAX_BYTES = 2 * 1024 * 1024
MAX_SECONDS = 30


def reference_bytes(path):
    if path.suffix.lower() == '.wav':
        data = path.read_bytes()
        if len(data) > MAX_BYTES:
            raise ValueError('Reference WAV exceeds 2 MiB; use mono 16 kHz PCM.')
        return data
    try:
        result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', str(MAX_SECONDS + 1), '-ac', '1', '-ar', '16000', '-f', 'wav', '-'], capture_output=True, timeout=15, check=True)
        return result.stdout
    except (OSError, subprocess.SubprocessError) as error:
        raise ValueError('Cannot decode reference audio; provide PCM WAV or enable ffmpeg.') from error


def features(data):
    if len(data) > MAX_BYTES:
        raise ValueError('Recording exceeds 2 MiB.')
    try:
        with wave.open(io.BytesIO(data), 'rb') as audio:
            rate, channels, width = audio.getframerate(), audio.getnchannels(), audio.getsampwidth()
            if channels not in (1, 2) or width != 2 or rate < 8000 or rate > 48000:
                raise ValueError('Use 16-bit PCM WAV, 8–48 kHz, mono or stereo.')
            raw = audio.readframes(rate * (MAX_SECONDS + 1))
            signal = np.frombuffer(raw, dtype='<i2').astype(float).reshape(-1, channels).mean(axis=1) / 32768
    except (wave.Error, EOFError, OSError) as error:
        raise ValueError('Invalid PCM WAV recording.') from error
    duration = len(signal) / rate
    if not .08 <= duration <= MAX_SECONDS:
        raise ValueError('Audio must be between 0.08 and 30 seconds.')
    # Resample to a bounded common grid. No learned model or hosted service.
    signal = np.interp(np.arange(int(duration * 8000)) / 8000, np.arange(len(signal)) / rate, signal)
    frames = np.array([signal[i:i + 256] for i in range(0, len(signal) - 255, 160)])
    rms = np.sqrt(np.mean(frames * frames, axis=1))
    voiced = rms > max(.006, float(np.percentile(rms, 90)) * .10)
    spectra, pitch = [], []
    bins = np.unique(np.geomspace(2, 129, 25).astype(int))
    for frame in frames:
        centered = frame - frame.mean()
        spectrum = np.abs(np.fft.rfft(centered * np.hanning(256)))
        spectrum = np.log1p(np.array([np.mean(spectrum[a:b]) for a, b in zip(bins[:-1], bins[1:])]) * 100)
        norm = np.linalg.norm(spectrum)
        spectra.append((spectrum / norm if norm > 1e-8 else spectrum).tolist())
        corr = np.correlate(centered, centered, 'full')[255:]
        lag = 20 + int(np.argmax(corr[20:134]))
        pitch.append(8000 / lag if corr[0] > 1e-8 and corr[lag] / corr[0] > .35 else 0)
    # Preserve original timeline for visual rhythm; sample at most 128 frames.
    idx = np.linspace(0, len(frames) - 1, min(128, len(frames))).astype(int)
    return {'duration': round(duration, 4), 'speechFraction': float(voiced.mean()),
            'spectrum': np.asarray(spectra)[idx].round(5).tolist(),
            'pitch': np.asarray(pitch)[idx].round(2).tolist(),
            'energy': rms[idx].round(5).tolist(), 'voiced': voiced[idx].tolist()}


def compare(reference, learner):
    a, b = np.asarray(reference['spectrum']), np.asarray(learner['spectrum'])
    costs = np.clip(1 - a @ b.T, 0, 1)
    acc = np.full((len(a) + 1, len(b) + 1), np.inf)
    acc[0, 0] = 0
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            acc[i, j] = costs[i - 1, j - 1] + min(acc[i - 1, j], acc[i, j - 1], acc[i - 1, j - 1])
    path, i, j = [], len(a), len(b)
    while i and j:
        path.append((i - 1, j - 1))
        move = int(np.argmin([acc[i - 1, j - 1], acc[i - 1, j], acc[i, j - 1]]))
        i -= move != 2
        j -= move != 1
    similarity = float(1 - np.mean([costs[i, j] for i, j in path]))
    pitch_pairs = [(reference['pitch'][i], learner['pitch'][j]) for i, j in path if reference['pitch'][i] and learner['pitch'][j]]
    intonation = None
    if len(pitch_pairs) >= 4:
        tones = 12 * np.log2(np.asarray(pitch_pairs))
        tones -= np.median(tones, axis=0)
        intonation = float(np.exp(-np.mean(np.abs(tones[:, 0] - tones[:, 1])) / 4))
    ratio = learner['duration'] / reference['duration']
    rhythm = float(np.exp(-abs(np.log(ratio)) - abs(learner['speechFraction'] - reference['speechFraction'])))
    if learner['speechFraction'] < .05:
        similarity, rhythm, intonation = 0., 0., None
    return {'method': 'acoustic-dtw-v1', 'acousticSimilarity': round(similarity, 4),
            'timingSimilarity': round(rhythm, 4), 'intonationSimilarity': None if intonation is None else round(intonation, 4),
            'reference': reference, 'learner': learner,
            'alignment': [[i, j, round(float(1 - costs[i, j]), 4)] for i, j in reversed(path)],
            'notice': 'Experimental acoustic comparison; not phoneme accuracy.'}
