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
              zIndex: 99999
            }}
            className="rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div
              style={{ maxHeight: `${coords.maxHeight}px` }}
              className="p-1.5 overflow-y-auto no-scrollbar space-y-1"
            >
              {normalizedOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={String(opt.value)}
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
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomSelect;
