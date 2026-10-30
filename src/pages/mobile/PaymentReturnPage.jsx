// Página de retorno y verificación del pago con Pagadito (Callback oficial)
// Consulta el estado del token de transacción con Pagadito y activa el anuncio en caso de éxito
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Home
} from "lucide-react";
import { verifyAndActivatePromotion } from "../../services/pagaditoService";
import { addNotification } from "../../services/notificationService";

export const PaymentReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // El token de transacción puede venir como 'token', 'token_trans' o 'tokenTrans' según el retorno de Pagadito
  const token = searchParams.get("token") || searchParams.get("token_trans") || searchParams.get("tokenTrans");
  const urlStatus = searchParams.get("status");

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Prevenir retroceso con gestos táctiles nativos o botón de retroceso
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const processPaymentVerification = async () => {
      // Si el usuario canceló explícitamente en la pasarela
      if (urlStatus === "cancelled") {
        setLoading(false);
        setError("La transacción fue cancelada en Pagadito.");
        return;
      }

      if (!token) {
        setLoading(false);
        setError("No se recibió el token de transacción de Pagadito.");
        return;
      }

      try {
        setLoading(true);
        const res = await verifyAndActivatePromotion(token);
        if (!isCancelled) {
          if (res.success) {
            setResult(res);
            try {
              const targetUserId = res.product?.seller?.id || res.product?.sellerId;
              if (targetUserId) {
                addNotification({
                  userId: targetUserId,
                  title: "¡Anuncio destacado con éxito!",
                  message: `Tu anuncio "${res.product?.title || "Publicación"}" ahora cuenta con destaque preferencial.`,
                  type: "promotion",
                  link: `/product/${res.product?.id}`
                });
              }
            } catch (_) {}
          } else {
            setError(res.message || "No se pudo confirmar el pago con Pagadito.");
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Error al verificar la transacción con Pagadito.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    processPaymentVerification();

    return () => {
      isCancelled = true;
    };
  }, [token, urlStatus]);

  // 1. Estado de carga / Verificación en proceso
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-sm mx-auto animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-base font-extrabold text-white">Verificando pago con Pagadito...</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Estamos confirmando la transacción con los servidores de Pagadito para activar tu anuncio destacado.
        </p>
      </div>
    );
  }

  // 2. Estado de error o cancelación
  if (error || !result) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-sm mx-auto animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-base font-extrabold text-white">No se completó la operación</h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          {error || "La transacción no fue procesada o fue cancelada."}
        </p>

        <div className="pt-2 space-y-2 w-full">
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Ir al Feed principal</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Estado de éxito: Anuncio destacado activado con halo dorado
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 max-w-sm mx-auto animate-fade-in text-center space-y-4">
      {/* Icono animado de felicitación con halo dorado */}
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 animate-bounce">
        <Sparkles className="w-11 h-11 fill-current" />
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Pago confirmado</span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight">
          ¡Tu Anuncio ha sido Destacado!
        </h1>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Tu publicación ya cuenta con el <strong className="text-amber-400">halo dorado</strong> y se encuentra posicionada sobre los demás anuncios en el feed principal de El Salvador.
      </p>

      {/* Tarjeta de detalles del pago */}
      <div className="w-full p-3.5 rounded-2xl bg-slate-900 border border-amber-500/30 shadow-md text-left space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-slate-400 text-[11px]">Referencia:</span>
          <span className="font-mono font-bold text-amber-300 text-[11px]">{result.reference}</span>
        </div>

        {result.productTitle && (
          <div className="text-[11px] text-slate-300">
            <span className="text-slate-400">Publicación:</span>{" "}
            <strong className="text-white line-clamp-1">{result.productTitle}</strong>
          </div>
        )}

        {result.buyerEmail && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
            <Mail className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>
              Justificante enviado a: <strong className="text-slate-200">{result.buyerEmail}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className="pt-2 space-y-2.5 w-full">
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4.5 h-4.5 fill-slate-950" />
          <span>Ir al Feed</span>
        </button>

        {result.productId && (
          <button
            type="button"
            onClick={() => navigate(`/product/${result.productId}`, { replace: true })}
            className="w-full min-h-[42px] py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition-all"
          >
            Ver detalles del anuncio
          </button>
        )}
      </div>
    </div>
  );
};

export default PaymentReturnPage;
