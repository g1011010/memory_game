export type MoodKey =
  | 'joyful'
  | 'grateful'
  | 'calm'
  | 'tender'
  | 'nostalgic'
  | 'curious'
  | 'heavy'
  | 'restless';

export type Precision = 'exact' | 'neighborhood' | 'city' | 'country' | 'nowhere';

export interface MemoryLocation {
  label: string;
  lat?: number;
  lng?: number;
  precision: Precision;
}

export interface MemoryMedia {
  kind: 'image' | 'video';
  /** Object URL or remote URL used for display. */
  url: string;
  /** Persisted binary for user-created media (IndexedDB). */
  blob?: Blob;
  /** For generated seed art. */
  art?: { hues: [number, number]; seed: number };
  /** Video loop window in seconds. */
  start?: number;
  end?: number;
}

export interface MemoryExtras {
  weather?: string;
  song?: string;
  company?: 'alone' | 'one' | 'many';
  tag?: string;
}

export interface Memory {
  id: string;
  displayName: string;
  anonymous: boolean;
  thought: string;
  mood: MoodKey;
  /** 0..1 */
  intensity: number;
  createdAt: number;
  location?: MemoryLocation;
  media?: MemoryMedia;
  extras?: MemoryExtras;
  sparkId?: string;
  echoOf?: string;
  authorKey: string;
  /** Seeded resonance (hidden; drives brightness). */
  resonance: number;
  mine?: boolean;
  visibility: 'public' | 'private';
}
