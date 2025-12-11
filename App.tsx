
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ImageItem, Hotspot, AppMode } from './types';
import { HotspotLayer } from './components/HotspotLayer';
import { HanziPlayer } from './components/HanziPlayer';
import { saveAppData, loadAppData } from './services/storageService';
import { 
  PhotoIcon, 
  PencilSquareIcon, 
  PlayIcon, 
  PlusIcon,
  TrashIcon,
  HandRaisedIcon,
  ArrowsRightLeftIcon,
  PresentationChartLineIcon,
  LockClosedIcon,
  ArrowPathIcon,
  Square2StackIcon,
  SpeakerWaveIcon,
  PauseIcon,
  MusicalNoteIcon,
  XMarkIcon,
  ArrowPathRoundedSquareIcon
} from '@heroicons/react/24/solid';

const DEFAULT_IMAGE_ID = 'demo-1';

// Demo variants for the first group
const DEMO_VARIANTS = [
  'https://images.unsplash.com/photo-1533158388470-9a56699990c6?q=80&w=2588&auto=format&fit=crop', // Original
  'https://images.unsplash.com/photo-1533158388470-9a56699990c6?q=80&w=2588&auto=format&fit=crop&sat=-100', // Black & White style
  'https://images.unsplash.com/photo-1533158388470-9a56699990c6?q=80&w=2588&auto=format&fit=crop&sepia=100' // Sepia style
];

const generateDemoHotspots = (): Hotspot[] => {
  const charRows = [
    ['君', '諱', '表', '字', '元'],
    ['異', '系', '帝', '高', '辛'],
    ['爰', '暨', '后', '稷', '張'],
    ['仲', '孝', '友', '雅', '藝'],
    ['攸', '載', '天', '挺', '留'],
    ['侯', '應', '期', '佐', '治']
  ];

  const hotspots: Hotspot[] = [];
  const rows = 6;
  const cols = 5;
  const cellWidth = 100 / cols;
  const cellHeight = 100 / rows;
  const boxSize = Math.min(cellWidth, cellHeight) * 0.7;
  
  charRows.forEach((rowChars, rowIndex) => {
    rowChars.forEach((char, colIndex) => {
      const x = (colIndex * cellWidth) + (cellWidth - boxSize) / 2;
      const y = (rowIndex * cellHeight) + (cellHeight - boxSize) / 2;

      let explanation = `点击探索汉字“${char}”的笔画顺序与结构之美。`;
      if (char === '天') {
        explanation = '“天”是中国文化中最重要的概念之一，代表天空、苍穹或白昼。它常与皇帝（天子）联系在一起，象征着至高无上的权力和自然的法则。';
      }

      hotspots.push({
        id: `demo-${char}-${rowIndex}-${colIndex}`,
        x,
        y,
        width: boxSize,
        height: boxSize,
        character: char,
        explanation: explanation
      });
    });
  });

  return hotspots;
};

const defaultImages: ImageItem[] = [
  {
    id: DEFAULT_IMAGE_ID,
    variants: DEMO_VARIANTS,
    name: '汉字碑文演示',
    audioText: '这是关于汉字碑文的语音导览。碑文记录了古代书法艺术的精髓，通过这些文字，我们可以窥见历史的痕迹。',
    hotspots: generateDemoHotspots()
  },
  {
    id: 'demo-2',
    variants: ['https://images.unsplash.com/photo-1629814585036-74d30c309582?q=80&w=2670&auto=format&fit=crop'],
    name: '宣纸书法示例',
    hotspots: []
  }
];

