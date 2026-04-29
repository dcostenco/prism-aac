export interface PredictionCandidate {
  word: string;
  bigramScore: number;
  frequencyScore: number;
  recencyScore: number;
  totalScore: number;
}

export interface PredictionConfig {
  bigramWeight: number;
  frequencyWeight: number;
  recencyWeight: number;
  maxResults: number;
  recencyWindowMinutes: number;
}

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  bigramWeight: 0.5,
  frequencyWeight: 0.3,
  recencyWeight: 0.2,
  maxResults: 5,
  recencyWindowMinutes: 10,
};

export const DEFAULT_PREDICTIONS = ['I', 'We', 'Can', 'Help', 'All done'];
