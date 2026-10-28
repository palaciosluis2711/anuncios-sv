// Perfil del usuario y centro de control de sus publicaciones
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { AvatarCropModal } from "../../components/common/AvatarCropModal";
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
  Edit3,
  Trash2,
  CheckCircle2,
  LogIn,
  PlusCircle,
  Phone,
  Mail,
  Lock,
  AlertTriangle,
  Save,
  KeyRound,
  ShieldAlert,
  Camera,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  SlidersHorizontal,
  MessageCircle,
  Ban
} from "lucide-react";
import {
  getStoredProducts,
  getUserProducts,
  getFavoriteProducts,
  toggleFavoriteProduct,
  formatProductPrice,
  deleteProduct,
  FAVORITES_EVENT,
  DAILY_PUBLICATION_LIMIT,
  canUserPublishToday
} from "../../services/productsService";
import {
  getTotalUnreadCount,
  getBlockedUsers,
  unblockUser,
  CHAT_EVENT
} from "../../services/chatService";

// Configuración de países para códigos de teléfono y formatos de máscara (solo bandera y código, sin nombre de país)
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
  // Ordenar de mayor a menor longitud de código para evitar colisiones
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
  // Por defecto El Salvador (+503)
  const defaultCountry = COUNTRY_PHONE_CONFIGS[0];
  const rawDigits = clean.replace(/\D/g, "").slice(0, defaultCountry.maxDigits);
  return { countryId: defaultCountry.id, rawDigits };
};

