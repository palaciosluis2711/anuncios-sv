// Módulo de Gestión de Publicidad, Banners y Monetización
import React, { useState } from "react";
import {
  Megaphone,
  PlusCircle,
  Eye,
  MousePointerClick,
  TrendingUp,
  ExternalLink,
  CheckCircle,
  PauseCircle,
  DollarSign
} from "lucide-react";
import { MOCK_ADS } from "../../services/mockData";

export const AdminAds = () => {
  const [ads, setAds] = useState(MOCK_ADS);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newAd, setNewAd] = useState({
    title: "",
    advertiser: "",
    placement: "feed_banner",
    link: "https://example.com"
  });

  const handleToggleStatus = (id) => {
    setAds((prev) =>
      prev.map((ad) =>
        ad.id === id
          ? { ...ad, status: ad.status === "activo" ? "pausado" : "activo" }
          : ad
      )
    );
  };

  const handleCreateAd = (e) => {
    e.preventDefault();
    const created = {
      id: "ad-" + Date.now(),
      title: newAd.title,
      advertiser: newAd.advertiser,
      image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
      link: newAd.link,
      impressions: 0,
      clicks: 0,
      status: "activo",
      placement: newAd.placement
    };
    setAds([created, ...ads]);
    setShowNewModal(false);
    setNewAd({ title: "", advertiser: "", placement: "feed_banner", link: "https://example.com" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-purple-400" />
            Gestión de Publicidad y Banners
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Monetiza el feed móvil de clasificados insertando campañas patrocinadas y midiendo su CTR.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nueva Campaña</span>
        </button>
      </div>

      {/* Grid de campañas publicitarias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ads.map((ad) => {
          const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";

          return (
            <div
              key={ad.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                    Ubicación: {ad.placement === "feed_banner" ? "Banner en Feed Móvil" : "Sidebar Admin"}
                  </span>

                  <button
                    onClick={() => handleToggleStatus(ad.id)}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                      ad.status === "activo"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {ad.status === "activo" ? "● Activo" : "○ Pausado"}
                  </button>
                </div>

                <h3 className="text-sm font-bold text-white mb-1">{ad.title}</h3>
                <div className="text-xs text-slate-400 mb-4">Anunciante: <span className="text-slate-200 font-semibold">{ad.advertiser}</span></div>

                {/* Métricas del anuncio */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
                  <div>
                    <div className="text-xs font-extrabold text-white">{ad.impressions.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5 mt-0.5">
                      <Eye className="w-3 h-3 text-slate-500" /> Vistas
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white">{ad.clicks.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5 mt-0.5">
                      <MousePointerClick className="w-3 h-3 text-slate-500" /> Clics
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-emerald-400">{ctr}%</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-emerald-500" /> CTR
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
                <a
                  href={ad.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
                >
                  <span>Enlace destino</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={() => handleToggleStatus(ad.id)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  {ad.status === "activo" ? "Pausar campaña" : "Reanudar campaña"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal para crear nueva campaña */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Crear Campaña Publicitaria</h3>
            <p className="text-xs text-slate-400 mb-4">Inserta anuncios patrocinados en el feed móvil</p>

            <form onSubmit={handleCreateAd} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título de la campaña</label>
                <input
                  type="text"
                  required
                  value={newAd.title}
                  onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                  placeholder="Ej: Descuento 30% en Telefonía"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Anunciante</label>
                <input
                  type="text"
                  required
                  value={newAd.advertiser}
                  onChange={(e) => setNewAd({ ...newAd, advertiser: e.target.value })}
                  placeholder="Ej: Banco o Marca Global"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Enlace de Destino (URL)</label>
                <input
                  type="url"
                  required
                  value={newAd.link}
                  onChange={(e) => setNewAd({ ...newAd, link: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30"
                >
                  Guardar y Activar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAds;
