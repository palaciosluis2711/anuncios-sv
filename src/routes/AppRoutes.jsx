// Definición central del enrutador de la aplicación (React Router v6/v7)
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Layouts principales
import MobileLayout from "../layouts/MobileLayout";
import AdminLayout from "../layouts/AdminLayout";

// Guardián de rutas protegidas
import ProtectedRoute from "./ProtectedRoute";

// Páginas de la App Móvil
import HomePage from "../pages/mobile/HomePage";
import ExplorePage from "../pages/mobile/ExplorePage";
import PublishPage from "../pages/mobile/PublishPage";
import ProfilePage from "../pages/mobile/ProfilePage";
import ProductDetailPage from "../pages/mobile/ProductDetailPage";
import SellerProfilePage from "../pages/mobile/SellerProfilePage";
import LoginPage from "../pages/mobile/LoginPage";

// Páginas del Panel Webmaster (Admin)
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminModeration from "../pages/admin/AdminModeration";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminAds from "../pages/admin/AdminAds";
import AdminSettings from "../pages/admin/AdminSettings";

export const AppRoutes = () => {
  return (
    <Routes>
      {/* ============================================================ */}
      {/* 1. RUTAS PÚBLICAS Y DE USUARIO (Mobile-First Layout)          */}
      {/* ============================================================ */}
      <Route element={<MobileLayout />}>
        {/* Feed de inicio */}
        <Route path="/" element={<HomePage />} />
        
        {/* Exploración de categorías */}
        <Route path="/explore" element={<ExplorePage />} />
        
        {/* Publicar anuncio (Protegido para usuarios autenticados) */}
        <Route
          path="/publish"
          element={
            <ProtectedRoute requireAdmin={false}>
              <PublishPage />
            </ProtectedRoute>
          }
        />
        
        {/* Perfil del usuario y sus publicaciones */}
        <Route path="/profile" element={<ProfilePage />} />
        
        {/* Detalle del producto */}
        <Route path="/product/:id" element={<ProductDetailPage />} />

        {/* Perfil público del vendedor */}
        <Route path="/seller/:sellerId" element={<SellerProfilePage />} />
        
        {/* Autenticación / Login */}
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* ============================================================ */}
      {/* 2. RUTAS PROTEGIDAS DEL WEBMASTER (/admin/* - Desktop-First) */}
      {/* ============================================================ */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard principal */}
        <Route index element={<AdminDashboard />} />
        
        {/* Moderación de anuncios */}
        <Route path="moderation" element={<AdminModeration />} />
        
        {/* Gestión de usuarios y suspensiones */}
        <Route path="users" element={<AdminUsers />} />
        
        {/* Publicidad y banners */}
        <Route path="ads" element={<AdminAds />} />
        
        {/* Ajustes técnicos */}
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Ruta comodín de redirección */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
