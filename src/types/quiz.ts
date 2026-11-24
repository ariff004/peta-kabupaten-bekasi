import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export interface KecamatanProperties {
  id: string;
  name: string;
  kecNo: string;
  areaScore: number;
}

export type KecamatanFeature = Feature<Polygon | MultiPolygon, KecamatanProperties>;
export type KecamatanCollection = FeatureCollection<Polygon | MultiPolygon, KecamatanProperties>;

export type PlayableQuizMode =
  | 'locate'
  | 'choice'
  | 'silhouette'
  | 'nameAll'
  | 'ranked'
  | 'duel';

export type QuizMode = PlayableQuizMode | 'explore';

export type RecordKey =
  | 'locate'
  | 'choice'
  | 'silhouette'
  | 'nameAll'
  | 'ranked'
  | 'ranked10'
  | 'ranked5'
  | 'duelQuestions'
  | 'duelTimed';

export type DistrictStatus = 'unanswered' | 'correct-first' | 'correct-assisted' | 'missed';

export type WilayahZona = 'Utara' | 'Tengah' | 'Selatan';

export type DemographicMetric = 'penduduk' | 'luas' | 'kepadatan';
export type RankedScope = 'all' | 'top10' | 'top5';
export type ChoroplethFilter = 'none' | DemographicMetric;
export type DuelCategory = 'mixed' | DemographicMetric;
export type DuelFormat = 'questions' | 'timed';
export type Language = 'id' | 'en';
export type ThemePreset = 'light' | 'dark' | 'sepia' | 'ocean';

export interface KecamatanMeta {
  id: string;
  name: string;
  zona: WilayahZona;
  kodeWilayah: string;
  clue: string;
  neighbors: string[];
  penduduk: number;
  luas: number;
  kepadatan: number;
}

export interface FeedbackBanner {
  type: 'correct' | 'wrong' | 'hint' | 'info';
  title: string;
  detail?: string;
}

export interface BestRecord {
  bestScore: number;
  bestAccuracy: number;
  fastestSeconds: number;
  bestCorrect?: number;
}

export interface DuelQuestion {
  idA: string;
  idB: string;
  metric: DemographicMetric;
  winnerId: string;
}
