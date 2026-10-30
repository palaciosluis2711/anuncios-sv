// Modal interactivo para recortar y encuadrar la foto de perfil antes de subirla
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Check, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

export const AvatarCropModal = ({
  isOpen,
  imageSrc,
  onClose,
  onApplyCrop,
  cropDisplaySize = 240,
  outputSize = 400
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const imageElementRef = useRef(null);
  const containerRef = useRef(null);

  // Cargar imagen y obtener dimensiones naturales al abrir o cambiar la imagen
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    // Resetear estados al abrir una nueva imagen
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      setNaturalSize({
        width: img.naturalWidth || 400,
        height: img.naturalHeight || 400
      });
    };
  }, [isOpen, imageSrc]);

  // Bloquear el scroll de la página de fondo mientras el modal esté abierto y gestionar tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Escala base para que la dimensión menor de la imagen siempre cubra el área circular
  const minSide = Math.min(naturalSize.width || 1, naturalSize.height || 1);
  const baseScale = minSide > 0 ? cropDisplaySize / minSide : 1;

  // Limitar desplazamiento para que la imagen nunca deje vacíos dentro del círculo de recorte
  const getClampedOffset = useCallback(
    (x, y, currentZoom, currentRotation) => {
      if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 };

      const isRotatedSwapped = currentRotation === 90 || currentRotation === 270;
      const visualWidth =
        (isRotatedSwapped ? naturalSize.height : naturalSize.width) *
        baseScale *
        currentZoom;
      const visualHeight =
        (isRotatedSwapped ? naturalSize.width : naturalSize.height) *
        baseScale *
        currentZoom;

      const maxOffsetX = Math.max(0, (visualWidth - cropDisplaySize) / 2);
      const maxOffsetY = Math.max(0, (visualHeight - cropDisplaySize) / 2);

      return {
        x: Math.min(Math.max(x, -maxOffsetX), maxOffsetX),
        y: Math.min(Math.max(y, -maxOffsetY), maxOffsetY)
      };
    },
    [naturalSize, baseScale, cropDisplaySize]
  );

  // Manejo de arrastre (compatible con mouse y táctil en móviles)
  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;
    setOffset(getClampedOffset(rawX, rawY, zoom, rotation));
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    if (containerRef.current) {
      try {
        containerRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignorar si el puntero ya fue liberado
      }
    }
  };

  // Cambio de nivel de zoom con slider
  const handleZoomChange = (newZoom) => {
    setZoom(newZoom);
    setOffset((prev) => getClampedOffset(prev.x, prev.y, newZoom, rotation));
  };

  // Girar la imagen 90 grados en sentido horario
  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setOffset((prev) => getClampedOffset(prev.x, prev.y, zoom, nextRot));
  };

  // Procesar y recortar la imagen en un Canvas offscreen de alta resolución
  const handleConfirm = () => {
    if (!imageElementRef.current || !naturalSize.width) return;

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const ratio = outputSize / cropDisplaySize;

    ctx.save();
    // Centrar en el canvas y desplazar según el offset visual
    ctx.translate(
      outputSize / 2 + offset.x * ratio,
      outputSize / 2 + offset.y * ratio
    );

    // Aplicar rotación
    ctx.rotate((rotation * Math.PI) / 180);

    // Dimensiones proporcionales a dibujar
    const renderWidth = naturalSize.width * baseScale * zoom * ratio;
    const renderHeight = naturalSize.height * baseScale * zoom * ratio;

    ctx.drawImage(
      imageElementRef.current,
      -renderWidth / 2,
      -renderHeight / 2,
      renderWidth,
      renderHeight
    );

    ctx.restore();

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onApplyCrop(croppedDataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] h-[100dvh] max-h-[100dvh] w-full bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-none select-none animate-backdrop-enter"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-2xl animate-scale-up overflow-hidden"
      >
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">Encuadrar Foto de Perfil</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar recorte"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visor interactivo de recorte */}
        <div className="flex flex-col items-center justify-center">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: `${cropDisplaySize}px`, height: `${cropDisplaySize}px` }}
            className="rounded-2xl overflow-hidden relative select-none touch-none bg-slate-950 cursor-grab active:cursor-grabbing border border-slate-800 flex items-center justify-center shadow-inner"
          >
            {/* Imagen renderizada con transformación matemática */}
            {imageSrc && (
              <img
                ref={imageElementRef}
                src={imageSrc}
                alt="Para recortar"
                draggable={false}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${baseScale * zoom})`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.08s ease-out",
                  maxWidth: "none",
                  maxHeight: "none",
                  userSelect: "none",
                  pointerEvents: "none"
                }}
              />
            )}

            {/* Máscara circular de encuadre con borde índigo y sombra exterior */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                style={{ width: `${cropDisplaySize}px`, height: `${cropDisplaySize}px` }}
                className="rounded-full border-2 border-indigo-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.78)]"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Arrastra para encuadrar tu foto
          </p>
        </div>

        {/* Controles de Zoom y Rotación */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            aria-label="Nivel de zoom"
          />
          <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex-shrink-0"
            title="Girar 90°"
            aria-label="Girar 90 grados"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-[0.99]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Recorte</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AvatarCropModal;

