import React, { useState, useRef } from 'react';
import { Hotspot, AppMode } from '../types';

interface HotspotLayerProps {
  hotspots: Hotspot[];
  mode: AppMode;
  onAddHotspot: (rect: Omit<Hotspot, 'id' | 'character' | 'explanation'>) => void;
  onUpdateHotspot: (id: string, updates: Partial<Hotspot>) => void;
  onSelectHotspot: (hotspot: Hotspot) => void;
  onDeleteHotspot: (id: string) => void;
}

export const HotspotLayer: React.FC<HotspotLayerProps> = ({
  hotspots,
  mode,
  onAddHotspot,
  onUpdateHotspot,
  onSelectHotspot,
  onDeleteHotspot
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Drag State
  const [movingHotspotId, setMovingHotspotId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize State
  const [resizingState, setResizingState] = useState<{
    id: string;
    handle: 'nw' | 'ne' | 'sw' | 'se';
    startPos: { x: number; y: number };
    startDims: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const getPercentageCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  // --- Creation Logic (Background) ---
  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (mode !== 'edit') return;
    if (movingHotspotId || resizingState) return;

    e.stopPropagation();
    containerRef.current?.setPointerCapture(e.pointerId);

    const coords = getPercentageCoords(e.clientX, e.clientY);
    setStartPos(coords);
    setDrawing(true);
    setCurrentRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handleBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!drawing || mode !== 'edit') return;

    const coords = getPercentageCoords(e.clientX, e.clientY);
    const width = coords.x - startPos.x;
    const height = coords.y - startPos.y;

    setCurrentRect({
      x: width > 0 ? startPos.x : coords.x,
      y: height > 0 ? startPos.y : coords.y,
      w: Math.abs(width),
      h: Math.abs(height)
    });
  };

  const handleBackgroundPointerUp = (e: React.PointerEvent) => {
    if (!drawing || mode !== 'edit') return;
    setDrawing(false);
    containerRef.current?.releasePointerCapture(e.pointerId);

    if (currentRect && currentRect.w > 2 && currentRect.h > 2) {
      onAddHotspot({
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.w,
        height: currentRect.h
      });
    }
    setCurrentRect(null);
  };

  // --- Move Logic (Hotspot) ---
  const handleHotspotPointerDown = (e: React.PointerEvent, h: Hotspot) => {
    if (mode !== 'edit') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const coords = getPercentageCoords(e.clientX, e.clientY);
    setMovingHotspotId(h.id);
    setDragOffset({
      x: coords.x - h.x,
      y: coords.y - h.y
    });
  };

  const handleHotspotPointerMove = (e: React.PointerEvent, h: Hotspot) => {
    if (mode !== 'edit' || movingHotspotId !== h.id) return;
    e.stopPropagation();

    const coords = getPercentageCoords(e.clientX, e.clientY);
    onUpdateHotspot(h.id, { x: coords.x - dragOffset.x, y: coords.y - dragOffset.y });
  };

  const handleHotspotPointerUp = (e: React.PointerEvent) => {
    if (mode !== 'edit' || !movingHotspotId) return;
    e.stopPropagation();
    setMovingHotspotId(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // --- Resize Logic ---
  const handleResizeDown = (e: React.PointerEvent, h: Hotspot, handle: 'nw' | 'ne' | 'sw' | 'se') => {
    if (mode !== 'edit') return;
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const coords = getPercentageCoords(e.clientX, e.clientY);
    setResizingState({
      id: h.id,
      handle,
      startPos: coords,
      startDims: { x: h.x, y: h.y, w: h.width, h: h.height }
    });
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizingState) return;
    e.stopPropagation();

    const coords = getPercentageCoords(e.clientX, e.clientY);
    const deltaX = coords.x - resizingState.startPos.x;
    const deltaY = coords.y - resizingState.startPos.y;

    const { x, y, w, h } = resizingState.startDims;
    let newX = x, newY = y, newW = w, newH = h;
    const minSize = 2;

    if (resizingState.handle.includes('e')) newW = Math.max(minSize, w + deltaX);
    if (resizingState.handle.includes('s')) newH = Math.max(minSize, h + deltaY);
    if (resizingState.handle.includes('w')) {
      if (w - deltaX < minSize) {
        newX = x + w - minSize;
        newW = minSize;
      } else {
        newX = x + deltaX;
        newW = w - deltaX;
      }
    }
    if (resizingState.handle.includes('n')) {
      if (h - deltaY < minSize) {
        newY = y + h - minSize;
        newH = minSize;
      } else {
        newY = y + deltaY;
        newH = h - deltaY;
      }
    }

    onUpdateHotspot(resizingState.id, { x: newX, y: newY, width: newW, height: newH });
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (!resizingState) return;
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    setResizingState(null);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 select-none touch-none ${mode === 'edit' ? 'cursor-crosshair' : 'cursor-default'}`}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handleBackgroundPointerMove}
      onPointerUp={handleBackgroundPointerUp}
    >
      {hotspots.map((h) => (
        <div
          key={h.id}
          onPointerDown={(e) => handleHotspotPointerDown(e, h)}
          onPointerMove={(e) => handleHotspotPointerMove(e, h)}
          onPointerUp={handleHotspotPointerUp}
          onClick={(e) => {
            e.stopPropagation();
            if (mode === 'view') onSelectHotspot(h);
          }}
          className={`absolute transition-all duration-0 
            ${mode === 'edit'
              ? 'border-4 border-[#8B2323] bg-[#8B2323]/20 hover:bg-[#8B2323]/30 cursor-move z-10 rounded-xl'
              : 'cursor-pointer group duration-500 z-0'
            }
          `}
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            width: `${h.width}%`,
            height: `${h.height}%`,
          }}
        >
          {mode === 'edit' && (
            <>
              <div className="absolute top-0 left-0 bg-[#8B2323] text-white text-xs px-1 font-bold pointer-events-none">
                {h.character}
              </div>

              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteHotspot(h.id);
                }}
                className="absolute -top-4 -right-4 w-8 h-8 bg-[#8B2323] hover:bg-[#6d1b1b] text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 z-40 transition border border-white"
                title="删除"
              >
                <span className="text-xl font-bold leading-none mb-1">&times;</span>
              </button>

              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                <div
                  key={handle}
                  onPointerDown={(e) => handleResizeDown(e, h, handle)}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeUp}
                  className={`absolute w-4 h-4 bg-white border-2 border-[#8B2323] rounded-full z-30 shadow-sm
                    ${handle === 'nw' ? '-top-2 -left-2 cursor-nw-resize' : ''}
                    ${handle === 'ne' ? '-top-2 -right-2 cursor-ne-resize' : ''}
                    ${handle === 'sw' ? '-bottom-2 -left-2 cursor-sw-resize' : ''}
                    ${handle === 'se' ? '-bottom-2 -right-2 cursor-se-resize' : ''}
                  `}
                />
              ))}
            </>
          )}

          {mode === 'view' && (
            <div className="absolute inset-0 rounded-xl transition-all duration-700 pointer-events-none">
              <div className="w-full h-full border-4 border-amber-400/30 bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.3)] animate-pulse group-hover:bg-amber-400/20 group-hover:border-amber-500 rounded-xl"></div>
            </div>
          )}
        </div>
      ))}

      {currentRect && (
        <div
          className="absolute border-2 border-[#8B2323] bg-[#8B2323]/20 pointer-events-none"
          style={{
            left: `${currentRect.x}%`,
            top: `${currentRect.y}%`,
            width: `${currentRect.w}%`,
            height: `${currentRect.h}%`,
          }}
        />
      )}
    </div>
  );
};