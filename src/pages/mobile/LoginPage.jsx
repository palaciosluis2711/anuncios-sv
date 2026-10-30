// Pantalla de Autenticación: Registro validando Nombre de Usuario y Correo electrónico + Login y Google
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  ShoppingBag,
  AtSign,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  UserPlus,
  LogIn,
  CheckCircle2,
  Loader2,
  XCircle,
  Eye,
  EyeOff
} from "lucide-react";

export const LoginPage = () => {
  const {
    loginUser,
    registerUser,
    loginWithGoogle,
    checkUsernameAvailability,
    checkEmailAvailability,
    authError,
    setAuthError
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // Modo: 'login' o 'register' (respeta el modo solicitado desde el modal)
  const [mode, setMode] = useState(() => (location.state?.mode === "register" ? "register" : "login"));
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (location.state?.mode && (location.state.mode === "login" || location.state.mode === "register")) {
      setMode(location.state.mode);
    }
  }, [location.state]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Estado del chequeo de disponibilidad en vivo para Usuario
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // { available: boolean, message?: string, error?: string }

  // Estado del chequeo de disponibilidad en vivo para Correo
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // { available: boolean, message?: string, error?: string }

  const from = location.state?.from?.pathname || "/";

  // Verificación reactiva con debounce para Nombre de Usuario
  useEffect(() => {
    if (mode !== "register" || !username.trim()) {
      setUsernameStatus(null);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    const timeoutId = setTimeout(async () => {
      const res = await checkUsernameAvailability(username);
      setUsernameStatus(res);
      setCheckingUsername(false);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [username, mode]);

  // Verificación reactiva con debounce para Correo Electrónico
  useEffect(() => {
    if (mode !== "register" || !email.trim()) {
      setEmailStatus(null);
      setCheckingEmail(false);
      return;
    }

    setCheckingEmail(true);
    const timeoutId = setTimeout(async () => {
      const res = await checkEmailAvailability(email);
      setEmailStatus(res);
      setCheckingEmail(false);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [email, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");

    try {
      if (mode === "register") {
        if (!usernameStatus?.available) {
          throw new Error(usernameStatus?.error || "El nombre de usuario no está disponible");
        }
        if (!emailStatus?.available) {
          throw new Error(emailStatus?.error || "El correo electrónico no está disponible");
        }
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden. Por favor verifícalas.");
        }
        await registerUser(username, email, password);
        setSuccessMsg(`¡Cuenta @${username.replace(/^@/, "")} creada con éxito! Ingresando...`);
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 800);
      } else {
        await loginUser(username, password);
        navigate(from, { replace: true });
      }
    } catch (err) {
      // El error se muestra vía authError
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      // Manejado en AuthContext
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="px-4 py-4 max-w-sm mx-auto space-y-4 animate-fade-in">
      {/* Botón de retorno a pantalla anterior o feed principal */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Regresar"
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10" aria-hidden="true" />
      </div>

      {/* Título de la pantalla */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-white tracking-tight">
          {mode === "login" ? "Iniciar sesión" : "Crear nueva cuenta"}
        </h1>
        <p className="text-xs text-slate-400">
          {mode === "login"
            ? "Accede con tu usuario o correo a AnunciosSV"
            : "Completa los campos para unirte a AnunciosSV"}
        </p>
      </div>

      {/* Selector de modo: Iniciar Sesión vs Registro (altura táctil optimizada min-h-[44px]) */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => {
            setMode("login");
            setAuthError(null);
            setUsernameStatus(null);
            setEmailStatus(null);
            setConfirmPassword("");
            setShowPassword(false);
            setShowConfirmPassword(false);
          }}
          className={`flex-1 min-h-[42px] py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 font-bold ${mode === "login"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-400 hover:text-slate-200"
            }`}
        >
          <LogIn className="w-4 h-4" />
          <span>Ingresar</span>
        </button>

        <button
          onClick={() => {
            setMode("register");
            setAuthError(null);
            setConfirmPassword("");
            setShowPassword(false);
            setShowConfirmPassword(false);
          }}
          className={`flex-1 min-h-[42px] py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 font-bold ${mode === "register"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-400 hover:text-slate-200"
            }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Registrarse</span>
        </button>
      </div>

      {/* Alerta de Error */}
      {authError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5 animate-slide-up">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">{authError}</div>
        </div>
      )}

      {/* Mensaje de Éxito */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo 1: Nombre de Usuario */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              {mode === "register" ? "Nombre de usuario" : "Usuario"}
            </label>
          </div>

          <div className="relative">
            <AtSign className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === "register" ? "usuario_ejemplo" : "usuario"}
              className={`w-full min-h-[48px] pl-11 pr-11 py-3 rounded-xl bg-slate-900 border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${mode === "register" && usernameStatus
                ? usernameStatus.available
                  ? "border-emerald-500/70 focus:border-emerald-500"
                  : "border-red-500/70 focus:border-red-500"
                : "border-slate-800 focus:border-indigo-500"
                }`}
            />

            {/* Indicador de disponibilidad para Usuario */}
            {mode === "register" && username.trim() && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {checkingUsername ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : usernameStatus?.available ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
            )}
          </div>

          {mode === "register" && username.trim() && !checkingUsername && usernameStatus && (
            <div className="mt-1 text-[11px] flex items-center gap-1">
              {usernameStatus.available ? (
                <span className="text-emerald-400 font-medium">✓ {usernameStatus.message}</span>
              ) : (
                <span className="text-red-400 font-medium">✕ {usernameStatus.error}</span>
              )}
            </div>
          )}
        </div>

        {/* Campo 2: Correo Electrónico (Solo visible en Registro) */}
        {mode === "register" && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Correo Electrónico
              </label>
            </div>

            <div className="relative">
              <Mail className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className={`w-full min-h-[48px] pl-11 pr-11 py-3 rounded-xl bg-slate-900 border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${emailStatus
                  ? emailStatus.available
                    ? "border-emerald-500/70 focus:border-emerald-500"
                    : "border-red-500/70 focus:border-red-500"
                  : "border-slate-800 focus:border-indigo-500"
                  }`}
              />

              {/* Indicador de disponibilidad para Correo (solo icono) */}
              {email.trim() && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  {checkingEmail ? (
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : emailStatus?.available ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              )}
            </div>

            {/* En correo solo se muestra mensaje si hay error (si está disponible solo muestra el check) */}
            {email.trim() && !checkingEmail && emailStatus && !emailStatus.available && (
              <div className="mt-1 text-[11px] flex items-center gap-1">
                <span className="text-red-400 font-medium">✕ {emailStatus.error}</span>
              </div>
            )}
          </div>
        )}

        {/* Campo: Contraseña con botón de ver/ocultar */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contraseña</label>
          <div className="relative">
            <Lock className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Mínimo 6 caracteres" : "contraseña"}
              className="w-full min-h-[48px] pl-11 pr-11 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>

        {/* Campo: Repetir Contraseña (Solo en Registro) */}
        {mode === "register" && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Repetir contraseña</label>
            <div className="relative">
              <Lock className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className={`w-full min-h-[48px] pl-11 pr-11 py-3 rounded-xl bg-slate-900 border text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${confirmPassword
                    ? password === confirmPassword
                      ? "border-emerald-500/70 focus:border-emerald-500"
                      : "border-red-500/70 focus:border-red-500"
                    : "border-slate-800 focus:border-indigo-500"
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>

            {/* Mensaje de validación de contraseñas */}
            {confirmPassword && (
              <div className="mt-1 text-[11px] flex items-center gap-1">
                {password === confirmPassword ? (
                  <span className="text-emerald-400 font-medium">✓ Las contraseñas coinciden</span>
                ) : (
                  <span className="text-red-400 font-medium">✕ Las contraseñas no coinciden</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Botón de Envío (altura estándar móvil min-h-[48px]) */}
        <button
          type="submit"
          disabled={
            loading ||
            (mode === "register" &&
              (!usernameStatus?.available ||
                !emailStatus?.available ||
                checkingUsername ||
                checkingEmail ||
                !password ||
                password.length < 6 ||
                !confirmPassword ||
                password !== confirmPassword))
          }
          className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {loading
            ? (mode === "register" ? "Creando cuenta..." : "Iniciando sesión...")
            : mode === "register"
              ? "Crear cuenta"
              : "Iniciar sesión"}
        </button>
      </form>

      {/* Botón de Google Auth (altura estándar móvil min-h-[48px]) */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-slate-200 hover:text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors active:scale-[0.99]"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.5 0 2.8.5 3.9 1.4l2.9-2.9C17 1.8 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.8C6.5 7.1 9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.8c2.2-2 3.7-5 3.7-8.7z"
          />
          <path
            fill="#FBBC05"
            d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
          />
          <path
            fill="#34A853"
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.8c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5l-3.7 2.9C3.7 20.4 7.5 23 12 23z"
          />
        </svg>
        <span>Continuar con Google</span>
      </button>
    </div>
  );
};

export default LoginPage;
