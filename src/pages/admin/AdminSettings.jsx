// Ajustes generales y centro de control técnico de Firebase para el Webmaster
import React, { useState } from "react";
import {
  Settings,
  Shield,
  Database,
  Save,
  CheckCircle2,
  Sliders,
  BellRing,
  Sparkles,
  Layers,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { isFirebaseConfigured } from "../../services/firebase";
import { seedFirestoreDatabase } from "../../services/seedFirestore";

export const AdminSettings = () => {
  const [settings, setSettings] = useState({
    autoApproveListings: false,
    requireEmailVerification: true,
    maxImageSizeMB: 5,
    currency: "USD",
    allowGuestBrowsing: true,
    notifyOnNewReport: true
  });

  const [saved, setSaved] = useState(false);

  // Estados del sembrado de Firestore
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState("");
  const [seedResult, setSeedResult] = useState(null);
  const [seedError, setSeedError] = useState(null);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSeedDatabase = async () => {
    if (!window.confirm("¿Deseas poblar la base de datos de Firestore con las colecciones y documentos iniciales?")) {
      return;
    }

    setSeeding(true);
    setSeedError(null);
    setSeedResult(null);

    try {
      const res = await seedFirestoreDatabase((msg) => setSeedProgress(msg));
      setSeedResult(res.stats);
    } catch (err) {
      if (err.code === "permission-denied" || err.message?.includes("permission-denied")) {
        setSeedError(
          "Permiso denegado por las reglas de Firestore. Ve a tu Consola de Firebase > Firestore Database > Reglas y cambia temporalmente a 'allow read, write: if true;' durante el desarrollo."
        );
      } else {
        setSeedError(`Error al sembrar Firestore: ${err.message}`);
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      {/* Encabezado */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-400" />
          Configuración de la Plataforma
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Ajustes de moderación, políticas de usuarios y gestión de colecciones en Firebase Firestore.
        </p>
      </div>

      {/* SECCIÓN DESTACADA: Sembrador Automático de Firestore */}
      <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-purple-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Inicializar y Sembrar Colecciones en Firestore</h3>
              <p className="text-xs text-slate-400">Genera las colecciones en tu proyecto de Firebase en la nube</p>
            </div>
          </div>

          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
            anunciossv-fe998
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Firestore crea las colecciones automáticamente cuando se escribe su primer documento. Al presionar el botón inferior, se crearán las colecciones <code className="text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded">products</code>, <code className="text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded">users</code>, <code className="text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded">categories</code> y <code className="text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded">ads</code> en tu base de datos en vivo.
        </p>

        {/* Notificación de Error */}
        {seedError && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">{seedError}</div>
          </div>
        )}

        {/* Notificación de Éxito */}
        {seedResult && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 space-y-2">
            <div className="font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ¡Colecciones creadas con éxito en Firestore!
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-200">
              <div className="bg-slate-950/50 p-2 rounded-lg">
                <div className="font-bold text-emerald-400">{seedResult.products}</div>
                <div className="text-[10px] text-slate-400">products</div>
              </div>
              <div className="bg-slate-950/50 p-2 rounded-lg">
                <div className="font-bold text-emerald-400">{seedResult.categories}</div>
                <div className="text-[10px] text-slate-400">categories</div>
              </div>
              <div className="bg-slate-950/50 p-2 rounded-lg">
                <div className="font-bold text-emerald-400">{seedResult.users}</div>
                <div className="text-[10px] text-slate-400">users</div>
              </div>
              <div className="bg-slate-950/50 p-2 rounded-lg">
                <div className="font-bold text-emerald-400">{seedResult.ads}</div>
                <div className="text-[10px] text-slate-400">ads</div>
              </div>
            </div>
          </div>
        )}

        {/* Botón de Acción de Sembrado */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleSeedDatabase}
            disabled={seeding}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? seedProgress || "Sembrando..." : "Sembrar Datos en Firestore Ahora"}</span>
          </button>

          <a
            href="https://console.firebase.google.com/project/anunciossv-fe998/firestore"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
          >
            <span>Ver Firestore en Consola</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Sección: Estado de Integración BaaS (Firebase) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Database className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Servicios Firebase Activos</h3>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Estado de Conexión:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isFirebaseConfigured
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                }`}>
                  {isFirebaseConfigured ? "Conectado a Firebase Console" : "Modo Mock / Fallback Seguro"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Proyecto actual: <span className="text-slate-200 font-semibold">anunciossv-fe998</span>. Autenticación y Firestore operando con Vite.
              </p>
            </div>
          </div>
        </div>

        {/* Sección: Políticas de Moderación */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Políticas de Moderación y Seguridad</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 cursor-pointer hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">Aprobación automática de anuncios</div>
                <div className="text-[11px] text-slate-400">Si está desactivado, todos los anuncios pasan a la cola /admin/moderation</div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoApproveListings}
                onChange={(e) => setSettings({ ...settings, autoApproveListings: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 cursor-pointer hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">Permitir navegación a invitados</div>
                <div className="text-[11px] text-slate-400">Los usuarios no registrados pueden explorar el feed de anuncios</div>
              </div>
              <input
                type="checkbox"
                checked={settings.allowGuestBrowsing}
                onChange={(e) => setSettings({ ...settings, allowGuestBrowsing: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 cursor-pointer hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">Alertas instantáneas por denuncias</div>
                <div className="text-[11px] text-slate-400">Enviar aviso al webmaster cuando un usuario denuncie una publicación</div>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyOnNewReport}
                onChange={(e) => setSettings({ ...settings, notifyOnNewReport: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
              />
            </label>
          </div>
        </div>

        {/* Botón de guardar cambios */}
        <div className="flex items-center justify-between pt-2">
          {saved ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              ¡Ajustes actualizados correctamente!
            </span>
          ) : (
            <span className="text-xs text-slate-500">Los cambios se guardan localmente para la sesión actual.</span>
          )}

          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Configuración</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;
