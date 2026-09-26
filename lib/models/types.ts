export type ModelPrediction = {
  label: string;
  probabilities: Record<string, number>;
};

export type ClassifierModel = {
  trained: boolean;
  predict(features: number[]): ModelPrediction | null;
};