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
import PublishPage from "../pages/mobile/PublishPage";
import ProfilePage from "../pages/mobile/ProfilePage";
import EditProfilePage from "../pages/mobile/EditProfilePage";
import ProductDetailPage from "../pages/mobile/ProductDetailPage";
import ManageProductPage from "../pages/mobile/ManageProductPage";
import SellerProfilePage from "../pages/mobile/SellerProfilePage";
import UserReputationPage from "../pages/mobile/UserReputationPage";
import LoginPage from "../pages/mobile/LoginPage";
import MessagesPage from "../pages/mobile/MessagesPage";
import ChatDetailPage from "../pages/mobile/ChatDetailPage";
import BlockedUsersPage from "../pages/mobile/BlockedUsersPage";
import PromoteAdPage from "../pages/mobile/PromoteAdPage";
import PaymentReturnPage from "../pages/mobile/PaymentReturnPage";
import PagaditoSandboxPage from "../pages/mobile/PagaditoSandboxPage";
import NotificationsPage from "../pages/mobile/NotificationsPage";

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
        
        {/* Redirección de la antigua sección Explorar hacia los Chats */}
        <Route path="/explore" element={<Navigate to="/messages" replace />} />
        
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

        {/* Pantalla dedicada para Editar Perfil y Datos de la Cuenta */}
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute requireAdmin={false}>
              <EditProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Reputación y valoraciones recibidas por el usuario */}
        <Route path="/profile/reputation" element={<UserReputationPage />} />

        {/* Notificaciones y avisos de actividad */}
        <Route path="/notifications" element={<NotificationsPage />} />
        
        {/* Detalle del producto */}
        <Route path="/product/:id" element={<ProductDetailPage />} />

        {/* Destacar anuncio con halo dorado y posicionamiento preferencial */}
        <Route path="/promote-ad/:id" element={<PromoteAdPage />} />

        {/* Retorno y confirmación de pago con Pagadito */}
        <Route path="/payment-return" element={<PaymentReturnPage />} />

        {/* Pasarela simulada de Pagadito Sandbox para pruebas de desarrollo */}
        <Route path="/pagadito-sandbox/:tokenTrans" element={<PagaditoSandboxPage />} />

        {/* Gestión de anuncio por su propietario */}
        <Route
          path="/manage-product/:id"
          element={
            <ProtectedRoute requireAdmin={false}>
              <ManageProductPage />
            </ProtectedRoute>
          }
        />

        {/* Perfil público del vendedor */}
        <Route path="/seller/:sellerId" element={<SellerProfilePage />} />
        
        {/* Mensajería interna: Bandeja de entrada */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute requireAdmin={false}>
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        {/* Mensajería interna: Conversación individual */}
        <Route
          path="/messages/:conversationId"
          element={
            <ProtectedRoute requireAdmin={false}>
              <ChatDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Gestión de usuarios bloqueados */}
        <Route
          path="/blocked-users"
          element={
            <ProtectedRoute requireAdmin={false}>
              <BlockedUsersPage />
            </ProtectedRoute>
          }
        />

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
