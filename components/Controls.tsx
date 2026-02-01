import React from 'react';
import { Play, Pause, FastForward, Rewind, Settings, Sun, Moon } from 'lucide-react';

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  availableVoices: { name: string; id: string }[];
  isDarkMode: boolean;
  toggleTheme: () => void;
  skipForward: () => void;
  skipBackward: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlayPause,
  playbackSpeed,
  onSpeedChange,
  selectedVoice,
  onVoiceChange,
  availableVoices,
  isDarkMode,
  toggleTheme,
  skipForward,
  skipBackward,
}) => {
  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto p-6 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl transition-colors duration-300">
      
      {/* Top Row: Speed, Voice, Theme */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Settings size={18} className="text-gray-400" />
          <select 
            value={selectedVoice}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="bg-background-light dark:bg-background-dark text-sm text-gray-700 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-700 p-2 focus:ring-2 focus:ring-primary outline-none w-full transition-colors"
          >
            {availableVoices.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
           {/* Speed Control */}
           <div className="flex items-center gap-3 bg-background-light dark:bg-background-dark p-2 rounded-lg border border-gray-300 dark:border-gray-700">
             <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Speed</span>
             <input 
               type="range" 
               min="0.5" 
               max="2.5" 
               step="0.1" 
               value={playbackSpeed}
               onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
               className="w-24 accent-primary cursor-pointer"
             />
             <span className="text-sm font-bold w-12 text-right text-gray-700 dark:text-gray-200">{playbackSpeed.toFixed(1)}x</span>
           </div>

           {/* Theme Toggle */}
           <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors"
            title="Toggle Night Mode"
           >
             {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
           </button>
        </div>
      </div>

      {/* Bottom Row: Playback Controls */}
      <div className="flex justify-center items-center gap-8">
        <button 
          onClick={skipBackward}
          className="text-gray-400 hover:text-primary transition-colors"
        >
          <Rewind size={24} />
        </button>

        <button 
          onClick={onPlayPause}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-primary hover:bg-secondary text-white shadow-lg shadow-primary/30 transition-all transform hover:scale-105 active:scale-95"
        >
          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
        </button>

        <button 
          onClick={skipForward}
          className="text-gray-400 hover:text-primary transition-colors"
        >
          <FastForward size={24} />
        </button>
      </div>
    </div>
  );
};