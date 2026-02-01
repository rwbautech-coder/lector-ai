export interface TextChunk {
  id: number;
  text: string;
  status: 'pending' | 'generating' | 'ready' | 'playing' | 'completed' | 'error';
  audioUrl?: string; // Blob URL for HTMLAudioElement
}

export interface Page {
  id: number;
  chunks: TextChunk[]; // Contains references or copies of chunks belonging to this page
  startChunkIndex: number; // Index in the global chunks array
  endChunkIndex: number;
  contentDisplay: string; // Full text of the page for display
}

export interface Chapter {
  title: string;
  pageIndex: number;
  chunkIndex: number;
}

export enum ReaderState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
}

export interface VoiceConfig {
  name: string;
  id: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
  email?: string; // Connected Google Email
  googleToken?: string; // Access Token
  // User-specific settings
  playbackSpeed: number;
  selectedVoice: string;
  isDarkMode: boolean;
}

export interface Book {
  id: string; // usually filename + timestamp
  title: string;
  content: string;
  lastRead: number; // timestamp
  currentChunkIndex: number;
  totalChunks: number;
  lastModified: number; // For sync resolution
}

export interface AppSettings {
  googleClientId?: string;
  googleApiKey?: string;
}

// Available voices in Kokoro TTS (Local)
export const AVAILABLE_VOICES: VoiceConfig[] = [
  { name: 'Heart (Female - US, English Only)', id: 'Kore' },
  { name: 'Adam (Male - US, English Only)', id: 'Fenrir' },
  { name: 'Bella (Female - US, English Only)', id: 'Zephyr' },
  { name: 'Michael (Male - US, English Only)', id: 'Puck' },
  { name: 'George (Male - UK, English Only)', id: 'Charon' },
];

export const PREDEFINED_USERS: UserProfile[] = [
  { id: '1', name: 'Grzegorz', avatarColor: 'bg-blue-500', playbackSpeed: 1.3, selectedVoice: 'Kore', isDarkMode: true },
  { id: '2', name: 'Magda', avatarColor: 'bg-pink-500', playbackSpeed: 1.3, selectedVoice: 'Kore', isDarkMode: true },
  { id: '3', name: 'Natalia', avatarColor: 'bg-purple-500', playbackSpeed: 1.3, selectedVoice: 'Kore', isDarkMode: true },
  { id: '4', name: 'Marcel', avatarColor: 'bg-green-500', playbackSpeed: 1.3, selectedVoice: 'Kore', isDarkMode: true },
];