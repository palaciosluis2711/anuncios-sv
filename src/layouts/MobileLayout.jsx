// Layout principal Mobile-First para la aplicación de clasificados y red social
import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import MobileHeader from "../components/mobile/MobileHeader";
import BottomNav from "../components/mobile/BottomNav";
import InAppMessageToast from "../components/mobile/InAppMessageToast";
import RoleSwitcherBanner from "../components/common/RoleSwitcherBanner";
import { Smartphone, Monitor } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToUserConversations, startPresenceTracking } from "../services/chatService";
import { subscribeToUserNotifications } from "../services/notificationService";

export const MobileLayout = () => {
  const { currentUser } = useAuth();
  // Permite simular vista móvil enmarcada o expandida en pantallas desktop
  const [isDeviceFrame, setIsDeviceFrame] = useState(true);
  const location = useLocation();

  const isChatDetail = location.pathname.startsWith("/messages/");

  // Suscripción reactiva global en tiempo real a conversaciones, notificaciones y presencia
  useEffect(() => {
    if (!currentUser) return;
    const unsubChats = subscribeToUserConversations(currentUser, () => {});
    const unsubNotifs = subscribeToUserNotifications(currentUser, () => {});
    const stopPresence = startPresenceTracking(currentUser);

    return () => {
      unsubChats();
      unsubNotifs();
      stopPresence();
    };
  }, [currentUser]);

  return (
    <div
      className={`${
        isChatDetail ? "h-[100dvh] max-h-[100dvh] overflow-hidden" : "min-h-screen"
      } bg-slate-950 text-slate-100 flex flex-col items-center justify-start relative`}
    >
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
        className={`w-full transition-all duration-300 ${
          isChatDetail ? "h-[100dvh] max-h-[100dvh] overflow-hidden" : "min-h-screen"
        } flex flex-col relative ${
          isDeviceFrame
            ? "max-w-md mx-auto bg-slate-950 sm:border-x sm:border-slate-800 sm:shadow-2xl sm:my-0"
            : "max-w-4xl mx-auto bg-slate-950"
        }`}
      >
        {/* Cabecera superior fija */}
        <MobileHeader />

        {/* Notificación flotante superior in-app de mensajes entrantes */}
        <InAppMessageToast />

        {/* Contenido dinámico con transición suave entre todas las pantallas de la app */}
        <main
          key={location.pathname}
          className={`flex-1 ${
            isChatDetail
              ? "pb-0 h-full overflow-hidden flex flex-col"
              : "pb-24"
          } animate-page-enter`}
        >
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
