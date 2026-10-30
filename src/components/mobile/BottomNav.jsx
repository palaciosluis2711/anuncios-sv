// Barra de navegación inferior fija para la experiencia Mobile-First
import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, MessageCircle, PlusCircle, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getTotalUnreadCount, CHAT_EVENT } from "../../services/chatService";

export const BottomNav = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  // Contador reactivo de mensajes no leídos para la pestaña de Chats
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(() =>
    getTotalUnreadCount(currentUser)
  );

  useEffect(() => {
    setUnreadMessagesCount(getTotalUnreadCount(currentUser));

    const handleChatUpdate = () => {
      setUnreadMessagesCount(getTotalUnreadCount(currentUser));
    };

    window.addEventListener(CHAT_EVENT, handleChatUpdate);
    return () => window.removeEventListener(CHAT_EVENT, handleChatUpdate);
  }, [currentUser]);

  // En la vista de chat individual, pasarela Pagadito Sandbox o retorno de pago, se oculta el BottomNav
  if (
    location.pathname.startsWith("/messages/") ||
    location.pathname.startsWith("/pagadito-sandbox/") ||
    location.pathname.startsWith("/payment-return")
  ) {
    return null;
  }

  const navItems = [
    {
      to: "/",
      label: "Inicio",
      icon: Home,
      exact: true
    },
    {
      to: "/messages",
      label: "Chats",
      icon: MessageCircle,
      badge: unreadMessagesCount
    },
    {
      to: "/publish",
      label: "Publicar",
      icon: PlusCircle,
      isSpecial: true // Botón central con diseño destacado
    },
    {
      to: "/profile",
      label: "Perfil",
      icon: User,
      hasAvatar: Boolean(currentUser?.avatar)
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 shadow-mobile-bar pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;

          const handleTabClick = (e) => {
            // Rastrear si la navegación hacia Chats proviene del menú inferior (footer)
            if (typeof window !== "undefined") {
              // Si el usuario usa las pestañas inferiores, se descarta el retorno pendiente por toast
              sessionStorage.removeItem("anunciossv_toast_return_origin");

              if (item.to === "/messages") {
                sessionStorage.setItem("anunciossv_messages_from_footer", "true");
              } else {
                sessionStorage.removeItem("anunciossv_messages_from_footer");
              }
            }

            if (location.pathname === "/publish" && item.to !== "/publish") {
              const event = new CustomEvent("anunciossv_publish_leave_requested", {
                detail: { targetPath: item.to },
                cancelable: true
              });
              window.dispatchEvent(event);
              if (event.defaultPrevented) {
                e.preventDefault();
              }
            }
          };

          if (item.isSpecial) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleTabClick}
                className={({ isActive }) => `
                  relative -top-5 flex flex-col items-center group
                `}
              >
                {({ isActive }) => (
                  <>
                    <div className={`
                      w-13 h-13 p-3 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
                      ${isActive 
                        ? "bg-gradient-to-tr from-indigo-500 to-pink-500 shadow-indigo-500/50 scale-105" 
                        : "bg-gradient-to-tr from-indigo-600 to-purple-600 group-hover:scale-105 shadow-indigo-600/30"}
                      border-2 border-slate-900
                    `}>
                      <PlusCircle className="w-7 h-7 text-white stroke-[2.2]" />
                    </div>
                    <span className={`text-[10px] mt-0.5 font-bold tracking-tight transition-colors ${
                      isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                    }`}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              state={item.to === "/messages" ? { fromBottomNav: true } : undefined}
              end={item.exact}
              onClick={handleTabClick}
              className={({ isActive }) => `
                flex flex-col items-center justify-center w-16 py-1 transition-all duration-200 relative
                ${isActive ? "text-indigo-400 font-semibold" : "text-slate-400 hover:text-slate-200"}
              `}
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    {item.hasAvatar && currentUser?.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt="Perfil"
                        className={`w-6 h-6 rounded-full object-cover border transition-all ${
                          isActive ? "border-indigo-400 ring-2 ring-indigo-500/30" : "border-slate-700"
                        }`}
                      />
                    ) : (
                      <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
                    )}

                    {/* Badge numérico de mensajes no leídos para Chats */}
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 bg-pink-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-slate-900 shadow-sm animate-fade-in">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}

                    {/* Punto indicador de pestaña activa */}
                    {isActive && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_8px_#818cf8]" />
                    )}
                  </div>
                  <span className="text-[11px] mt-1.5 tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
