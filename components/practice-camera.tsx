"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmark } from "@/lib/bowMotion";
import { rmsOf } from "@/lib/audioPitch";

/* The live camera window on the practice screen. The webcam feeds the pose
  worker and the microphone gates stroke segmentation so the worker can
  classify each bow stroke. */

type CameraStatus = "starting" | "loading" | "live" | "blocked" | "error";

type Point = { x: number; y: number };

type Prediction = { label: string; probabilities: Record<string, number> } | null;

type WorkerResult = {
  type?: string;
  message?: string;
  /* Frame timestamp (performance.now() clock) the landmarks belong to. */
  timestamp?: number;
  poseLandmarks?: PoseLandmark[];
  handLandmarks?: Point[];
  bowHandX?: number | null;
  articulation?: Prediction;
};

type Props = {
  /* Called for every pose result with the frame's timestamp, the pose
     landmarks (MediaPipe indices, normalised 0..1) and the video's width over
     height. The practice screen uses it to record the right wrist. */
  onPose?: (timestamp: number, landmarks: PoseLandmark[], aspect: number) => void;
  onArticulation?: (timestamp: number, prediction: NonNullable<Prediction>) => void;
};

const AUDIO_THRESHOLD = 0.0001;

const poseConnections = [
  [12, 14], [14, 16],
];
const handConnections = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const POSE_COLOR = "#fcae5b";
const HAND_COLOR = "#f4c95d";

const statusLabel: Record<CameraStatus, string> = {
  starting: "Starting camera",
  loading: "Loading landmarks",
  live: "Tracking",
  blocked: "Camera blocked",
  error: "Tracking unavailable",
};

