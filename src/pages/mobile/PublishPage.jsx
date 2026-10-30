// Vista simplificada y limpia de publicación de clasificados en AnunciosSV
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isFirebaseConfigured, db } from "../../services/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  CheckCircle2,
  DollarSign,
  MapPin,
  LogIn,
  Camera,
  Plus,
  AlertCircle,
  Star,
  Store,
  Truck,
  Boxes,
  Check,
  ArrowRight,
  Sparkles,
  Zap,
  MessageCircle,
  ArrowLeftRight,
  Calendar,
  Clock,
  Mail,
  Trash2
} from "lucide-react";
import { CustomSelect } from "../../components/common/CustomSelect";
import { PhotoCarouselModal } from "../../components/mobile/PhotoCarouselModal";
import {
  PUBLICATION_HIERARCHY,
  EL_SALVADOR_DEPARTMENTS,
  PRODUCT_CONDITIONS
} from "../../services/mockData";
import {
  saveNewProduct,
  updateProduct,
  getProductById,
  formatMoney,
  DAILY_PUBLICATION_LIMIT,
  canUserPublishToday,
  fetchServerTimestamp,
  getMillisecondsUntilNextMidnight,
  formatTimeUntilMidnight
} from "../../services/productsService";
import { compressImage } from "../../utils/imageCompressor";

// Opciones de preferencias de entrega para productos
const DELIVERY_OPTIONS = [
  {
    id: "public_place",
    label: "Lugar Público",
    detail: "Acordar punto con el vendedor",
    icon: MapPin
  },
  {
    id: "pickup",
    label: "Retiro en Local",
    detail: "En tienda o ubicación física",
    icon: Store
  },
  {
    id: "shipping",
    label: "Envío",
    detail: "Si se ofrece envío o encomienda",
    icon: Truck
  }
];

