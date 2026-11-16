import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';

interface ProtectedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
  blurred?: boolean;
  onError?: () => void;
  fallback?: React.ReactNode;
}

const blockEvent = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export const ProtectedImage: React.FC<ProtectedImageProps> = ({
  src,
  alt,
  className = 'h-full w-full object-cover',
  containerClassName = 'relative h-full w-full overflow-hidden select-none',
  blurred = false,
  onError,
  fallback,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);

    if (!src) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const drawToCanvas = async () => {
      try {
        const resp = await fetch(src, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        if (cancelled) return;

        let bitmap: ImageBitmap | null = null;
        let fallbackImg: HTMLImageElement | null = null;
        let tempObjUrl: string | null = null;

        try {
          if (typeof createImageBitmap === 'function') {
            bitmap = await createImageBitmap(blob);
          }
        } catch {
          bitmap = null;
        }

        if (!bitmap) {
          tempObjUrl = URL.createObjectURL(blob);
          fallbackImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = tempObjUrl!;
          });
        }

        try {
          if (cancelled) return;
          const canvas = canvasRef.current;
          if (!canvas) return;

          const width = bitmap ? bitmap.width : fallbackImg!.naturalWidth;
          const height = bitmap ? bitmap.height : fallbackImg!.naturalHeight;
          if (!width || !height) {
            throw new Error('Dimensões inválidas');
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D indisponível');
          }

          ctx.clearRect(0, 0, width, height);
          if (blurred) {
            ctx.filter = 'blur(22px) brightness(0.72)';
            const pad = Math.round(Math.max(width, height) * 0.04);
            if (bitmap) {
              ctx.drawImage(bitmap, -pad, -pad, width + pad * 2, height + pad * 2);
            } else if (fallbackImg) {
              ctx.drawImage(fallbackImg, -pad, -pad, width + pad * 2, height + pad * 2);
            }
          } else {
            ctx.filter = 'none';
            if (bitmap) {
              ctx.drawImage(bitmap, 0, 0, width, height);
            } else if (fallbackImg) {
              ctx.drawImage(fallbackImg, 0, 0, width, height);
            }
          }

          setLoaded(true);
        } finally {
          if (bitmap) bitmap.close();
          if (tempObjUrl) URL.revokeObjectURL(tempObjUrl);
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setFailed(true);
        onError?.();
      }
    };

    drawToCanvas();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [src, blurred, onError]);

  if (failed || !src) {
    return (
      <div
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
        className={`${containerClassName} media-shield`}
      >
        {fallback ?? (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-600">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onContextMenu={blockEvent}
      onDragStart={blockEvent}
      onCopy={blockEvent}
      className={`${containerClassName} media-shield`}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        draggable={false}
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
        className={`${className} media-shield pointer-events-none transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Invisible protective shield prevents Inspect URL / Save Image As / drag-drop */}
      <div
        aria-hidden="true"
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
        onCopy={blockEvent}
        className="absolute inset-0 z-10 media-shield"
      />
    </div>
  );
};

interface ProtectedVideoProps {
  src: string | null | undefined;
  title?: string;
  className?: string;
  containerClassName?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string | null;
}

function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ProtectedVideo: React.FC<ProtectedVideoProps> = ({
  src,
  title,
  className = 'h-full w-full object-contain bg-black',
  containerClassName = 'relative w-full h-full overflow-hidden bg-black select-none',
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(autoPlay);
    setCurrentTime(0);
    setDuration(0);
  }, [src, autoPlay]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setPlaying(true);
    } else {
      vid.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    if (!vid) return;
    const next = Number(e.target.value);
    vid.currentTime = next;
    setCurrentTime(next);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  if (!src) return null;

  return (
    <div
      ref={containerRef}
      onContextMenu={blockEvent}
      onDragStart={blockEvent}
      onCopy={blockEvent}
      className={`${containerClassName} media-shield group`}
    >
      <video
        ref={videoRef}
        src={src}
        title={title}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata"
        draggable={false}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
            setDuration(videoRef.current.duration);
          }
        }}
        className={`${className} media-shield pointer-events-none`}
      />

      {/* Full protective click/context shield prevents right-click Save/Copy Video URL */}
      <div
        onClick={controls ? togglePlay : undefined}
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
        onCopy={blockEvent}
        className={`absolute inset-0 z-10 media-shield ${controls ? 'cursor-pointer' : ''}`}
      />

      {/* Custom Download-Free Controls Bar */}
      {controls && (
        <div
          onClick={(e) => e.stopPropagation()}
          onContextMenu={blockEvent}
          className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-4 pt-6 pb-3"
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            aria-label="Progresso do vídeo"
            className="w-full h-1.5 accent-[#D4AF37] cursor-pointer"
          />
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pausar' : 'Reproduzir'}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900/80 border border-zinc-700 hover:border-[#D4AF37] text-zinc-100 cursor-pointer"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900/80 border border-zinc-700 hover:border-[#D4AF37] text-zinc-100 cursor-pointer"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <span className="font-mono text-[11px] text-zinc-300 tabular-nums">
                {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
                Stream Protegido
              </span>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Tela cheia"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900/80 border border-zinc-700 hover:border-[#D4AF37] text-zinc-100 cursor-pointer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