export default function PracticeCamera({ onPose, onArticulation }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /* Kept in a ref so a new callback does not restart the camera. */
  const onPoseRef = useRef(onPose);
  const onArticulationRef = useRef(onArticulation);
  useEffect(() => {
    onPoseRef.current = onPose;
  }, [onPose]);
  useEffect(() => {
    onArticulationRef.current = onArticulation;
  }, [onArticulation]);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<WorkerResult>({});
  const previousResultRef = useRef<WorkerResult>({});
  const smoothedPoseRef = useRef<PoseLandmark[] | undefined>(undefined);
  const smoothedHandRef = useRef<Point[] | undefined>(undefined);
  const frameInFlightRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bowX, setBowX] = useState<number | null>(null);
  const [articulation, setArticulation] = useState<Prediction>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [audioActive, setAudioActive] = useState(false);

  /* Camera and microphone stream, the pose worker, and the audio gate. */
  useEffect(() => {
    let active = true;
    let audioContext: AudioContext | null = null;
    const video = videoRef.current;
    if (!video) return;

    const worker = new Worker(
      new URL("../workers/poseWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
      /* Every reply reopens the frame gate, including "ready": frames sent
         before the models loaded are dropped by the worker without a reply. */
      frameInFlightRef.current = false;
      if (data.type === "ready") {
        setStatus((current) => (current === "loading" ? "live" : current));
        return;
      }
      if (data.type === "error") {
        setStatus("error");
        setErrorMessage(data.message ?? "MediaPipe failed to start.");
        return;
      }
      if (data.articulation) {
        setArticulation(data.articulation);
        setStrokeCount((count) => count + 1);
        if (data.timestamp !== undefined) onArticulationRef.current?.(data.timestamp, data.articulation);
      }
      if (data.poseLandmarks) {
        previousResultRef.current = resultRef.current;
        resultRef.current = data;
        if (data.timestamp !== undefined && data.poseLandmarks.length > 0) {
          onPoseRef.current?.(data.timestamp, data.poseLandmarks, (video.videoWidth || 16) / (video.videoHeight || 9));
        }
      }
    };
    worker.postMessage({ type: "configure" });

    void navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      .then(async (stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setStatus((current) => (current === "starting" ? "loading" : current));

        audioContext = new AudioContext();
        await audioContext.resume();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const audioBuffer = new Float32Array(analyser.fftSize);

        let lastInference = 0;
        const sendFrame = async (timestamp: number) => {
          if (!active) return;
          analyser.getFloatTimeDomainData(audioBuffer);
          const currentAudioActive = rmsOf(audioBuffer) >= AUDIO_THRESHOLD;
          setAudioActive(currentAudioActive);
          worker.postMessage({ type: "audio", active: currentAudioActive, timestamp });
          if (
            !frameInFlightRef.current &&
            timestamp - lastInference >= 66 &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            lastInference = timestamp;
            try {
              const bitmap = await createImageBitmap(video, { resizeWidth: 384, resizeHeight: 216 });
              frameInFlightRef.current = true;
              worker.postMessage({ type: "frame", bitmap, timestamp }, [bitmap]);
            } catch {
              /* The preview keeps running if a frame cannot be copied. */
            }
          }
          video.requestVideoFrameCallback(sendFrame);
        };
        video.requestVideoFrameCallback(sendFrame);
      })
      .catch(() => setStatus("blocked"));

    return () => {
      active = false;
      worker.terminate();
      void audioContext?.close().catch(() => undefined);
      (video.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, []);

  /* Overlay drawing: right arm and hand skeleton. */
  useEffect(() => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas) return;
    const overlay = canvas.getContext("2d");
    if (!overlay) return;

    let active = true;
    let frame = 0;
    let lastUiUpdate = 0;

    const draw = () => {
      if (!active) return;
      frame = requestAnimationFrame(draw);
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        overlay.clearRect(0, 0, width, height);
        const projected = projectResult(
          resultRef.current,
          previousResultRef.current,
          performance.now(),
        );
        const result = smoothResult(projected, smoothedPoseRef, smoothedHandRef);
        overlay.strokeStyle = POSE_COLOR;
        overlay.lineWidth = Math.max(2, width / 500);
        for (const [from, to] of poseConnections)
          drawLine(overlay, result.poseLandmarks?.[from], result.poseLandmarks?.[to], width, height);
        for (const [from, to] of handConnections)
          drawLine(overlay, result.handLandmarks?.[from], result.handLandmarks?.[to], width, height);
        drawPoints(overlay, rightArmPoints(result.poseLandmarks), width, height, POSE_COLOR);
        drawPoints(overlay, result.handLandmarks ?? [], width, height, HAND_COLOR);

        const now = performance.now();

        if (now - lastUiUpdate > 100) {
          lastUiUpdate = now;
          setBowX(result.bowHandX ?? null);
        }

      } catch {
        /* Keep the loop alive if a frame is unavailable during a resize or restart. */
      }
    };
    draw();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  const live = status === "live";
  const failed = status === "blocked" || status === "error";

  return (
    <div className="flex h-full min-h-64 flex-col text-white">
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        <p className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-md border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-white/80 backdrop-blur-sm">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              live ? "bg-emerald-400" : failed ? "bg-danger" : "bg-white/40"
            }`}
          />
          {statusLabel[status]}
        </p>

        {live ? (
          <div className="absolute right-3 top-3 rounded-md border border-white/15 bg-black/50 px-2.5 py-1 text-right backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Articulation</p>
            <p className="text-sm font-medium capitalize">{articulation?.label ?? "Play a stroke"}</p>
            {articulation ? (
              <p className="mt-0.5 text-[10px] text-white/60">
                {Object.entries(articulation.probabilities)
                  .map(([label, probability]) => `${label} ${(probability * 100).toFixed(0)}%`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="max-w-xs">
              <p className="text-sm font-medium">{statusLabel[status]}</p>
              <p className="mt-1 text-sm text-white/60">
                {status === "blocked"
                  ? "Allow camera and microphone access in your browser to see your bow and posture."
                  : errorMessage}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-3 py-2 text-xs">
        <Readout label="Bow hand X" value={bowX === null ? "–" : `${bowX.toFixed(3)} m`} />
        <Readout label="Audio" value={audioActive ? "on" : "off"} />
        <Readout label="Strokes" value={String(strokeCount)} />
      </div>
    </div>
  );
}
function Readout({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-white/60">{label}</span>
      <span className="font-mono tabular-nums text-white">{value}</span>
    </p>
  );
}

/* Worker inference arrives behind the live video. Extrapolate only the
   short, measurable gap from the previous two results; the cap prevents a
   stale pose from drifting across the frame when inference is interrupted. */
function projectResult(current: WorkerResult, previous: WorkerResult, now: number): WorkerResult {
  const timestamp = current.timestamp;
  if (timestamp === undefined || previous.timestamp === undefined || timestamp <= previous.timestamp) return current;
  const elapsed = Math.min(80, Math.max(0, now - timestamp));
  const interval = timestamp - previous.timestamp;
  const factor = elapsed / interval;
  return {
    ...current,
    poseLandmarks: projectPoints(current.poseLandmarks, previous.poseLandmarks, factor),
    handLandmarks: projectPoints(current.handLandmarks, previous.handLandmarks, factor),
  };
}

function projectPoints<T extends Point>(current: T[] | undefined, previous: T[] | undefined, factor: number): T[] | undefined {
  if (!current || !previous || current.length !== previous.length) return current;
  return current.map((point, index) => {
    const before = previous[index];
    return {
      ...point,
      x: point.x + (point.x - before.x) * factor,
      y: point.y + (point.y - before.y) * factor,
    } as T;
  });
}

function smoothResult(
  result: WorkerResult,
  poseRef: { current: PoseLandmark[] | undefined },
  handRef: { current: Point[] | undefined },
): WorkerResult {
  poseRef.current = smoothPoints(result.poseLandmarks, poseRef.current, 0.22);
  handRef.current = smoothPoints(result.handLandmarks, handRef.current, 0.16);
  return { ...result, poseLandmarks: poseRef.current, handLandmarks: handRef.current };
}

function smoothPoints<T extends Point>(current: T[] | undefined, previous: T[] | undefined, alpha: number): T[] | undefined {
  if (!current) return previous;
  if (!previous || previous.length !== current.length) return current;
  return current.map((point, index) => {
    const prior = previous[index];
    return {
      ...point,
      x: prior.x + (point.x - prior.x) * alpha,
      y: prior.y + (point.y - prior.y) * alpha,
    } as T;
  });
}

function rightArmPoints(points: PoseLandmark[] | undefined): PoseLandmark[] {
  if (!points) return [];
  return [points[12], points[14], points[16]].filter((point): point is PoseLandmark => point !== undefined);
}

/* Landmarks come normalised to 0..1, so scale them into canvas pixels. */
function drawPoints(
  context: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  height: number,
  fill: string,
) {
  context.fillStyle = fill;
  const radius = Math.max(3, width / 180);
  for (const point of points) {
    context.beginPath();
    context.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawLine(
  context: CanvasRenderingContext2D,
  first: Point | undefined,
  last: Point | undefined,
  width: number,
  height: number,
) {
  if (!first || !last) return;
  context.beginPath();
  context.moveTo(first.x * width, first.y * height);
  context.lineTo(last.x * width, last.y * height);
  context.stroke();
}
