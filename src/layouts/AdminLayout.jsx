// Layout principal Desktop-First para el panel de administración del Webmaster
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";
import AdminHeader from "../components/admin/AdminHeader";
import RoleSwitcherBanner from "../components/common/RoleSwitcherBanner";

export const AdminLayout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Barra lateral Desktop-First */}
      <AdminSidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Área de contenido principal con margen para el sidebar en desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Barra superior de administración */}
        <AdminHeader setIsMobileOpen={setIsMobileOpen} />

        {/* Vista dinámica de la ruta hija */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Selector de roles de prueba */}
      <RoleSwitcherBanner />
    </div>
  );
};

export default AdminLayout;
