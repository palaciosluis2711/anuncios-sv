// Modal de Carrete de Fotos optimizado para móviles (Transición suave 1-a-1, Swipe táctil y puntero, Portal z-[9999], Fullscreen)
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Trash2,
  RefreshCw,
  X,
  Plus
} from "lucide-react";

export const PhotoCarouselModal = ({
  isOpen,
  onClose,
  photos = [],
  activeIndex = 0,
  onSelectIndex,
  onSetPrimary,
  onTriggerReplace,
  onDelete,
  onTriggerAdd
}) => {
  // Estados para el arrastre y deslizamiento táctil suave
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Referencias para el control de gestos fluido
  const isPointerDownRef = useRef(false);
  const pointerIdRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const directionLockedRef = useRef(null);
  const thumbnailContainerRef = useRef(null);

  // Auto centrar miniatura activa en la barra inferior
  useEffect(() => {
    if (thumbnailContainerRef.current) {
      const activeEl = thumbnailContainerRef.current.children[activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    }
  }, [activeIndex]);

  // Bloquear el scroll de la página de fondo mientras el modal esté abierto y gestionar teclado
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, photos.length, activeIndex]);

  if (!isOpen || photos.length === 0) return null;

  // Navegación suave con límites (evita saltos bruscos de extremo a extremo)
  const handlePrev = () => {
    if (activeIndex > 0) {
      onSelectIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < photos.length - 1) {
      onSelectIndex(activeIndex + 1);
    }
  };

  // 1. Inicio de toque o clic (Puntero unificado para táctil y ratón)
  const handlePointerDown = (e) => {
    if (photos.length <= 1) return;
    if (e.button !== undefined && e.button !== 0) return; // Solo botón principal

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch (_) {}

    pointerIdRef.current = e.pointerId;
    isPointerDownRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    currentOffsetRef.current = 0;
    directionLockedRef.current = null;
    setIsDragging(true);
    setDragOffset(0);
  };

  // 2. Movimiento táctil con seguimiento suave 1-a-1 y resistencia elástica en bordes
  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current) return;
    const diffX = e.clientX - startXRef.current;
    const diffY = e.clientY - startYRef.current;

    // Detectar si el usuario desliza horizontalmente o verticalmente
    if (directionLockedRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        const isHoriz = Math.abs(diffX) > Math.abs(diffY);
        directionLockedRef.current = isHoriz;
        if (!isHoriz) {
          // Si es scroll vertical, cancelar arrastre horizontal
          isPointerDownRef.current = false;
          setIsDragging(false);
          setDragOffset(0);
          currentOffsetRef.current = 0;
          return;
        }
      }
    }

    if (directionLockedRef.current === true) {
      // Amortiguación elástica en los extremos
      let offset = diffX;
      if (
        (activeIndex === 0 && diffX > 0) ||
        (activeIndex === photos.length - 1 && diffX < 0)
      ) {
        offset = diffX * 0.28;
      }
      currentOffsetRef.current = offset;
      setDragOffset(offset);
    }
  };

  // 3. Fin de gesto: transición fluida hacia la foto objetivo o rebote suave
  const handlePointerUp = (e) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    if (pointerIdRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture?.(pointerIdRef.current);
      } catch (_) {}
      pointerIdRef.current = null;
    }

    const diffX = currentOffsetRef.current;
    const elapsed = Date.now() - startTimeRef.current;
    const isFlick = elapsed < 320 && Math.abs(diffX) > 28;
    const isPastThreshold = Math.abs(diffX) > 55;

    if (isFlick || isPastThreshold) {
      if (diffX < 0 && activeIndex < photos.length - 1) {
        onSelectIndex(activeIndex + 1);
      } else if (diffX > 0 && activeIndex > 0) {
        onSelectIndex(activeIndex - 1);
      }
    }

    currentOffsetRef.current = 0;
    setDragOffset(0);
    directionLockedRef.current = null;
  };

  const isPrimary = activeIndex === 0;
  const remainingSlots = 5 - photos.length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] h-[100dvh] w-full bg-slate-950/98 backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200">
      {/* 1. Cabecera fija superior */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-slate-800/80 bg-slate-950/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white tracking-tight">Carrete de Fotos</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
            {activeIndex + 1} de {photos.length}
          </span>
          {remainingSlots > 0 ? (
            <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
              Quedan {remainingSlots}
            </span>
          ) : (
            <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
              Límite alcanzado
            </span>
          )}
          {isPrimary && (
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
              <Star className="w-3 h-3 fill-amber-400" />
              Principal
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[38px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow"
        >
          <X className="w-4 h-4" />
          <span>Listo</span>
        </button>
      </div>

      {/* 2. Pista deslizante con transición suave 1-a-1 (Hardware GPU acelerado con translate3d y curva cúbica suave) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden touch-pan-y cursor-grab active:cursor-grabbing select-none"
      >
        {/* Contenedor tipo cinta continua con animación suave */}
        <div
          className="flex h-full w-full items-center select-none"
          style={{
            transform: `translate3d(calc(-${activeIndex * 100}% + ${dragOffset}px), 0, 0)`,
            transition: isDragging
              ? "none"
              : "transform 360ms cubic-bezier(0.16, 1, 0.3, 1)",
            willChange: "transform"
          }}
        >
          {photos.map((photoUrl, idx) => (
            <div
              key={idx}
              className="w-full h-full flex-shrink-0 flex items-center justify-center px-4 py-2 select-none"
            >
              <img
                src={photoUrl}
                alt={`Foto ${idx + 1}`}
                draggable={false}
                className="max-h-[46dvh] sm:max-h-[56dvh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800/80 pointer-events-none select-none transition-transform duration-300"
              />
            </div>
          ))}
        </div>

        {/* Botones de navegación táctiles laterales con transición suave */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              disabled={activeIndex === 0}
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/85 hover:bg-indigo-600 active:scale-90 text-white flex items-center justify-center border border-slate-700/80 shadow-2xl transition-all z-20 ${
                activeIndex === 0
                  ? "opacity-25 pointer-events-none cursor-not-allowed"
                  : "opacity-100 hover:scale-105"
              }`}
              title="Foto anterior"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={activeIndex === photos.length - 1}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/85 hover:bg-indigo-600 active:scale-90 text-white flex items-center justify-center border border-slate-700/80 shadow-2xl transition-all z-20 ${
                activeIndex === photos.length - 1
                  ? "opacity-25 pointer-events-none cursor-not-allowed"
                  : "opacity-100 hover:scale-105"
              }`}
              title="Siguiente foto"
              aria-label="Siguiente foto"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* 3. Panel inferior de acciones y carrete de miniaturas */}
      <div className="px-4 pb-4 pt-2.5 border-t border-slate-800/80 bg-slate-950/90 space-y-2.5">
        {/* Botones de acción directos (altura táctil estándar min-h-[44px]) */}
        <div className="flex items-center gap-2">
          {!isPrimary ? (
            <button
              type="button"
              onClick={() => onSetPrimary(activeIndex)}
              className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Star className="w-3.5 h-3.5 fill-white" />
              <span>Definir como Imagen principal</span>
            </button>
          ) : (
            <div className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1.5 pointer-events-none">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Imagen principal</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onTriggerReplace(activeIndex)}
            className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-700/60"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Cambiar</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(activeIndex)}
            className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-rose-500/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar</span>
          </button>
        </div>

        {/* Carrete horizontal de miniaturas táctiles */}
        <div
          ref={thumbnailContainerRef}
          className="flex items-center justify-center gap-2 overflow-x-auto py-1 no-scrollbar"
        >
          {photos.map((photoUrl, idx) => {
            const isActive = idx === activeIndex;
            const isItemPrimary = idx === 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all border ${
                  isActive
                    ? "ring-2 ring-indigo-500 border-indigo-400 scale-105 shadow-md shadow-indigo-500/20"
                    : "border-slate-800 opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={photoUrl}
                  alt={`Miniatura ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {isItemPrimary && (
                  <span className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow border border-slate-950" />
                )}
              </button>
            );
          })}

          {/* Botón para añadir foto individual (1 a la vez con conteo de cupos restantes) */}
          {remainingSlots > 0 && (
            <button
              type="button"
              onClick={onTriggerAdd}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 border-dashed border-indigo-500/60 hover:border-indigo-400 active:scale-95 text-indigo-400 hover:text-white flex flex-col items-center justify-center flex-shrink-0 transition-all bg-indigo-500/10 hover:bg-indigo-500/20"
              title={`Añadir foto (Quedan ${remainingSlots} de 5)`}
            >
              <Plus className="w-4 h-4" />
              <span className="text-[9px] font-bold">+{remainingSlots}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PhotoCarouselModal;

