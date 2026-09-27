import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { computeFeatures, type WorldLandmark } from "@/lib/features";
import { articulationFeatureVector, BowStrokeSegmenter } from "@/lib/bowArticulation";
import { articulationModel } from "@/lib/models/articulation.generated";
import { postureModel } from "@/lib/models/posture.generated";

type WorkerInput = { type: "configure" | "frame" | "audio"; bitmap?: ImageBitmap; timestamp?: number; active?: boolean };
type ImageLandmark = { x: number; y: number; z: number; visibility?: number };
let pose: PoseLandmarker | undefined;
let hand: HandLandmarker | undefined;
const history: string[] = [];
const strokeSegmenter = new BowStrokeSegmenter();

async function configure() {
  try {
    const vision = await FilesetResolver.forVisionTasks("/wasm");
    pose = await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "GPU" }, runningMode: "VIDEO", numPoses: 1 });
    hand = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate: "GPU" }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.3, minHandPresenceConfidence: 0.25, minTrackingConfidence: 0.25 });
    postMessage({ type: "ready" });
  } catch (error) {
    postMessage({ type: "error", message: error instanceof Error ? error.message : "MediaPipe failed to initialize" });
  }
}

self.onmessage = async ({ data }: MessageEvent<WorkerInput>) => {
  if (data.type === "configure") return configure();
  if (data.type === "audio") {
    const stroke = strokeSegmenter.setAudioActive(data.active === true, data.timestamp ?? performance.now());
    if (stroke) postMessage({ type: "articulation", articulation: articulationModel.predict(articulationFeatureVector(stroke)) });
    return;
  }
  if (!pose || !hand || !data.bitmap || data.timestamp === undefined) {
    data.bitmap?.close();
    return;
  }
  const poseResult = pose.detectForVideo(data.bitmap, data.timestamp);
  const handResult = hand.detectForVideo(data.bitmap, data.timestamp);
  const landmarks = (poseResult.worldLandmarks[0] ?? []) as WorldLandmark[];
  const handIndex = handResult.handedness.findIndex((categories) => categories[0]?.categoryName === "Right");
  const imagePoseLandmarks = (poseResult.landmarks[0] ?? []) as ImageLandmark[];
  if (handIndex < 0) {
    postMessage({ type: "landmarks", poseLandmarks: imagePoseLandmarks, handLandmarks: [], bowHandX: null });
    data.bitmap.close();
    return;
  }
  const handLandmarks = (handResult.worldLandmarks[handIndex] ?? []) as WorldLandmark[];
  const imageHandLandmarks = (handResult.landmarks[handIndex] ?? []) as ImageLandmark[];
  const bodyCenterX = landmarks[11] && landmarks[12] ? (landmarks[11].x + landmarks[12].x) / 2 : 0;
  const bowHandX = landmarks[16] ? landmarks[16].x - bodyCenterX : null;
  if (landmarks.length < 17 || handLandmarks.length < 21) {
    postMessage({ type: "landmarks", poseLandmarks: imagePoseLandmarks, handLandmarks: imageHandLandmarks, bowHandX });
    data.bitmap.close();
    return;
  }
  const features = computeFeatures(landmarks, handLandmarks);
  const prediction = postureModel.predict(features);
  if (!prediction) {
    postMessage({ type: "model_unavailable", model: "posture", poseLandmarks: imagePoseLandmarks, handLandmarks: imageHandLandmarks, bowHandX });
    data.bitmap.close();
    return;
  }
  history.push(prediction.label); if (history.length > 10) history.shift();
  const counts = history.reduce<Record<string, number>>((all, item) => ({ ...all, [item]: (all[item] ?? 0) + 1 }), {});
  const smoothedLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const stroke = strokeSegmenter.push(handLandmarks[0].x, data.timestamp);
  const articulation = stroke && articulationModel.predict(articulationFeatureVector(stroke));
  postMessage({ type: "result", label: smoothedLabel, probabilities: prediction.probabilities, articulation: articulation?.label, articulationProbabilities: articulation?.probabilities, features, bowHandX, poseLandmarks: imagePoseLandmarks, handLandmarks: imageHandLandmarks });
  data.bitmap.close();
};