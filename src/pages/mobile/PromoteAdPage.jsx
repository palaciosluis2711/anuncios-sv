// Pantalla para destacar un anuncio en AnunciosSV con halo dorado y posicionamiento preferencial
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Sparkles,
  AlertCircle,
  CreditCard,
  Lock,
  Mail,
  ChevronRight,
  Check
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { CustomSelect } from "../../components/common/CustomSelect";
import {
  getProductById,
  formatProductPrice
} from "../../services/productsService";
import { initiatePromotionPayment } from "../../services/pagaditoService";

// Tarifas oficiales para destacar anuncios en la plataforma
export const PROMOTION_TIERS = [
  { id: "1d", days: 1, price: 1.99, label: "1 día - $1.99", desc: "Prueba rápida de alta visibilidad" },
  { id: "3d", days: 3, price: 4.99, label: "3 días - $4.99", desc: "Ideal para fines de semana" },
  { id: "7d", days: 7, price: 7.99, label: "7 días - $7.99", desc: "Recomendado: 1 semana completa de alcance", isPopular: true },
  { id: "14d", days: 14, price: 11.99, label: "14 días - $11.99", desc: "Quincena con máxima exposición" },
  { id: "30d", days: 30, price: 17.99, label: "30 días - $17.99", desc: "El mejor valor mensual (Ahorro del 70%)", isBestValue: true }
];

