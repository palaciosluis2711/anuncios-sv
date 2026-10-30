// Modal de Compartir tipo Android / iOS con selección directa de aplicaciones y acciones
import React, { useState, useEffect } from "react";
import { Copy, Check, Mail, MessageSquare, X, Share2, Globe } from "lucide-react";
import { SHARE_MODAL_EVENT } from "../../services/shareService";

export const ShareModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shareData, setShareData] = useState({ title: "", text: "", url: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleOpen = (e) => {
      const data = e.detail || {};
      setShareData({
        title: data.title || (typeof document !== "undefined" ? document.title : "AnunciosSV"),
        text: data.text || "Publicación en AnunciosSV",
        url: data.url || (typeof window !== "undefined" ? window.location.href : "")
      });
      setCopied(false);
      setIsClosing(false);
      setIsOpen(true);
    };

    window.addEventListener(SHARE_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(SHARE_MODAL_EVENT, handleOpen);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setCopied(false);
    }, 250);
  };

  if (!isOpen) return null;

  const encodedUrl = encodeURIComponent(shareData.url);
  const encodedText = encodeURIComponent(`${shareData.text} ${shareData.url}`);
  const encodedTitle = encodeURIComponent(shareData.title);

  // Lista de aplicaciones y canales de destino
  const apps = [
    {
      id: "whatsapp",
      name: "WhatsApp",
      bgColor: "bg-[#25D366]",
      textColor: "text-white",
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
      action: () => {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank", "noopener,noreferrer");
        handleClose();
      }
    },
    {
      id: "facebook",
      name: "Facebook",
      bgColor: "bg-[#1877F2]",
      textColor: "text-white",
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "_blank", "noopener,noreferrer");
        handleClose();
      }
    },
    {
      id: "telegram",
      name: "Telegram",
      bgColor: "bg-[#229ED9]",
      textColor: "text-white",
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0011.944 0zm5.82 7.747l-1.98 9.336c-.15.66-.54.82-1.1.51l-3.04-2.24-1.46 1.41c-.16.16-.3.3-.62.3l.22-3.09 5.63-5.09c.24-.22-.05-.34-.38-.13l-6.96 4.38-3-.94c-.65-.2-.66-.65.14-.96l11.73-4.52c.54-.2 1.02.13.82 1.04z" />
        </svg>
      ),
      action: () => {
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareData.text)}`, "_blank", "noopener,noreferrer");
        handleClose();
      }
    },
    {
      id: "twitter",
      name: "X (Twitter)",
      bgColor: "bg-black border border-slate-700",
      textColor: "text-white",
      icon: (
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, "_blank", "noopener,noreferrer");
        handleClose();
      }
    }
  ];

  // Acciones complementarias de compartir
  const secondaryActions = [
    {
      id: "sms",
      name: "Mensaje SMS",
      icon: MessageSquare,
      bgColor: "bg-emerald-600",
      action: () => {
        window.location.href = `sms:?body=${encodedText}`;
        handleClose();
      }
    },
    {
      id: "email",
      name: "Correo",
      icon: Mail,
      bgColor: "bg-rose-600",
      action: () => {
        window.location.href = `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${shareData.text}\n\n${shareData.url}`)}`;
        handleClose();
      }
    }
  ];

  // Copiar al portapapeles sin alerts
  const handleCopy = () => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareData.url);
      } else {
        const input = document.createElement("input");
        input.value = shareData.url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end select-none">
      {/* Fondo oscuro con desenfoque suave */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-250 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Contenedor tipo Bottom Sheet de Android / iOS */}
      <div
        className={`relative z-10 w-full max-w-md mx-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-8 shadow-2xl transition-transform duration-250 ease-out ${
          isClosing ? "translate-y-full" : "translate-y-0 animate-slide-up"
        }`}
      >
        {/* Barra superior de agarre estilo táctil */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-4" />

        {/* Cabecera del modal */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Compartir en</h3>
              <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
                {shareData.title || "AnunciosSV"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fila 1: Aplicaciones sociales principales */}
        <div className="grid grid-cols-4 gap-3 mb-4 text-center">
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={app.action}
              className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
            >
              <div
                className={`w-13 h-13 rounded-2xl ${app.bgColor} flex items-center justify-center shadow-lg transition-transform group-hover:scale-105`}
              >
                {app.icon}
              </div>
              <span className="text-[11px] font-medium text-slate-300 group-hover:text-white truncate max-w-full">
                {app.name}
              </span>
            </button>
          ))}
        </div>

        {/* Fila 2: Acciones rápidas (SMS, Correo, Copiar Enlace) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80 mb-4">
          {/* Botón para copiar enlace directo */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-700/50 text-slate-300"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  {copied ? "¡Enlace copiado al portapapeles!" : "Copiar enlace"}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[230px]">
                  {shareData.url}
                </div>
              </div>
            </div>

            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                copied
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {copied ? "Copiado" : "Copiar"}
            </span>
          </button>

          {/* Opciones SMS y Correo en fila */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {secondaryActions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.action}
                  className="py-2 px-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white transition-all active:scale-95"
                >
                  <div className={`w-6 h-6 rounded-lg ${act.bgColor} flex items-center justify-center text-white flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{act.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Botón Cancelar */}
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors active:scale-[0.99]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default ShareModal;

