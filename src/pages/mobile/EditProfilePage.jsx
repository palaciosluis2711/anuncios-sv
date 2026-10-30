// Pantalla completa de edición de perfil y datos de la cuenta en AnunciosSV
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  User,
  Mail,
  KeyRound,
  Camera,
  Save,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  ChevronDown,
  Lock,
  ArrowLeft,
  ChevronLeft
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AvatarCropModal } from "../../components/common/AvatarCropModal";

// Configuración de países para códigos de teléfono y formatos de máscara
const COUNTRY_PHONE_CONFIGS = [
  { id: "sv", code: "+503", flag: "🇸🇻", mask: "####-####", maxDigits: 8, placeholder: "0000-0000" },
  { id: "gt", code: "+502", flag: "🇬🇹", mask: "####-####", maxDigits: 8, placeholder: "0000-0000" },
  { id: "hn", code: "+504", flag: "🇭🇳", mask: "####-####", maxDigits: 8, placeholder: "0000-0000" },
  { id: "ni", code: "+505", flag: "🇳🇮", mask: "####-####", maxDigits: 8, placeholder: "0000-0000" },
  { id: "cr", code: "+506", flag: "🇨🇷", mask: "####-####", maxDigits: 8, placeholder: "0000-0000" },
  { id: "pa", code: "+507", flag: "🇵🇦", mask: "####-####", maxDigits: 8, placeholder: "0000-0000" },
  { id: "mx", code: "+52", flag: "🇲🇽", mask: "### ### ####", maxDigits: 10, placeholder: "000 000 0000" },
  { id: "us", code: "+1", flag: "🇺🇸", mask: "(###) ###-####", maxDigits: 10, placeholder: "(000) 000-0000" },
  { id: "ca", code: "+1-ca", codeDisplay: "+1", flag: "🇨🇦", mask: "(###) ###-####", maxDigits: 10, placeholder: "(000) 000-0000" },
  { id: "co", code: "+57", flag: "🇨🇴", mask: "### ### ####", maxDigits: 10, placeholder: "000 000 0000" },
  { id: "es", code: "+34", flag: "🇪🇸", mask: "### ## ## ##", maxDigits: 9, placeholder: "000 00 00 00" },
];

// Formatea los dígitos numéricos de acuerdo con la máscara del país (# representa un dígito)
const formatPhoneByMask = (digits, mask) => {
  if (!digits) return "";
  let digitIndex = 0;
  let formatted = "";
  for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
    if (mask[i] === "#") {
      formatted += digits[digitIndex];
      digitIndex++;
    } else {
      formatted += mask[i];
    }
  }
  return formatted;
};

// Extrae el país y los dígitos numéricos a partir de un número almacenado
const parsePhoneInput = (phoneStr) => {
  if (!phoneStr || typeof phoneStr !== "string") {
    return { countryId: "sv", rawDigits: "" };
  }
  const clean = phoneStr.trim();
  const sorted = [...COUNTRY_PHONE_CONFIGS].sort((a, b) => {
    const codeA = a.codeDisplay || a.code;
    const codeB = b.codeDisplay || b.code;
    return codeB.length - codeA.length;
  });
  const matched = sorted.find((c) => clean.startsWith(c.codeDisplay || c.code));
  if (matched) {
    const codeStr = matched.codeDisplay || matched.code;
    const rawDigits = clean.slice(codeStr.length).replace(/\D/g, "").slice(0, matched.maxDigits);
    return { countryId: matched.id, rawDigits };
  }
  const defaultCountry = COUNTRY_PHONE_CONFIGS[0];
  const rawDigits = clean.replace(/\D/g, "").slice(0, defaultCountry.maxDigits);
  return { countryId: defaultCountry.id, rawDigits };
};

