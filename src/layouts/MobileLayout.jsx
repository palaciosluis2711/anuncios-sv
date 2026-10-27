// Layout principal Mobile-First para la aplicación de clasificados y red social
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import MobileHeader from "../components/mobile/MobileHeader";
import BottomNav from "../components/mobile/BottomNav";
import RoleSwitcherBanner from "../components/common/RoleSwitcherBanner";
import { Smartphone, Monitor } from "lucide-react";

export const MobileLayout = () => {
  // Permite simular vista móvil enmarcada o expandida en pantallas desktop
  const [isDeviceFrame, setIsDeviceFrame] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start relative">
      {/* Botón flotante superior para desarrollador: alternar simulación de marco móvil en desktop */}
      <div className="hidden lg:flex fixed top-3 left-4 z-50 items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 text-xs text-slate-400">
        <span className="font-medium text-slate-300">Vista previa:</span>
        <button
          onClick={() => setIsDeviceFrame(true)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all ${
            isDeviceFrame ? "bg-indigo-600 text-white font-semibold" : "hover:text-slate-200"
          }`}
          title="Vista móvil enmarcada"
        >
          <Smartphone className="w-3.5 h-3.5" />
          Móvil
        </button>
        <button
          onClick={() => setIsDeviceFrame(false)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all ${
            !isDeviceFrame ? "bg-indigo-600 text-white font-semibold" : "hover:text-slate-200"
          }`}
          title="Vista completa"
        >
          <Monitor className="w-3.5 h-3.5" />
          Amplia
        </button>
      </div>

      {/* Contenedor principal de la aplicación */}
      <div
        className={`w-full transition-all duration-300 min-h-screen flex flex-col relative ${
          isDeviceFrame
            ? "max-w-md mx-auto bg-slate-950 sm:border-x sm:border-slate-800 sm:shadow-2xl sm:my-0"
            : "max-w-4xl mx-auto bg-slate-950"
        }`}
      >
        {/* Cabecera superior fija */}
        <MobileHeader />

        {/* Contenido dinámico de las páginas */}
        <main className="flex-1 pb-24 animate-fade-in">
          <Outlet />
        </main>

        {/* Barra de navegación inferior fija */}
        <BottomNav />
      </div>

      {/* Selector flotante de roles para pruebas de acceso */}
      <RoleSwitcherBanner />
    </div>
  );
};

export default MobileLayout;
