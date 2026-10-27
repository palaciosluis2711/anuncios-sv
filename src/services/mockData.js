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
  }
];

export const MOCK_PRODUCTS = [
  {
    id: "prod-101",
    title: "MacBook Pro M2 14\" - 16GB / 512GB Impecable",
    price: 1350,
    currency: "USD",
    category: "tech",
    categoryName: "Tecnología",
    location: "Madrid, ES",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
    description: "MacBook Pro en condición excelente, batería con 96% de salud. Se entrega con cargador MagSafe original y caja.",
    likesCount: 38,
    isLiked: false,
    viewsCount: 412,
    createdAt: "Hace 2 horas",
    status: "aprobado", // aprobado | pendiente | rechazado
    featured: true,
    seller: {
      id: "usr-01",
      name: "Carlos Méndez",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      rating: 4.9,
      reviewsCount: 24,
      verified: true
    }
  },
  {
    id: "prod-102",
    title: "Apartamento Céntrico 2 Habitaciones con Terraza",
    price: 950,
    currency: "USD/mes",
    category: "real_estate",
    categoryName: "Inmuebles",
    location: "Barcelona, ES",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
    description: "Alquiler temporal o larga estancia. Totalmente amueblado con luz natural todo el día. Aire acondicionado frío/calor.",
    likesCount: 64,
    isLiked: true,
    viewsCount: 890,
    createdAt: "Hace 5 horas",
    status: "aprobado",
    featured: false,
    seller: {
      id: "usr-02",
      name: "Inmobiliaria Viva Sol",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
      rating: 4.8,
      reviewsCount: 112,
      verified: true
    }
  },
  {
    id: "prod-103",
    title: "Honda Civic Sport 2021 Automático",
    price: 18900,
    currency: "USD",
    category: "vehicles",
    categoryName: "Vehículos",
    location: "Valencia, ES",
    image: "https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80",
    description: "35,000 km, mantenimientos al día en concesionario oficial. Llantas deportivas de 18 pulgadas, Apple CarPlay.",
    likesCount: 52,
    isLiked: false,
    viewsCount: 730,
    createdAt: "Hace 1 día",
    status: "aprobado",
    featured: true,
    seller: {
      id: "usr-03",
      name: "Andrés Silva",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      rating: 4.7,
      reviewsCount: 18,
      verified: false
    }
  },
  {
    id: "prod-104",
    title: "Desarrollo Web Full-Stack & Apps Móviles React Native",
    price: 45,
    currency: "USD/hora",
    category: "services",
    categoryName: "Servicios",
    location: "Remoto / Global",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
    description: "Creación de landing pages, plataformas PWA, sistemas a medida con React, Node y Firebase. Presupuesto sin compromiso.",
    likesCount: 89,
    isLiked: true,
    viewsCount: 1204,
    createdAt: "Hace 2 días",
    status: "aprobado",
    featured: false,
    seller: {
      id: "usr-admin",
      name: "Admin Webmaster",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
      rating: 5.0,
      reviewsCount: 67,
      verified: true
    }
  },
  {
    id: "prod-105",
    title: "Sony Alpha A7 IV + Lente 24-70mm GM f/2.8",
    price: 2400,
    currency: "USD",
    category: "tech",
    categoryName: "Tecnología",
    location: "Sevilla, ES",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    description: "Cámara profesional de 33MP ideal para video y fotografía. Menos de 4,000 disparos de obturador.",
    likesCount: 41,
    isLiked: false,
    viewsCount: 390,
    createdAt: "Hace 3 días",
    status: "pendiente", // En cola de moderación
    featured: false,
    seller: {
      id: "usr-04",
      name: "Lucía Morales",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
      rating: 4.6,
      reviewsCount: 9,
      verified: false
    }
  },
  {
    id: "prod-106",
    title: "Sofá Escandinavo 3 Plazas Chaise Longue Gris",
    price: 420,
    currency: "USD",
    category: "home",
    categoryName: "Hogar",
    location: "Bilbao, ES",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
    description: "Tapizado en tela impermeable antimanchas. Como nuevo, apenas 6 meses de uso por mudanza.",
    likesCount: 19,
    isLiked: false,
    viewsCount: 210,
    createdAt: "Hace 4 días",
    status: "aprobado",
    featured: false,
    seller: {
      id: "usr-05",
      name: "Mateo Gómez",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
      rating: 4.5,
      reviewsCount: 7,
      verified: true
    }
  }
];

export const MOCK_USERS = [
  {
    id: "usr-admin",
    name: "Webmaster Admin",
    email: "admin@mercadosocial.com",
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
    joinedDate: "15 Ene 2024",
    status: "activo", // activo | suspendido
    postsCount: 12,
    reportedCount: 0
  },
  {
    id: "usr-01",
    name: "Carlos Méndez",
    email: "carlos.m@example.com",
    role: "user",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    joinedDate: "03 Feb 2024",
    status: "activo",
    postsCount: 4,
    reportedCount: 0
  },
  {
    id: "usr-02",
    name: "Inmobiliaria Viva Sol",
    email: "contacto@vivasol.es",
    role: "user",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    joinedDate: "10 Mar 2024",
    status: "activo",
    postsCount: 19,
    reportedCount: 1
  },
  {
    id: "usr-spammer",
    name: "Bot Ofertas Rápidas",
    email: "spam.crypto@fake.org",
    role: "user",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
    joinedDate: "20 May 2024",
    status: "suspendido",
    postsCount: 34,
    reportedCount: 14
  }
];

export const MOCK_ADS = [
  {
    id: "ad-01",
    title: "Seguros Auto Premium - 20% de Descuento",
    advertiser: "Aseguradora Global",
    image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
    link: "https://example.com/promo-seguros",
    impressions: 14230,
    clicks: 840,
    status: "activo",
    placement: "feed_banner"
  },
  {
    id: "ad-02",
    title: "Cursos de Programación con IA y Certificación",
    advertiser: "Tech Academy Online",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80",
    link: "https://example.com/academia",
    impressions: 9840,
    clicks: 520,
    status: "activo",
    placement: "sidebar_admin"
  }
];

export const MOCK_ADMIN_STATS = {
  totalUsers: 1248,
  usersGrowth: "+12.4% este mes",
  activeListings: 3520,
  listingsGrowth: "+8.1% esta semana",
  pendingModeration: 7,
  reportedItems: 3,
  adRevenue: "$4,280 USD",
  adRevenueGrowth: "+18.2% vs mes anterior"
};