export const EditProfilePage = () => {
  const {
    currentUser,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
    deleteAccount
  } = useAuth();
  const navigate = useNavigate();

  const avatarFileInputRef = useRef(null);

  // Control del modal de recorte y encuadre de foto de perfil
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Estados del teléfono y código de país
  const initialPhoneParsed = parsePhoneInput(currentUser?.phone);
  const [selectedCountryId, setSelectedCountryId] = useState(initialPhoneParsed.countryId);
  const [phoneDigits, setPhoneDigits] = useState(initialPhoneParsed.rawDigits);
  const activeCountry = COUNTRY_PHONE_CONFIGS.find((c) => c.id === selectedCountryId) || COUNTRY_PHONE_CONFIGS[0];

  // Desplegable de selección de país
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countryCoords, setCountryCoords] = useState({
    top: undefined,
    bottom: undefined,
    left: 0,
    width: 135,
    maxHeight: 220,
    openUp: false
  });
  const countryButtonRef = useRef(null);
  const countryDropdownRef = useRef(null);

  // Posicionamiento dinámico del selector de país
  const updateCountryPosition = useCallback(() => {
    if (!countryButtonRef.current) return;
    const rect = countryButtonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(220, Math.max(120, openUp ? spaceAbove - 20 : spaceBelow - 20));

    let width = 135;
    let left = rect.left;
    if (left + width > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - width - 8);
    }

    setCountryCoords({
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? viewportHeight - rect.top + 6 : undefined,
      left: Math.max(8, left),
      width,
      maxHeight,
      openUp
    });
  }, []);

  useEffect(() => {
    if (!isCountryDropdownOpen) return;
    updateCountryPosition();

    const handleScrollOrResize = () => updateCountryPosition();
    const handleClickOutside = (event) => {
      if (
        countryButtonRef.current &&
        !countryButtonRef.current.contains(event.target) &&
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target)
      ) {
        setIsCountryDropdownOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isCountryDropdownOpen, updateCountryPosition]);

  // Estados del formulario de perfil
  const [profileForm, setProfileForm] = useState({
    displayName: currentUser?.displayName || (currentUser?.name && !currentUser.name.startsWith("@") ? currentUser.name : ""),
    phone: currentUser?.phone || "",
    avatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
  });
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Estados del formulario de correo
  const [emailForm, setEmailForm] = useState(currentUser?.email || "");
  const [emailSuccessMsg, setEmailSuccessMsg] = useState(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState(null);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Estados del formulario de contraseña
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Estados para eliminación de cuenta (Danger Zone)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState(null);

  // Referencias para detección de gesto táctil de retroceso (Swipe back desde margen izquierdo)
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
    }
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
    const elapsed = Date.now() - touchStartTimeRef.current;

    // Gesto de swipe fluido hacia la derecha desde el margen izquierdo (< 120px)
    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && touchStartXRef.current < 120) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/profile", { replace: true });
      }
    }
  };

  // Sincronizar estado cuando el usuario activo cargue
  useEffect(() => {
    if (currentUser) {
      const parsed = parsePhoneInput(currentUser.phone);
      setSelectedCountryId(parsed.countryId);
      setPhoneDigits(parsed.rawDigits);
      setProfileForm({
        displayName: currentUser.displayName || (currentUser.name && !currentUser.name.startsWith("@") ? currentUser.name : ""),
        phone: currentUser.phone || "",
        avatar: currentUser.avatar || null
      });
      setEmailForm(currentUser.email || "");
    }
  }, [currentUser]);

  // Cambio de país y actualización del formato telefónico
  const handleCountryChange = (newCountryId) => {
    setSelectedCountryId(newCountryId);
    setIsCountryDropdownOpen(false);

    const newCountry = COUNTRY_PHONE_CONFIGS.find((c) => c.id === newCountryId) || COUNTRY_PHONE_CONFIGS[0];
    const slicedDigits = phoneDigits.slice(0, newCountry.maxDigits);
    setPhoneDigits(slicedDigits);

    const codeStr = newCountry.codeDisplay || newCountry.code;
    const formatted = formatPhoneByMask(slicedDigits, newCountry.mask);
    setProfileForm((prev) => ({
      ...prev,
      phone: slicedDigits.length > 0 ? `${codeStr} ${formatted}` : ""
    }));
  };

  // Entrada de número de teléfono con máscara automática
  const handlePhoneInputChange = (e) => {
    let inputVal = e.target.value;
    const activeCode = activeCountry.codeDisplay || activeCountry.code;

    const matchedCountry = COUNTRY_PHONE_CONFIGS.find((c) => inputVal.startsWith(c.codeDisplay || c.code));
    if (matchedCountry) {
      setSelectedCountryId(matchedCountry.id);
      const codeStr = matchedCountry.codeDisplay || matchedCountry.code;
      inputVal = inputVal.slice(codeStr.length);
      const digits = inputVal.replace(/\D/g, "").slice(0, matchedCountry.maxDigits);
      setPhoneDigits(digits);
      const formatted = formatPhoneByMask(digits, matchedCountry.mask);
      setProfileForm((prev) => ({
        ...prev,
        phone: digits.length > 0 ? `${codeStr} ${formatted}` : ""
      }));
      return;
    }

    if (inputVal.startsWith(activeCode.replace("+", ""))) {
      inputVal = inputVal.slice(activeCode.length - 1);
    }

    const digits = inputVal.replace(/\D/g, "").slice(0, activeCountry.maxDigits);
    setPhoneDigits(digits);
    const formatted = formatPhoneByMask(digits, activeCountry.mask);
    setProfileForm((prev) => ({
      ...prev,
      phone: digits.length > 0 ? `${activeCode} ${formatted}` : ""
    }));
  };

  // Cargar archivo para nueva foto de perfil y abrir modal de encuadre
  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        setCropImageSrc(uploadEvent.target.result);
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Confirmar recorte de foto de perfil
  const handleApplyAvatarCrop = async (croppedDataUrl) => {
    setProfileForm((prev) => ({ ...prev, avatar: croppedDataUrl }));
    setIsCropModalOpen(false);

    try {
      await updateUserProfile({ avatar: croppedDataUrl });
      setProfileSuccessMsg("¡Foto de perfil actualizada con éxito!");
      setTimeout(() => setProfileSuccessMsg(null), 3500);
    } catch (err) {
      console.warn("Aviso al guardar avatar:", err);
    }
  };

  // Guardar datos básicos de perfil
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setIsUpdatingProfile(true);

    try {
      await updateUserProfile({
        displayName: profileForm.displayName,
        phone: profileForm.phone,
        avatar: profileForm.avatar
      });
      setProfileSuccessMsg("¡Información guardada con éxito!");
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err) {
      setProfileErrorMsg(err.message || "Error al actualizar la información.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Actualizar correo electrónico
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailSuccessMsg(null);
    setEmailErrorMsg(null);
    setIsUpdatingEmail(true);

    try {
      await updateUserEmail(emailForm);
      setEmailSuccessMsg("¡Correo electrónico actualizado con éxito!");
      setTimeout(() => setEmailSuccessMsg(null), 4000);
    } catch (err) {
      setEmailErrorMsg(err.message || "Error al actualizar el correo electrónico.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Actualizar contraseña
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateUserPassword(passwordForm.newPassword);
      setPasswordSuccessMsg("¡Contraseña actualizada con éxito!");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordSuccessMsg(null), 4000);
    } catch (err) {
      setPasswordErrorMsg(err.message || "Error al cambiar la contraseña.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Confirmar eliminación de cuenta
  const handleConfirmDeleteAccount = async () => {
    setDeleteErrorMsg(null);
    setIsDeletingAccount(true);

    try {
      await deleteAccount();
      setShowDeleteModal(false);
      navigate("/", { replace: true });
      alert("Tu cuenta ha sido eliminada permanentemente de AnunciosSV.");
    } catch (err) {
      setDeleteErrorMsg(err.message || "No se pudo eliminar la cuenta. Intenta nuevamente.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="px-4 py-12 max-w-sm mx-auto text-center space-y-4 animate-page-enter">
        <p className="text-sm text-slate-400">Debes iniciar sesión para editar tu perfil.</p>
        <Link
          to="/login"
          className="inline-block py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
        >
          Iniciar Sesión
        </Link>
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="px-4 py-4 max-w-md mx-auto space-y-4 pb-20 animate-page-enter"
    >
      {/* Selector de Foto de Perfil */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3 shadow-sm">
        <div className="relative w-24 h-24 mx-auto">
          {profileForm.avatar ? (
            <img
              src={profileForm.avatar}
              alt="Foto de perfil"
              className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 shadow-lg">
              <User className="w-12 h-12 text-slate-400" />
            </div>
          )}
          <button
            type="button"
            onClick={() => avatarFileInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md border-2 border-slate-900 transition-all active:scale-95"
            title="Cambiar foto de perfil"
            aria-label="Cambiar foto de perfil"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={avatarFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarFileChange}
          className="hidden"
        />

        <div>
          <button
            type="button"
            onClick={() => avatarFileInputRef.current?.click()}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
          >
            {profileForm.avatar ? "Cambiar foto de perfil" : "Subir foto de perfil"}
          </button>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Formatos soportados: JPG, PNG o WEBP
          </p>
        </div>
      </div>

      {/* 1. Información General de Contacto */}
      <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-sm">
        <div className="pb-1 border-b border-slate-800/80">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <User className="w-4 h-4 text-indigo-400" />
            <span>Información de Contacto</span>
          </h2>
        </div>

        {profileSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-scale-up">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{profileSuccessMsg}</span>
          </div>
        )}
        {profileErrorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-scale-up">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{profileErrorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nombre de usuario <span className="text-[10px] text-slate-500 font-normal">(No modificable)</span>
          </label>
          <input
            type="text"
            disabled
            value={currentUser.username ? `@${currentUser.username}` : "@usuario"}
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-sm text-slate-400 font-mono cursor-not-allowed select-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nombre de pila <span className="text-[10px] text-slate-500 font-normal">(Opcional)</span>
          </label>
          <input
            type="text"
            value={profileForm.displayName}
            onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
            placeholder="Ej. Carlos Méndez"
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Número de teléfono <span className="text-[10px] text-slate-500 font-normal">(Opcional)</span>
          </label>
          <div className="flex rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 transition-all">
            {/* Selector estilizado de país */}
            <button
              ref={countryButtonRef}
              type="button"
              onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
              className="min-h-[46px] px-3.5 bg-slate-800/60 hover:bg-slate-800/90 border-r border-slate-800 flex items-center gap-1.5 transition-colors focus:outline-none flex-shrink-0 rounded-l-xl select-none"
              aria-label="Código de país"
              title="Seleccionar código de país"
            >
              <span className="text-base leading-none">{activeCountry.flag}</span>
              <span className="font-mono font-bold text-xs text-white">
                {activeCountry.codeDisplay || activeCountry.code}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isCountryDropdownOpen ? "rotate-180 text-indigo-400" : ""
                }`}
              />
            </button>

            {/* Input de número formateado */}
            <div className="relative flex-1 flex items-center">
              <input
                type="tel"
                value={formatPhoneByMask(phoneDigits, activeCountry.mask)}
                onChange={handlePhoneInputChange}
                placeholder={activeCountry.placeholder}
                className="w-full min-h-[46px] px-3.5 py-2.5 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isUpdatingProfile}
          className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{isUpdatingProfile ? "Guardando información..." : "Guardar Información"}</span>
        </button>
      </form>

      {/* 2. Cambiar Correo Electrónico */}
      <form onSubmit={handleUpdateEmail} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
        <div className="pb-1 border-b border-slate-800/80">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>Correo Electrónico</span>
          </h2>
        </div>

        {emailSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-scale-up">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{emailSuccessMsg}</span>
          </div>
        )}
        {emailErrorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-scale-up">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{emailErrorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Dirección de correo
          </label>
          <input
            type="email"
            required
            value={emailForm}
            onChange={(e) => setEmailForm(e.target.value)}
            placeholder="tu_correo@ejemplo.com"
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isUpdatingEmail || emailForm === currentUser?.email}
          className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs border border-slate-700 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          <span>{isUpdatingEmail ? "Actualizando correo..." : "Actualizar Correo"}</span>
        </button>
      </form>

      {/* 3. Cambiar Contraseña */}
      <form onSubmit={handleUpdatePassword} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
        <div className="pb-1 border-b border-slate-800/80">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>Cambiar Contraseña</span>
          </h2>
        </div>

        {passwordSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-scale-up">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{passwordSuccessMsg}</span>
          </div>
        )}
        {passwordErrorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-scale-up">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{passwordErrorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nueva Contraseña
          </label>
          <input
            type="password"
            required
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="Mínimo 6 caracteres"
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Confirmar Nueva Contraseña
          </label>
          <input
            type="password"
            required
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder="Repite la nueva contraseña"
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isUpdatingPassword || !passwordForm.newPassword}
          className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs border border-slate-700 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4" />
          <span>{isUpdatingPassword ? "Actualizando contraseña..." : "Actualizar Contraseña"}</span>
        </button>
      </form>

      {/* 4. Zona de Peligro (Danger Zone) */}
      <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/30 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-rose-400">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <h2 className="text-xs font-bold uppercase tracking-wider">
            Zona de Peligro
          </h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Al eliminar tu cuenta, todos tus anuncios, mensajes e historial se borrarán definitivamente de la plataforma.
        </p>
        <button
          type="button"
          onClick={() => {
            setDeleteErrorMsg(null);
            setShowDeleteModal(true);
          }}
          className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Eliminar mi Cuenta</span>
        </button>
      </div>

      {/* Modal Desplegable de Selección de País */}
      {isCountryDropdownOpen && (
        <div
          ref={countryDropdownRef}
          style={{
            position: "fixed",
            top: countryCoords.top !== undefined ? `${countryCoords.top}px` : "auto",
            bottom: countryCoords.bottom !== undefined ? `${countryCoords.bottom}px` : "auto",
            left: `${countryCoords.left}px`,
            width: `${countryCoords.width}px`,
            maxHeight: `${countryCoords.maxHeight}px`,
            zIndex: 9999
          }}
          className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-y-auto no-scrollbar animate-scale-up"
        >
          {COUNTRY_PHONE_CONFIGS.map((country) => {
            const isSelected = country.id === selectedCountryId;
            return (
              <button
                key={country.id}
                type="button"
                onClick={() => handleCountryChange(country.id)}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 text-xs transition-colors ${
                  isSelected ? "bg-indigo-600 text-white font-bold" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="text-base leading-none">{country.flag}</span>
                <span className="font-mono font-semibold">
                  {country.codeDisplay || country.code}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal de Encuadre y Recorte de Avatar */}
      <AvatarCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSrc}
        onApplyCrop={handleApplyAvatarCrop}
        onClose={() => setIsCropModalOpen(false)}
      />

      {/* Modal de Confirmación para Eliminar Cuenta (Danger Zone) */}
      {showDeleteModal && (
        <div
          onClick={() => setShowDeleteModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-enter"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-rose-500/40 p-5 space-y-4 shadow-2xl animate-scale-up"
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">¿Eliminar tu cuenta definitivamente?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Esta acción eliminará permanentemente tu usuario <span className="font-bold text-white">@{currentUser.username}</span> y todos sus datos. No podrás recuperarla.
              </p>
            </div>

            {deleteErrorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteErrorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleConfirmDeleteAccount}
                className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                {isDeletingAccount ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfilePage;
