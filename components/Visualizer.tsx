import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  isDarkMode: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, isDarkMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const bars = 50;
    
    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width / bars;
      
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      // Adjust colors based on theme if needed, but primary brand colors usually look good in both
      gradient.addColorStop(0, '#6366f1'); // Indigo 500
      gradient.addColorStop(1, '#a855f7'); // Purple 500
      ctx.fillStyle = gradient;

      for (let i = 0; i < bars; i++) {
        // Create a fake audio wave effect based on time and index
        let heightMultiplier = 0.05; // Base height
        if (isPlaying) {
            // Perlin-noise-ish simulation using sine waves
            heightMultiplier = Math.abs(Math.sin(time * 0.005 + i * 0.2) * Math.sin(time * 0.003 + i * 0.1));
            // Add some randomness
            heightMultiplier += Math.random() * 0.2;
        }

        const barHeight = canvas.height * heightMultiplier * 0.8;
        const x = i * width;
        const y = (canvas.height - barHeight) / 2;
        
        // Rounded bars
        ctx.beginPath();
        // Use different alpha for inactive state based on mode
        ctx.globalAlpha = isPlaying ? 1 : 0.3;
        ctx.roundRect(x + 2, y, width - 4, barHeight, 4);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, isDarkMode]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-32 rounded-xl bg-surface-light dark:bg-surface-dark backdrop-blur-sm border border-gray-200 dark:border-white/10 transition-colors duration-300"
    />
  );
};