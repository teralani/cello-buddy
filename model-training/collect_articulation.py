"""Collect single-stroke articulation examples from a laptop webcam and mic."""
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

from features import ARTICULATION_FEATURE_COLUMNS, articulation_features

LABELS = {"1": "legato", "2": "staccato", "3": "detache"}
CSV_COLUMNS = ["label", "performer_id", "session_id", "audio_valid", *ARTICULATION_FEATURE_COLUMNS]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--performer", required=True)
    parser.add_argument("--session", required=True)
    parser.add_argument("--hand-model", help="Deprecated; retained for command compatibility")
    parser.add_argument("--pose-model", default=None, help="Local pose_landmarker_lite.task path")
    parser.add_argument("--out", default="data/articulation.csv")
    parser.add_argument("--device", type=int, default=None, help="sounddevice input device index")
    parser.add_argument("--motion-threshold", type=float, default=0.00008)
    parser.add_argument("--audio-threshold", type=float, default=0.0005, help="minimum microphone RMS treated as cello sound")
    parser.add_argument("--minimum-audio-ratio", type=float, default=0.35)
    parser.add_argument("--reversal-ms", type=float, default=70)
    parser.add_argument("--reversal-distance", type=float, default=0.003)
    args = parser.parse_args()

    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    exists = output.exists()
    if exists:
        with output.open("r", newline="", encoding="utf-8") as existing_file:
            if next(csv.reader(existing_file), []) != CSV_COLUMNS:
                raise SystemExit(f"{output} has an incompatible schema; choose a new output file.")

    camera = cv2.VideoCapture(0)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    pose_model = args.pose_model or str(Path(args.hand_model).with_name("pose_landmarker_lite.task"))
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=pose_model),
        running_mode=vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.25,
        min_pose_presence_confidence=0.25,
        min_tracking_confidence=0.25,
    )
    label = None
    speeds = []
    accelerations = []
    direction = 0
    started_at = 0
    last_x = None
    last_time = 0
    reversal_direction = 0
    reversal_since = 0
    reversal_distance = 0.0
    audio_rms = 0.0
    audio_frames = 0
    total_frames = 0
    stroke_count = 0
    last_saved_label = "none"

    def capture_audio(indata, _frames, _time, _status):
        nonlocal audio_rms
        audio_rms = max(audio_rms, float(np.sqrt(np.mean(indata ** 2))))

    try:
        audio_info = sd.query_devices(args.device, "input")
        audio = sd.InputStream(device=args.device, channels=1, blocksize=1024, callback=capture_audio)
        print(f"Using audio input: {audio_info['name']}")
        audio.start()
    except sd.PortAudioError as error:
        raise SystemExit(f"Could not open audio input: {error}") from error

    def reset_stroke():
        nonlocal speeds, accelerations, direction, started_at, last_x, last_time
        nonlocal reversal_direction, reversal_since, reversal_distance, audio_frames, total_frames
        speeds, accelerations = [], []
        direction, started_at, last_x, last_time = 0, 0, None, 0
        reversal_direction, reversal_since, reversal_distance = 0, 0, 0.0
        audio_frames, total_frames = 0, 0

    def write_stroke(writer, end_time):
        nonlocal stroke_count, last_saved_label
        if not label or not started_at or end_time - started_at < 120:
            return
        audio_ratio = audio_frames / total_frames if total_frames else 0
        if audio_ratio < args.minimum_audio_ratio:
            return
        values = articulation_features(end_time - started_at, speeds, accelerations, direction)
        writer.writerow([label, args.performer, args.session, 1, *[values[column] for column in ARTICULATION_FEATURE_COLUMNS]])
        stroke_count += 1
        last_saved_label = label
        print(f"saved {label} stroke ({end_time - started_at:.0f} ms)")

    try:
        with vision.PoseLandmarker.create_from_options(options) as pose, output.open("a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            if not exists:
                writer.writerow(CSV_COLUMNS)
            while True:
                ok, frame = camera.read()
                if not ok:
                    break
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                if chr(key) in LABELS:
                    label = LABELS[chr(key)]
                    print(f"label: {label}")

                now = time.monotonic() * 1000
                audio_active = audio_rms >= args.audio_threshold
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = pose.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(now))
                right_wrist_detected = bool(result.pose_landmarks and len(result.pose_landmarks[0]) > 16)
                if not right_wrist_detected:
                    reset_stroke()
                if right_wrist_detected:
                    x = result.pose_landmarks[0][16].x
                    speed = 0 if last_x is None or now == last_time else (x - last_x) / (now - last_time)
                    previous_speed = speeds[-1] if speeds else 0
                    acceleration = 0 if last_time == 0 else (speed - previous_speed) / max(1, now - last_time)
                    next_direction = 0 if abs(speed) <= args.motion_threshold else int(np.sign(speed))
                    if next_direction and direction and next_direction != direction:
                        if reversal_direction != next_direction:
                            reversal_direction, reversal_since, reversal_distance = next_direction, now, 0.0
                        reversal_distance += abs(speed * (now - last_time))
                    else:
                        reversal_direction, reversal_distance = 0, 0.0
                    confirmed = direction and reversal_direction and now - reversal_since >= args.reversal_ms and reversal_distance >= args.reversal_distance
                    if confirmed:
                        write_stroke(writer, now)
                        reset_stroke()
                        started_at, direction = now, next_direction
                    elif next_direction:
                        if not started_at:
                            started_at = now
                        if not direction:
                            direction = next_direction
                        speeds.append(speed)
                        accelerations.append(acceleration)
                        total_frames += 1
                        audio_frames += int(audio_active)
                    last_x, last_time = x, now
                cv2.putText(frame, f"label: {label or 'none'} | right wrist: {'yes' if right_wrist_detected else 'no'} | sound: {'on' if audio_active else 'off'} rms: {audio_rms:.4f} | counted: {stroke_count}", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 2)
                cv2.putText(frame, f"last: {last_saved_label} | 1 legato  2 staccato  3 detache  |  q quit", (12, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 2)
                cv2.imshow("cello articulation collection", frame)
                audio_rms *= 0.72
    finally:
        camera.release()
        audio.stop()
        audio.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