export const ProfilePage = () => {
  const {
    currentUser,
    isAdmin,
    logout,
    switchDemoRole,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
    deleteAccount
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Inicializar pestaña activa respetando parámetro URL (?tab=...) o estado de navegación
  const targetInitialTab = searchParams.get("tab") || location.state?.tab || "posts";
  const [activeTab, setActiveTab] = useState(targetInitialTab);

  // Sincronizar reactivamente si cambia el query param o state
  useEffect(() => {
    const tabParam = searchParams.get("tab") || location.state?.tab;
    if (tabParam && ["posts", "saved", "settings"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams, location.state]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
  };
  const [allProducts, setAllProducts] = useState(() => getStoredProducts());
  const [favoriteProducts, setFavoriteProducts] = useState(() => getFavoriteProducts(currentUser));
  const [unreadChatCount, setUnreadChatCount] = useState(() => getTotalUnreadCount(currentUser));
  const [blockedUsers, setBlockedUsers] = useState(() => getBlockedUsers(currentUser));
  const [unblockingId, setUnblockingId] = useState(null);

  // Control del modal de edición de perfil y cuenta
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const avatarFileInputRef = useRef(null);

  // Control del modal de recorte y encuadre manual de foto de perfil
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Control del código de país y formateo automático del teléfono
  const initialPhoneParsed = parsePhoneInput(currentUser?.phone);
  const [selectedCountryId, setSelectedCountryId] = useState(initialPhoneParsed.countryId);
  const [phoneDigits, setPhoneDigits] = useState(initialPhoneParsed.rawDigits);
  const activeCountry = COUNTRY_PHONE_CONFIGS.find((c) => c.id === selectedCountryId) || COUNTRY_PHONE_CONFIGS[0];

  // Control del menú desplegable estilizado para selección de código de país
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

  // Calcular posición del desplegable de países en el viewport
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

  // Escuchar eventos para cerrar o reposicionar el menú desplegable de país
  useEffect(() => {
    if (!isCountryDropdownOpen) return;

    updateCountryPosition();

    const handleScrollOrResize = () => {
      updateCountryPosition();
    };

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

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCountryDropdownOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCountryDropdownOpen, updateCountryPosition]);

  // Estados del formulario de edición de perfil (nombre de pila, teléfono y foto de perfil)
  const [profileForm, setProfileForm] = useState({
    displayName: currentUser?.displayName || (currentUser?.name && !currentUser.name.startsWith("@") ? currentUser.name : ""),
    phone: currentUser?.phone || "",
    avatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
  });
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Estados para cambio de correo electrónico (con efecto en Firestore y Auth)
  const [emailForm, setEmailForm] = useState(currentUser?.email || "");
  const [emailSuccessMsg, setEmailSuccessMsg] = useState(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState(null);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Estados para cambio de contraseña (con efecto en Auth)
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Estados para Zona de Peligro / Eliminar Cuenta permanentemente
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState(null);

  // Funciones para apertura y cierre de modales sincronizadas con el historial del navegador
  const handleOpenEditModal = () => {
    window.history.pushState({ modal: "edit-profile" }, "");
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setIsCountryDropdownOpen(false);
    if (window.history.state?.modal === "edit-profile") {
      window.history.back();
    }
  };

  const handleCloseCropModal = () => {
    setIsCropModalOpen(false);
    if (window.history.state?.modal === "avatar-crop") {
      window.history.back();
    }
  };

  const handleOpenDeleteModal = () => {
    setDeleteErrorMsg(null);
    window.history.pushState({ modal: "delete-account" }, "");
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    if (window.history.state?.modal === "delete-account") {
      window.history.back();
    }
  };

  // Interceptar el gesto táctil del sistema hacia atrás (deslizar desde el lateral o botón atrás)
  // Si hay un modal abierto (edición de cuenta, crop o eliminación), vuelve al Perfil cerrando el modal.
  // Si está en la pantalla principal de Perfil, el gesto táctil de retorno lleva directamente al Feed.
  useEffect(() => {
    const handlePopState = () => {
      if (isCropModalOpen) {
        setIsCropModalOpen(false);
      } else if (showDeleteModal) {
        setShowDeleteModal(false);
      } else if (isEditModalOpen) {
        setIsEditModalOpen(false);
        setIsCountryDropdownOpen(false);
      } else {
        navigate("/", { replace: true });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isCropModalOpen, showDeleteModal, isEditModalOpen, navigate]);

  // Controles de gesto táctil de arrastre horizontal en el modal de edición
  const editModalTouchStartXRef = useRef(0);
  const editModalTouchStartYRef = useRef(0);
  const editModalTouchStartTimeRef = useRef(0);

  const handleEditModalTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      editModalTouchStartXRef.current = e.touches[0].clientX;
      editModalTouchStartYRef.current = e.touches[0].clientY;
      editModalTouchStartTimeRef.current = Date.now();
    }
  };

  const handleEditModalTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - editModalTouchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - editModalTouchStartYRef.current;
    const elapsed = Date.now() - editModalTouchStartTimeRef.current;

    // Gesto de swipe fluido hacia la derecha desde el margen izquierdo (< 100px)
    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && editModalTouchStartXRef.current < 100) {
      handleCloseEditModal();
    }
  };

  // Sincronizar formularios al cambiar el usuario activo
  useEffect(() => {
    if (currentUser) {
      const parsed = parsePhoneInput(currentUser.phone);
      setSelectedCountryId(parsed.countryId);
      setPhoneDigits(parsed.rawDigits);

      setProfileForm({
        displayName: currentUser.displayName || (currentUser.name && !currentUser.name.startsWith("@") ? currentUser.name : ""),
        phone: currentUser.phone || "",
        avatar: currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
      });
      setEmailForm(currentUser.email || "");
    }
  }, [currentUser]);

  // Cambio de país en el selector telefónico y reformateo automático
  const handleCountryChange = (newCountryId) => {
    setSelectedCountryId(newCountryId);

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

    // Detectar si el usuario pegó un número con código internacional de país
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

    // Si pegó el código sin el símbolo "+"
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

  // Manejo de carga de nueva foto de perfil: abre modal de recorte manual
  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        setCropImageSrc(uploadEvent.target.result);
        window.history.pushState({ modal: "avatar-crop" }, "");
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Aplicar foto de perfil recortada
  const handleApplyAvatarCrop = (croppedDataUrl) => {
    setProfileForm((prev) => ({ ...prev, avatar: croppedDataUrl }));
    handleCloseCropModal();
  };

  // Sincronizar en tiempo real cuando se publica un producto, se actualizan favoritos o hay mensajes
  useEffect(() => {
    const handleUpdate = () => {
      setAllProducts(getStoredProducts());
      setFavoriteProducts(getFavoriteProducts(currentUser));
      setUnreadChatCount(getTotalUnreadCount(currentUser));
    };

    setUnreadChatCount(getTotalUnreadCount(currentUser));

    window.addEventListener("anunciossv_products_updated", handleUpdate);
    window.addEventListener(FAVORITES_EVENT, handleUpdate);
    window.addEventListener(CHAT_EVENT, handleUpdate);
    return () => {
      window.removeEventListener("anunciossv_products_updated", handleUpdate);
      window.removeEventListener(FAVORITES_EVENT, handleUpdate);
      window.removeEventListener(CHAT_EVENT, handleUpdate);
    };
  }, [currentUser]);

  // Guardar datos básicos de perfil (nombre de pila, teléfono y foto de perfil)
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
      setProfileSuccessMsg("¡Información y foto de perfil actualizadas con éxito!");
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err) {
      setProfileErrorMsg(err.message || "Error al actualizar la información.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Actualizar correo electrónico (efecto en Auth y Firestore)
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailSuccessMsg(null);
    setEmailErrorMsg(null);
    setIsUpdatingEmail(true);

    try {
      await updateUserEmail(emailForm);
      setEmailSuccessMsg("¡Correo electrónico actualizado con éxito en Firestore!");
      setTimeout(() => setEmailSuccessMsg(null), 4000);
    } catch (err) {
      setEmailErrorMsg(err.message || "Error al actualizar el correo electrónico.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Actualizar contraseña (efecto en Auth)
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

  // Confirmar eliminación de cuenta (Danger Zone con efecto en Firestore y Auth)
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

  // Sincronización en tiempo real de bloqueos y mensajes no leídos
  useEffect(() => {
    setBlockedUsers(getBlockedUsers(currentUser));
    setUnreadChatCount(getTotalUnreadCount(currentUser));

    const handleChatUpdate = () => {
      setBlockedUsers(getBlockedUsers(currentUser));
      setUnreadChatCount(getTotalUnreadCount(currentUser));
    };

    window.addEventListener(CHAT_EVENT, handleChatUpdate);
    return () => window.removeEventListener(CHAT_EVENT, handleChatUpdate);
  }, [currentUser]);

  // Desbloquear usuario desde el perfil
  const handleUnblockUser = (userId) => {
    setUnblockingId(userId);
    unblockUser(userId, currentUser);
    setBlockedUsers(getBlockedUsers(currentUser));
    setTimeout(() => setUnblockingId(null), 300);
  };

  // Eliminar un borrador guardado
  const handleDeleteDraft = async (draftId) => {
    if (window.confirm("¿Deseas descartar y eliminar este borrador de forma permanente?")) {
      await deleteProduct(draftId);
      setAllProducts(getStoredProducts());
    }
  };

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
            onClick={() => navigate("/login", { state: { from: { pathname: "/profile" } } })}
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
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative flex-shrink-0">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-lg"
              />
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-extrabold text-white truncate">{currentUser.name}</h2>
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              </div>
              <div className="text-xs text-slate-400 truncate">{currentUser.email}</div>

              <div className="mt-1 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isAdmin
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

          {/* Botón en el lado superior derecho para editar datos de la cuenta */}
          <button
            type="button"
            onClick={handleOpenEditModal}
            className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shadow-md transition-all active:scale-95 flex-shrink-0"
            title="Editar datos de la cuenta"
            aria-label="Editar datos de la cuenta"
          >
            <Edit3 className="w-4 h-4 text-indigo-400" />
          </button>
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

      {/* Acceso directo a la Bandeja de Mensajes internos */}
      <Link
        to="/messages"
        className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 flex items-center justify-between gap-3 transition-all active:scale-[0.99] shadow-sm"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Bandeja de Mensajes</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black shadow-sm">
                  {unreadChatCount} {unreadChatCount === 1 ? "nuevo" : "nuevos"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {unreadChatCount > 0
                ? "Tienes consultas pendientes por revisar"
                : "Conversaciones con compradores y vendedores"}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </Link>

      {/* Pestañas de contenido (altura táctil optimizada min-h-[42px]) */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => handleTabChange("posts")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${activeTab === "posts"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
            }`}
        >
          Mis Anuncios ({userProducts.length})
        </button>
        <button
          onClick={() => handleTabChange("saved")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${activeTab === "saved"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
            }`}
        >
          Favoritos ({favoriteProducts.length})
        </button>
        <button
          onClick={() => handleTabChange("settings")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${activeTab === "settings"
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
          {/* Indicador de límite diario de publicaciones */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">Publicaciones hoy:</span>
              <span className="font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px]">
                {canUserPublishToday(currentUser).count} de {DAILY_PUBLICATION_LIMIT}
              </span>
            </div>
            <Link
              to="/publish"
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95 transition-transform"
            >
              <span>+ Publicar anuncio</span>
            </Link>
          </div>

          {userProducts.length > 0 ? (
            userProducts.map((prod) => {
              const isDraft = prod.status === "borrador";
              const targetLink = isDraft ? `/publish?draftId=${prod.id}` : `/product/${prod.id}?from=profile&tab=posts`;
              const targetState = { from: "/profile", fromProfile: true, tab: "posts" };

              return (
                <div
                  key={prod.id}
                  className={`p-3 rounded-xl bg-slate-900 border flex items-center justify-between gap-3 shadow-sm transition-all ${
                    isDraft
                      ? "border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <Link
                    to={targetLink}
                    state={targetState}
                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0 block"
                  >
                    <img
                      src={prod.image || (prod.images && prod.images[0])}
                      alt={prod.title}
                      className="w-full h-full object-cover"
                    />
                    {prod.featured && (
                      <span className="absolute top-1 right-1 p-0.5 rounded bg-amber-500 text-slate-950">
                        <Sparkles className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={targetLink} state={{ from: "/profile", tab: "posts" }} className="block">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white truncate hover:text-indigo-300 transition-colors">
                          {prod.title || "Borrador sin título"}
                        </h4>
                        {prod.featured && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            DESTACADO
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="text-xs font-semibold text-indigo-400 mt-0.5">
                      {(() => {
                        const priceInfo = formatProductPrice(prod);
                        if (priceInfo.isContact) return "💬 A consultar";
                        if (priceInfo.isFree) return "GRATIS";
                        return `${priceInfo.text} ${priceInfo.currency || "USD"}${priceInfo.periodSuffix || ""}`;
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {isDraft ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                          <span>📝</span>
                          <span>Borrador</span>
                        </span>
                      ) : prod.status === "pausado" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                          ⏸ Pausado
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                          ✓ Activo
                        </span>
                      )}
                      {!isDraft && (
                        <span className="text-[10px] text-slate-500">{prod.viewsCount || 0} visitas</span>
                      )}
                      {prod.condition && (
                        <span className="text-[10px] text-slate-400">· {prod.condition}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {isDraft ? (
                      <>
                        <Link
                          to={`/publish?draftId=${prod.id}`}
                          className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white transition-colors flex items-center justify-center"
                          title="Continuar editando borrador"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(prod.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors flex items-center justify-center"
                          title="Eliminar borrador"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to={`/manage-product/${prod.id}?from=profile&tab=posts`}
                          state={{ from: "/profile", fromProfile: true, tab: "posts" }}
                          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition-colors flex items-center justify-center shadow-sm active:scale-95"
                          title="Gestionar anuncio"
                          aria-label="Gestionar anuncio"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/product/${prod.id}?from=profile&tab=posts`}
                          state={{ from: "/profile", fromProfile: true, tab: "posts" }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center shadow-sm active:scale-95"
                          title="Ver en detalle"
                          aria-label="Ver en detalle"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })
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
        <div className="space-y-2.5 animate-fade-in">
          {favoriteProducts.length > 0 ? (
            favoriteProducts.map((prod) => {
              const productSavedLink = `/product/${prod.id}?from=profile&tab=saved`;
              const productSavedState = { from: "/profile", fromProfile: true, tab: "saved" };

              return (
                <div
                  key={prod.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-all"
                >
                  <Link
                    to={productSavedLink}
                    state={productSavedState}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0 block"
                  >
                    <img
                      src={prod.image || (prod.images && prod.images[0])}
                      alt={prod.title}
                      className="w-full h-full object-cover"
                    />
                    {prod.featured && (
                      <span className="absolute top-1 right-1 p-0.5 rounded bg-amber-500 text-slate-950">
                        <Sparkles className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link to={productSavedLink} state={productSavedState} className="block">
                      <h4 className="text-xs font-bold text-white truncate hover:text-indigo-300 transition-colors">
                        {prod.title}
                      </h4>
                    </Link>

                  <div className="text-xs font-semibold text-indigo-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {(() => {
                      const priceInfo = formatProductPrice(prod);
                      if (priceInfo.isContact) {
                        return (
                          <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-500/30">
                            💬 A consultar
                          </span>
                        );
                      }
                      if (priceInfo.isFree) {
                        return <span className="text-emerald-400 font-bold">GRATIS</span>;
                      }
                      return (
                        <span>
                          {priceInfo.text} {priceInfo.currency || "USD"}{priceInfo.periodSuffix || ""}
                        </span>
                      );
                    })()}
                    {prod.isNegotiable && !prod.isFree && !prod.isContactPrice && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                        Negociable
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className="truncate max-w-[130px]">{prod.location}</span>
                    {prod.condition && <span>· {prod.condition}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleFavoriteProduct(prod.id, currentUser)}
                    className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors active:scale-95"
                    title="Quitar de favoritos"
                    aria-label="Quitar de favoritos"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </button>

                  <Link
                    to={productSavedLink}
                    state={productSavedState}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Ver en detalle"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <Heart className="w-6 h-6 fill-rose-500/20" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">No tienes anuncios guardados</h4>
                <p className="mt-1 text-slate-400">
                  Presiona el corazón en cualquier publicación del feed para guardarla aquí y consultarla cuando quieras.
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <span>Explorar Anuncios</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Contenido de la pestaña Cuenta: Solo resumen de la cuenta y botón de cerrar sesión */}
      {activeTab === "settings" && (
        <div className="space-y-4 animate-fade-in pb-8">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-sm">
            <div className="pb-1 border-b border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Información de la Cuenta
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Nombre de pila</span>
                <span className="text-slate-200 font-semibold truncate max-w-[200px]">
                  {currentUser.displayName || currentUser.name || "No especificado"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Nombre de usuario</span>
                <span className="text-slate-200 font-semibold font-mono">
                  {currentUser.username ? `@${currentUser.username}` : "@usuario"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Correo Electrónico</span>
                <span className="text-slate-200 font-semibold truncate max-w-[200px]">
                  {currentUser.email || "No especificado"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Teléfono de contacto</span>
                <span className="text-slate-200 font-semibold">
                  {currentUser.phone || "No configurado"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Rol en la plataforma</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAdmin ? "text-purple-300 bg-purple-950/60 border border-purple-800" : "text-blue-300 bg-blue-950/60 border border-blue-800"
                  }`}>
                  {isAdmin ? "👑 Webmaster (Admin)" : "👤 Usuario Estándar"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Estado de cuenta</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Activa</span>
                </span>
              </div>
            </div>
          </div>

          {/* Acceso a Usuarios Bloqueados (diseño idéntico a Bandeja de Mensajes) */}
          <Link
            to="/blocked-users"
            className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-rose-950/30 border border-slate-800 hover:border-rose-500/40 flex items-center justify-between gap-3 transition-all active:scale-[0.99] shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Usuarios Bloqueados</span>
                  {blockedUsers.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black shadow-sm">
                      {blockedUsers.length}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {blockedUsers.length > 0
                    ? `${blockedUsers.length} contacto${blockedUsers.length === 1 ? "" : "s"} restringido${blockedUsers.length === 1 ? "" : "s"}`
                    : "Administra las cuentas restringidas para enviarte mensajes"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </Link>

          {/* Botón de Cerrar Sesión */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition-all active:scale-[0.99] shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal para Editar Datos de la Cuenta y Foto de Perfil */}
      {isEditModalOpen && (
        <div
          onTouchStart={handleEditModalTouchStart}
          onTouchEnd={handleEditModalTouchEnd}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
        >
          <div className="w-full max-w-md max-h-[90vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl animate-slide-up sm:animate-scale-up overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/95 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Editar Datos de la Cuenta</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido scrolleable del Modal */}
            <div className="p-5 space-y-4 overflow-y-auto no-scrollbar">
              {/* Selector de Foto de Perfil */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2.5">
                <div className="relative w-20 h-20 mx-auto">
                  <img
                    src={profileForm.avatar}
                    alt="Foto de perfil"
                    className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md border-2 border-slate-950 transition-all active:scale-95"
                    title="Cambiar foto de perfil"
                    aria-label="Cambiar foto de perfil"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  Cambiar foto de perfil
                </button>
              </div>

              {/* 1. Información General de Perfil */}
              <form onSubmit={handleSaveProfile} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>Información de Contacto</span>
                </h4>

                {profileSuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{profileSuccessMsg}</span>
                  </div>
                )}
                {profileErrorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{profileErrorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nombre de pila <span className="text-[10px] text-slate-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                    placeholder="Ej. Carlos Méndez"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Número de teléfono <span className="text-[10px] text-slate-500 font-normal">(Opcional)</span>
                  </label>
                  <div className="flex rounded-xl bg-slate-900 border border-slate-800 focus-within:border-indigo-500 transition-all">
                    {/* Selector estilizado de país (solo bandera y código, sin nombre) */}
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
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCountryDropdownOpen ? "rotate-180 text-indigo-400" : ""
                          }`}
                      />
                    </button>

                    {/* Input de número formateado automáticamente */}
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
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{isUpdatingProfile ? "Guardando..." : "Guardar Información"}</span>
                </button>
              </form>

              {/* 2. Cambiar Correo Electrónico */}
              <form onSubmit={handleUpdateEmail} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>Correo Electrónico</span>
                </h4>

                {emailSuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{emailSuccessMsg}</span>
                  </div>
                )}
                {emailErrorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{emailErrorMsg}</span>
                  </div>
                )}

                <div>
                  <input
                    type="email"
                    required
                    value={emailForm}
                    onChange={(e) => setEmailForm(e.target.value)}
                    placeholder="tu_correo@ejemplo.com"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
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
              <form onSubmit={handleUpdatePassword} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  <span>Cambiar Contraseña</span>
                </h4>

                {passwordSuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{passwordSuccessMsg}</span>
                  </div>
                )}
                {passwordErrorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
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
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
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
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
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
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/30 space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Zona de Peligro (Danger Zone)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleOpenDeleteModal}
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar mi Cuenta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Cuenta (Danger Zone) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-rose-500/40 p-5 space-y-4 shadow-2xl animate-scale-up">
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
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                {deleteErrorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleCloseDeleteModal}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleConfirmDeleteAccount}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAccount ? "Eliminando..." : "Sí, Eliminar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menú desplegable estilizado para selección de código de país montado en portal */}
      {isCountryDropdownOpen &&
        createPortal(
          <div
            ref={countryDropdownRef}
            style={{
              position: "fixed",
              top: countryCoords.top !== undefined ? `${countryCoords.top}px` : "auto",
              bottom: countryCoords.bottom !== undefined ? `${countryCoords.bottom}px` : "auto",
              left: `${countryCoords.left}px`,
              width: `${countryCoords.width}px`,
              zIndex: 99999
            }}
            className="rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div
              style={{ maxHeight: `${countryCoords.maxHeight}px` }}
              className="p-1.5 overflow-y-auto no-scrollbar space-y-1"
            >
              {COUNTRY_PHONE_CONFIGS.map((country) => {
                const isSelected = country.id === selectedCountryId;
                const displayCode = country.codeDisplay || country.code;
                return (
                  <button
                    key={country.id}
                    type="button"
                    onClick={() => {
                      handleCountryChange(country.id);
                      setIsCountryDropdownOpen(false);
                    }}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs flex items-center justify-between text-left transition-all ${isSelected
                        ? "bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30"
                        : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{country.flag}</span>
                      <span className="font-mono font-bold text-xs">{displayCode}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {/* Modal interactivo para recortar y encuadrar manualmente foto de perfil */}
      <AvatarCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSrc}
        onClose={handleCloseCropModal}
        onApplyCrop={handleApplyAvatarCrop}
      />
    </div>
  );
};

export default ProfilePage;
