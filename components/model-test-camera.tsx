"use client";

import { useEffect, useRef, useState } from "react";
import { bowAngle, bowPlacement, detectTapePoints, type TapeColor, type TapePoint } from "@/lib/bowVision";

type Result = { poseLandmarks?: { x: number; y: number }[]; handLandmarks?: { x: number; y: number }[]; bowHandX?: number | null; type?: string; message?: string };
const poseConnections = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [23, 25], [25, 27], [24, 26], [26, 28], [23, 24]];
const handConnections = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export default function ModelTestCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const resultRef = useRef<Result>({});
  const frameInFlightRef = useRef(false);
  const tapePointsRef = useRef<TapePoint[]>([]);
  const [status, setStatus] = useState("starting");
  const [color, setColor] = useState<TapeColor>("red");
  const [tapePoints, setTapePoints] = useState<TapePoint[]>([]);
  const [angle, setAngle] = useState<number | null>(null);
  const [bowX, setBowX] = useState<number | null>(null);
  const [bridgeY, setBridgeY] = useState<number | null>(null);
  const [fingerboardY, setFingerboardY] = useState<number | null>(null);
  const [placement, setPlacement] = useState("uncalibrated");

  useEffect(() => {
    let active = true;
    const video = videoRef.current;
    if (!video) return;
    const worker = new Worker(new URL("../workers/poseWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = ({ data }: MessageEvent<Result>) => { resultRef.current = data; frameInFlightRef.current = false; if (data.type === "ready") setStatus("live"); if (data.type === "error") setStatus(`MediaPipe error: ${data.message ?? "unknown"}`); };
    worker.postMessage({ type: "configure" });
    void navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false }).then(async (stream) => {
      if (!active || !video) return;
      video.srcObject = stream;
      await video.play();
      setStatus("loading landmarks");
      let lastInference = 0;
      const sendFrame = async (timestamp: number) => {
        if (!active || !video) return;
        if (!frameInFlightRef.current && timestamp - lastInference >= 66 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          lastInference = timestamp;
          try {
            const bitmap = await createImageBitmap(video, { resizeWidth: 256, resizeHeight: 256 });
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
    return () => { active = false; worker.terminate(); (video.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop()); };
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
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const analysisWidth = Math.min(320, width);
      const analysisHeight = Math.round((analysisWidth / width) * height);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      if (analysis.width !== analysisWidth || analysis.height !== analysisHeight) { analysis.width = analysisWidth; analysis.height = analysisHeight; }
      overlay.clearRect(0, 0, width, height);
      const result = resultRef.current;
      overlay.strokeStyle = "#b4b8f0"; overlay.lineWidth = Math.max(2, width / 500);
      for (const [from, to] of poseConnections) drawLine(overlay, result.poseLandmarks?.[from], result.poseLandmarks?.[to], width, height);
      for (const [from, to] of handConnections) drawLine(overlay, result.handLandmarks?.[from], result.handLandmarks?.[to], width, height);
      drawPoints(overlay, result.poseLandmarks ?? [], width, height, "#b4b8f0");
      drawPoints(overlay, result.handLandmarks ?? [], width, height, "#f4c95d");
      if (performance.now() - lastTapeCheck > 100) {
        lastTapeCheck = performance.now();
        context.drawImage(video, 0, 0, analysis.width, analysis.height);
        const detected = detectTapePoints(context, color).map((point) => ({ ...point, x: point.x * width / analysis.width, y: point.y * height / analysis.height }));
        if (detected.length === 2) {
          tapePointsRef.current = detected;
          setTapePoints(detected); setAngle(bowAngle(detected[0], detected[1]));
          const midpoint = { x: (detected[0].x + detected[1].x) / 2, y: (detected[0].y + detected[1].y) / 2, size: 0 };
          setPlacement(bowPlacement(midpoint, bridgeY, fingerboardY));
        } else { tapePointsRef.current = []; setTapePoints([]); }
      }
      if (performance.now() - lastUiUpdate > 100) { lastUiUpdate = performance.now(); setBowX(result.bowHandX ?? null); }
      if (tapePointsRef.current.length === 2) {
        overlay.strokeStyle = "#ff6b6b"; overlay.lineWidth = 5; overlay.beginPath(); overlay.moveTo(tapePointsRef.current[0].x, tapePointsRef.current[0].y); overlay.lineTo(tapePointsRef.current[1].x, tapePointsRef.current[1].y); overlay.stroke();
        drawPoints(overlay, tapePointsRef.current, width, height, "#ff6b6b");
      }
      requestAnimationFrame(draw);
    };
    draw();
    return () => { active = false; };
  }, [color, bridgeY, fingerboardY]);

  function calibrate(kind: "bridge" | "fingerboard") {
    if (tapePointsRef.current.length !== 2) return;
    const y = (tapePointsRef.current[0].y + tapePointsRef.current[1].y) / 2;
    if (kind === "bridge") setBridgeY(y); else setFingerboardY(y);
  }

  return <section className="border-4 border-cabinet-edge bg-cabinet p-1 hard-shadow"><div className="bg-bezel p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-ink-soft">03 / Live vision</p><h2 className="font-display text-4xl uppercase">Landmark camera</h2></div><span className="border-2 border-butter px-2 py-1 text-[10px] uppercase tracking-widest text-butter">{status}</span></div><div className="relative mt-4 overflow-hidden border-2 border-screen-edge bg-night"><video ref={videoRef} muted playsInline className="block aspect-video w-full object-cover" /><canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" /><canvas ref={analysisRef} className="hidden" /></div><div className="mt-4 grid gap-3 text-xs uppercase sm:grid-cols-3"><div><span className="text-ink-soft">Right bow hand X</span><strong className="mt-1 block font-display text-3xl text-butter">{bowX === null ? "--" : bowX.toFixed(3)} m</strong></div><div><span className="text-ink-soft">Tape angle</span><strong className="mt-1 block font-display text-3xl text-butter">{angle === null ? "--" : `${angle.toFixed(1)}°`}</strong></div><div><span className="text-ink-soft">Placement</span><strong className="mt-1 block font-display text-3xl text-butter">{placement}</strong></div></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-screen-edge pt-4 text-xs uppercase"><label>Tape <select value={color} onChange={(event) => setColor(event.target.value as TapeColor)} className="ml-2 border-2 border-screen-edge bg-screen px-2 py-1"><option value="red">red</option><option value="blue">blue</option><option value="green">green</option></select></label><button type="button" onClick={() => calibrate("bridge")} disabled={tapePoints.length !== 2} className="border-2 border-sky px-2 py-1 disabled:opacity-40">Calibrate bridge</button><button type="button" onClick={() => calibrate("fingerboard")} disabled={tapePoints.length !== 2} className="border-2 border-sky px-2 py-1 disabled:opacity-40">Calibrate fingerboard</button></div><p className="mt-3 text-xs leading-relaxed text-ink-soft">MediaPipe annotates joints. Two visible tape markers estimate bow angle; calibrate once with the bow over the bridge and once over the fingerboard to compare placement.</p></div></section>;
}

function drawPoints(context: CanvasRenderingContext2D, points: { x: number; y: number }[], width: number, height: number, color: string) { context.fillStyle = color; for (const point of points) { context.beginPath(); context.arc(point.x * width, point.y * height, Math.max(3, width / 180), 0, Math.PI * 2); context.fill(); } }
function drawLine(context: CanvasRenderingContext2D, first: { x: number; y: number } | undefined, last: { x: number; y: number } | undefined, width: number, height: number) { if (!first || !last) return; context.beginPath(); context.moveTo(first.x * width, first.y * height); context.lineTo(last.x * width, last.y * height); context.stroke(); }