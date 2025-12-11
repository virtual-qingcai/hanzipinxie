import React, { useEffect, useRef, useState } from 'react';

interface HanziPlayerProps {
  character: string;
  size?: number;
}

export const HanziPlayer: React.FC<HanziPlayerProps> = ({ character, size = 300 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !window.HanziWriter) return;

    // Clear previous instance
    containerRef.current.innerHTML = '';
    setLoading(true);
    setError(false);

    try {
      writerRef.current = window.HanziWriter.create(containerRef.current, character, {
        width: size,
        height: size,
        padding: 5,
        showOutline: true,
        strokeAnimationSpeed: 1, // 1x speed
        delayBetweenStrokes: 200,
        strokeColor: '#2c1810', // Dark Brown (Ink)
        radicalColor: '#8B2323', // Imperial Red
        outlineColor: '#e7e5e4', // Light Stone
        drawingWidth: 20,
        onLoadCharDataSuccess: () => {
          setLoading(false);
          // Auto start animation loop
          writerRef.current.loopCharacterAnimation();
        },
        onLoadCharDataError: () => {
          setLoading(false);
          setError(true);
        }
      });
    } catch (e) {
      console.error("HanziWriter init error", e);
      setError(true);
      setLoading(false);
    }

    return () => {
      // Cleanup
    };
  }, [character, size]);

  const handleReplay = () => {
    if (writerRef.current) {
      writerRef.current.animateCharacter();
    }
  };

  const handleQuiz = () => {
     if (writerRef.current) {
      writerRef.current.quiz();
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div 
        ref={containerRef} 
        className={`bg-white rounded-xl shadow-lg border border-[#d6d3d1] ${loading ? 'animate-pulse' : ''}`}
        style={{ width: size, height: size }}
      />
      
      {loading && <p className="text-stone-500 font-serif">正在研墨...</p>}
      {error && <p className="text-red-800 font-serif">无法加载汉字数据。</p>}
      
      {!loading && !error && (
        <div className="flex gap-4">
          <button 
            onClick={handleReplay}
            className="px-8 py-3 bg-[#8B2323] hover:bg-[#6d1b1b] text-white rounded-lg font-bold transition shadow-md active:scale-95 tracking-widest"
          >
            重播
          </button>
          <button 
            onClick={handleQuiz}
            className="px-8 py-3 bg-[#f5f5f4] hover:bg-[#e7e5e4] border border-[#d6d3d1] text-[#2c1810] rounded-lg font-bold transition shadow-md active:scale-95 tracking-widest"
          >
            描红
          </button>
        </div>
      )}
    </div>
  );
};