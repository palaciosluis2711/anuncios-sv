# AnunciosSV 🇸🇻

> **Plataforma Progresiva (PWA) de Clasificados y Red Social para El Salvador.**
> Conectando compradores y vendedores salvadoreños con una experiencia móvil moderna, rápida y fluida al estilo iOS/iPhone.

---

## 📱 Características Principales

- **Diseño Mobile-First (Estilo iOS):**
  - Controles e inputs táctiles adaptados a los estándares de la web móvil (`min-h-[48px]`).
  - Navegación inferior persistente (`BottomNav`) y cabecera fija con respuesta dinámica.
  - Simulador de vista previa de dispositivo móvil para visualización en pantallas de escritorio.

- **Feed Dinámico de Publicaciones:**
  - Exploración por departamentos de El Salvador (San Salvador, Santa Ana, San Miguel, La Libertad, etc.).
  - Categorías principales (Productos, Servicios, Vehículos, Inmuebles, Empleos) y subcategorías filtrables.
  - Soporte de artículos destacados, badges de estado, precios negociables o gratuitos.

- **Publicación Intuitiva en 2 Pasos:**
  - **Paso 1: Detalles del Anuncio:** Selector de fotos con carrete modal interactivo (reordenar principal, recortar y reemplazar), inputs con validación en tiempo real y desplazamiento suave centrado automático (`smooth scroll`) hacia los campos faltantes.
  - **Paso 2: Promocionar Anuncio:** Opción para destacar la publicación o publicarla de manera gratuita.

- **Preferencias de Entrega y Stock (para Productos):**
  - Configuración rápida de unidades disponibles o "Artículo único".
  - Opciones de entrega: Lugar Público, Retiro en Local y Envío a domicilio.

- **Perfil de Usuario y Gestión:**
  - Pestaña de "Mis Anuncios" con sincronización reactiva inmediata.
  - Modo invitado y autenticación completa con Firebase.

---

## 🚀 Tecnologías Utilizadas

- **Framework:** [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- **Estilos:** [Tailwind CSS v3](https://tailwindcss.com/)
- **Iconos:** [Lucide React](https://lucide.dev/)
- **Navegación:** [React Router DOM v7](https://reactrouter.com/)
- **Backend / BaaS:** [Firebase](https://firebase.google.com/) (Authentication, Firestore, Storage) + Servicio local reactivo de respaldo.

---

## 🛠️ Instalación y Configuración Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/palaciosluis2711/anuncios-sv.git
   cd anuncios-sv
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo `.env.example` a `.env` y define tus credenciales de Firebase:
   ```bash
   cp .env.example .env
   ```

4. **Ejecutar en modo de desarrollo:**
   ```bash
   npm run dev
   ```

5. **Compilar para producción:**
   ```bash
   npm run build
   ```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