export const PublishPage = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Origen de navegación asegurado (perfil vs producto) para garantizar retorno exacto
  const initialOriginRef = useRef(
    searchParams.get("from") ||
    (location.state?.fromProfile ? "profile" : null) ||
    (location.state?.fromProduct ? "product" : null) ||
    (location.state?.from === "/profile" ? "profile" : null) ||
    (searchParams.get("edit") ? "profile" : null)
  );

  // Paso actual sincronizado con la URL (?step=promote para el paso 2)
  const isPromoteStep = searchParams.get("step") === "promote";
  const [isFeatured, setIsFeatured] = useState(false);
  const [wasOriginallyFeatured, setWasOriginallyFeatured] = useState(false);
  const originalFeaturedTimestampRef = useRef(null);

  // Estados del formulario
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    currency: "USD",
    description: ""
  });

  // Galería de fotos (hasta 5 fotos)
  const [photos, setPhotos] = useState([
    "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80"
  ]);
  const [photoError, setPhotoError] = useState(null);
  const [replaceIndex, setReplaceIndex] = useState(null);

  // Estado del Carrete / Modal de imágenes
  const [isCarreteOpen, setIsCarreteOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  // Referencias para auto-scroll suave hacia los campos faltantes
  const photosSectionRef = useRef(null);
  const titleInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const deliverySectionRef = useRef(null);
  const descriptionInputRef = useRef(null);

  // Errores específicos de campos para validación visual
  const [formErrors, setFormErrors] = useState({
    title: null,
    price: null,
    quantity: null,
    delivery: null,
    description: null
  });

  // Modo edición (?edit=id) o continuación de borrador (?draftId=id)
  const editId = searchParams.get("edit");
  const draftId = searchParams.get("draftId");
  const targetId = editId || draftId;
  const isDraftEditing = Boolean(draftId);
  const [isEditing, setIsEditing] = useState(Boolean(targetId));

  // Control del modal de confirmación para descartar cambios
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Modalidades de precio: "fixed" (precio fijo), "range" (rango de precios), "contact" (solicitar precio por mensaje)
  const [priceMode, setPriceMode] = useState("fixed"); // "fixed" | "range" | "contact"
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  // Frecuencia para alquiler: "mes" (mensual) o "año" (anual)
  const [rentPeriod, setRentPeriod] = useState("mes");
  // Modalidad de pago para servicios: "unico" (un solo pago / ocasión), "mes" (mensual / recurrente), "año" (anual / recurrente)
  const [servicePaymentType, setServicePaymentType] = useState("unico");

  const [mainCategory, setMainCategory] = useState("producto");
  const [subcategory, setSubcategory] = useState("tech");
  const [department, setDepartment] = useState("San Salvador");
  const [exactLocation, setExactLocation] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [itemCondition, setItemCondition] = useState("Nuevo");
  const [isSingleItem, setIsSingleItem] = useState(true);
  const [availableQuantity, setAvailableQuantity] = useState("1");
  const [deliveryPreferences, setDeliveryPreferences] = useState(["public_place"]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishedItem, setPublishedItem] = useState(null);

  // Control del límite diario de publicaciones (máximo 3 anuncios al día por usuario)
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [dailyLimitStatus, setDailyLimitStatus] = useState(() => canUserPublishToday(currentUser));
  const dailyLimitStatusRef = useRef(dailyLimitStatus);

  // Reloj de cuenta regresiva sincronizado con el servidor para la renovación del límite a medianoche
  const [countdownText, setCountdownText] = useState(() => {
    return formatTimeUntilMidnight(getMillisecondsUntilNextMidnight());
  });

  useEffect(() => {
    dailyLimitStatusRef.current = dailyLimitStatus;
  }, [dailyLimitStatus]);

  // Sincronizar en tiempo real el contador diario al cambiar de usuario o modificarse publicaciones
  useEffect(() => {
    const refreshDailyLimit = () => {
      setDailyLimitStatus(canUserPublishToday(currentUser));
    };

    refreshDailyLimit();
    window.addEventListener("anunciossv_products_updated", refreshDailyLimit);
    return () => window.removeEventListener("anunciossv_products_updated", refreshDailyLimit);
  }, [currentUser]);

  // Contador de cuenta regresiva segundo a segundo protegido contra manipulación del reloj local
  useEffect(() => {
    let isCancelled = false;

    // Sincronizar con la hora del servidor al montar
    fetchServerTimestamp().then(() => {
      if (!isCancelled) {
        setCountdownText(formatTimeUntilMidnight(getMillisecondsUntilNextMidnight()));
      }
    });

    const timer = setInterval(() => {
      const remainingMs = getMillisecondsUntilNextMidnight();
      if (remainingMs <= 0) {
        // Al llegar a la medianoche (00:00), recargar cupo
        setDailyLimitStatus(canUserPublishToday(currentUser));
      }
      setCountdownText(formatTimeUntilMidnight(remainingMs));
    }, 1000);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [currentUser]);

  // Verificación de número telefónico registrado en el perfil del vendedor
  const userPhone = (currentUser?.phone || "").trim();
  const hasUserPhone = Boolean(userPhone.length > 0);

  // Opciones de contacto para compradores (WhatsApp y Correo Electrónico)
  const [allowEmailContact, setAllowEmailContact] = useState(true);
  const [allowWhatsappContact, setAllowWhatsappContact] = useState(() => Boolean(currentUser?.phone && currentUser.phone.trim().length > 0));

  // Asegurar que si el usuario no tiene teléfono registrado, no se pueda activar WhatsApp
  useEffect(() => {
    if (!hasUserPhone && allowWhatsappContact) {
      setAllowWhatsappContact(false);
    }
  }, [hasUserPhone, allowWhatsappContact]);

  // Referencias para control de cambios (snapshot) y navegación en el historial
  const initialSnapshotRef = useRef(null);
  const hasHistoryGuardRef = useRef(false);
  const isPromoteStepRef = useRef(isPromoteStep);
  const showDiscardModalRef = useRef(showDiscardModal);

  useEffect(() => {
    isPromoteStepRef.current = isPromoteStep;
  }, [isPromoteStep]);

  useEffect(() => {
    showDiscardModalRef.current = showDiscardModal;
  }, [showDiscardModal]);

  // Genera un snapshot serializado del formulario para detectar si el usuario ha realizado modificaciones
  const buildFormSnapshot = (customValues = {}) => {
    const curFormData = customValues.formData || formData;
    const curPhotos = customValues.photos !== undefined ? customValues.photos : photos;
    const curMainCategory = customValues.mainCategory !== undefined ? customValues.mainCategory : mainCategory;
    const curSubcategory = customValues.subcategory !== undefined ? customValues.subcategory : subcategory;
    const curDepartment = customValues.department !== undefined ? customValues.department : department;
    const curExactLocation = customValues.exactLocation !== undefined ? customValues.exactLocation : exactLocation;
    const curPriceMode = customValues.priceMode !== undefined ? customValues.priceMode : priceMode;
    const curMinPrice = customValues.minPrice !== undefined ? customValues.minPrice : minPrice;
    const curMaxPrice = customValues.maxPrice !== undefined ? customValues.maxPrice : maxPrice;
    const curRentPeriod = customValues.rentPeriod !== undefined ? customValues.rentPeriod : rentPeriod;
    const curServicePaymentType = customValues.servicePaymentType !== undefined ? customValues.servicePaymentType : servicePaymentType;
    const curIsFree = customValues.isFree !== undefined ? customValues.isFree : isFree;
    const curIsNegotiable = customValues.isNegotiable !== undefined ? customValues.isNegotiable : isNegotiable;
    const curItemCondition = customValues.itemCondition !== undefined ? customValues.itemCondition : itemCondition;
    const curIsSingleItem = customValues.isSingleItem !== undefined ? customValues.isSingleItem : isSingleItem;
    const curAvailableQuantity = customValues.availableQuantity !== undefined ? customValues.availableQuantity : availableQuantity;
    const curDeliveryPreferences = customValues.deliveryPreferences !== undefined ? customValues.deliveryPreferences : deliveryPreferences;
    const curAllowEmailContact = customValues.allowEmailContact !== undefined ? customValues.allowEmailContact : allowEmailContact;
    const curAllowWhatsappContact = customValues.allowWhatsappContact !== undefined ? customValues.allowWhatsappContact : allowWhatsappContact;
    const curIsFeatured = customValues.isFeatured !== undefined ? customValues.isFeatured : isFeatured;

    return JSON.stringify({
      title: (curFormData.title || "").trim(),
      price: (curFormData.price || "").trim(),
      currency: curFormData.currency || "USD",
      description: (curFormData.description || "").trim(),
      photos: (curPhotos || []).filter(Boolean),
      mainCategory: curMainCategory,
      subcategory: curSubcategory,
      department: curDepartment,
      exactLocation: (curExactLocation || "").trim(),
      priceMode: curPriceMode,
      minPrice: String(curMinPrice || "").trim(),
      maxPrice: String(curMaxPrice || "").trim(),
      rentPeriod: curRentPeriod,
      servicePaymentType: curServicePaymentType,
      isFree: Boolean(curIsFree),
      isNegotiable: Boolean(curIsNegotiable),
      itemCondition: curItemCondition,
      isSingleItem: Boolean(curIsSingleItem),
      availableQuantity: String(curAvailableQuantity || "1"),
      deliveryPreferences: [...(curDeliveryPreferences || [])].sort(),
      allowEmailContact: Boolean(curAllowEmailContact),
      allowWhatsappContact: Boolean(curAllowWhatsappContact),
      isFeatured: Boolean(curIsFeatured)
    });
  };

  // Cargar datos previos si se está editando una publicación existente o continuando un borrador
  useEffect(() => {
    if (targetId) {
      const prod = getProductById(targetId);
      if (prod) {
        setIsEditing(true);
        const loadedTitle = prod.title || "";
        const loadedCurrency = prod.currency?.replace(/\/mes|\/año/g, "") || "USD";
        const loadedDescription = prod.description || "";
        const loadedPhotos = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images : (prod.image ? [prod.image] : []);
        const loadedMainCategory = prod.mainCategory || "producto";
        const loadedSubcategory = prod.category || prod.subcategory || "tech";
        const loadedDepartment = prod.department || "San Salvador";
        const loadedExactLocation = prod.exactLocation || "";
        const loadedCondition = prod.condition || "Nuevo";
        const loadedIsSingleItem = prod.isSingleItem !== undefined ? prod.isSingleItem : true;
        const loadedAvailableQuantity = prod.availableQuantity ? String(prod.availableQuantity) : "1";
        const loadedDelivery = prod.deliveryPreferences || ["public_place"];
        const isAlreadyFeatured = Boolean(prod.featured);
        const loadedFeatured = isAlreadyFeatured;
        setWasOriginallyFeatured(isAlreadyFeatured);
        originalFeaturedTimestampRef.current = prod.featuredTimestamp || null;
        const loadedAllowEmail = prod.allowEmailContact !== undefined ? Boolean(prod.allowEmailContact) : true;
        const loadedAllowWhatsapp = prod.allowWhatsappContact !== undefined ? (hasUserPhone ? Boolean(prod.allowWhatsappContact) : false) : false;

        let loadedPriceMode = "fixed";
        let loadedMinPrice = "";
        let loadedMaxPrice = "";
        let loadedIsFree = false;
        let loadedIsNegotiable = false;

        if (prod.priceMode === "contact" || prod.isContactPrice || prod.priceType === "contact") {
          loadedPriceMode = "contact";
        } else if (
          prod.priceMode === "range" ||
          (Boolean(prod.isPriceRange) &&
            prod.priceMode !== "fixed" &&
            prod.minPrice != null &&
            prod.maxPrice != null &&
            Number(prod.maxPrice) > 0)
        ) {
          loadedPriceMode = "range";
          loadedMinPrice = String(prod.minPrice ?? "");
          loadedMaxPrice = String(prod.maxPrice ?? "");
        } else {
          loadedPriceMode = "fixed";
          loadedIsFree = Boolean(prod.isFree);
          loadedIsNegotiable = Boolean(prod.isNegotiable);
        }

        const loadedPrice =
          loadedPriceMode === "fixed" && !loadedIsFree && prod.price !== undefined && prod.price !== null
            ? String(prod.price)
            : "";

        const loadedRentPeriod = prod.rentPeriod || "mes";
        const loadedServicePaymentType = prod.servicePaymentType || "unico";

        setFormData({
          title: loadedTitle,
          price: loadedPrice,
          currency: loadedCurrency,
          description: loadedDescription
        });
        setPhotos(loadedPhotos);
        setMainCategory(loadedMainCategory);
        setSubcategory(loadedSubcategory);
        setDepartment(loadedDepartment);
        setExactLocation(loadedExactLocation);
        setItemCondition(loadedCondition);
        setIsSingleItem(loadedIsSingleItem);
        setAvailableQuantity(loadedAvailableQuantity);
        setDeliveryPreferences(loadedDelivery);
        setIsFeatured(loadedFeatured);
        setAllowEmailContact(loadedAllowEmail);
        setAllowWhatsappContact(loadedAllowWhatsapp);
        setPriceMode(loadedPriceMode);
        setMinPrice(loadedMinPrice);
        setMaxPrice(loadedMaxPrice);
        setIsFree(loadedIsFree);
        setIsNegotiable(loadedIsNegotiable);
        setRentPeriod(loadedRentPeriod);
        setServicePaymentType(loadedServicePaymentType);

        // Guardar snapshot inicial del borrador o producto para detectar SOLO cambios nuevos
        initialSnapshotRef.current = buildFormSnapshot({
          formData: {
            title: loadedTitle,
            price: loadedPrice,
            currency: loadedCurrency,
            description: loadedDescription
          },
          photos: loadedPhotos,
          mainCategory: loadedMainCategory,
          subcategory: loadedSubcategory,
          department: loadedDepartment,
          exactLocation: loadedExactLocation,
          itemCondition: loadedCondition,
          isSingleItem: loadedIsSingleItem,
          availableQuantity: loadedAvailableQuantity,
          deliveryPreferences: loadedDelivery,
          isFeatured: loadedFeatured,
          allowEmailContact: loadedAllowEmail,
          allowWhatsappContact: loadedAllowWhatsapp,
          priceMode: loadedPriceMode,
          minPrice: loadedMinPrice,
          maxPrice: loadedMaxPrice,
          isFree: loadedIsFree,
          isNegotiable: loadedIsNegotiable,
          rentPeriod: loadedRentPeriod,
          servicePaymentType: loadedServicePaymentType
        });
      }
    } else {
      // Para nueva publicación en blanco, capturar snapshot inicial limpio si aún no existe
      if (!initialSnapshotRef.current) {
        initialSnapshotRef.current = buildFormSnapshot();
      }
    }
  }, [targetId, hasUserPhone]);

  // Determina si el formulario contiene modificaciones respecto al estado inicial
  const isFormDirty = () => {
    if (submitted) return false;
    if (!initialSnapshotRef.current) return false;
    return buildFormSnapshot() !== initialSnapshotRef.current;
  };

  // Proteger la sesión de historial una sola vez cuando el formulario contenga modificaciones (solo en nuevas publicaciones)
  useEffect(() => {
    if (!targetId && isFormDirty() && !hasHistoryGuardRef.current && !submitted) {
      window.history.pushState({ isPublishGuarded: true }, "");
      hasHistoryGuardRef.current = true;
    }
  }, [
    targetId,
    formData,
    photos,
    exactLocation,
    minPrice,
    maxPrice,
    priceMode,
    mainCategory,
    subcategory,
    department,
    itemCondition,
    isSingleItem,
    availableQuantity,
    deliveryPreferences,
    allowEmailContact,
    allowWhatsappContact,
    isFeatured,
    isFree,
    isNegotiable,
    rentPeriod,
    servicePaymentType,
    submitted
  ]);

  // Interceptar eventos de retorno para consultar si descartar o regresar al paso 1
  useEffect(() => {
    const handleBackRequested = () => {
      // 0. Si se muestra el cartel de límite diario (no hay formulario en curso):
      // retornar atrás hacia el Feed directamente
      if (!isEditing && !editId && !dailyLimitStatusRef.current?.allowed) {
        navigate("/", { replace: true });
        return;
      }

      // 1. Si está en el Paso 2 (Promocionar publicación): regresar a la edición del formulario (Paso 1)
      if (isPromoteStepRef.current || isPromoteStep || searchParams.get("step") === "promote") {
        isPromoteStepRef.current = false;
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          const originFrom = initialOriginRef.current;
          const nextParams = {};
          if (draftId) nextParams.draftId = draftId;
          if (editId) nextParams.edit = editId;
          if (originFrom) nextParams.from = originFrom;
          setSearchParams(nextParams, { replace: true });
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // 2. Si el modal de confirmación ya está visible en pantalla: cerrarlo y seguir editando
      if (showDiscardModalRef.current) {
        setShowDiscardModal(false);
        setPendingNavigation(null);
        return;
      }

      // 3. Al editar publicaciones existentes (targetId): NO se muestra diálogo de descarte,
      // sale directamente al Centro de Control (ManageProductPage) con los parámetros exactos
      if (targetId) {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          const origin = initialOriginRef.current || (searchParams.get("from") === "product" ? "product" : "profile");
          const isFromProf = origin === "profile";
          navigate(
            editId
              ? `/manage-product/${editId}?from=${isFromProf ? "profile" : "product"}&tab=posts`
              : (isFromProf ? "/profile?tab=posts" : "/"),
            {
              replace: true,
              state: {
                from: isFromProf ? "/profile" : (editId ? `/product/${editId}` : "/"),
                fromProfile: isFromProf,
                fromProduct: !isFromProf,
                tab: isFromProf ? "posts" : undefined
              }
            }
          );
        }
        return;
      }

      // 4. Solo para nuevas publicaciones (pantalla principal de Publicar nuevo anuncio):
      // Si el usuario ingresó datos, consultar descarte hacia el Feed; si no hay datos, ir directo al Feed
      if (isFormDirty()) {
        window.history.pushState({ isPublishModalOpen: true }, "");
        setPendingNavigation("/");
        setShowDiscardModal(true);
      } else {
        navigate("/", { replace: true });
      }
    };

    const handleLeaveRequested = (e) => {
      const targetPath = e.detail?.targetPath || "/";
      // Al editar publicaciones existentes, navegar libremente sin diálogo
      if (targetId) {
        navigate(targetPath);
        return;
      }

      // Solo para nuevas publicaciones con datos no guardados:
      if (isFormDirty()) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        window.history.pushState({ isPublishModalOpen: true }, "");
        setPendingNavigation(targetPath);
        setShowDiscardModal(true);
      } else {
        navigate(targetPath);
      }
    };

    const handlePopState = () => {
      // 0. Si se muestra el cartel de límite diario (no hay formulario en curso):
      if (!isEditing && !editId && !dailyLimitStatusRef.current?.allowed) {
        navigate("/", { replace: true });
        return;
      }

      // 1. Si el modal de confirmación está abierto y se hace gesto táctil de retorno:
      // volver a seguir editando la publicación directamente
      if (showDiscardModalRef.current) {
        setShowDiscardModal(false);
        setPendingNavigation(null);
        return;
      }

      // 2. Si el gesto táctil de retorno ocurre estando en el Paso 2: volver a la edición del formulario (Paso 1)
      if (isPromoteStepRef.current || searchParams.get("step") === "promote") {
        isPromoteStepRef.current = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // 3. Al editar publicaciones existentes: retornar directamente al Centro de Control
      if (targetId) {
        // El navegador por acción nativa de popstate ya desapiló hacia el Centro de Control
        return;
      }

      // 4. Solo para nuevas publicaciones con datos sin guardar:
      if (!targetId && isFormDirty() && !submitted) {
        window.history.pushState({ isPublishModalOpen: true }, "");
        setPendingNavigation("/");
        setShowDiscardModal(true);
      } else if (!targetId) {
        // En pantalla principal de Publicar nuevo anuncio sin datos: llevar al Feed
        navigate("/", { replace: true });
      }
    };

    window.addEventListener("anunciossv_publish_back_requested", handleBackRequested);
    window.addEventListener("anunciossv_publish_leave_requested", handleLeaveRequested);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("anunciossv_publish_back_requested", handleBackRequested);
      window.removeEventListener("anunciossv_publish_leave_requested", handleLeaveRequested);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isPromoteStep, submitted, draftId, targetId, editId]);

  // Descarta los cambios no guardados (aplica para nuevas publicaciones y existentes)
  const handleDiscard = () => {
    setShowDiscardModal(false);
    setSubmitted(true);
    hasHistoryGuardRef.current = false;
    handleResetForm();
    const dest = pendingNavigation || (targetId ? "/profile" : "/");
    navigate(dest, { replace: true });
  };

  // Cierra el modal y permite al usuario continuar editando
  const handleKeepEditing = () => {
    setShowDiscardModal(false);
    setPendingNavigation(null);
  };

  // Desplaza suavemente la pantalla hacia el elemento o sección que requiere atención
  const scrollToTarget = (element, shouldFocus = false) => {
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if (shouldFocus && typeof element.focus === "function") {
      setTimeout(() => {
        try {
          element.focus({ preventScroll: true });
        } catch {
          element.focus();
        }
      }, 350);
    }
  };

  // Subcategorías dinámicas según la categoría seleccionada (Producto o Servicio)
  const currentCategoryGroup =
    PUBLICATION_HIERARCHY.find((c) => c.id === mainCategory) || PUBLICATION_HIERARCHY[0];
  const activeSubcategories = currentCategoryGroup.subcategories;

  const handleMainCategoryChange = (newCatId) => {
    setMainCategory(newCatId);
    const group = PUBLICATION_HIERARCHY.find((c) => c.id === newCatId);
    if (group && group.subcategories.length > 0) {
      setSubcategory(group.subcategories[0].id);
    }
  };

  // Abrir el carrete modal al tocar cualquier miniatura
  const handleOpenCarrete = (index) => {
    setActivePhotoIndex(index);
    setIsCarreteOpen(true);
  };

  // Manejo de carga de nuevas fotos con compresión automática
  const handleAddPhotos = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 5) {
      setPhotoError("Has alcanzado el límite máximo de 5 fotos.");
      e.target.value = "";
      return;
    }

    setPhotoError(null);
    try {
      // Comprimir imagen a resolución optimizada para no superar el límite de 1MB de Firestore
      const compressedDataUrl = await compressImage(file, 1080, 1080, 0.82);
      setPhotos((prev) => {
        if (prev.length >= 5) return prev;
        const updated = [...prev, compressedDataUrl];
        setActivePhotoIndex(updated.length - 1);
        return updated;
      });
    } catch (err) {
      console.warn("Aviso al comprimir foto, usando fallback directo:", err);
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setPhotos((prev) => {
            if (prev.length >= 5) return prev;
            const updated = [...prev, uploadEvent.target.result];
            setActivePhotoIndex(updated.length - 1);
            return updated;
          });
        }
      };
      reader.readAsDataURL(file);
    }

    e.target.value = "";
  };

  // Manejo de reemplazo/cambio de una foto específica
  const handleTriggerReplace = (index) => {
    setReplaceIndex(index);
    replaceInputRef.current?.click();
  };

  const handleReplacePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (file && replaceIndex !== null) {
      setPhotoError(null);
      try {
        const compressedDataUrl = await compressImage(file, 1080, 1080, 0.82);
        setPhotos((prev) => {
          const updated = [...prev];
          updated[replaceIndex] = compressedDataUrl;
          return updated;
        });
        setReplaceIndex(null);
      } catch (err) {
        console.warn("Aviso al reemplazar foto comprimida:", err);
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          if (uploadEvent.target?.result) {
            setPhotos((prev) => {
              const updated = [...prev];
              updated[replaceIndex] = uploadEvent.target.result;
              return updated;
            });
            setReplaceIndex(null);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = "";
  };

  // Acciones invocadas desde el Modal del Carrete
  const handleDeleteFromModal = (indexToDelete) => {
    const updated = photos.filter((_, idx) => idx !== indexToDelete);
    setPhotos(updated);
    if (updated.length === 0) {
      setIsCarreteOpen(false);
      setActivePhotoIndex(0);
    } else if (activePhotoIndex >= updated.length) {
      setActivePhotoIndex(updated.length - 1);
    }
  };

  const handleSetPrimaryFromModal = (indexToPrimary) => {
    if (indexToPrimary === 0) return;
    const target = photos[indexToPrimary];
    const rest = photos.filter((_, idx) => idx !== indexToPrimary);
    setPhotos([target, ...rest]);
    setActivePhotoIndex(0);
  };

  // Manejo de precio: si digita "." se coloca "0.", valida enteros >= 0 y decimales con hasta dos cifras
  const handlePriceChange = (e) => {
    let val = e.target.value;

    if (val === "." || val === ",") {
      val = "0.";
    }

    if (val === "" || /^\d+(\.\d{0,2})?$/.test(val)) {
      setFormData({ ...formData, price: val });
      if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: null }));
    }
  };

  const handlePriceBlur = () => {
    if (formData.price && !isNaN(formData.price)) {
      setFormData({ ...formData, price: parseFloat(formData.price).toFixed(2) });
    }
  };

  const handleMinPriceChange = (e) => {
    let val = e.target.value;
    if (val === "." || val === ",") val = "0.";
    if (val === "" || /^\d+(\.\d{0,2})?$/.test(val)) {
      setMinPrice(val);
      if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: null }));
    }
  };

  const handleMinPriceBlur = () => {
    if (minPrice && !isNaN(minPrice)) {
      setMinPrice(parseFloat(minPrice).toFixed(2));
    }
  };

  const handleMaxPriceChange = (e) => {
    let val = e.target.value;
    if (val === "." || val === ",") val = "0.";
    if (val === "" || /^\d+(\.\d{0,2})?$/.test(val)) {
      setMaxPrice(val);
      if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: null }));
    }
  };

  const handleMaxPriceBlur = () => {
    if (maxPrice && !isNaN(maxPrice)) {
      setMaxPrice(parseFloat(maxPrice).toFixed(2));
    }
  };

  const handleToggleFree = (checked) => {
    setIsFree(checked);
    if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: null }));
    if (checked) {
      setFormData((prev) => ({ ...prev, price: "0.00" }));
      setIsNegotiable(false);
    } else {
      setFormData((prev) => ({ ...prev, price: "" }));
    }
  };

  // Manejo de artículo único y cantidad de unidades disponibles
  const handleToggleSingleItem = (checked) => {
    setIsSingleItem(checked);
    if (formErrors.quantity) setFormErrors((prev) => ({ ...prev, quantity: null }));
    if (checked) {
      setAvailableQuantity("1");
    } else if (availableQuantity === "1") {
      setAvailableQuantity("2");
    }
  };

  const handleQuantityChange = (e) => {
    // Solo permitir números enteros positivos
    const val = e.target.value.replace(/\D/g, "");
    setAvailableQuantity(val);
    if (formErrors.quantity) setFormErrors((prev) => ({ ...prev, quantity: null }));
  };

  const handleQuantityBlur = () => {
    if (!availableQuantity || parseInt(availableQuantity, 10) < 1) {
      setAvailableQuantity("1");
    }
  };

  // Manejo de preferencias de entrega (permite seleccionar múltiples opciones manteniendo al menos una)
  const handleToggleDeliveryOption = (optId) => {
    if (formErrors.delivery) setFormErrors((prev) => ({ ...prev, delivery: null }));
    setDeliveryPreferences((prev) => {
      if (prev.includes(optId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== optId);
      } else {
        return [...prev, optId];
      }
    });
  };

  // Paso 1: Validar el formulario y desplazar suavemente la pantalla hacia el campo faltante
  const handleProceedToPromote = (e) => {
    e.preventDefault();

    // 0. Si es una nueva publicación y ya se alcanzó el límite de 3 anuncios al día, impedir continuar
    if (!isEditing && !editId) {
      const status = canUserPublishToday(currentUser);
      if (!status.allowed) {
        setShowLimitModal(true);
        return;
      }
    }

    // 1. Validar que se haya cargado al menos una foto
    if (photos.length === 0) {
      setPhotoError("Por favor añade al menos una foto para tu publicación.");
      scrollToTarget(photosSectionRef.current);
      return;
    }

    // 2. Validar Título
    if (!formData.title.trim()) {
      setFormErrors((prev) => ({ ...prev, title: "Por favor ingresa un título para tu anuncio." }));
      scrollToTarget(titleInputRef.current, true);
      return;
    }

    // 3. Validar Precio según modalidad elegida
    if (priceMode === "contact") {
      // Precio por mensaje: no se requiere monto numérico
    } else if (priceMode === "range") {
      const numMin = parseFloat(minPrice);
      const numMax = parseFloat(maxPrice);
      if (!minPrice || isNaN(numMin) || numMin <= 0) {
        setFormErrors((prev) => ({ ...prev, price: "Ingresa un precio mínimo válido para el rango." }));
        scrollToTarget(priceInputRef.current, true);
        return;
      }
      if (!maxPrice || isNaN(numMax) || numMax < numMin) {
        setFormErrors((prev) => ({ ...prev, price: "El precio máximo debe ser mayor o igual al precio mínimo." }));
        scrollToTarget(priceInputRef.current, true);
        return;
      }
    } else {
      if (!isFree) {
        const numPrice = parseFloat(formData.price);
        if (!formData.price || isNaN(numPrice) || numPrice <= 0) {
          setFormErrors((prev) => ({ ...prev, price: "Ingresa un precio válido o marca el anuncio como Gratis." }));
          scrollToTarget(priceInputRef.current, true);
          return;
        }
      }
    }

    // 4. Validar Cantidad de unidades (para productos con múltiples unidades)
    if (mainCategory === "producto" && !isSingleItem) {
      const numQty = parseInt(availableQuantity, 10);
      if (!availableQuantity || isNaN(numQty) || numQty < 1) {
        setFormErrors((prev) => ({ ...prev, quantity: "Ingresa una cantidad de unidades válida (mínimo 1)." }));
        scrollToTarget(quantityInputRef.current, true);
        return;
      }
    }

    // 5. Validar Preferencias de Entrega (para productos)
    if (mainCategory === "producto" && (!deliveryPreferences || deliveryPreferences.length === 0)) {
      setFormErrors((prev) => ({ ...prev, delivery: "Selecciona al menos una preferencia de entrega." }));
      scrollToTarget(deliverySectionRef.current);
      return;
    }

    // 6. Validar Descripción
    if (!formData.description.trim()) {
      setFormErrors((prev) => ({ ...prev, description: "Por favor añade una breve descripción de tu publicación." }));
      scrollToTarget(descriptionInputRef.current, true);
      return;
    }

    // Todo completado correctamente: limpiar errores y avanzar al paso de promoción
    setPhotoError(null);
    setFormErrors({
      title: null,
      price: null,
      quantity: null,
      delivery: null,
      description: null
    });
    const originFrom = initialOriginRef.current;
    const nextParams = { step: "promote" };
    if (draftId) nextParams.draftId = draftId;
    if (editId) nextParams.edit = editId;
    if (originFrom) nextParams.from = originFrom;
    setSearchParams(nextParams, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Paso 2: Guardado final de la publicación en Firestore (con o sin destaque)
  const handleFinalPublish = async (featured = false) => {
    // Si no es edición y se alcanzó el límite diario de 3 publicaciones, impedir publicar
    if (!isEditing && !editId) {
      const status = canUserPublishToday(currentUser);
      if (!status.allowed) {
        setShowLimitModal(true);
        setLoading(false);
        return;
      }
    }

    setLoading(true);

    const activeGroup = PUBLICATION_HIERARCHY.find((c) => c.id === mainCategory) || PUBLICATION_HIERARCHY[0];
    const activeSub = activeGroup.subcategories.find((s) => s.id === subcategory) || activeGroup.subcategories[0];
    const numericPrice = (priceMode === "fixed" && !isFree) ? parseFloat(formData.price || 0) : 0;

    const fullLocation = exactLocation.trim()
      ? `${exactLocation.trim()}, ${department}`
      : `${department}, El Salvador`;

    const isNowFeatured = wasOriginallyFeatured ? true : Boolean(featured);
    const existingFeaturedTimestamp = originalFeaturedTimestampRef.current || (editId ? getProductById(editId)?.featuredTimestamp : null);
    const resolvedFeaturedTimestamp = isNowFeatured ? (existingFeaturedTimestamp || Date.now()) : null;

    const publicationData = {
      title: formData.title.trim(),
      mainCategory: activeGroup.id,
      mainCategoryName: activeGroup.name,
      subcategory: activeSub.id,
      subcategoryName: activeSub.name,
      category: activeSub.id,
      categoryName: activeSub.name,
      priceMode: priceMode,
      price: numericPrice,
      isPriceRange: priceMode === "range",
      minPrice: priceMode === "range" ? parseFloat(minPrice || 0) : null,
      maxPrice: priceMode === "range" ? parseFloat(maxPrice || 0) : null,
      isContactPrice: priceMode === "contact",
      rentPeriod: activeGroup.id === "alquiler" ? rentPeriod : null,
      servicePaymentType: activeGroup.id === "servicio" && priceMode !== "contact" ? servicePaymentType : null,
      currency: "USD",
      isFree: priceMode === "fixed" && isFree,
      isNegotiable: priceMode !== "contact" && !isFree && isNegotiable,
      condition: mainCategory === "producto" ? itemCondition : null,
      isSingleItem: mainCategory === "producto" ? isSingleItem : null,
      availableQuantity: mainCategory === "producto" ? (isSingleItem ? 1 : parseInt(availableQuantity || "1", 10)) : null,
      deliveryPreferences: mainCategory === "producto" ? deliveryPreferences : [],
      allowEmailContact: allowEmailContact,
      allowWhatsappContact: hasUserPhone ? allowWhatsappContact : false,
      contactEmail: allowEmailContact ? (currentUser?.email || "") : null,
      contactPhone: (hasUserPhone && allowWhatsappContact) ? currentUser?.phone : null,
      contactWhatsapp: (hasUserPhone && allowWhatsappContact) ? currentUser?.phone : null,
      department: department,
      exactLocation: exactLocation.trim(),
      location: fullLocation,
      description: formData.description.trim(),
      image: photos[0] || "",
      images: photos,
      featured: isNowFeatured,
      featuredTimestamp: resolvedFeaturedTimestamp
    };

    // Si se está editando una publicación existente, actualizarla directamente
    if (isEditing && editId) {
      try {
        const updated = await updateProduct(editId, publicationData);
        setPublishedItem(updated);
        setSearchParams({});
        setSubmitted(true);
      } catch (err) {
        alert("Error al guardar cambios de la publicación: " + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Si se está publicando un borrador existente, actualizarlo y pasarlo a aprobado
    if (draftId) {
      try {
        const now = new Date();
        const day = now.getDate();
        const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        const datePart = `${day} ${months[now.getMonth()]}.`;
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        const timeFormatted = `${datePart} · ${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;

        const updated = await updateProduct(draftId, {
          ...publicationData,
          status: "aprobado",
          createdAt: timeFormatted,
          isRecent: true,
          createdAtISO: now.toISOString(),
          publishedTimestamp: now.getTime()
        });
        setPublishedItem(updated);
        setSearchParams({});
        setSubmitted(true);
      } catch (err) {
        alert("Error al publicar el borrador: " + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const newPublication = {
      ...publicationData,
      likesCount: 0,
      viewsCount: 0,
      status: "aprobado",
      seller: {
        id: currentUser?.id || currentUser?.uid || "usr-anon",
        uid: currentUser?.uid || currentUser?.id || "",
        username: currentUser?.username || "",
        name: currentUser?.displayName || currentUser?.name || `@${currentUser?.username || "usuario"}`,
        phone: currentUser?.phone || "",
        email: currentUser?.email || "",
        avatar: currentUser?.avatar || "",
        rating: 5.0,
        reviewsCount: 0,
        verified: Boolean(currentUser?.verified)
      }
    };

    const now = new Date();
    const day = now.getDate();
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const datePart = `${day} ${months[now.getMonth()]}.`;
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeFormatted = `${datePart} · ${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;

    let generatedId = `prod-${Date.now()}`;
    try {
      if (isFirebaseConfigured) {
        const docRef = await addDoc(collection(db, "products"), {
          ...newPublication,
          createdAt: serverTimestamp(),
          createdAtISO: now.toISOString(),
          publishedTimestamp: now.getTime()
        });
        if (docRef?.id) generatedId = docRef.id;
      }
    } catch (err) {
      console.warn("Aviso al guardar en Firestore (modo respaldo local activo):", err);
    }

    // Persistir en el servicio central de productos para Feed y Perfil
    const savedItem = saveNewProduct({
      ...newPublication,
      id: generatedId,
      createdAt: timeFormatted,
      createdAtISO: now.toISOString(),
      publishedTimestamp: now.getTime()
    });

    setPublishedItem(savedItem);
    setSearchParams({});
    setSubmitted(true);
    setLoading(false);
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setSearchParams({});
    setIsEditing(false);
    setIsFeatured(false);
    setIsFree(false);
    setIsNegotiable(false);
    setPriceMode("fixed");
    setMinPrice("");
    setMaxPrice("");
    setRentPeriod("mes");
    setServicePaymentType("unico");
    setMainCategory("producto");
    setSubcategory("tech");
    setItemCondition("Nuevo");
    setIsSingleItem(true);
    setAvailableQuantity("1");
    setDeliveryPreferences(["public_place"]);
    setDepartment("San Salvador");
    setExactLocation("");
    setAllowEmailContact(true);
    setAllowWhatsappContact(hasUserPhone);
    setPublishedItem(null);
    setPhotoError(null);
    setFormErrors({
      title: null,
      price: null,
      quantity: null,
      delivery: null,
      description: null
    });
    setIsCarreteOpen(false);
    setActivePhotoIndex(0);
    setPhotos([
      "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80"
    ]);
    setFormData({
      title: "",
      price: "",
      currency: "USD",
      description: ""
    });
  };

  // Si el usuario no está autenticado, aviso amigable
  if (!isAuthenticated) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <LogIn className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Inicia sesión para publicar</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Para ofrecer productos o servicios en AnunciosSV, necesitas una cuenta activa.
        </p>
        <div className="pt-2">
          <button
            onClick={() => navigate("/login", { state: { from: { pathname: "/publish" } } })}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4" />
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  // Si el usuario ha alcanzado el límite de 3 publicaciones diarias al intentar crear anuncios nuevos
  if (!isEditing && !editId && !dailyLimitStatus.allowed) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-8 animate-fade-in">
        <div className="p-6 text-center space-y-4 max-w-sm w-full mx-auto rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Clock className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-white">Límite diario alcanzado</h2>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-2 leading-relaxed text-left">
            <p>
              Para mantener la equidad y la calidad de los clasificados en AnunciosSV, cada usuario cuenta con un límite de <span className="text-amber-400 font-bold">3 publicaciones diarias</span>.
            </p>
            <p className="text-slate-400 text-[11px]">
              Podrás publicar un nuevo anuncio dentro de {countdownText}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => navigate("/profile?tab=posts")}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <Store className="w-4 h-4" />
              <span>Ver mis anuncios publicados</span>
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full min-h-[42px] py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center"
            >
              <span>Ir al Feed</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de confirmación tras publicar o actualizar
  if (submitted && publishedItem) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-8 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-lg font-bold text-white">
          {isEditing ? "¡Anuncio Actualizado con Éxito!" : "¡Publicación Guardada!"}
        </h2>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-2.5">
          <div className="flex gap-3">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0">
              <img
                src={publishedItem.image}
                alt={publishedItem.title}
                className="w-full h-full object-cover"
              />
              {publishedItem.images?.length > 1 && (
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-bold text-white backdrop-blur-sm">
                  +{publishedItem.images.length - 1}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white line-clamp-1">{publishedItem.title}</h3>
              <p className="text-xs text-slate-400 line-clamp-1">{publishedItem.location}</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {publishedItem.isContactPrice || publishedItem.priceMode === "contact" ? (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30">
                    💬 A consultar
                  </span>
                ) : publishedItem.isPriceRange ? (
                  <span className="text-xs font-black text-indigo-400">
                    ${formatMoney(publishedItem.minPrice)} - ${formatMoney(publishedItem.maxPrice)} USD{
                      publishedItem.rentPeriod
                        ? `/${publishedItem.rentPeriod}`
                        : publishedItem.servicePaymentType === "mes"
                        ? "/mes"
                        : publishedItem.servicePaymentType === "año"
                        ? "/año"
                        : publishedItem.servicePaymentType === "unico"
                        ? " (ocasión)"
                        : ""
                    }
                  </span>
                ) : publishedItem.isFree ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                    GRATIS
                  </span>
                ) : (
                  <>
                    <span className="text-sm font-black text-indigo-400">
                      ${formatMoney(publishedItem.price)} USD{
                        publishedItem.rentPeriod
                          ? `/${publishedItem.rentPeriod}`
                          : publishedItem.servicePaymentType === "mes"
                          ? "/mes"
                          : publishedItem.servicePaymentType === "año"
                          ? "/año"
                          : publishedItem.servicePaymentType === "unico"
                          ? " (ocasión)"
                          : ""
                      }
                    </span>
                    {publishedItem.isNegotiable && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                        Negociable
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Categoría:</span>
              <span className="font-semibold text-slate-200">
                {publishedItem.mainCategoryName} › {publishedItem.subcategoryName}
              </span>
            </div>
            {publishedItem.condition && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Estado:</span>
                <span className="font-semibold text-slate-200">
                  {publishedItem.condition}
                </span>
              </div>
            )}
            {publishedItem.availableQuantity && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Disponibilidad:</span>
                <span className="font-semibold text-slate-200">
                  {publishedItem.isSingleItem
                    ? "1 unidad (Artículo único)"
                    : `${publishedItem.availableQuantity} unidades`}
                </span>
              </div>
            )}
            {publishedItem.deliveryPreferences?.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Entrega:</span>
                <span className="font-semibold text-indigo-400 text-right">
                  {publishedItem.deliveryPreferences
                    .map((id) => DELIVERY_OPTIONS.find((o) => o.id === id)?.label || id)
                    .join(", ")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Fotos cargadas:</span>
              <span className="font-semibold text-indigo-400">
                {publishedItem.images?.length || 1} fotos (1 Imagen principal)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Canales de contacto:</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {publishedItem.allowWhatsappContact && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    WhatsApp
                  </span>
                )}
                {publishedItem.allowEmailContact !== false && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                    Correo
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  Chat
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => navigate("/", { replace: true })}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <span>Ver en el feed</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {!isPromoteStep && (
        <form onSubmit={handleProceedToPromote} noValidate className="space-y-3.5 animate-fade-in">
          {/* Indicador de límite de publicaciones diarias (máximo 3 al día por usuario) */}
          {!isEditing && !editId && (
            <div className="animate-fade-in">
              {dailyLimitStatus.allowed ? (
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white">Límite diario:</span>
                        <span className="text-[11px] font-extrabold text-indigo-300">
                          {dailyLimitStatus.count} de {DAILY_PUBLICATION_LIMIT} anuncios hoy
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {dailyLimitStatus.remaining === 1
                          ? "Te queda 1 anuncio disponible para publicar hoy."
                          : `Te quedan ${dailyLimitStatus.remaining} anuncios disponibles para hoy.`}
                      </p>
                    </div>
                  </div>

                  {/* Indicador visual de 3 slots */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
                    {[1, 2, 3].map((slot) => {
                      const isUsed = slot <= dailyLimitStatus.count;
                      return (
                        <div
                          key={slot}
                          title={isUsed ? `Publicación ${slot} usada` : `Cupo ${slot} disponible`}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            isUsed
                              ? "bg-indigo-500 shadow-sm shadow-indigo-500/50 scale-110"
                              : "bg-slate-700/80"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3 shadow-sm animate-fade-in">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-amber-200">Límite diario alcanzado (3/3)</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        Completo hoy
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 mt-1 leading-relaxed">
                      Has alcanzado el límite máximo de 3 anuncios que puedes publicar al día. Podrás publicar nuevos anuncios nuevamente a partir de mañana.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sección de Fotos (Miniaturas limpias: al tocar una imagen se abre el Carrete Modal) */}
          <div ref={photosSectionRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Fotos
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {photos.length} de 5 fotos {photos.length < 5 ? `(Quedan ${5 - photos.length})` : "(Límite alcanzado)"}
              </span>
            </div>

            {/* Inputs ocultos para cargar 1 foto a la vez (compatible con el selector de Android) y reemplazar fotos */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAddPhotos}
              className="hidden"
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              onChange={handleReplacePhoto}
              className="hidden"
            />

            {photoError && (
              <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{photoError}</span>
              </div>
            )}

            {photos.length === 0 ? (
              /* Dropzone inicial cuando no hay fotos */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video rounded-2xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/60 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-white mb-0.5">
                  Tomar foto o elegir de la galería
                </span>
                <span className="text-[10px] text-slate-400">
                  Selecciona 1 foto a la vez (hasta 5 fotos en total)
                </span>
              </div>
            ) : (
              /* Cuadrícula limpia de miniaturas sin botones encimados */
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {photos.map((photoUrl, index) => (
                  <div
                    key={index}
                    onClick={() => handleOpenCarrete(index)}
                    className="aspect-square rounded-2xl overflow-hidden relative border border-slate-800 bg-slate-900 shadow-md cursor-pointer hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/30 transition-all group active:scale-95"
                  >
                    <img
                      src={photoUrl}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />

                    {/* Distintivo discreto de Imagen Principal */}
                    {index === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-indigo-600/90 text-white text-[9px] font-bold shadow-md backdrop-blur-sm flex items-center gap-1 pointer-events-none">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        Principal
                      </span>
                    )}
                  </div>
                ))}

                {/* Botón para añadir más fotos si hay menos de 5 (1 a la vez con conteo restante) */}
                {photos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-indigo-500/50 hover:border-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 flex flex-col items-center justify-center p-2 text-center transition-all group cursor-pointer active:scale-95"
                    title={`Añadir foto (Quedan ${5 - photos.length} de 5)`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-200">
                      Añadir
                    </span>
                    <span className="text-[9px] text-indigo-400 font-semibold">
                      Quedan {5 - photos.length}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Título
            </label>
            <input
              ref={titleInputRef}
              type="text"
              required
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: null }));
              }}
              placeholder="Título del anuncio"
              className={`w-full min-h-[48px] px-4 py-3 rounded-xl bg-slate-900 border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${formErrors.title
                  ? "border-rose-500 ring-2 ring-rose-500/20"
                  : "border-slate-800 focus:border-indigo-500"
                }`}
            />
            {formErrors.title && (
              <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{formErrors.title}</span>
              </p>
            )}
          </div>

          {/* Categoría y Subcategoría con Comboboxes estilizados (esquinas redondeadas estilo iPhone) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-30">
            {/* Combobox Categoría */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Categoría
              </label>
              <CustomSelect
                value={mainCategory}
                onChange={handleMainCategoryChange}
                options={PUBLICATION_HIERARCHY.map((cat) => ({ id: cat.id, name: cat.name }))}
                placeholder="Seleccionar categoría"
              />
            </div>

            {/* Combobox Subcategoría */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Subcategoría
              </label>
              <CustomSelect
                value={subcategory}
                onChange={(val) => setSubcategory(val)}
                options={activeSubcategories.map((sub) => ({ id: sub.id, name: sub.name }))}
                placeholder="Seleccionar subcategoría"
              />
            </div>
          </div>

          {/* Sección de Precio con soporte para Rango, Alquiler y Solicitar por Mensaje */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm relative z-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-200">
                  Modalidad de Precio
                </label>
                <span className="text-[11px] text-slate-400">
                  Selecciona cómo deseas publicar el precio
                </span>
              </div>

              {/* Selector de Modalidad: Fijo, Rango, Por mensaje */}
              <div className="inline-flex items-center p-0.5 rounded-full bg-slate-950 border border-slate-800 gap-0.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setPriceMode("fixed");
                    if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: null }));
                  }}
                  className={`px-3 py-1.5 min-h-[30px] rounded-full text-xs font-semibold transition-all select-none ${
                    priceMode === "fixed"
                      ? "bg-indigo-600 text-white shadow font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Precio Fijo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPriceMode("range");
                    setIsFree(false);
                    if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: null }));
                  }}
                  className={`px-3 py-1.5 min-h-[30px] rounded-full text-xs font-semibold transition-all select-none flex items-center gap-1 ${
                    priceMode === "range"
                      ? "bg-indigo-600 text-white shadow font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Rango</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPriceMode("contact");
                    setIsFree(false);
                    setIsNegotiable(false);
                    if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: null }));
                  }}
                  className={`px-3 py-1.5 min-h-[30px] rounded-full text-xs font-semibold transition-all select-none flex items-center gap-1 ${
                    priceMode === "contact"
                      ? "bg-indigo-600 text-white shadow font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>Por mensaje</span>
                </button>
              </div>
            </div>

            {/* Opciones adicionales para categoría Alquiler: Período mensual o anual */}
            {mainCategory === "alquiler" && priceMode !== "contact" && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  Frecuencia de renta:
                </span>
                <div className="inline-flex items-center p-0.5 rounded-full bg-slate-900 border border-slate-800 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRentPeriod("mes")}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      rentPeriod === "mes"
                        ? "bg-indigo-600 text-white font-bold shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Mensual (/mes)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRentPeriod("año")}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      rentPeriod === "año"
                        ? "bg-indigo-600 text-white font-bold shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Anual (/año)
                  </button>
                </div>
              </div>
            )}

            {/* Opciones adicionales para categoría Servicio: Un solo pago (ocasión), Mensual o Anual (recurrente) */}
            {mainCategory === "servicio" && priceMode !== "contact" && (
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Modalidad de cobro del servicio:
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setServicePaymentType("unico")}
                    className={`py-2 px-1.5 rounded-lg text-center transition-all ${
                      servicePaymentType === "unico"
                        ? "bg-indigo-600 text-white font-bold shadow"
                        : "text-slate-400 hover:text-slate-200 font-medium"
                    }`}
                  >
                    <span className="block text-xs font-bold leading-tight">Un solo pago</span>
                    <span className="text-[10px] opacity-80">(Ocasión)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServicePaymentType("mes")}
                    className={`py-2 px-1.5 rounded-lg text-center transition-all ${
                      servicePaymentType === "mes"
                        ? "bg-indigo-600 text-white font-bold shadow"
                        : "text-slate-400 hover:text-slate-200 font-medium"
                    }`}
                  >
                    <span className="block text-xs font-bold leading-tight">Mensual</span>
                    <span className="text-[10px] opacity-80">(/mes recurrente)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServicePaymentType("año")}
                    className={`py-2 px-1.5 rounded-lg text-center transition-all ${
                      servicePaymentType === "año"
                        ? "bg-indigo-600 text-white font-bold shadow"
                        : "text-slate-400 hover:text-slate-200 font-medium"
                    }`}
                  >
                    <span className="block text-xs font-bold leading-tight">Anual</span>
                    <span className="text-[10px] opacity-80">(/año recurrente)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Caso 1: Precio Fijo */}
            {priceMode === "fixed" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Monto en USD</span>
                  <div className="inline-flex items-center p-0.5 rounded-full bg-slate-950 border border-slate-800 gap-0.5">
                    <button
                      type="button"
                      disabled={isFree}
                      onClick={() => setIsNegotiable(!isNegotiable)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        !isFree && isNegotiable
                          ? "bg-indigo-600 text-white font-bold shadow"
                          : "text-slate-400 hover:text-slate-200 disabled:opacity-30"
                      }`}
                    >
                      Negociable
                    </button>
                    {mainCategory !== "alquiler" && (
                      <button
                        type="button"
                        onClick={() => handleToggleFree(!isFree)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                          isFree
                            ? "bg-emerald-600 text-white font-bold shadow"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Gratis
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <DollarSign className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={priceInputRef}
                    type="text"
                    inputMode="decimal"
                    required={!isFree}
                    disabled={isFree}
                    value={isFree ? "0.00" : formData.price}
                    onChange={handlePriceChange}
                    onBlur={handlePriceBlur}
                    placeholder="0.00"
                    className={`w-full min-h-[48px] pl-10 pr-24 py-3 rounded-xl border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                      isFree
                        ? "bg-slate-900/50 border-slate-800 text-emerald-400 font-bold cursor-not-allowed"
                        : formErrors.price
                        ? "bg-slate-900 border-rose-500 ring-2 ring-rose-500/20"
                        : "bg-slate-900 border-slate-800 focus:border-indigo-500"
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    {isFree
                      ? "GRATIS"
                      : mainCategory === "alquiler"
                      ? `USD/${rentPeriod}`
                      : mainCategory === "servicio"
                      ? servicePaymentType === "mes"
                        ? "USD/mes"
                        : servicePaymentType === "año"
                        ? "USD/año"
                        : "USD (ocasión)"
                      : "USD"}
                  </span>
                </div>
              </div>
            )}

            {/* Caso 2: Rango de Precios */}
            {priceMode === "range" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Desde y Hasta (USD)</span>
                  <button
                    type="button"
                    onClick={() => setIsNegotiable(!isNegotiable)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                      isNegotiable
                        ? "bg-indigo-600 text-white font-bold shadow"
                        : "text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800"
                    }`}
                  >
                    {isNegotiable ? "Negociable ✓" : "Negociable"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Mín $</span>
                    <input
                      ref={priceInputRef}
                      type="text"
                      inputMode="decimal"
                      value={minPrice}
                      onChange={handleMinPriceChange}
                      onBlur={handleMinPriceBlur}
                      placeholder="0.00"
                      className="w-full min-h-[48px] pl-12 pr-3 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Máx $</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={maxPrice}
                      onChange={handleMaxPriceChange}
                      onBlur={handleMaxPriceBlur}
                      placeholder="0.00"
                      className="w-full min-h-[48px] pl-12 pr-3 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>
                {mainCategory === "alquiler" && (
                  <p className="text-[11px] text-slate-400">
                    Rango expresado por período: <span className="text-indigo-300 font-semibold">{rentPeriod === "mes" ? "Mensual (/mes)" : "Anual (/año)"}</span>
                  </p>
                )}
                {mainCategory === "servicio" && (
                  <p className="text-[11px] text-slate-400">
                    Modalidad del servicio:{" "}
                    <span className="text-indigo-300 font-semibold">
                      {servicePaymentType === "unico"
                        ? "Un solo pago (ocasión)"
                        : servicePaymentType === "mes"
                        ? "Mensual (/mes recurrente)"
                        : "Anual (/año recurrente)"}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Caso 3: Solicitar por Mensaje */}
            {priceMode === "contact" && (
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300 flex items-start gap-2.5 animate-fade-in">
                <MessageCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-white block">Precio a convenir por mensaje</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Tu anuncio mostrará el distintivo <strong className="text-indigo-300 font-semibold">«A consultar»</strong>. Los compradores interesados se comunicarán contigo directamente para solicitar cotización.
                  </p>
                </div>
              </div>
            )}

            {formErrors.price && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{formErrors.price}</span>
              </p>
            )}
          </div>

          {/* Campo Estado: Sólo se muestra para productos */}
          {mainCategory === "producto" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estado del Producto
              </label>
              <CustomSelect
                value={itemCondition}
                onChange={(val) => setItemCondition(val)}
                options={PRODUCT_CONDITIONS}
                placeholder="Seleccionar estado"
              />
            </div>
          )}

          {/* Opciones exclusivas de Producto: Cantidad de unidades y Preferencias de entrega */}
          {mainCategory === "producto" && (
            <div className="space-y-3.5 pt-1">
              {/* Cantidad de unidades disponibles con cápsula para "Artículo único" */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Cantidad de unidades disponibles
                  </label>

                  {/* Cápsula seleccionable para Artículo único (mismo estilo que Negociable y Gratis) */}
                  <div className="inline-flex items-center p-0.5 rounded-full bg-slate-950 border border-slate-800/90">
                    <button
                      type="button"
                      onClick={() => handleToggleSingleItem(!isSingleItem)}
                      className={`px-3 py-1.5 min-h-[30px] rounded-full text-xs font-semibold transition-all select-none ${isSingleItem
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold scale-[1.02]"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                        }`}
                    >
                      Artículo único
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Boxes className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={quantityInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    disabled={isSingleItem}
                    value={isSingleItem ? "1" : availableQuantity}
                    onChange={handleQuantityChange}
                    onBlur={handleQuantityBlur}
                    placeholder="1"
                    className={`w-full min-h-[48px] pl-10 pr-24 py-3 rounded-xl border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isSingleItem
                        ? "bg-slate-900/50 border-slate-800 text-slate-400 font-semibold cursor-not-allowed"
                        : formErrors.quantity
                          ? "bg-slate-900 border-rose-500 ring-2 ring-rose-500/20 font-medium"
                          : "bg-slate-900 border-slate-800 focus:border-indigo-500 font-medium"
                      }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isSingleItem ? (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30">
                        ÚNICO (1)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        unidades
                      </span>
                    )}
                  </div>
                </div>
                {formErrors.quantity && (
                  <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{formErrors.quantity}</span>
                  </p>
                )}
              </div>

              {/* Preferencias de Entrega */}
              <div ref={deliverySectionRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Preferencias de Entrega
                  </label>
                  <span className="text-[10px] text-slate-400">
                    (Puedes seleccionar varias)
                  </span>
                </div>

                <div className={`space-y-2 rounded-2xl p-1 transition-all ${formErrors.delivery ? "ring-2 ring-rose-500/30 border border-rose-500/40" : ""
                  }`}>
                  {DELIVERY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = deliveryPreferences.includes(opt.id);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleToggleDeliveryOption(opt.id)}
                        className={`min-h-[50px] p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer select-none transition-all active:scale-[0.99] ${isSelected
                            ? "bg-indigo-600/10 border-indigo-500/50 text-white shadow-sm shadow-indigo-500/5"
                            : "bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                                : "bg-slate-800/80 text-slate-400"
                              }`}
                          >
                            <Icon className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white leading-tight">
                              {opt.label}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                              {opt.detail}
                            </p>
                          </div>
                        </div>

                        {/* Checkbox visual estilizado */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all ${isSelected
                              ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                              : "border-slate-700 bg-slate-800/50"
                            }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {formErrors.delivery && (
                  <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{formErrors.delivery}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Departamento y Ubicación específica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
            {/* Combobox Departamento de El Salvador */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Departamento
              </label>
              <CustomSelect
                value={department}
                onChange={(val) => setDepartment(val)}
                options={EL_SALVADOR_DEPARTMENTS}
                placeholder="Seleccionar departamento"
              />
            </div>

            {/* Ubicación manual más exacta */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ubicación
              </label>
              <div className="relative">
                <MapPin className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={exactLocation}
                  onChange={(e) => setExactLocation(e.target.value)}
                  placeholder="Municipio, colonia o referencia"
                  className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="relative z-0">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Descripción
            </label>
            <textarea
              ref={descriptionInputRef}
              rows="3"
              required
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: null }));
              }}
              placeholder="Detalles de la publicación..."
              className={`w-full min-h-[96px] px-4 py-3 rounded-xl bg-slate-900 border text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed transition-all ${formErrors.description
                  ? "border-rose-500 ring-2 ring-rose-500/20"
                  : "border-slate-800 focus:border-indigo-500"
                }`}
            />
            {formErrors.description && (
              <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{formErrors.description}</span>
              </p>
            )}
          </div>

          {/* Vías de contacto directo para compradores (WhatsApp y Correo Electrónico) */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Vías de contacto para compradores
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Elige cómo deseas que los compradores se comuniquen contigo desde este anuncio.
              </p>
            </div>

            {/* Opción 1: WhatsApp */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              hasUserPhone
                ? allowWhatsappContact
                  ? "bg-emerald-950/20 border-emerald-500/40"
                  : "bg-slate-950/60 border-slate-800"
                : "bg-slate-950/40 border-slate-800/80"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    hasUserPhone && allowWhatsappContact
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "bg-slate-800 text-slate-400"
                  }`}>
                    {/* Logotipo SVG oficial de WhatsApp */}
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">Contacto por WhatsApp</span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {hasUserPhone ? `Número: ${userPhone}` : "Requiere registrar teléfono en perfil"}
                    </span>
                  </div>
                </div>

                {/* Switch interactivo estilo iOS */}
                {hasUserPhone ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowWhatsappContact}
                    onClick={() => setAllowWhatsappContact(!allowWhatsappContact)}
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 cursor-pointer ${
                      allowWhatsappContact ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        allowWhatsappContact ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                ) : (
                  <div
                    title="No puedes activar WhatsApp sin un número registrado en tu perfil"
                    className="w-12 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center p-0.5 opacity-50 cursor-not-allowed flex-shrink-0"
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-600 shadow-sm" />
                  </div>
                )}
              </div>

              {/* Advertencia interactiva si el usuario no tiene teléfono en su perfil */}
              {!hasUserPhone && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Sin teléfono registrado en perfil</span>
                  </div>
                  <Link
                    to="/profile"
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline whitespace-nowrap"
                  >
                    Añadir en Perfil →
                  </Link>
                </div>
              )}
            </div>

            {/* Opción 2: Correo Electrónico */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              allowEmailContact
                ? "bg-indigo-950/20 border-indigo-500/40"
                : "bg-slate-950/60 border-slate-800"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    allowEmailContact
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-800 text-slate-400"
                  }`}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">Contacto por Correo</span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {currentUser?.email ? `Correo: ${currentUser.email}` : "Recibir consultas por email"}
                    </span>
                  </div>
                </div>

                {/* Switch interactivo estilo iOS */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowEmailContact}
                  onClick={() => setAllowEmailContact(!allowEmailContact)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 cursor-pointer ${
                    allowEmailContact ? "bg-indigo-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      allowEmailContact ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Nota informativa de mensajería interna */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span>La mensajería interna de AnunciosSV siempre permanecerá activa en tu anuncio.</span>
            </div>
          </div>

          {/* Botón Siguiente (conduce al paso de decidir si promocionar el anuncio) */}
          {!isEditing && !editId && !dailyLimitStatus.allowed ? (
            <button
              type="button"
              onClick={() => setShowLimitModal(true)}
              className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-slate-800/90 border border-amber-500/40 text-amber-300 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <AlertCircle className="w-4.5 h-4.5 text-amber-400" />
              <span>Límite diario alcanzado (3/3 hoy)</span>
            </button>
          ) : (
            <button
              type="submit"
              className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 relative z-0 active:scale-[0.99]"
            >
              <span>{isEditing ? "Continuar con los cambios" : "Siguiente"}</span>
              <ArrowRight className="w-4.5 h-4.5" />
            </button>
          )}
        </form>
      )}

      {/* Paso 2: Promocionar Anuncio */}
      {isPromoteStep && (
        <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
          {/* Tarjeta de encabezado con diseño visual moderno */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 shadow-xl text-center space-y-3 relative overflow-hidden">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 via-pink-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">¿Deseas promocionar tu anuncio?</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-sm mx-auto">
                Los anuncios promocionados se destacan en los primeros resultados de búsqueda y en la portada principal para conseguir ventas más rápido.
              </p>
            </div>

            {/* Vista previa compacta del anuncio */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-3 text-left">
              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0">
                <img
                  src={photos[0]}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                />
                {isFeatured && (
                  <span className="absolute top-1 right-1 p-0.5 rounded bg-amber-500 text-slate-950 shadow">
                    <Star className="w-2.5 h-2.5 fill-slate-950" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white truncate">{formData.title || "Tu anuncio"}</h4>
                  {isFeatured && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      DESTACADO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">{department}, El Salvador</p>
                <div className="text-xs font-black text-indigo-400 mt-0.5">
                  {priceMode === "contact" ? (
                    "💬 A consultar"
                  ) : priceMode === "range" ? (
                    `$${formatMoney(minPrice)} - $${formatMoney(maxPrice)} USD${
                      mainCategory === "alquiler"
                        ? `/${rentPeriod}`
                        : mainCategory === "servicio"
                        ? servicePaymentType === "mes"
                          ? "/mes"
                          : servicePaymentType === "año"
                          ? "/año"
                          : " (ocasión)"
                        : ""
                    }`
                  ) : isFree ? (
                    "GRATIS"
                  ) : (
                    `$${formatMoney(formData.price)} USD${
                      mainCategory === "alquiler"
                        ? `/${rentPeriod}`
                        : mainCategory === "servicio"
                        ? servicePaymentType === "mes"
                          ? "/mes"
                          : servicePaymentType === "año"
                          ? "/año"
                          : " (ocasión)"
                        : ""
                    }`
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Opciones de promoción (Aún en preparación / Maqueta interactiva) */}
          <div className="space-y-2.5">
            {/* Opción Destacada */}
            <div
              onClick={() => {
                // Si la publicación ya estaba destacada previamente, no se puede desmarcar
                if (wasOriginallyFeatured) return;
                setIsFeatured(!isFeatured);
              }}
              className={`p-4 rounded-2xl border transition-all select-none relative overflow-hidden ${
                wasOriginallyFeatured ? "cursor-default" : "cursor-pointer active:scale-[0.99]"
              } ${isFeatured
                  ? "bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-indigo-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isFeatured
                        ? "bg-gradient-to-br from-amber-500 to-pink-500 text-white shadow-md shadow-amber-500/30"
                        : "bg-slate-800 text-slate-400"
                      }`}
                  >
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white">Destacar Anuncio</h3>
                      {wasOriginallyFeatured ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Destaque Activo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Próximamente
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {wasOriginallyFeatured
                        ? "Esta publicación ya cuenta con destaque activo y se mantendrá en las primeras posiciones."
                        : "Ubica tu producto en el carrusel superior y en las primeras posiciones del feed."}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all mt-0.5 ${isFeatured
                      ? "bg-amber-500 border-amber-400 text-slate-950 shadow-sm"
                      : "border-slate-700 bg-slate-800/50"
                    }`}
                >
                  {isFeatured && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* Aviso informativo de sección en preparación */}
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 text-center">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Esta sección de pagos y planes de patrocinio estará disponible en la próxima actualización. Puedes publicar gratis sin costo adicional.
              </p>
            </div>
          </div>

          {/* Botón único de acción: Publicar Anuncio (o Publicar como destacado si está marcado) */}
          <div className="pt-2">
            {!isEditing && !editId && !dailyLimitStatus.allowed ? (
              <button
                type="button"
                onClick={() => setShowLimitModal(true)}
                className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-slate-800/90 border border-amber-500/40 text-amber-300 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <AlertCircle className="w-4.5 h-4.5 text-amber-400" />
                <span>Límite diario alcanzado (3/3 hoy)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleFinalPublish(isFeatured)}
                className={`w-full min-h-[50px] py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 ${isFeatured
                    ? "bg-gradient-to-r from-amber-500 via-pink-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 shadow-amber-500/20"
                    : "bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-indigo-600/30"
                  }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>
                      {isEditing
                        ? "Guardando cambios..."
                        : isFeatured
                        ? "Publicando anuncio destacado..."
                        : "Publicando anuncio..."}
                    </span>
                  </>
                ) : isEditing ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Publicar actualización</span>
                  </>
                ) : isFeatured ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Publicar como destacado</span>
                  </>
                ) : (
                  <span>Publicar Anuncio</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de Carrete de Fotos optimizado para móviles (Swipe táctil y Portal z-[9999]) */}
      <PhotoCarouselModal
        isOpen={isCarreteOpen}
        onClose={() => setIsCarreteOpen(false)}
        photos={photos}
        activeIndex={activePhotoIndex}
        onSelectIndex={(idx) => setActivePhotoIndex(idx)}
        onSetPrimary={handleSetPrimaryFromModal}
        onTriggerReplace={handleTriggerReplace}
        onDelete={handleDeleteFromModal}
        onTriggerAdd={() => fileInputRef.current?.click()}
      />

      {/* Modal interactivo de confirmación para descartar nueva publicación */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-backdrop-enter">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl text-left animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">¿Descartar publicación?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tienes una publicación en proceso</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
              Si sales ahora, los datos que hayas ingresado en el formulario se perderán. ¿Deseas descartar esta publicación o seguir editando?
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleDiscard}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Descartar publicación</span>
              </button>

              <button
                type="button"
                onClick={handleKeepEditing}
                className="w-full min-h-[40px] py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center"
              >
                <span>Seguir editando</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal interactivo de advertencia por límite diario de publicaciones */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-backdrop-enter">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl text-left animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Límite diario alcanzado</h3>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>
                Para mantener la equidad y calidad del feed en AnunciosSV, cada usuario cuenta con un límite de <span className="text-amber-400 font-bold">3 publicaciones diarias</span>.
              </p>
              <p className="text-slate-400 text-[11px]">
                Podrás publicar un nuevo anuncio dentro de {countdownText}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowLimitModal(false);
                  navigate("/profile?tab=posts");
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>Ver mis anuncios publicados</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLimitModal(false);
                  navigate("/");
                }}
                className="w-full min-h-[40px] py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center"
              >
                <span>Ir al Feed</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishPage;
