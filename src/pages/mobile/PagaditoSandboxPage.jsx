// Pantalla interactiva que simula la pasarela de cobro segura de Pagadito Sandbox (El Salvador)
// Permite verificar el flujo de cobro con tarjetas de prueba antes de contar con credenciales de producción
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Lock,
  ShieldCheck,
  Info
} from "lucide-react";
import { updateSandboxTransactionStatus } from "../../services/pagaditoService";

export const PagaditoSandboxPage = () => {
  const { tokenTrans } = useParams();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [testCard, setTestCard] = useState({
    number: "4111 2222 3333 4444",
    name: "JUAN PEREZ (USUARIO PRUEBA)",
    expiry: "12/28",
    cvc: "123"
  });

  // Cargar datos de la transacción desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("anunciossv_pagadito_transactions");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[tokenTrans]) {
          setTransaction(parsed[tokenTrans]);
        }
      }
    } catch (err) {
      console.error("Error al cargar transacción simulada de Pagadito:", err);
    }
  }, [tokenTrans]);

  // Completar pago simulado exitoso
  const handleApprovePayment = async () => {
    setIsProcessing(true);
    try {
      // Simular tiempo de respuesta bancaria
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Marcar transacción como COMPLETED en Pagadito
      updateSandboxTransactionStatus(tokenTrans, "COMPLETED");

      // Redirigir de regreso a la aplicación mediante el callback oficial
      navigate(`/payment-return?token=${tokenTrans}&status=success`, { replace: true });
    } catch (err) {
      alert("Error en la pasarela de prueba: " + err.message);
      setIsProcessing(false);
    }
  };

  // Cancelar la transacción
  const handleCancelPayment = () => {
    updateSandboxTransactionStatus(tokenTrans, "REVOKED");
    navigate(`/payment-return?token=${tokenTrans}&status=cancelled`, { replace: true });
  };

  const amount = transaction ? Number(transaction.amount).toFixed(2) : "7.99";
  const productTitle = transaction?.customParams?.productTitle || "Destacar anuncio en AnunciosSV";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-start pb-12 font-sans">
      {/* Cabecera institucional de Pagadito Sandbox */}
      <header className="w-full bg-[#004B93] text-white py-3.5 px-4 shadow-md border-b-4 border-[#F37021]">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1 font-black text-[#004B93] text-sm tracking-tighter">
              <span>PAGADITO</span>
              <span className="text-[#F37021]">.com</span>
            </div>
            <span className="text-[10px] uppercase font-bold bg-[#F37021] text-white px-1.5 py-0.5 rounded tracking-wider">
              Sandbox
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-blue-100">
            <Lock className="w-3.5 h-3.5 text-emerald-300" />
            <span>256-bit SSL</span>
          </div>
        </div>
      </header>

      {/* Contenedor principal de la pasarela */}
      <main className="w-full max-w-md px-4 py-5 space-y-4">
        {/* Banner informativo de ambiente de pruebas */}
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 shadow-sm">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="leading-tight space-y-0.5">
            <div className="font-bold">Ambiente de pruebas Pagadito Sandbox</div>
            <div className="text-[11px] text-amber-800">
              Esta es una simulación visual de la pasarela de Pagadito en El Salvador. No se realizarán cargos a dinero real.
            </div>
          </div>
        </div>

        {/* Resumen de la orden de cobro */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comercio afiliado</div>
              <div className="text-sm font-bold text-slate-800">AnunciosSV El Salvador</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</div>
              <div className="text-base font-extrabold text-[#004B93]">${amount} USD</div>
            </div>
          </div>

          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Concepto:</span> {productTitle}
          </div>
        </div>

        {/* Formulario de tarjeta de crédito/débito */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#004B93]" />
              <span>Datos de la tarjeta de prueba</span>
            </h3>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                VISA
              </span>
              <span className="text-[10px] font-extrabold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                MC
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">Número de Tarjeta:</label>
              <input
                type="text"
                value={testCard.number}
                onChange={(e) => setTestCard({ ...testCard, number: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-slate-800 focus:outline-none focus:border-[#004B93] focus:ring-1 focus:ring-[#004B93]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">Nombre del Titular:</label>
              <input
                type="text"
                value={testCard.name}
                onChange={(e) => setTestCard({ ...testCard, name: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-slate-800 uppercase focus:outline-none focus:border-[#004B93] focus:ring-1 focus:ring-[#004B93]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Expiración:</label>
                <input
                  type="text"
                  value={testCard.expiry}
                  onChange={(e) => setTestCard({ ...testCard, expiry: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-center font-mono text-slate-800 focus:outline-none focus:border-[#004B93]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">CVV / CVC:</label>
                <input
                  type="password"
                  value={testCard.cvc}
                  onChange={(e) => setTestCard({ ...testCard, cvc: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-center font-mono text-slate-800 focus:outline-none focus:border-[#004B93]"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleApprovePayment}
              className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#004B93] hover:bg-[#003B75] text-white font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Procesando con Pagadito...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Pagar ${amount} USD con Pagadito</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleCancelPayment}
              className="w-full min-h-[38px] py-2 px-4 rounded-xl text-slate-500 hover:text-rose-600 text-xs font-semibold transition-colors"
            >
              Cancelar y volver a AnunciosSV
            </button>
          </div>
        </div>

        {/* Sellos de confianza y seguridad */}
        <div className="text-center space-y-1 text-[11px] text-slate-500 pt-2">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Pasarela certificada PCI-DSS Nivel 1</span>
          </div>
          <div>Pagadito El Salvador © Todos los derechos reservados.</div>
        </div>
      </main>
    </div>
  );
};

export default PagaditoSandboxPage;