export const PromoteAdPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Carga del producto seleccionado para destacar
  const [product, setProduct] = useState(() => getProductById(id));

  // Estados del formulario de promoción
  const [selectedTierId, setSelectedTierId] = useState("7d");
  const [email, setEmail] = useState(() => currentUser?.email || "");
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Estados de validación visual
  const [emailError, setEmailError] = useState(null);
  const [termsError, setTermsError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Obtener la tarifa seleccionada actualmente
  const selectedTier = PROMOTION_TIERS.find((t) => t.id === selectedTierId) || PROMOTION_TIERS[2];

  // Sincronizar reactivamente si el producto cambia
  useEffect(() => {
    setProduct(getProductById(id));
  }, [id]);

  // Si el usuario es invitado, solicitar inicio de sesión o registro al entrar
  useEffect(() => {
    if (!currentUser) {
      navigate("/login", {
        replace: true,
        state: {
          from: { pathname: `/promote-ad/${id}` },
          message: "Inicia sesión o regístrate para destacar esta publicación."
        }
      });
    }
  }, [currentUser, navigate, id]);

  // Si el anuncio no existe
  if (!product) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Anuncio no encontrado</h2>
        <p className="text-xs text-slate-400">
          El anuncio que intentas destacar no existe o fue eliminado previamente.
        </p>
        <button
          onClick={() => navigate("/", { replace: true })}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md"
        >
          Ir al Feed principal
        </button>
      </div>
    );
  }

  const priceInfo = formatProductPrice(product);

  // Validación de formulario antes de proceder con el pago
  const validateForm = () => {
    let isValid = true;

    // Validación de correo electrónico
    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail) {
      setEmailError("Ingresa un correo electrónico para enviarte el justificante de pago.");
      isValid = false;
    } else if (!emailRegex.test(cleanEmail)) {
      setEmailError("Por favor ingresa un correo electrónico válido.");
      isValid = false;
    } else {
      setEmailError(null);
    }

    // Validación de términos y condiciones
    if (!acceptTerms) {
      setTermsError("Debes aceptar los Términos y Condiciones para continuar.");
      isValid = false;
    } else {
      setTermsError(null);
    }

    return isValid;
  };

  // Iniciar cobro seguro y redirección hacia la pasarela de Pagadito
  const handleProceedToPagadito = async () => {
    if (!validateForm()) {
      // Desplazar suavemente a los errores si faltan datos
      window.scrollTo({ top: 380, behavior: "smooth" });
      return;
    }

    setIsProcessing(true);
    try {
      const order = await initiatePromotionPayment({
        product,
        tier: selectedTier,
        buyerEmail: email
      });

      if (order.success && order.value) {
        // Pausa breve para una transición visual suave hacia la pasarela
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Redirigir a la URL oficial de cobro provista por Pagadito
        if (order.value.startsWith("http://") || order.value.startsWith("https://")) {
          if (order.value.startsWith(window.location.origin)) {
            const relPath = order.value.replace(window.location.origin, "");
            navigate(relPath);
          } else {
            window.location.href = order.value;
          }
        } else {
          navigate(order.value);
        }
      } else {
        throw new Error(order.message || "No se pudo generar la orden de cobro con Pagadito.");
      }
    } catch (err) {
      setIsProcessing(false);
      alert("Error al conectar con la pasarela de pago: " + err.message);
    }
  };

  return (
    <div className="space-y-4 px-4 py-3 pb-16 animate-fade-in max-w-lg mx-auto">
      {/* 1. Tarjeta Resumen del Anuncio Seleccionado */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex items-center gap-3">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800">
          <img
            src={product.image || (product.images && product.images[0])}
            alt={product.title}
            className="w-full h-full object-cover"
          />
          {product.featured && (
            <span className="absolute top-1 left-1 p-0.5 rounded bg-amber-500 text-slate-950" title="Actualmente destacado">
              <Sparkles className="w-3 h-3 fill-current" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 fill-current" />
            <span>Publicación a destacar</span>
          </div>
          <h2 className="text-xs font-bold text-white line-clamp-1">{product.title}</h2>
          <div className="text-xs font-extrabold text-indigo-400 mt-0.5">
            {priceInfo.isContact ? (
              <span>💬 A consultar</span>
            ) : priceInfo.isFree ? (
              <span className="text-emerald-400">GRATIS</span>
            ) : (
              <span>{priceInfo.text} {priceInfo.currency}{priceInfo.periodSuffix}</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Breve Descripción Persuasiva de Beneficios */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-900 to-yellow-500/10 border border-amber-500/30 shadow-lg space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/30 shadow-sm">
            <Sparkles className="w-4.5 h-4.5 fill-amber-400" />
          </div>
          <h3 className="text-sm font-extrabold text-white tracking-tight">
            Multiplica la visibilidad de tu publicación
          </h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Al destacar este anuncio, se mostrará con un <strong className="text-amber-400 font-bold">halo dorado alrededor</strong> y se <strong className="text-amber-400 font-bold">posicionará sobre los demás anuncios</strong> en la parte superior del feed principal, permitiendo que sea visto por más usuarios y mejorando su alcance.
        </p>
      </div>

      {/* 3. Combobox de Tarifas de Promoción */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="promotion-tier-select" className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <span>Tiempo de duración</span>
          </label>
          <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            ${selectedTier.price} USD total
          </span>
        </div>

        {/* Combobox interactivo CustomSelect con las tarifas oficiales */}
        <CustomSelect
          id="promotion-tier-select"
          value={selectedTierId}
          onChange={(newVal) => setSelectedTierId(newVal)}
          options={PROMOTION_TIERS.map((tier) => ({
            id: tier.id,
            name: `${tier.label} ${tier.isPopular ? "⭐ (Más popular)" : tier.isBestValue ? "🔥 (Mejor tarifa)" : ""}`
          }))}
          placeholder="Selecciona el tiempo a destacar..."
        />

        <p className="text-[11px] text-slate-400 leading-tight">
          {selectedTier.desc}
        </p>
      </div>

      {/* 4. Solicitud de Correo Electrónico para Justificante de Pago */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2.5">
        <label htmlFor="user-email-input" className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-indigo-400" />
          <span>Correo para recibir justificante</span>
        </label>

        <div className="relative">
          <input
            id="user-email-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            placeholder="ejemplo@correo.com"
            className={`w-full h-11 px-3.5 rounded-xl bg-slate-950 border text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
              emailError
                ? "border-rose-500 focus:ring-2 focus:ring-rose-500/30"
                : "border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            }`}
          />
        </div>

        {emailError ? (
          <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{emailError}</span>
          </p>
        ) : (
          <p className="text-[10px] text-slate-400">
            Te enviaremos el comprobante de pago y los detalles de activación a esta dirección de correo.
          </p>
        )}
      </div>

      {/* 5. Aceptación de Términos y Condiciones */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
        <label className="flex items-start gap-2.5 cursor-pointer select-none group">
          <div className="pt-0.5">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (termsError) setTermsError(null);
              }}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                acceptTerms
                  ? "bg-amber-500 border-amber-400 text-slate-950 shadow-sm shadow-amber-500/30"
                  : termsError
                  ? "bg-slate-950 border-rose-500"
                  : "bg-slate-950 border-slate-700 group-hover:border-slate-600"
              }`}
            >
              {acceptTerms && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          <div className="flex-1 text-xs text-slate-300 leading-snug">
            <span>Acepto los </span>
            <span className="font-bold text-amber-400 underline decoration-amber-400/40 hover:text-amber-300">
              Términos y Condiciones
            </span>
            <span> del servicio de publicación destacada.</span>
          </div>
        </label>

        {termsError && (
          <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 pl-7">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{termsError}</span>
          </p>
        )}
      </div>

      {/* 6. Método de Pago: Pago con tarjeta */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Método de pago
          </h4>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Pago seguro</span>
          </span>
        </div>

        {/* Botón oficial: Pagar con tarjeta de crédito/débito */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleProceedToPagadito}
          className="w-full min-h-[52px] p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-slate-950 to-amber-500/10 hover:from-amber-500/25 hover:to-amber-500/15 border border-amber-500/40 hover:border-amber-400 text-left transition-all active:scale-[0.99] flex items-center justify-between group shadow-sm disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
              Pagar con tarjeta de crédito/débito
            </span>
          </div>
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-all" />
          )}
        </button>
      </div>

      {/* Transición suave hacia el carrito de Pagadito */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-backdrop-enter transition-all">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-4 shadow-xl shadow-amber-500/20 animate-pulse">
            <CreditCard className="w-8 h-8" />
          </div>
          <div className="text-sm font-bold text-white mb-1.5">Conectando con la pasarela...</div>
          <div className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Abriendo el carrito de cobro seguro de Pagadito
          </div>
          <div className="mt-5 w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default PromoteAdPage;
