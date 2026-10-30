// Datos mock enriquecidos para la Fase 1: feed social de clasificados, moderación y panel de control

export const MOCK_CATEGORIES = [
  { id: "all", name: "Todos", icon: "Sparkles", count: 240 },
  { id: "tech", name: "Tecnología", icon: "Laptop", count: 85 },
  { id: "vehicles", name: "Vehículos", icon: "Car", count: 42 },
  { id: "real_estate", name: "Inmuebles", icon: "Home", count: 31 },
  { id: "services", name: "Servicios", icon: "Briefcase", count: 56 },
  { id: "home", name: "Hogar", icon: "Armchair", count: 26 },
];

// Los 14 Departamentos de la República de El Salvador
export const EL_SALVADOR_DEPARTMENTS = [
  "Ahuachapán",
  "Cabañas",
  "Chalatenango",
  "Cuscatlán",
  "La Libertad",
  "La Paz",
  "La Unión",
  "Morazán",
  "San Miguel",
  "San Salvador",
  "San Vicente",
  "Santa Ana",
  "Sonsonate",
  "Usulután"
];

// Opciones de Estado o Condición física de los productos
export const PRODUCT_CONDITIONS = [
  "Nuevo",
  "Como nuevo",
  "Usado",
  "Reacondicionado",
  "Para repuestos"
];

// Opciones de Preferencias de Entrega para productos
export const DELIVERY_OPTIONS = [
  {
    id: "public_place",
    label: "Lugar Público",
    detail: "Acordar punto con el vendedor"
  },
  {
    id: "pickup",
    label: "Retiro en Local",
    detail: "En tienda o ubicación física"
  },
  {
    id: "store_pickup",
    label: "Retiro en Local",
    detail: "El comprador retira en tu dirección o tienda"
  },
  {
    id: "shipping",
    label: "Envío",
    detail: "Si se ofrece envío o encomienda"
  }
];

// Jerarquía de Categorías Principales y Subcategorías para el Editor de Anuncios
export const PUBLICATION_HIERARCHY = [
  {
    id: "producto",
    name: "Producto",
    icon: "Package",
    tagline: "Venta de artículos tangibles",
    description: "Dispositivos, vehículos, inmuebles, hogar, moda y más",
    subcategories: [
      { id: "tech", name: "Tecnología y Celulares", icon: "Laptop", detail: "Celulares, laptops, consolas, tablets y accesorios" },
      { id: "vehicles", name: "Vehículos y Repuestos", icon: "Car", detail: "Carros, motocicletas, repuestos y accesorios" },
      { id: "real_estate", name: "Inmuebles y Bienes Raíces", icon: "Home", detail: "Casas, apartamentos, terrenos y locales" },
      { id: "home", name: "Hogar y Muebles", icon: "Armchair", detail: "Electrodomésticos, salas, comedores y decoración" },
      { id: "fashion", name: "Moda y Calzado", icon: "Shirt", detail: "Ropa hombre/mujer, calzado, relojes y accesorios" },
      { id: "sports", name: "Deportes y Hobbies", icon: "Dumbbell", detail: "Bicicletas, fitness, camping y artículos deportivos" },
      { id: "tools", name: "Herramientas e Industria", icon: "Wrench", detail: "Construcción, herramientas eléctricas y maquinaria" },
      { id: "beauty_products", name: "Belleza y Salud", icon: "Sparkles", detail: "Cosméticos, perfumes y cuidado personal" },
      { id: "kids", name: "Bebés y Juguetes", icon: "Baby", detail: "Juguetes, coches, ropa infantil y maternidad" },
      { id: "other_products", name: "Otros Productos", icon: "Package", detail: "Artículos misceláneos y varios" }
    ]
  },
  {
    id: "servicio",
    name: "Servicio",
    icon: "Briefcase",
    tagline: "Oferta de servicios profesionales y oficios",
    description: "Asesorías, soporte técnico, mantenimiento, transportes y más",
    subcategories: [
      { id: "tech_services", name: "Tecnología y Soporte IT", icon: "Cpu", detail: "Desarrollo web, reparación PC/móviles y redes" },
      { id: "repairs", name: "Mantenimiento del Hogar", icon: "Hammer", detail: "Electricistas, fontanería, pintura y albañilería" },
      { id: "mechanic", name: "Mecánica Automotriz", icon: "Car", detail: "Talleres, mecánica rápida, frenos y escáner automotriz" },
      { id: "education", name: "Clases y Tutorías", icon: "GraduationCap", detail: "Idiomas, refuerzo escolar, música y talleres" },
      { id: "health_beauty", name: "Belleza y Cuidado Personal", icon: "Scissors", detail: "Barbería, peluquería, manicura y estética" },
      { id: "transport", name: "Transporte y Fletes", icon: "Truck", detail: "Mudanzas, viajes, fletes y envíos locales" },
      { id: "events", name: "Eventos y Fotografía", icon: "Camera", detail: "Fotografía, sonido, catering y animación de fiestas" },
      { id: "legal_consulting", name: "Asesoría Legal y Contable", icon: "FileText", detail: "Abogados, contadores, trámites y consultoría fiscal" },
      { id: "cleaning", name: "Limpieza y Desinfección", icon: "Sparkles", detail: "Limpieza residencial, comercial y de tapicería" },
      { id: "other_services", name: "Otros Servicios", icon: "Briefcase", detail: "Oficios varios y servicios especializados" }
    ]
  },
  {
    id: "alquiler",
    name: "Alquiler",
    icon: "Key",
    tagline: "Renta de inmuebles, vehículos y bienes",
    description: "Apartamentos, casas, locales, vehículos, maquinaria y eventos en alquiler",
    subcategories: [
      { id: "rent_real_estate", name: "Casas y Apartamentos", icon: "Home", detail: "Viviendas familiares, condominios, estudios y quintas" },
      { id: "rent_commercial", name: "Locales y Oficinas", icon: "Store", detail: "Espacios comerciales, oficinas, bodegas y consultorios" },
      { id: "rent_rooms", name: "Habitaciones y Cuartos", icon: "DoorClosed", detail: "Habitaciones amuebladas, estancias y dormitorios" },
      { id: "rent_vehicles", name: "Vehículos y Renta Autos", icon: "Car", detail: "Carros particulares, pickups, camionetas y motocicletas" },
      { id: "rent_machinery", name: "Maquinaria y Herramientas", icon: "Wrench", detail: "Equipos de construcción, plantas eléctricas y herramientas" },
      { id: "rent_events", name: "Mobiliario y Eventos", icon: "Sparkles", detail: "Sillas, mesas, toldos, mantelería, sonido e iluminación" },
      { id: "rent_other", name: "Otros Alquileres", icon: "Key", detail: "Rentas varias y alquileres específicos" }
    ]
  }
];

// Colección vacía para publicaciones: la web inicia sin publicaciones mock de prueba
export const MOCK_PRODUCTS = [];

// Lista de usuarios inicial: únicamente el Webmaster Administrador
export const MOCK_USERS = [
  {
    id: "usr-admin",
    name: "Webmaster Admin",
    email: "admin@mercadosocial.com",
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
    joinedDate: "15 Ene 2024",
    status: "activo",
    postsCount: 0,
    reportedCount: 0
  }
];

export const MOCK_ADS = [];

export const MOCK_ADMIN_STATS = {
  totalUsers: 1,
  usersGrowth: "0% este mes",
  activeListings: 0,
  listingsGrowth: "0% esta semana",
  pendingModeration: 0,
  reportedItems: 0,
  adRevenue: "$0.00 USD",
  adRevenueGrowth: "0% vs mes anterior"
};
