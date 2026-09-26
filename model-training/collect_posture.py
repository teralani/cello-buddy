"""Collect labeled pose and hand world landmarks from a local webcam.

Keys 1-5 select labels, space pauses/resumes capture, and q quits. The model
asset paths are local files downloaded outside the production website.
"""
import argparse
import csv
import json
import time
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

LABELS = {"1": "correct_bow_hold", "2": "flat_thumb", "3": "collapsed_pinky", "4": "bent_wrist", "5": "low_elbow"}


def world_rows(landmarks):
    return [[round(point.x, 6), round(point.y, 6), round(point.z, 6)] for point in landmarks]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--performer", required=True)
    parser.add_argument("--session", required=True)
    parser.add_argument("--pose-model", required=True, help="Local pose_landmarker_lite.task path")
    parser.add_argument("--hand-model", required=True, help="Local hand_landmarker.task path")
    parser.add_argument("--out", default="data/posture.csv")
    args = parser.parse_args()
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    exists = output.exists()
    camera = cv2.VideoCapture(0)
    pose_options = vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=args.pose_model), running_mode=vision.RunningMode.VIDEO)
    hand_options = vision.HandLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=args.hand_model), running_mode=vision.RunningMode.VIDEO, num_hands=2)
    paused = False
    label = None
    with vision.PoseLandmarker.create_from_options(pose_options) as pose, vision.HandLandmarker.create_from_options(hand_options) as hand, output.open("a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        if not exists:
            writer.writerow(["label", "performer_id", "session_id", "timestamp_ms", "pose_landmarks_json", "hand_landmarks_json"])
        while True:
            ok, frame = camera.read()
            if not ok:
                break
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord(" "):
                paused = not paused
            if chr(key) in LABELS:
                label = LABELS[chr(key)]
            if not paused and label:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp = int(time.monotonic() * 1000)
                pose_result = pose.detect_for_video(image, timestamp)
                hand_result = hand.detect_for_video(image, timestamp)
                if pose_result.world_landmarks and hand_result.world_landmarks:
                    writer.writerow([label, args.performer, args.session, timestamp, json.dumps(world_rows(pose_result.world_landmarks[0])), json.dumps(world_rows(hand_result.world_landmarks[0]))])
            cv2.putText(frame, f"label: {label or 'none'} | space pause | q quit", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.imshow("cello posture collection", frame)
    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
