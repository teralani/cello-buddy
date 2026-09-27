"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { angleDelta, bowAngle, detectDualTapePoints, type DualTapePoints, type TapeColor } from "@/lib/bowVision";
import { rmsOf } from "@/lib/audioPitch";

type Prediction = { label: string; probabilities: Record<string, number> } | null;
type Result = { poseLandmarks?: { x: number; y: number }[]; handLandmarks?: { x: number; y: number }[]; bowHandX?: number | null; articulation?: Prediction; type?: string; message?: string };
const AUDIO_THRESHOLD = 0.0001;
const poseConnections = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [23, 25], [25, 27], [24, 26], [26, 28], [23, 24]];
const handConnections = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export default function ModelTestCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const resultRef = useRef<Result>({});
  const frameInFlightRef = useRef(false);
  const tapePointsRef = useRef<DualTapePoints | null>(null);
  const smoothedAngleRef = useRef<number | null>(null);
  const missedTapeFramesRef = useRef(0);
  const [status, setStatus] = useState("starting");
  const [firstColor, setFirstColor] = useState<TapeColor>("#168dcc");
  const [secondColor, setSecondColor] = useState<TapeColor>("#39ff14");
  const [expectedLength, setExpectedLength] = useState<number | null>(null);
  const [baselineAngle, setBaselineAngle] = useState<number | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [bowX, setBowX] = useState<number | null>(null);
  const [articulation, setArticulation] = useState<Prediction>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [audioActive, setAudioActive] = useState(false);

  useEffect(() => {
    tapePointsRef.current = null;
    smoothedAngleRef.current = null;
    missedTapeFramesRef.current = 0;
    startTransition(() => {
      setAngle(null);
    });
  }, [firstColor, secondColor]);

  useEffect(() => {
    let active = true;
    let audioContext: AudioContext | null = null;
    const video = videoRef.current;
    if (!video) return;
    const worker = new Worker(new URL("../workers/poseWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = ({ data }: MessageEvent<Result>) => {
      resultRef.current = data;
      frameInFlightRef.current = false;
      if (data.type === "ready") setStatus("live");
      if (data.type === "error") setStatus(`MediaPipe error: ${data.message ?? "unknown"}`);
      if (data.articulation) {
        setArticulation(data.articulation);
        setStrokeCount((count) => count + 1);
      }
    };
    worker.postMessage({ type: "configure" });
    void navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(async (stream) => {
      if (!active || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setStatus("loading landmarks");
      audioContext = new AudioContext();
      await audioContext.resume();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const audioBuffer = new Float32Array(analyser.fftSize);
      let lastInference = 0;
      const sendFrame = async (timestamp: number) => {
        if (!active || !video) return;
        analyser.getFloatTimeDomainData(audioBuffer);
        const currentRms = rmsOf(audioBuffer);
        const currentAudioActive = currentRms >= AUDIO_THRESHOLD;
        setAudioActive(currentAudioActive);
        worker.postMessage({ type: "audio", active: currentAudioActive, timestamp });
        if (!frameInFlightRef.current && timestamp - lastInference >= 66 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          lastInference = timestamp;
          try {
            const bitmap = await createImageBitmap(video, { resizeWidth: 384, resizeHeight: 216 });
            frameInFlightRef.current = true;
            worker.postMessage({ type: "frame", bitmap, timestamp }, [bitmap]);
          } catch {
            // The camera preview remains usable if a frame cannot be copied.
          }
        }
        video.requestVideoFrameCallback(sendFrame);
      };
      video.requestVideoFrameCallback(sendFrame);
    }).catch(() => setStatus("camera blocked"));
    return () => {
      active = false;
      worker.terminate();
      void audioContext?.close().catch(() => undefined);
      (video.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    const analysis = analysisRef.current;
    if (!video || !canvas || !analysis) return;
    const overlay = canvas.getContext("2d");
    const context = analysis.getContext("2d", { willReadFrequently: true });
    if (!overlay || !context) return;
    let active = true;
    let lastTapeCheck = 0;
    let lastUiUpdate = 0;
    const draw = () => {
      if (!active) return;
      try {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const analysisWidth = Math.min(320, width);
      const analysisHeight = Math.round((analysisWidth / width) * height);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      if (analysis.width !== analysisWidth || analysis.height !== analysisHeight) { analysis.width = analysisWidth; analysis.height = analysisHeight; }
      overlay.clearRect(0, 0, width, height);
      const result = resultRef.current;
      overlay.strokeStyle = "#b4b8f0";
      overlay.lineWidth = Math.max(2, width / 500);
      for (const [from, to] of poseConnections) drawLine(overlay, result.poseLandmarks?.[from], result.poseLandmarks?.[to], width, height);
      for (const [from, to] of handConnections) drawLine(overlay, result.handLandmarks?.[from], result.handLandmarks?.[to], width, height);
      drawPoints(overlay, result.poseLandmarks ?? [], width, height, "#b4b8f0");
      drawPoints(overlay, result.handLandmarks ?? [], width, height, "#f4c95d");
      if (performance.now() - lastTapeCheck > 100) {
        lastTapeCheck = performance.now();
        context.drawImage(video, 0, 0, analysis.width, analysis.height);
        const previous = tapePointsRef.current ? {
          first: { ...tapePointsRef.current.first, x: tapePointsRef.current.first.x * analysis.width / width, y: tapePointsRef.current.first.y * analysis.height / height },
          second: { ...tapePointsRef.current.second, x: tapePointsRef.current.second.x * analysis.width / width, y: tapePointsRef.current.second.y * analysis.height / height },
          length: tapePointsRef.current.length * analysis.width / width,
        } : null;
        const detectedInAnalysis = detectDualTapePoints(context, firstColor, secondColor, previous, expectedLength ? expectedLength * analysis.width / width : null);
        if (detectedInAnalysis) {
          const detected = {
            first: { ...detectedInAnalysis.first, x: detectedInAnalysis.first.x * width / analysis.width, y: detectedInAnalysis.first.y * height / analysis.height },
            second: { ...detectedInAnalysis.second, x: detectedInAnalysis.second.x * width / analysis.width, y: detectedInAnalysis.second.y * height / analysis.height },
            length: detectedInAnalysis.length * width / analysis.width,
          };
          missedTapeFramesRef.current = 0;
          tapePointsRef.current = detected;
          const rawAngle = bowAngle(detected.first, detected.second);
          if (smoothedAngleRef.current === null) {
            smoothedAngleRef.current = rawAngle;
          } else {
            let delta = rawAngle - smoothedAngleRef.current;
            if (delta > 90) delta -= 180;
            if (delta <= -90) delta += 180;
            smoothedAngleRef.current += delta * 0.25;
            if (smoothedAngleRef.current > 90) smoothedAngleRef.current -= 180;
            if (smoothedAngleRef.current <= -90) smoothedAngleRef.current += 180;
          }
          setAngle(baselineAngle === null ? smoothedAngleRef.current : angleDelta(smoothedAngleRef.current, baselineAngle));
        } else {
          missedTapeFramesRef.current += 1;
          if (missedTapeFramesRef.current >= 24) {
            tapePointsRef.current = null;
            smoothedAngleRef.current = null;
            setAngle(null);
          }
        }
      }
      if (performance.now() - lastUiUpdate > 100) { lastUiUpdate = performance.now(); setBowX(result.bowHandX ?? null); }
      if (tapePointsRef.current) {
        overlay.strokeStyle = firstColor;
        overlay.lineWidth = 5;
        overlay.beginPath();
        overlay.moveTo(tapePointsRef.current.first.x, tapePointsRef.current.first.y);
        overlay.lineTo(tapePointsRef.current.second.x, tapePointsRef.current.second.y);
        overlay.stroke();
        drawPixelPoints(overlay, [tapePointsRef.current.first], firstColor);
        drawPixelPoints(overlay, [tapePointsRef.current.second], secondColor);
      }
      } catch {
        // Keep the camera loop alive if a frame is unavailable during a resize or restart.
      }
      if (active) requestAnimationFrame(draw);
    };
    draw();
    return () => { active = false; };
  }, [firstColor, secondColor, expectedLength, baselineAngle]);

  function calibrateStraightStroke() {
    if (!tapePointsRef.current || smoothedAngleRef.current === null) return;
    setExpectedLength(tapePointsRef.current.length);
    setBaselineAngle(smoothedAngleRef.current);
    setAngle(0);
  }

  return (
    <section className="border-4 border-cabinet-edge bg-cabinet p-1 hard-shadow">
      <div className="bg-bezel p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs uppercase tracking-widest text-ink-soft">03 / Live vision</p><h2 className="font-display text-4xl uppercase">Landmark camera</h2></div>
          <span className="border-2 border-butter px-2 py-1 text-[10px] uppercase tracking-widest text-butter">{status}</span>
        </div>
        <div className="relative mt-4 overflow-hidden border-2 border-screen-edge bg-night">
          <video ref={videoRef} muted playsInline className="block aspect-video w-full object-cover" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          <canvas ref={analysisRef} className="hidden" />
        </div>
        <div className="mt-4 grid gap-3 text-xs uppercase sm:grid-cols-3">
          <div><span className="text-ink-soft">Right bow hand X</span><strong className="mt-1 block font-display text-3xl text-butter">{bowX === null ? "--" : bowX.toFixed(3)} m</strong></div>
          <div><span className="text-ink-soft">Bow alignment</span><strong className="mt-1 block font-display text-3xl text-butter">{angle === null ? "--" : `${angle.toFixed(1)} deg`}</strong></div>
          <div><span className="text-ink-soft">Audio gate / strokes</span><strong className="mt-1 block font-display text-3xl text-butter">{audioActive ? "ON" : "OFF"} / {strokeCount}</strong></div>
        </div>
        <div className="mt-4 border-t-2 border-screen-edge pt-4">
          <span className="text-xs uppercase tracking-widest text-ink-soft">Detected articulation</span>
          <strong className="mt-1 block font-display text-5xl uppercase text-butter">{articulation?.label ?? "Play a stroke"}</strong>
          {articulation ? <div className="mt-2 flex flex-wrap gap-3 text-xs uppercase text-ink-soft">{Object.entries(articulation.probabilities).map(([label, probability]) => <span key={label}>{label}: {(probability * 100).toFixed(0)}%</span>)}</div> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-screen-edge pt-4 text-xs uppercase">
          <label className="flex items-center gap-2">Frog <input type="color" value={firstColor} onChange={(event) => setFirstColor(event.target.value)} className="h-8 w-12 cursor-pointer border-2 border-screen-edge bg-screen p-0.5" /></label>
          <label className="flex items-center gap-2">Tip <input type="color" value={secondColor} onChange={(event) => setSecondColor(event.target.value)} className="h-8 w-12 cursor-pointer border-2 border-screen-edge bg-screen p-0.5" /></label>
          <button type="button" onClick={calibrateStraightStroke} disabled={angle === null} className="border-2 border-sky px-2 py-1 disabled:opacity-40">Calibrate straight</button>
        </div>
      </div>
    </section>
  );
}

function drawPoints(context: CanvasRenderingContext2D, points: { x: number; y: number }[], width: number, height: number, color: string) {
  context.fillStyle = color;
  for (const point of points) { context.beginPath(); context.arc(point.x * width, point.y * height, Math.max(3, width / 180), 0, Math.PI * 2); context.fill(); }
}

function drawLine(context: CanvasRenderingContext2D, first: { x: number; y: number } | undefined, last: { x: number; y: number } | undefined, width: number, height: number) {
  if (!first || !last) return;
  context.beginPath(); context.moveTo(first.x * width, first.y * height); context.lineTo(last.x * width, last.y * height); context.stroke();
}

function drawPixelPoints(context: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string) {
  context.fillStyle = color;
  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, 10, 0, Math.PI * 2);
    context.fill();
  }
}