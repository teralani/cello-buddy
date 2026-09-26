"""Collect labeled bow strokes from a local webcam.

Keys 1-4 select articulation labels, n manually marks an audio note onset,
and q quits. Audio attacks are detected automatically as RMS level rises.
"""
import argparse
import csv
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import sounddevice as sd
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

LABELS = {"1": "legato", "2": "staccato", "3": "hooked", "4": "detache"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--performer", required=True)
    parser.add_argument("--session", required=True)
    parser.add_argument("--hand-model", required=True)
    parser.add_argument("--out", default="data/articulation.csv")
    parser.add_argument("--device", type=int, default=None, help="sounddevice input device index")
    args = parser.parse_args()
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    exists = output.exists()
    camera = cv2.VideoCapture(0)
    options = vision.HandLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=args.hand_model), running_mode=vision.RunningMode.VIDEO, num_hands=2)
    label = None
    onset_count = 0
    points = []
    active_points = []
    direction = 0
    started_at = 0
    last_x = None
    last_time = 0
    audio_rms = 0.0
    audio_noise_floor = 0.0
    last_audio_onset = -float("inf")

    def capture_audio(indata, _frames, _time, _status):
        nonlocal audio_rms
        audio_rms = float(np.sqrt(np.mean(indata ** 2)))

    try:
        audio_info = sd.query_devices(args.device, "input")
        audio = sd.InputStream(device=args.device, channels=1, callback=capture_audio)
        print(f"Using audio input: {audio_info['name']}")
        audio.start()
    except sd.PortAudioError as error:
        raise SystemExit(
            f"Could not open audio input {args.device if args.device is not None else 'default'}: {error}\n"
            "Try --device 1 (MME) or --device 9 (WASAPI)."
        ) from error
    with vision.HandLandmarker.create_from_options(options) as hand, output.open("a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        if not exists:
            writer.writerow(["label", "performer_id", "session_id", "duration_ms", "mean_speed", "speed_variance", "note_onset_count"])
        while True:
            ok, frame = camera.read()
            if not ok:
                break
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if chr(key) in LABELS:
                label = LABELS[chr(key)]
            if key == ord("n"):
                onset_count += 1
            now = time.monotonic() * 1000
            audio_noise_floor = audio_noise_floor * 0.98 + audio_rms * 0.02
            onset_threshold = max(0.006, audio_noise_floor * 2.5)
            if audio_rms - audio_noise_floor >= onset_threshold and now - last_audio_onset >= 120:
                onset_count += 1
                last_audio_onset = now
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = hand.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(time.monotonic() * 1000))
            right_hand_index = next((index for index, categories in enumerate(result.handedness) if categories and categories[0].category_name == "Right"), 0)
            if result.hand_world_landmarks and right_hand_index < len(result.hand_world_landmarks):
                now = time.monotonic() * 1000
                x = result.hand_world_landmarks[right_hand_index][0].x
                speed = 0 if last_x is None or now == last_time else (x - last_x) / (now - last_time)
                next_direction = direction if abs(speed) < 0.0003 else (1 if speed > 0 else -1)
                if direction and next_direction != direction and label and now - started_at >= 80:
                    mean = sum(points) / len(points) if points else 0
                    variance = sum((value - mean) ** 2 for value in points) / len(points) if points else 0
                    active_ratio = sum(active_points) / len(active_points) if active_points else 0
                    if active_ratio >= 0.25:
                        writer.writerow([label, args.performer, args.session, round(now - started_at, 2), mean, variance, onset_count])
                    points, active_points, onset_count, started_at = [], [], 0, now
                if not started_at:
                    started_at = now
                direction = next_direction
                points.append(abs(speed))
                active_points.append(audio_rms >= max(0.015, audio_noise_floor * 2))
                last_x, last_time = x, now
            cv2.putText(frame, f"label: {label or 'none'} | onsets: {onset_count} | rms: {audio_rms:.3f} | q quit", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.imshow("cello articulation collection", frame)
    camera.release()
    audio.stop()
    audio.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
