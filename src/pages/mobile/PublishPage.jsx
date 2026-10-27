// Vista simplificada y limpia de publicación de clasificados en AnunciosSV
import React, { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isFirebaseConfigured, db } from "../../services/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  UploadCloud,
  CheckCircle2,
  DollarSign,
  MapPin,
  Image as ImageIcon,
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
  Zap
} from "lucide-react";
import { CustomSelect } from "../../components/common/CustomSelect";
import { PhotoCarouselModal } from "../../components/mobile/PhotoCarouselModal";
import {
  PUBLICATION_HIERARCHY,
  EL_SALVADOR_DEPARTMENTS,
  PRODUCT_CONDITIONS
} from "../../services/mockData";
import { saveNewProduct } from "../../services/productsService";

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Paso actual sincronizado con la URL (?step=promote para el paso 2)
  const isPromoteStep = searchParams.get("step") === "promote";
  const [isFeatured, setIsFeatured] = useState(false);

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

  // Manejo de carga de nuevas fotos (cámara o galería: 1 a la vez para compatibilidad con el selector de Android)
  const handleAddPhotos = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 5) {
      setPhotoError("Has alcanzado el límite máximo de 5 fotos.");
      e.target.value = "";
      return;
    }

    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        setPhotos((prev) => {
          if (prev.length >= 5) return prev;
          const updated = [...prev, uploadEvent.target.result];
          // Enfocar inmediatamente la nueva foto agregada en el carrete
          setActivePhotoIndex(updated.length - 1);
          return updated;
        });
      }
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  // Manejo de reemplazo/cambio de una foto específica
  const handleTriggerReplace = (index) => {
    setReplaceIndex(index);
    replaceInputRef.current?.click();
  };

  const handleReplacePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file && replaceIndex !== null) {
      setPhotoError(null);
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

    // 3. Validar Precio (si no está marcado como Gratis)
    if (!isFree) {
      const numPrice = parseFloat(formData.price);
      if (!formData.price || isNaN(numPrice) || numPrice <= 0) {
        setFormErrors((prev) => ({ ...prev, price: "Ingresa un precio válido o marca el anuncio como Gratis." }));
        scrollToTarget(priceInputRef.current, true);
        return;
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
    setSearchParams({ step: "promote" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Paso 2: Guardado final de la publicación en Firestore (con o sin destaque)
  const handleFinalPublish = async (featured = false) => {
    setLoading(true);

    const activeGroup = PUBLICATION_HIERARCHY.find((c) => c.id === mainCategory) || PUBLICATION_HIERARCHY[0];
    const activeSub = activeGroup.subcategories.find((s) => s.id === subcategory) || activeGroup.subcategories[0];
    const numericPrice = isFree ? 0 : parseFloat(formData.price || 0);

    const fullLocation = exactLocation.trim()
      ? `${exactLocation.trim()}, ${department}`
      : `${department}, El Salvador`;

    const newPublication = {
      title: formData.title.trim(),
      mainCategory: activeGroup.id,
      mainCategoryName: activeGroup.name,
      subcategory: activeSub.id,
      subcategoryName: activeSub.name,
      category: activeSub.id,
      categoryName: activeSub.name,
      price: numericPrice,
      currency: "USD",
      isFree: isFree,
      isNegotiable: !isFree && isNegotiable,
      condition: mainCategory === "producto" ? itemCondition : null,
      isSingleItem: mainCategory === "producto" ? isSingleItem : null,
      availableQuantity: mainCategory === "producto" ? (isSingleItem ? 1 : parseInt(availableQuantity || "1", 10)) : null,
      deliveryPreferences: mainCategory === "producto" ? deliveryPreferences : [],
      department: department,
      exactLocation: exactLocation.trim(),
      location: fullLocation,
      description: formData.description.trim(),
      image: photos[0] || "",
      images: photos,
      likesCount: 0,
      viewsCount: 0,
      status: "aprobado",
      featured: featured,
      seller: {
        id: currentUser?.id || currentUser?.uid || "usr-anon",
        name: currentUser?.name || `@${currentUser?.username || "usuario"}`,
        avatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        rating: 5.0,
        reviewsCount: 0,
        verified: Boolean(currentUser?.verified)
      }
    };

    let generatedId = `prod-${Date.now()}`;
    try {
      if (isFirebaseConfigured) {
        const docRef = await addDoc(collection(db, "products"), {
          ...newPublication,
          createdAt: serverTimestamp()
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
      createdAt: "Hace un momento"
    });

    setPublishedItem(savedItem);
    setSearchParams({});
    setSubmitted(true);
    setLoading(false);
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setSearchParams({});
    setIsFeatured(false);
    setIsFree(false);
    setIsNegotiable(false);
    setMainCategory("producto");
    setSubcategory("tech");
    setItemCondition("Nuevo");
    setIsSingleItem(true);
    setAvailableQuantity("1");
    setDeliveryPreferences(["public_place"]);
    setDepartment("San Salvador");
    setExactLocation("");
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

  // Pantalla de confirmación tras publicar
  if (submitted && publishedItem) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-8 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-lg font-bold text-white">¡Publicación Guardada!</h2>

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
              <div className="mt-1 flex items-center gap-2">
                {publishedItem.isFree ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                    GRATIS
                  </span>
                ) : (
                  <>
                    <span className="text-sm font-black text-indigo-400">
                      ${Number(publishedItem.price).toFixed(2)} USD
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
          </div>
        </div>

        <div className="pt-2 space-y-2.5">
          <button
            onClick={() => navigate("/")}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center"
          >
            Ver en el Feed
          </button>
          <button
            onClick={handleResetForm}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center"
          >
            Publicar otro anuncio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {!isPromoteStep && (
        <form onSubmit={handleProceedToPromote} noValidate className="space-y-3.5 animate-fade-in">
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
            className={`w-full min-h-[48px] px-4 py-3 rounded-xl bg-slate-900 border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${
              formErrors.title
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

        {/* Precio y Estado (solo para productos) */}
        <div className={`grid grid-cols-1 ${mainCategory === "producto" ? "sm:grid-cols-2" : ""} gap-3 relative z-20`}>
          {/* Precio con opciones Negociable y Gratis */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Precio (USD)
              </label>

              {/* Cápsula seleccionable para Negociable y Gratis (sin checkboxes visibles) */}
              <div className="inline-flex items-center p-0.5 rounded-full bg-slate-950 border border-slate-800/90 gap-0.5">
                <button
                  type="button"
                  disabled={isFree}
                  onClick={() => setIsNegotiable(!isNegotiable)}
                  className={`px-3 py-1.5 min-h-[30px] rounded-full text-xs font-semibold transition-all select-none ${
                    !isFree && isNegotiable
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold scale-[1.02]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
                >
                  Negociable
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleFree(!isFree)}
                  className={`px-3 py-1.5 min-h-[30px] rounded-full text-xs font-semibold transition-all select-none ${
                    isFree
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold scale-[1.02]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  Gratis
                </button>
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
                className={`w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  isFree
                    ? "bg-slate-900/50 border-slate-800 text-emerald-400 font-bold cursor-not-allowed"
                    : formErrors.price
                    ? "bg-slate-900 border-rose-500 ring-2 ring-rose-500/20"
                    : "bg-slate-900 border-slate-800 focus:border-indigo-500"
                }`}
              />
              {isFree && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  GRATIS
                </span>
              )}
            </div>
            {formErrors.price && (
              <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{formErrors.price}</span>
              </p>
            )}
          </div>

          {/* Campo Estado: Sólo se muestra para productos */}
          {mainCategory === "producto" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estado
              </label>
              <CustomSelect
                value={itemCondition}
                onChange={(val) => setItemCondition(val)}
                options={PRODUCT_CONDITIONS}
                placeholder="Seleccionar estado"
              />
            </div>
          )}
        </div>

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
                    className={`px-3 py-1.5 min-h-[30px] rounded-full text-xs font-semibold transition-all select-none ${
                      isSingleItem
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
                  className={`w-full min-h-[48px] pl-10 pr-24 py-3 rounded-xl border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    isSingleItem
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

              <div className={`space-y-2 rounded-2xl p-1 transition-all ${
                formErrors.delivery ? "ring-2 ring-rose-500/30 border border-rose-500/40" : ""
              }`}>
                {DELIVERY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = deliveryPreferences.includes(opt.id);

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleToggleDeliveryOption(opt.id)}
                      className={`min-h-[50px] p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer select-none transition-all active:scale-[0.99] ${
                        isSelected
                          ? "bg-indigo-600/10 border-indigo-500/50 text-white shadow-sm shadow-indigo-500/5"
                          : "bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
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
                        className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all ${
                          isSelected
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
            className={`w-full min-h-[96px] px-4 py-3 rounded-xl bg-slate-900 border text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed transition-all ${
              formErrors.description
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

        {/* Botón Siguiente (conduce al paso de decidir si promocionar el anuncio) */}
        <button
          type="submit"
          className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 relative z-0 active:scale-[0.99]"
        >
          <span>Siguiente</span>
          <ArrowRight className="w-4.5 h-4.5" />
        </button>
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
                  {isFree ? "GRATIS" : `$${parseFloat(formData.price || 0).toFixed(2)} USD`}
                </div>
              </div>
            </div>
          </div>

          {/* Opciones de promoción (Aún en preparación / Maqueta interactiva) */}
          <div className="space-y-2.5">
            {/* Opción Destacada */}
            <div
              onClick={() => setIsFeatured(!isFeatured)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] relative overflow-hidden ${
                isFeatured
                  ? "bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-indigo-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isFeatured
                        ? "bg-gradient-to-br from-amber-500 to-pink-500 text-white shadow-md shadow-amber-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white">Destacar Anuncio</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Próximamente
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Ubica tu producto en el carrusel superior y en las primeras posiciones del feed.
                    </p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all mt-0.5 ${
                    isFeatured
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
            <button
              type="button"
              disabled={loading}
              onClick={() => handleFinalPublish(isFeatured)}
              className={`w-full min-h-[50px] py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 ${
                isFeatured
                  ? "bg-gradient-to-r from-amber-500 via-pink-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 shadow-amber-500/20"
                  : "bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-indigo-600/30"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isFeatured ? "Publicando anuncio destacado..." : "Publicando anuncio..."}</span>
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
    </div>
  );
};

export default PublishPage;
