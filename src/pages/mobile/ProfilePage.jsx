// Perfil del usuario y centro de control de sus publicaciones
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  User,
  Shield,
  Package,
  Heart,
  Settings,
  LogOut,
  Sparkles,
  ExternalLink,
  Edit,
  Trash2,
  CheckCircle2,
  LogIn,
  PlusCircle
} from "lucide-react";
import { getStoredProducts, getUserProducts } from "../../services/productsService";

export const ProfilePage = () => {
  const { currentUser, isAdmin, logout, switchDemoRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("posts");
  const [allProducts, setAllProducts] = useState(() => getStoredProducts());

  // Sincronizar en tiempo real cuando se publica un nuevo producto
  useEffect(() => {
    const handleUpdate = () => {
      setAllProducts(getStoredProducts());
    };
    window.addEventListener("anunciossv_products_updated", handleUpdate);
    return () => window.removeEventListener("anunciossv_products_updated", handleUpdate);
  }, []);

  if (!currentUser) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-lg">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Modo Invitado</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Actualmente estás navegando sin iniciar sesión. Accede con tu cuenta para gestionar tus publicaciones, favoritos y configuración.
        </p>
        <div className="pt-2">
          <button
            onClick={() => navigate("/login")}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4" />
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  // Filtrar productos reales del usuario actual desde productsService
  const userProducts = getUserProducts(currentUser);

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Tarjeta de cabecera de perfil */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-lg"
          />
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-extrabold text-white truncate">{currentUser.name}</h2>
              <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
            </div>
            <div className="text-xs text-slate-400 truncate">{currentUser.email}</div>

            <div className="mt-1 flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isAdmin
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/40"
              }`}>
                {isAdmin ? "👑 Webmaster Admin" : "👤 Usuario Estándar"}
              </span>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="text-[10px] font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-0.5 underline"
                >
                  Abrir panel →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Resumen de actividad / KPIs del usuario */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
          <div>
            <div className="text-sm font-bold text-white">{userProducts.length}</div>
            <div className="text-[10px] text-slate-400">Publicaciones</div>
          </div>
          <div>
            <div className="text-sm font-bold text-white">4.9 ★</div>
            <div className="text-[10px] text-slate-400">Reputación</div>
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              {userProducts.reduce((acc, p) => acc + (p.likesCount || 0), 0) + 12}
            </div>
            <div className="text-[10px] text-slate-400">Me Gusta</div>
          </div>
        </div>
      </div>

      {/* Pestañas de contenido (altura táctil optimizada min-h-[42px]) */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${
            activeTab === "posts"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Mis Anuncios ({userProducts.length})
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${
            activeTab === "saved"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Favoritos
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${
            activeTab === "settings"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Cuenta
        </button>
      </div>

      {/* Contenido de la pestaña Mis Anuncios */}
      {activeTab === "posts" && (
        <div className="space-y-2.5 animate-fade-in">
          {userProducts.length > 0 ? (
            userProducts.map((prod) => (
              <div
                key={prod.id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-all"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0">
                  <img
                    src={prod.image}
                    alt={prod.title}
                    className="w-full h-full object-cover"
                  />
                  {prod.featured && (
                    <span className="absolute top-1 right-1 p-0.5 rounded bg-amber-500 text-slate-950">
                      <Sparkles className="w-2.5 h-2.5 fill-current" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-white truncate">{prod.title}</h4>
                    {prod.featured && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        DESTACADO
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-indigo-400 mt-0.5">
                    {prod.isFree ? "GRATIS" : `$${Number(prod.price).toFixed(2)} ${prod.currency || "USD"}`}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                      Activo
                    </span>
                    <span className="text-[10px] text-slate-500">{prod.viewsCount || 0} visitas</span>
                    {prod.condition && (
                      <span className="text-[10px] text-slate-400">· {prod.condition}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Link
                    to={`/product/${prod.id}`}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Ver en detalle"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Aún no tienes publicaciones</h4>
                <p className="mt-1 text-slate-400">Publica tu primer producto o servicio gratis en AnunciosSV.</p>
              </div>
              <Link
                to="/publish"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Crear Publicación</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Contenido de Favoritos */}
      {activeTab === "saved" && (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800 animate-fade-in">
          <Heart className="w-8 h-8 mx-auto text-rose-400 mb-2 fill-rose-500/20" />
          <h4 className="font-bold text-white text-sm mb-1">Tus Anuncios Guardados</h4>
          <p>Los clasificados que marques con "Me gusta" aparecerán organizados aquí para acceso rápido.</p>
        </div>
      )}

      {/* Contenido de Configuración y Cierre de Sesión */}
      {activeTab === "settings" && (
        <div className="space-y-3 animate-fade-in">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="text-xs font-bold text-slate-300">Datos de la Cuenta</div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Usuario</span>
              <span className="text-slate-200 font-semibold">{currentUser.username ? `@${currentUser.username}` : currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Correo</span>
              <span className="text-slate-200 font-semibold truncate max-w-[200px]">{currentUser.email || "No especificado"}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-400">Rol asignado</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAdmin ? "text-purple-300 bg-purple-950/60 border border-purple-800" : "text-blue-300 bg-blue-950/60 border border-blue-800"}`}>
                {isAdmin ? "Webmaster (Admin)" : "Usuario Estándar"}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-bold transition-colors active:scale-[0.99]"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
