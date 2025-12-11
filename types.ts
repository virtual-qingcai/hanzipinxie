
export interface Hotspot {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
  character: string;
  explanation: string;
}

export interface ImageItem {
  id: string;
  variants: string[]; // Changed from single url to array of urls
  audioUrl?: string; // Base64 audio string
  audioText?: string; // Text explanation for the audio
  name: string;
  hotspots: Hotspot[];
}

export type AppMode = 'view' | 'edit';

// Extend Window interface for HanziWriter
declare global {
  interface Window {
    HanziWriter: any;
  }
}