"use client";

import { useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "starting" | "live" | "blocked";

export default function PostureFeedback() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const workerRef = useRef<Worker | null>(null);
  const latestResultRef = useRef<{ label?: string; poseLandmarks?: { x: number; y: number }[] }>({});
  const lastInferenceRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [frames, setFrames] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      setStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        if (!mounted || !videoRef.current) return;
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("live");
      } catch {
        if (mounted) setStatus("blocked");
      }
    }

    void startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(animationRef.current);
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (status !== "live") return;
    const video = videoRef.current;
    if (!video) return;
    const worker = new Worker(new URL("../workers/poseWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.postMessage({ type: "configure" });
    worker.onmessage = ({ data }: MessageEvent<{ type: string; label?: string; poseLandmarks?: { x: number; y: number }[] }>) => {
      if (data.type === "result") latestResultRef.current = data;
    };
    let running = true;
    const infer = async (timestamp: number) => {
      if (!running) return;
      if (timestamp - lastInferenceRef.current >= 66 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        lastInferenceRef.current = timestamp;
        try {
          const bitmap = await createImageBitmap(video, { resizeWidth: 256, resizeHeight: 256 });
          worker.postMessage({ type: "frame", bitmap, timestamp }, [bitmap]);
        } catch { /* The raw camera preview remains available without inference. */ }
      }
      video.requestVideoFrameCallback(infer);
    };
    video.requestVideoFrameCallback(infer);
    return () => { running = false; worker.terminate(); workerRef.current = null; };
  }, [status]);

  useEffect(() => {
    if (status !== "live") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const draw = () => {
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "rgba(180, 184, 240, 0.7)";
      context.lineWidth = Math.max(2, canvas.width / 500);
      context.strokeRect(canvas.width * 0.2, canvas.height * 0.12, canvas.width * 0.6, canvas.height * 0.76);
      const result = latestResultRef.current;
      if (result.poseLandmarks?.length) {
        context.fillStyle = "#b4b8f0";
        for (const landmark of result.poseLandmarks) {
          context.beginPath();
          context.arc(landmark.x * canvas.width, landmark.y * canvas.height, Math.max(3, canvas.width / 160), 0, Math.PI * 2);
          context.fill();
        }
      }
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
    const counter = window.setInterval(() => setFrames((value) => value + 1), 1000);
    return () => {
      cancelAnimationFrame(animationRef.current);
      window.clearInterval(counter);
    };
  }, [status]);

  return (
    <div className="relative flex h-full min-h-72 flex-col justify-between bg-screen-dim p-4">
      <div className="relative min-h-0 flex-1 overflow-hidden screen-curve border-2 border-screen-edge bg-night">
        <video ref={videoRef} muted playsInline className="h-full min-h-72 w-full object-cover" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {status !== "live" && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div className="max-w-sm border-2 border-butter bg-night/90 p-5">
              <p className="font-display text-4xl uppercase text-butter">
                {status === "blocked" ? "Camera offline" : status === "starting" ? "Tuning the lens" : "Camera ready"}
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                {status === "blocked" ? "Allow camera access to see posture feedback." : "Starting a local preview. No video leaves this device."}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs uppercase tracking-widest">
        <span className="flex items-center gap-2"><span className={`h-2 w-2 ${status === "live" ? "bg-butter" : "bg-rose"}`} />{status === "live" ? "Preview live" : "Waiting for camera"}</span>
        <span className="text-ink-soft">Inference {status === "live" ? `${Math.min(frames, 20)} fps target` : "paused"}</span>
      </div>
    </div>
  );
}