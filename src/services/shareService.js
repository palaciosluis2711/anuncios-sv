// Servicio para compartir contenido utilizando exclusivamente el menú oficial por defecto de los teléfonos (Android / iOS)

/**
 * Muestra una confirmación visual suave cuando el entorno no soporta la Web Share API nativa
 */
const showShareFeedback = (message) => {
  if (typeof document === "undefined") return;

  const existing = document.getElementById("anunciossv-share-feedback");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "anunciossv-share-feedback";
  toast.className =
    "fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl bg-slate-900/95 text-slate-200 text-xs font-semibold shadow-2xl border border-indigo-500/40 backdrop-blur-md transition-all duration-300 ease-out flex items-center gap-2 max-w-[92vw] text-center pointer-events-none";
  toast.style.opacity = "0";
  toast.style.transform = "translate(-50%, -10px)";
  toast.innerText = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, -10px)";
    setTimeout(() => {
      try {
        toast.remove();
      } catch (_) {}
    }, 300);
  }, 2800);
};

/**
 * Invoca el diálogo nativo de compartir por defecto del sistema operativo (Web Share API)
 * @param {Object} params
 * @param {string} [params.title] - Título del contenido a compartir
 * @param {string} [params.text] - Texto o descripción a compartir
 * @param {string} [params.url] - URL a compartir (por defecto la URL actual)
 */
export const shareContent = async ({ title, text, url } = {}) => {
  const finalUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const finalTitle = title || (typeof document !== "undefined" ? document.title : "AnunciosSV");
  const finalText = text || `Mira esto en AnunciosSV: ${finalTitle}`;

  const payload = {
    title: finalTitle,
    text: finalText,
    url: finalUrl
  };

  // 1. En Android y iOS con HTTPS o localhost, navigator.share abre directamente el formulario nativo del sistema
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    let sharePayload = payload;

    // Verificar compatibilidad de campos con canShare si el navegador lo implementa
    if (typeof navigator.canShare === "function") {
      try {
        if (!navigator.canShare(payload)) {
          sharePayload = { title: finalTitle, url: finalUrl };
        }
      } catch (_) {
        sharePayload = { title: finalTitle, url: finalUrl };
      }
    }

    try {
      await navigator.share(sharePayload);
      return;
    } catch (err) {
      // Si el usuario canceló deliberadamente el menú en su teléfono, no mostramos nada
      if (err.name === "AbortError") {
        return;
      }
      console.warn("Aviso al invocar compartir nativo:", err);
    }
  }

  // 2. Si el navegador no tiene activo el menú nativo (entorno HTTP sin HTTPS en red local o desktop):
  // Copia el enlace al portapapeles y ofrece retroalimentación visual clara
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(finalUrl);
    } catch (_) {}
  }

  showShareFeedback("Enlace copiado (El menú nativo del celular requiere conexión HTTPS)");
};