const App: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [images, setImages] = useState<ImageItem[]>(defaultImages);
  const [mode, setMode] = useState<AppMode>('view');
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [appTitle, setAppTitle] = useState("汉字 互动探索");
  const [isSaving, setIsSaving] = useState(false);
  
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [exitProgress, setExitProgress] = useState(0);

  const [isCreatingHotspot, setIsCreatingHotspot] = useState(false);
  const [tempRect, setTempRect] = useState<Omit<Hotspot, 'id' | 'character' | 'explanation'> | null>(null);
  const [inputChar, setInputChar] = useState('');
  const [inputExplanation, setInputExplanation] = useState('');

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioPopupOpen, setIsAudioPopupOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Slider State
  const [activeIndex, setActiveIndex] = useState(0); // This is the index in the FLATTENED list of all variants
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isSwipingRef = useRef(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  // --- Derived State (Flattened Slides) ---
  const flatSlides = useMemo(() => {
    return images.flatMap((img, groupIndex) => 
      img.variants.map((variantUrl, variantIndex) => ({
        uniqueId: `${img.id}-${variantIndex}`,
        imageId: img.id,
        url: variantUrl,
        audioUrl: img.audioUrl,
        audioText: img.audioText,
        name: img.name,
        hotspots: img.hotspots, // Shared reference
        groupIndex,
        variantIndex,
        totalVariants: img.variants.length,
        isFirstInGroup: variantIndex === 0
      }))
    );
  }, [images]);

  const activeSlide = flatSlides[activeIndex] || flatSlides[0];
  const activeImageId = activeSlide?.imageId;

  // --- Persistence Logic ---
  useEffect(() => {
    const initData = async () => {
      const savedData = await loadAppData();
      if (savedData && savedData.images.length > 0) {
        // Data Migration: Ensure 'variants' array exists
        const migratedImages = savedData.images.map((img: any) => ({
          ...img,
          variants: Array.isArray(img.variants) ? img.variants : (img.url ? [img.url] : [])
        }));

        setImages(migratedImages);
        setAppTitle(savedData.appTitle);
      }
      setIsLoaded(true);
    };
    initData();
  }, []);

  // Auto-save
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
        setIsSaving(true);
        saveAppData({ appTitle, images }).then(() => {
            setIsSaving(false);
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [images, appTitle, isLoaded]);

  // Audio Auto-Stop on GROUP Change
  useEffect(() => {
    // When activeImageId changes, it means we switched groups.
    // The key={activeImageId} on the audio element handles unmounting the old audio,
    // which effectively stops it. We just need to reset local state.
    setIsPlaying(false);
    setIsAudioPopupOpen(false);
  }, [activeImageId]); 

  // Swipe Hint Logic
  useEffect(() => {
    if (mode === 'view' && flatSlides.length > 1 && !activeHotspot && isLoaded) {
        setShowSwipeHint(true);
        const timer = setTimeout(() => setShowSwipeHint(false), 4000);
        return () => clearTimeout(timer);
    } else {
        setShowSwipeHint(false);
    }
  }, [mode, flatSlides.length, activeHotspot, isLoaded]);

  const enterPresentationMode = () => {
    setIsPresentationMode(true);
    setMode('view');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(e => console.log(e));
    }
  };

  const handleExitDown = () => {
    setExitProgress(0);
    const startTime = Date.now();
    const duration = 3000;
    exitTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setExitProgress(progress);
        if (progress >= 100) {
            if (exitTimerRef.current) clearInterval(exitTimerRef.current);
            setIsPresentationMode(false);
            if (document.exitFullscreen) document.exitFullscreen().catch(e => console.log(e));
            setExitProgress(0);
        }
    }, 50);
  };

  const handleExitUp = () => {
    if (exitTimerRef.current) {
        clearInterval(exitTimerRef.current);
        exitTimerRef.current = null;
    }
    setExitProgress(0);
  };

  // --- Image Management ---

  const handleImportNewGroup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage: ImageItem = {
          id: Date.now().toString(),
          variants: [reader.result as string],
          name: file.name.replace(/\.[^/.]+$/, ""),
          hotspots: []
        };
        setImages(prev => [...prev, newImage]);
        // Jump to the new image (last index)
        setTimeout(() => {
             setActiveIndex(flatSlides.length); 
        }, 0);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddVariant = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && activeSlide) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            const newVariantUrl = reader.result as string;
            setImages(prev => prev.map(img => {
                if (img.id === activeSlide.imageId) {
                    return { ...img, variants: [...img.variants, newVariantUrl] };
                }
                return img;
            }));
        };
        reader.readAsDataURL(file);
      }
  };

  // --- Audio Management ---
  const handleImportAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && activeSlide) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              const audioBase64 = reader.result as string;
              setImages(prev => prev.map(img => {
                  if (img.id === activeSlide.imageId) {
                      return { ...img, audioUrl: audioBase64, audioText: "请在此输入音频解说内容..." };
                  }
                  return img;
              }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDeleteAudio = () => {
      if (!activeSlide) return;
      setImages(prev => prev.map(img => {
          if (img.id === activeSlide.imageId) {
              return { ...img, audioUrl: undefined, audioText: undefined };
          }
          return img;
      }));
      setIsPlaying(false);
  };

  const handleAudioPlayClick = () => {
      setIsAudioPopupOpen(true);
      if (audioRef.current && !isPlaying) {
          audioRef.current.play().catch(e => console.error("Audio playback failed", e));
          setIsPlaying(true);
      }
  };

  const toggleAudio = () => {
      if (!audioRef.current) return;
      if (isPlaying) {
          audioRef.current.pause();
      } else {
          audioRef.current.play().catch(e => console.error("Audio playback failed", e));
      }
      setIsPlaying(!isPlaying);
  };

  const handleRestartAudio = () => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      if (!isPlaying) {
          audioRef.current.play().catch(e => console.error("Audio playback failed", e));
          setIsPlaying(true);
      }
  };

  const updateAudioText = (text: string) => {
    if (!activeSlide) return;
    setImages(prev => prev.map(img => {
        if (img.id === activeSlide.imageId) {
            return { ...img, audioText: text };
        }
        return img;
    }));
  };

  const updateImageName = (id: string, name: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, name } : img));
  };

  const deleteImageGroup = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (images.length <= 1) return;
    const newImages = images.filter(img => img.id !== id);
    setImages(newImages);
    setActiveIndex(0);
  };

  const deleteCurrentVariant = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeSlide) return;
      
      // If it's the only variant, warn user to delete the group instead
      if (activeSlide.totalVariants <= 1) {
          alert("这是该组唯一的图片。若要删除，请在侧边栏删除整组。");
          return;
      }

      setImages(prev => prev.map(img => {
          if (img.id === activeSlide.imageId) {
              const newVariants = img.variants.filter((_, idx) => idx !== activeSlide.variantIndex);
              return { ...img, variants: newVariants };
          }
          return img;
      }));
      // Adjust index slightly back if we deleted the last one
      if (activeIndex > 0) setActiveIndex(prev => prev - 1);
  };

  // --- Sidebar Navigation ---
  const jumpToGroup = (imageId: string) => {
    const index = flatSlides.findIndex(s => s.imageId === imageId && s.isFirstInGroup);
    if (index !== -1) setActiveIndex(index);
  };

  // --- Hotspot Management ---

  const handleAddHotspotDraw = (rect: Omit<Hotspot, 'id' | 'character' | 'explanation'>) => {
    setTempRect(rect);
    setIsCreatingHotspot(true);
    setInputChar('');
    setInputExplanation('');
  };

  const updateHotspot = (id: string, updates: Partial<Hotspot>) => {
    if (!activeSlide) return;
    const updatedImages = images.map(img => {
      if (img.id === activeSlide.imageId) {
        return {
          ...img,
          hotspots: img.hotspots.map(h => h.id === id ? { ...h, ...updates } : h)
        };
      }
      return img;
    });
    setImages(updatedImages);
  };

  const confirmHotspotCreation = () => {
    if (!tempRect || !activeSlide || !inputChar) return;
    const newHotspot: Hotspot = {
      ...tempRect,
      id: Date.now().toString(),
      character: inputChar,
      explanation: inputExplanation || "暂无详细解说。"
    };
    const updatedImages = images.map(img => {
      if (img.id === activeSlide.imageId) {
        return { ...img, hotspots: [...img.hotspots, newHotspot] };
      }
      return img;
    });
    setImages(updatedImages);
    setIsCreatingHotspot(false);
    setTempRect(null);
  };

  const deleteHotspot = (hotspotId: string) => {
    if (!activeSlide) return;
    const updatedImages = images.map(img => {
      if (img.id === activeSlide.imageId) {
        return { ...img, hotspots: img.hotspots.filter(h => h.id !== hotspotId) };
      }
      return img;
    });
    setImages(updatedImages);
  };

  // --- Swipe / Nav Logic ---

  const handlePrev = () => {
    setActiveIndex(prev => (prev - 1 + flatSlides.length) % flatSlides.length);
  };

  const handleNext = () => {
    setActiveIndex(prev => (prev + 1) % flatSlides.length);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setShowSwipeHint(false);
    touchStartX.current = e.clientX;
    isSwipingRef.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (touchStartX.current === null) return;
    touchEndX.current = e.clientX;
    if (Math.abs(touchEndX.current - touchStartX.current) > 10) {
        isSwipingRef.current = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (touchStartX.current === null || touchEndX.current === null) {
        touchStartX.current = null;
        touchEndX.current = null;
        isSwipingRef.current = false;
        return;
    }

    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) handleNext();
      else handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
    setTimeout(() => { isSwipingRef.current = false; }, 100);
  };

  const onPointerLeave = () => {
    touchStartX.current = null;
    touchEndX.current = null;
    isSwipingRef.current = false;
  };

  const handleHotspotSelect = (h: Hotspot) => {
    if (isSwipingRef.current) return;
    setActiveHotspot(h);
  };

  if (!isLoaded) {
      return (
          <div className="flex h-screen items-center justify-center bg-[#fdfbf7] text-[#2c1810]">
              <div className="flex flex-col items-center gap-4 animate-pulse">
                  <div className="text-4xl">🖌️</div>
                  <p className="font-serif tracking-widest text-xl">正在读取馆藏数据...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-[#fdfbf7] overflow-hidden select-none font-sans text-[#2c1810]">
      
      {/* Sidebar */}
      <div className={`bg-[#f5f5f4] border-r border-[#d6d3d1] flex flex-col z-30 shadow-2xl transition-all duration-500 ease-in-out ${isPresentationMode ? 'w-16 opacity-80 hover:opacity-100 hover:w-64' : 'w-64'}`}>
        {/* Title Area */}
        {!isPresentationMode ? (
             <div className="p-4 border-b border-[#d6d3d1] min-w-[16rem]">
                {mode === 'edit' ? (
                    <input
                        type="text"
                        value={appTitle}
                        onChange={(e) => setAppTitle(e.target.value)}
                        className="w-full bg-[#e7e5e4] text-xl font-bold text-[#2c1810] tracking-wider border-b border-[#8B2323] focus:outline-none py-1 px-2 font-serif"
                    />
                ) : (
                    <h1 className="text-xl font-bold text-[#2c1810] tracking-wider flex items-center gap-2 font-serif">
                        <span className="text-[#8B2323] text-2xl">|</span> {appTitle}
                    </h1>
                )}
            </div>
        ) : (
            <div className="p-4 border-b border-[#d6d3d1] flex justify-center">
                 <span className="text-[#8B2323] text-2xl font-bold font-serif">汉</span>
            </div>
        )}
        
        {/* Image List (Groups) */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isPresentationMode ? 'scrollbar-hide' : 'min-w-[16rem]'}`}>
            {images.map(img => (
                <div 
                    key={img.id}
                    onClick={() => jumpToGroup(img.id)}
                    className={`
                        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 shadow-sm
                        ${activeImageId === img.id ? 'border-[#8B2323] ring-1 ring-[#8B2323]/20' : 'border-[#d6d3d1] hover:border-[#a8a29e]'}
                    `}
                    title={img.name}
                >
                    <img src={img.variants[0]} alt={img.name} className="w-full h-24 md:h-32 object-cover opacity-90 group-hover:opacity-100 transition" />
                    {!isPresentationMode && (
                        <div className="absolute bottom-0 inset-x-0 bg-[#2c1810]/80 p-2 flex justify-between items-center">
                            <p className="text-xs text-[#f5f5f4] truncate font-medium tracking-wide flex-1">{img.name}</p>
                            {img.variants.length > 1 && (
                                <span className="bg-[#8B2323] text-white text-[10px] px-1.5 rounded-sm ml-2 font-mono">{img.variants.length}</span>
                            )}
                        </div>
                    )}
                    {mode === 'edit' && images.length > 1 && !isPresentationMode && (
                        <button 
                            onClick={(e) => deleteImageGroup(e, img.id)}
                            className="absolute top-2 right-2 p-1.5 bg-[#8B2323] hover:bg-[#6d1b1b] rounded-full text-white shadow-lg z-20"
                            title="删除整组"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ))}
        </div>

        {!isPresentationMode && (
            <div className="p-4 border-t border-[#d6d3d1] bg-[#e7e5e4] space-y-3 min-w-[16rem]">
                <label className="flex items-center justify-center gap-2 w-full py-3 bg-white hover:bg-[#f5f5f4] text-[#2c1810] rounded-lg cursor-pointer transition font-medium border border-[#d6d3d1] shadow-sm">
                    <PlusIcon className="w-5 h-5 text-[#8B2323]" />
                    <span>导入新组</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImportNewGroup} />
                </label>
                
                <div className="flex bg-[#d6d3d1] p-1 rounded-lg">
                    <button 
                        onClick={() => setMode('view')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition text-sm font-bold tracking-wide ${mode === 'view' ? 'bg-[#8B2323] text-white shadow' : 'text-[#57534e] hover:text-[#2c1810]'}`}
                    >
                        <PlayIcon className="w-4 h-4" /> 浏览
                    </button>
                    <button 
                        onClick={() => setMode('edit')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition text-sm font-bold tracking-wide ${mode === 'edit' ? 'bg-[#8B2323] text-white shadow' : 'text-[#57534e] hover:text-[#2c1810]'}`}
                    >
                        <PencilSquareIcon className="w-4 h-4" /> 编辑
                    </button>
                </div>

                <button 
                    onClick={enterPresentationMode}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#2c1810] hover:bg-black text-[#f5f5f4] rounded-lg font-bold shadow-lg transition active:scale-95"
                >
                    <PresentationChartLineIcon className="w-5 h-5" />
                    进入演示模式
                </button>
                
                {isSaving && (
                    <div className="flex items-center justify-center gap-2 text-xs text-[#a8a29e]">
                         <ArrowPathIcon className="w-3 h-3 animate-spin" /> 正在保存...
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Main Stage */}
      <div 
        className="flex-1 relative bg-[#fdfbf7] flex items-center justify-center overflow-hidden touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        {showSwipeHint && (
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
                <div className="bg-[#2c1810]/80 backdrop-blur-md border border-[#f5f5f4]/20 text-[#f5f5f4] px-10 py-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
                    <div className="flex items-center gap-6 text-[#c49a6c]">
                         <ArrowsRightLeftIcon className="w-12 h-12 animate-pulse" />
                         <HandRaisedIcon className="w-16 h-16 animate-bounce" />
                    </div>
                    <p className="text-2xl font-bold tracking-widest font-serif">左右滑动切换</p>
                </div>
            </div>
        )}

        {/* Carousel Container */}
        <div 
            className="flex w-full h-full transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
            {flatSlides.map((slide) => (
                <div key={slide.uniqueId} className="w-full h-full flex-shrink-0 p-4 md:p-8 lg:p-12 relative flex items-center justify-center">
                     <div className="relative w-full h-full shadow-2xl rounded-sm overflow-hidden bg-white border border-[#d6d3d1]">
                        
                        {/* Title Overlay */}
                        <div className="absolute top-0 left-0 w-full p-6 z-20 bg-gradient-to-b from-[#2c1810]/80 via-[#2c1810]/40 to-transparent pointer-events-none flex justify-between items-start">
                            <div>
                                {mode === 'edit' && !isPresentationMode ? (
                                    <input
                                        type="text"
                                        value={slide.name}
                                        onChange={(e) => updateImageName(slide.imageId, e.target.value)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="pointer-events-auto text-4xl font-bold text-[#fdfbf7] bg-transparent border-b border-white/30 focus:border-[#c49a6c] outline-none w-full max-w-lg font-serif tracking-wider"
                                        placeholder="在此输入标题"
                                    />
                                ) : (
                                    <h2 className="text-4xl font-bold text-[#fdfbf7] font-serif tracking-widest drop-shadow-md">{slide.name}</h2>
                                )}
                            </div>
                        </div>
                        
                        {/* Add Variant Button (Edit Mode) */}
                        {mode === 'edit' && !isPresentationMode && (
                             <div className="absolute top-6 right-6 z-30 flex flex-col gap-2 pointer-events-auto">
                                <label className="bg-[#f5f5f4] hover:bg-white text-[#2c1810] px-3 py-2 rounded-lg text-xs font-bold shadow-lg cursor-pointer flex items-center gap-2 transition border border-[#d6d3d1]">
                                    <Square2StackIcon className="w-4 h-4 text-[#8B2323]" />
                                    添加变体
                                    <input type="file" accept="image/*" className="hidden" onChange={handleAddVariant} />
                                </label>
                                {slide.totalVariants > 1 && (
                                     <button 
                                        onClick={deleteCurrentVariant}
                                        className="bg-[#2c1810] hover:bg-red-900 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 transition"
                                     >
                                         <TrashIcon className="w-4 h-4" /> 删除变体
                                     </button>
                                )}
                             </div>
                        )}

                        <img 
                            src={slide.url} 
                            alt={slide.name} 
                            className="w-full h-full object-contain pointer-events-none select-none bg-white" 
                        />
                        
                        {/* Render hotspots (Shared for the group) */}
                        <div className={activeImageId === slide.imageId ? 'pointer-events-auto' : 'pointer-events-none'}>
                            <HotspotLayer 
                                hotspots={slide.hotspots}
                                mode={mode}
                                onAddHotspot={handleAddHotspotDraw}
                                onUpdateHotspot={updateHotspot}
                                onSelectHotspot={handleHotspotSelect}
                                onDeleteHotspot={deleteHotspot}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Audio Player Controls */}
        <div className="absolute bottom-20 right-20 z-40 flex flex-col items-end gap-4">
             {/* Hidden Audio Element - Keyed by ImageID so it persists across variants but resets across groups */}
             {activeSlide?.audioUrl && (
                 <audio 
                    key={activeImageId}
                    ref={audioRef} 
                    src={activeSlide.audioUrl} 
                    onEnded={() => setIsPlaying(false)}
                 />
             )}

             {mode === 'edit' && !isPresentationMode && (
                 <div className="flex flex-col gap-2 mb-2 pointer-events-auto">
                     {activeSlide?.audioUrl ? (
                         <button 
                            onClick={handleDeleteAudio}
                            className="bg-[#2c1810] text-white px-3 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 hover:bg-red-900 transition"
                         >
                             <XMarkIcon className="w-4 h-4" /> 删除音频
                         </button>
                     ) : (
                         <label className="bg-[#f5f5f4] text-[#2c1810] px-3 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 hover:bg-white cursor-pointer transition border border-[#d6d3d1]">
                             <MusicalNoteIcon className="w-4 h-4 text-[#8B2323]" /> 上传音频
                             <input type="file" accept="audio/*" className="hidden" onChange={handleImportAudio} />
                         </label>
                     )}
                 </div>
             )}

             {activeSlide?.audioUrl && (
                 <button 
                    onClick={handleAudioPlayClick}
                    className={`w-24 h-24 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 pointer-events-auto z-50
                        ${isPlaying ? 'bg-[#fdfbf7] text-[#8B2323] border-4 border-[#8B2323]' : 'bg-[#8B2323] text-white border-4 border-white'}
                        hover:scale-105 active:scale-95
                    `}
                    title="播放解说"
                 >
                     {isPlaying ? (
                         <PauseIcon className="w-12 h-12" />
                     ) : (
                         <SpeakerWaveIcon className="w-12 h-12 ml-1" />
                     )}
                 </button>
             )}
        </div>

        {/* Audio Info Popup */}
        {isAudioPopupOpen && activeSlide?.audioUrl && (
             <div 
                 className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c1810]/60 backdrop-blur-sm p-4 animate-in fade-in duration-300"
                 onClick={() => setIsAudioPopupOpen(false)}
             >
                 <div 
                     onClick={(e) => e.stopPropagation()}
                     className="bg-white/95 border border-[#d6d3d1] rounded-3xl shadow-2xl max-w-lg w-full p-8 flex flex-col items-center gap-6 relative"
                 >
                     <div className="w-full border-b border-[#8B2323]/30 pb-4 text-center">
                         <h3 className="text-[#8B2323] font-bold tracking-widest text-lg uppercase font-serif">语音导览</h3>
                     </div>
                     
                     {mode === 'edit' ? (
                         <textarea 
                             value={activeSlide.audioText || ''}
                             onChange={(e) => updateAudioText(e.target.value)}
                             className="w-full h-40 bg-[#f5f5f4] border border-[#d6d3d1] rounded-lg p-4 text-[#2c1810] focus:ring-2 focus:ring-[#8B2323] outline-none resize-none font-serif text-lg leading-relaxed"
                             placeholder="请输入语音解说文字..."
                         />
                     ) : (
                         <div className="w-full h-40 overflow-y-auto custom-scrollbar">
                            <p className="text-[#44403c] text-lg leading-relaxed font-serif text-center px-2">
                                {activeSlide.audioText || "暂无解说文字。"}
                            </p>
                         </div>
                     )}

                     <div className="flex gap-4 w-full">
                         <button 
                             onClick={toggleAudio}
                             className={`flex-1 py-4 rounded-xl font-bold tracking-widest text-lg shadow-md transition active:scale-95 flex items-center justify-center gap-2
                                ${isPlaying ? 'bg-[#f5f5f4] text-[#8B2323] border border-[#d6d3d1]' : 'bg-[#8B2323] text-white hover:bg-[#6d1b1b]'}
                             `}
                         >
                             {isPlaying ? <><PauseIcon className="w-6 h-6" /> 暂停</> : <><PlayIcon className="w-6 h-6" /> 播放</>}
                         </button>
                         <button 
                             onClick={handleRestartAudio}
                             className="flex-1 py-4 bg-[#2c1810] hover:bg-[#1a0f0a] text-white rounded-xl font-bold tracking-widest text-lg shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                         >
                            <ArrowPathRoundedSquareIcon className="w-6 h-6" /> 重新讲解
                         </button>
                     </div>
                 </div>
             </div>
        )}

        {mode === 'edit' && !isPresentationMode && (
            <div className="absolute bottom-6 left-6 bg-[#2c1810]/80 backdrop-blur-md text-[#fdfbf7] px-5 py-3 rounded-full border border-[#fdfbf7]/20 shadow-xl pointer-events-none z-30 font-medium tracking-wide">
                <span className="text-[#c49a6c] font-bold">编辑模式：</span> 拖动添加热区，热区在同组变体间共享
            </div>
        )}

        {isPresentationMode && (
             <div className="absolute bottom-0 left-0 z-50 p-4">
                <button
                    onPointerDown={handleExitDown}
                    onPointerUp={handleExitUp}
                    onPointerLeave={handleExitUp}
                    className="w-12 h-12 flex items-center justify-center text-[#2c1810]/5 hover:text-[#2c1810]/50 active:text-[#8B2323] transition duration-500 rounded-full bg-transparent active:bg-[#8B2323]/10"
                    title="长按 3 秒退出"
                >
                    <LockClosedIcon className="w-6 h-6" />
                </button>
                {exitProgress > 0 && (
                     <div className="absolute bottom-4 left-4 w-12 h-12 pointer-events-none">
                        <svg className="w-full h-full -rotate-90">
                            <circle
                                cx="24" cy="24" r="20"
                                stroke="#8B2323" strokeWidth="4"
                                fill="none"
                                strokeDasharray="125.6"
                                strokeDashoffset={125.6 - (125.6 * exitProgress) / 100}
                                className="transition-all duration-75 ease-linear opacity-80"
                            />
                        </svg>
                     </div>
                )}
             </div>
        )}
      </div>

      {isCreatingHotspot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c1810]/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#d6d3d1] p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                <h3 className="text-2xl font-bold text-[#2c1810] mb-6 font-serif">添加汉字说明</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[#57534e] text-sm mb-2 font-bold">输入汉字 (单字)</label>
                        <input 
                            type="text" 
                            maxLength={1}
                            value={inputChar}
                            onChange={(e) => setInputChar(e.target.value)}
                            className="w-full text-4xl text-center bg-[#f5f5f4] border border-[#d6d3d1] rounded-lg p-4 text-[#2c1810] focus:ring-2 focus:ring-[#8B2323] outline-none placeholder-[#a8a29e] font-serif"
                            placeholder="天"
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="block text-[#57534e] text-sm mb-2 font-bold">输入解说</label>
                        <textarea 
                            value={inputExplanation}
                            onChange={(e) => setInputExplanation(e.target.value)}
                            className="w-full h-32 bg-[#f5f5f4] border border-[#d6d3d1] rounded-lg p-3 text-[#2c1810] focus:ring-2 focus:ring-[#8B2323] outline-none resize-none placeholder-[#a8a29e]"
                            placeholder="请输入关于该汉字的文化解读..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button 
                            onClick={() => setIsCreatingHotspot(false)}
                            className="flex-1 py-3 bg-[#e7e5e4] hover:bg-[#d6d3d1] text-[#2c1810] rounded-xl font-bold transition"
                        >
                            取消
                        </button>
                        <button 
                            onClick={confirmHotspotCreation}
                            disabled={!inputChar}
                            className={`flex-1 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2
                                ${!inputChar ? 'bg-[#f5f5f4] text-[#a8a29e] cursor-not-allowed' : 'bg-[#8B2323] hover:bg-[#6d1b1b] text-white shadow-lg'}
                            `}
                        >
                            创建
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeHotspot && mode === 'view' && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c1810]/70 backdrop-blur-md p-4 animate-in fade-in duration-300"
            onClick={() => setActiveHotspot(null)}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white/95 border border-[#d6d3d1] p-8 md:p-12 rounded-3xl shadow-2xl max-w-5xl w-full flex flex-col items-center"
            >
                <div className="flex flex-col md:flex-row gap-12 items-center w-full">
                    <div className="flex-shrink-0">
                        <HanziPlayer character={activeHotspot.character} size={300} />
                    </div>

                    <div className="flex-1 space-y-6 text-left w-full">
                        <div className="border-b-2 border-[#8B2323] pb-4">
                            <span className="text-[#8B2323] font-bold tracking-wider uppercase text-sm">汉字详情</span>
                            <h2 className="text-6xl font-bold text-[#2c1810] mt-2 font-serif">{activeHotspot.character}</h2>
                        </div>
                        
                        <div className="prose prose-lg max-h-[30vh] overflow-y-auto pr-4 custom-scrollbar">
                            <p className="text-[#44403c] leading-relaxed text-xl whitespace-pre-wrap font-serif">
                                {activeHotspot.explanation}
                            </p>
                        </div>

                        <div className="pt-4 flex gap-4">
                            <div className="h-2 w-24 bg-[#c49a6c] rounded-full"></div>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={() => setActiveHotspot(null)}
                    className="mt-10 px-16 py-4 bg-[#8B2323] hover:bg-[#6d1b1b] text-white text-lg font-bold tracking-widest uppercase shadow-lg active:scale-95 transition-all w-full md:w-auto rounded-full"
                >
                    关闭窗口
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;