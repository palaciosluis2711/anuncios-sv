// Componente CustomSelect: Combobox estilizado con esquinas redondeadas estilo iOS / iPhone
// Utiliza ReactDOM.createPortal en document.body con zIndex: 99999 para garantizar
// que el menú desplegado SIEMPRE quede por encima del header, footer u otros contenedores.
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  disabled = false,
  className = "",
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({
    top: undefined,
    bottom: undefined,
    left: 0,
    width: 0,
    maxHeight: 260,
    openUp: false
  });

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);
  const selectedItemRef = useRef(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isDraggingAtBottomRef = useRef(false);
  const wheelTimeoutRef = useRef(null);
  const [bounceOffset, setBounceOffset] = useState(0);
  const [showBounceIndicator, setShowBounceIndicator] = useState(false);

  // Normalizar opciones: soporta tanto arreglos de strings como arreglos de objetos { id, name } o { value, label }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "string") {
      return { id: opt, label: opt, value: opt };
    }
    return {
      id: opt.id ?? opt.value,
      label: opt.name ?? opt.label ?? String(opt.id ?? opt.value),
      value: opt.id ?? opt.value
    };
  });

  // Opción actualmente seleccionada
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Calcular la posición exacta en el viewport
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Espacio disponible arriba y abajo del botón en el viewport
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Si hay menos de 220px abajo y más espacio arriba, abrir hacia arriba
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(260, Math.max(130, openUp ? spaceAbove - 24 : spaceBelow - 24));

    // Ajustar horizontalmente para no desbordar el viewport
    let left = rect.left;
    let width = rect.width;
    if (left + width > viewportWidth - 8) {
      width = Math.min(width, viewportWidth - 16);
      left = Math.max(8, viewportWidth - width - 8);
    }

    setCoords({
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? viewportHeight - rect.top + 6 : undefined,
      left: Math.max(8, left),
      width,
      maxHeight,
      openUp
    });
  }, []);

  // Actualizar coordenadas y eventos al abrir
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleClickOutside = (event) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    // Escuchar scroll en captura para sincronizar con cualquier contenedor desplazable
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  // Al abrir el combobox, posicionar el elemento seleccionado como el primer elemento a la vista
  useEffect(() => {
    if (!isOpen) return;

    // Ejecutar tras el render del portal para sincronizar el scroll al elemento previamente seleccionado
    const timer = setTimeout(() => {
      if (selectedItemRef.current && listRef.current) {
        listRef.current.scrollTop = selectedItemRef.current.offsetTop;
      }
    }, 15);

    return () => clearTimeout(timer);
  }, [isOpen, value]);

  // Control de scroll y rebote táctil en el límite inferior del combobox
  useEffect(() => {
    if (!isOpen) return;

    const listEl = listRef.current;
    if (!listEl) return;

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartYRef.current = e.touches[0].clientY;
        touchStartXRef.current = e.touches[0].clientX;
        isDraggingAtBottomRef.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartYRef.current;
      const deltaX = currentX - touchStartXRef.current;

      // Procesar exclusivamente desplazamientos predominantemente verticales
      if (Math.abs(deltaY) < Math.abs(deltaX) * 0.7) return;

      const isAtBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 3;
      const isAtTop = listEl.scrollTop <= 0;

      // 1. Bloquear arrastre hacia abajo en el tope para no desplazar la página
      if (isAtTop && deltaY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }

      // 2. Al llegar al último ítem y continuar deslizando hacia arriba (deltaY < 0):
      // Bloquear estrictamente el scroll de la página y activar el indicador de rebote amarillo
      if (isAtBottom && deltaY < 0) {
        if (e.cancelable) {
          e.preventDefault();
        }

        const pullDistance = Math.abs(deltaY);
        // Resistencia elástica sutil y discreta (máx 10px)
        const elasticDistance = Math.min(Math.pow(pullDistance, 0.6) * 1.0, 10);
        setBounceOffset(elasticDistance);
        setShowBounceIndicator(true);

        // Feedback háptico sutil al topar con el fondo
        if (!isDraggingAtBottomRef.current && typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch {}
        }
        isDraggingAtBottomRef.current = true;
      } else if (isAtBottom && deltaY >= 0) {
        setBounceOffset(0);
        setShowBounceIndicator(false);
        isDraggingAtBottomRef.current = false;
      }
    };

    const handleTouchEnd = () => {
      isDraggingAtBottomRef.current = false;
      // Retorno elástico suave
      setBounceOffset(0);
      setTimeout(() => {
        setShowBounceIndicator(false);
      }, 250);
    };

    const handleWheel = (e) => {
      const isAtBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 3;
      const isAtTop = listEl.scrollTop <= 0;

      if (isAtBottom && e.deltaY > 0) {
        if (e.cancelable) e.preventDefault();
        setBounceOffset(6);
        setShowBounceIndicator(true);
        clearTimeout(wheelTimeoutRef.current);
        wheelTimeoutRef.current = setTimeout(() => {
          setBounceOffset(0);
          setShowBounceIndicator(false);
        }, 280);
      } else if (isAtTop && e.deltaY < 0) {
        if (e.cancelable) e.preventDefault();
      }
    };

    listEl.addEventListener("touchstart", handleTouchStart, { passive: true });
    listEl.addEventListener("touchmove", handleTouchMove, { passive: false });
    listEl.addEventListener("touchend", handleTouchEnd, { passive: true });
    listEl.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    listEl.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      listEl.removeEventListener("touchstart", handleTouchStart);
      listEl.removeEventListener("touchmove", handleTouchMove);
      listEl.removeEventListener("touchend", handleTouchEnd);
      listEl.removeEventListener("touchcancel", handleTouchEnd);
      listEl.removeEventListener("wheel", handleWheel);
      clearTimeout(wheelTimeoutRef.current);
    };
  }, [isOpen]);

  const handleSelect = (optValue) => {
    onChange?.(optValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Botón disparador del combobox (altura estándar táctil min-h-[48px]) */}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[48px] px-4 py-3 rounded-xl bg-slate-900 border text-sm text-left flex items-center justify-between transition-all select-none ${
          disabled
            ? "opacity-50 cursor-not-allowed border-slate-800 text-slate-500"
            : isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 text-white shadow-lg shadow-indigo-500/10"
            : "border-slate-800 hover:border-slate-700 text-white"
        }`}
      >
        <span className={`truncate font-medium ${selectedOption ? "text-white" : "text-slate-500"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-indigo-400" : "text-slate-400"
          }`}
        />
      </button>

      {/* Menú desplegable montado en document.body mediante React Portal (z-index 99999 para quedar siempre por encima de Header y Footer) */}
      {isOpen &&
        !disabled &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : "auto",
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : "auto",
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
              overscrollBehaviorY: "contain"
            }}
            className="rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none overscroll-contain"
          >
            <div
              ref={listRef}
              style={{
                maxHeight: `${coords.maxHeight}px`,
                overscrollBehaviorY: "contain"
              }}
              className="p-1.5 overflow-y-auto no-scrollbar overscroll-contain overscroll-y-contain relative"
            >
              {/* Contenedor elástico con animación de rebote hacia arriba */}
              <div
                style={{
                  transform: bounceOffset > 0 ? `translateY(-${bounceOffset}px)` : "translateY(0)",
                  transition:
                    bounceOffset > 0
                      ? "transform 0.05s ease-out"
                      : "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                }}
                className="space-y-1"
              >
                {normalizedOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={String(opt.value)}
                      ref={isSelected ? selectedItemRef : null}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm flex items-center justify-between text-left transition-all ${
                        isSelected
                          ? "bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30"
                          : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 ml-2 flex-shrink-0 text-indigo-400" />
                      )}
                    </button>
                  );
                })}

                {/* Indicador discreto de rebote de color amarillo al final del último ítem */}
                <div
                  style={{
                    opacity: showBounceIndicator ? 0.95 : 0,
                    transform: `scaleX(${showBounceIndicator ? 1 : 0.6})`,
                    maxHeight: showBounceIndicator ? "14px" : "0px",
                    transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                  }}
                  className="overflow-hidden flex items-center justify-center pt-1 pb-0.5 select-none pointer-events-none"
                >
                  <div className="w-10 h-1 rounded-full bg-amber-400/90 shadow-sm" />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomSelect;
