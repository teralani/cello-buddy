# Offline model training

These scripts run outside the Next.js production site. They collect labeled
data locally, then train shallow `RandomForestClassifier` models. Every row
keeps `performer_id` and `session_id` so validation can hold out complete
performances instead of leaking neighboring frames or strokes.

## 1. Set up the environment

From the repository root:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r model-training\requirements.txt
```

Download these MediaPipe Tasks files to a local `models` folder. They are used
only by the offline collectors and are ignored by git:

- [Pose Landmarker Lite](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task)
- [Hand Landmarker](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task)

The resulting paths should be:

```text
models/pose_landmarker_lite.task
models/hand_landmarker.task
```

## 2. Collect posture data

```powershell
python model-training\collect_posture.py --performer p01 --session s01 --pose-model models\pose_landmarker_lite.task --hand-model models\hand_landmarker.task --out model-training\data\posture.csv
```

Controls: `1` through `5` choose posture labels, `Space` pauses/resumes, and
`Q` quits. Hold each label for several seconds, then repeat it across multiple
performers, sessions, and camera angles.

## 3. Collect articulation data

```powershell
python model-training\collect_articulation.py --performer p01 --session s01 --hand-model models\hand_landmarker.task --out model-training\data\articulation.csv
```

You can choose the microphone without editing the script. On the listed laptop,
device `1` (MME) and device `9` (WASAPI) are usable; device `16` is a WDM-KS
endpoint that may not support this callback-based collector:

```powershell
python model-training\collect_articulation.py --performer p01 --session s01 --hand-model public\models\hand_landmarker.task --device 9 --out model-training\data\articulation.csv
```

The four articulation labels are:

- `1`: `legato`
- `2`: `staccato`
- `3`: `hooked`
- `4`: `detache`

Press `N` when a note begins. You do not press a capture key: the collector
uses the bow-hand wrist world-x movement and automatically closes a stroke when
movement changes direction. The same behavior is used by the website's
`BowStrokeSegmenter`. Collect examples in both directions: a downbow followed
by an upbow creates one boundary, and the upbow followed by a downbow creates
the next one. Repeat every articulation on both directions, across performers,
sessions, and tempos.

The collector also listens to the microphone and keeps only strokes with
sustained sound. Silent bow placement and silent retakes are therefore excluded
from the articulation dataset rather than being mislabeled as a bow style.

The local collector uses `N` for onset labels because it does not run the
production microphone pipeline. In the website, Web Audio onset timestamps are
merged automatically instead.

## 4. Train and export

Use at least two performer/session groups for meaningful leave-one-session-out
validation:

```powershell
python model-training\train_posture.py model-training\data\posture.csv --out lib\models\posture.generated.ts
python model-training\train_articulation.py model-training\data\articulation.csv --out lib\models\articulation.generated.ts
```

Each trainer:

1. Reads the collected CSV.
2. Computes the exact feature vector used by the browser.
3. Holds out each performer/session group in turn.
4. Prints validation accuracy and variation.
5. Fits the final Random Forest on all rows.
6. Uses `m2cgen` to export a plain JavaScript scorer wrapped as TypeScript.

Refresh `/model-test` after exporting. The model status changes from
`placeholder` to `trained`, and its sliders exercise the generated predictions.

Temporal CNN/TCN models are deliberately deferred because they require many
labeled complete sequences and are not part of this milestone.
