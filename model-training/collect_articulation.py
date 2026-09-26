"""Collect labeled bow strokes from a local webcam.

Keys 1-4 select articulation labels, n marks an audio note onset, and q quits.
The production browser uses Web Audio onsets; this collector's manual onset
key lets a small offline dataset preserve the same feature schema.
"""
import argparse
import csv
import time
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

LABELS = {"1": "legato", "2": "staccato", "3": "hooked", "4": "detache"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--performer", required=True)
    parser.add_argument("--session", required=True)
    parser.add_argument("--hand-model", required=True)
    parser.add_argument("--out", default="data/articulation.csv")
    args = parser.parse_args()
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    exists = output.exists()
    camera = cv2.VideoCapture(0)
    options = vision.HandLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=args.hand_model), running_mode=vision.RunningMode.VIDEO, num_hands=2)
    label = None
    onset_count = 0
    points = []
    direction = 0
    started_at = 0
    last_x = None
    last_time = 0
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
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = hand.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(time.monotonic() * 1000))
            if result.world_landmarks:
                now = time.monotonic() * 1000
                x = result.world_landmarks[0][0].x
                speed = 0 if last_x is None or now == last_time else (x - last_x) / (now - last_time)
                next_direction = direction if abs(speed) < 0.0003 else (1 if speed > 0 else -1)
                if direction and next_direction != direction and label and now - started_at >= 80:
                    mean = sum(points) / len(points) if points else 0
                    variance = sum((value - mean) ** 2 for value in points) / len(points) if points else 0
                    writer.writerow([label, args.performer, args.session, round(now - started_at, 2), mean, variance, onset_count])
                    points, onset_count, started_at = [], 0, now
                if not started_at:
                    started_at = now
                direction = next_direction
                points.append(abs(speed))
                last_x, last_time = x, now
            cv2.putText(frame, f"label: {label or 'none'} | onsets: {onset_count} | q quit", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.imshow("cello articulation collection", frame)
    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
