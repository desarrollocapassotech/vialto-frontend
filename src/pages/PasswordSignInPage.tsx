import { useAuth, useClerk, useSignIn } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type ClerkLikeError = {
  errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
};

function getClerkErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybe = error as ClerkLikeError;
    const first = maybe.errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return "No se pudo iniciar sesión. Revisá las credenciales e intentá de nuevo.";
}

function isAlreadySignedInError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as ClerkLikeError).errors?.[0]?.code ?? "";
  return code.includes("session") || code.includes("signed_in");
}

export function PasswordSignInPage() {
  const navigate = useNavigate();
  const { isLoaded, signIn, setActive } = useSignIn();
  const clerk = useClerk();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mfaActivo, setMfaActivo] = useState(false);
  const [mfaCodigo, setMfaCodigo] = useState("");

  // Si ya está autenticado, ir al home
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [authLoaded, isSignedIn]);

  // Detectar sesiones pendientes con tarea al cargar
  useEffect(() => {
    if (!isLoaded) return;
    const allSessions: any[] = (clerk.client as any)?.sessions ?? [];
    const pending = allSessions.find(
      (s) => s.status === "pending" && s.currentTask?.key,
    );
    if (pending) {
      const taskRoutes: Record<string, string> = {
        "setup-mfa": "/tasks/setup-mfa",
        "choose-organization": "/tasks/choose-organization",
        "reset-password": "/tasks/reset-password",
      };
      const path = taskRoutes[pending.currentTask.key];
      if (path) navigate(path, { replace: true });
    }
  }, [isLoaded]);

  // Si hay un sign-in previo en estado needs_second_factor (MFA pendiente), retomarlo
  useEffect(() => {
    if (!isLoaded || !signIn) return;
    if (signIn.status === "needs_second_factor") {
      setMfaActivo(true);
      setInfo(
        "Hay un inicio de sesión pendiente. Ingresá el código de verificación.",
      );
    }
  }, [isLoaded, signIn?.status]);

  async function attemptSignIn() {
    const result = await signIn!.create({
      identifier: email.trim(),
      password,
    });

    if (result.status === "complete") {
      if (result.createdSessionId) {
        await setActive!({ session: result.createdSessionId });
      }
      navigate("/", { replace: true });
      return;
    }

    if (result.status === "needs_second_factor") {
      const hasEmailFactor = signIn!.supportedSecondFactors?.some(
        (f) => f.strategy === "email_code",
      );
      if (!hasEmailFactor) {
        setError(
          "Se requiere un segundo factor, pero no está disponible el envío por email.",
        );
        return;
      }
      await signIn!.prepareSecondFactor({ strategy: "email_code" });
      setMfaCodigo("");
      setMfaActivo(true);
      setInfo("Te enviamos un código de verificación por email.");
      setError(null);
      return;
    }

    if (result.status === "needs_first_factor") {
      setError("Se requiere información adicional para iniciar sesión.");
      return;
    }
    if (result.status === "needs_new_password") {
      setError("Debes establecer una nueva contraseña.");
      return;
    }
    if (result.status === "needs_identifier") {
      setError("Se requiere un identificador válido.");
      return;
    }

    setError(
      `Estado de autenticación inesperado: ${result.status}. Revisá tus credenciales.`,
    );
  }

  async function onSubmit() {
    if (!isLoaded) return;
    if (authLoaded && isSignedIn) {
      navigate("/", { replace: true });
      return;
    }
    if (!email.trim()) {
      setError("Ingresá un email.");
      return;
    }
    if (!password) {
      setError("Ingresá una contraseña.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await attemptSignIn();
    } catch (e) {
      if (isAlreadySignedInError(e)) {
        // activeSessions está en el clerk instance, no en clerk.client
        const existing =
          (clerk as any).activeSessions?.[0] ??
          clerk.client?.signedInSessions?.[0];
        if (existing && setActive) {
          try {
            await setActive({ session: existing.id });
            navigate("/", { replace: true });
            return;
          } catch {
            /* fall through */
          }
        }
        // Destruir todas las sesiones del cliente y reintentar
        try {
          await clerk.client?.removeSessions();
          await attemptSignIn();
        } catch (retryErr) {
          if (isAlreadySignedInError(retryErr)) {
            // Hay una sesión pending con tarea que no se puede limpiar — redirigir a la tarea
            const allSessions: any[] = (clerk.client as any)?.sessions ?? [];
            const pending = allSessions.find(
              (s) => s.status === "pending" && s.currentTask?.key,
            );
            const taskRoutes: Record<string, string> = {
              "setup-mfa": "/tasks/setup-mfa",
              "choose-organization": "/tasks/choose-organization",
              "reset-password": "/tasks/reset-password",
            };
            const path = pending ? taskRoutes[pending.currentTask.key] : null;
            if (path) {
              navigate(path, { replace: true });
            } else {
              setError(
                "Hay una sesión activa que no se puede limpiar. Borrá las cookies del sitio (DevTools → Application → Cookies → obliging-sunfish-91.clerk.accounts.dev) e intentá de nuevo.",
              );
            }
          } else {
            setError(getClerkErrorMessage(retryErr));
          }
        }
      } else {
        setError(getClerkErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onMfaSubmit() {
    if (!isLoaded || !signIn) return;
    if (!mfaCodigo.trim()) {
      setError("Ingresá el código de verificación que recibiste por email.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: mfaCodigo.trim(),
      });

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        navigate("/", { replace: true });
        return;
      }

      setError("No se pudo completar la verificación por email.");
    } catch (e) {
      setError(getClerkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    if (!isLoaded) return;
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/#/sso-callback",
        redirectUrlComplete: "/#/",
      });
    } catch (e) {
      setError(getClerkErrorMessage(e));
      setGoogleLoading(false);
    }
  }

  if (mfaActivo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal px-4">
        <div className="w-full max-w-md bg-vialto-graphite border border-white/10 shadow-xl p-6">
          <h1 className="text-center font-[family-name:var(--font-display)] text-2xl tracking-wide text-white">
            Verificación por email
          </h1>
          <p className="mt-3 text-center text-sm text-white/60">
            Ingresá el código que te enviamos a tu correo electrónico.
          </p>

          {info && (
            <p className="mt-4 text-sm text-amber-200 bg-amber-900/30 border border-amber-600/50 px-3 py-2">
              {info}
            </p>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-200 bg-red-900/30 border border-red-700/50 px-3 py-2">
              {error}
            </p>
          )}

          <form
            className="mt-5 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void onMfaSubmit();
            }}
          >
            <label className="grid gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/70">
                Código de verificación
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="h-10 border border-white/15 bg-white px-3 text-sm tracking-widest"
                value={mfaCodigo}
                onChange={(e) => setMfaCodigo(e.target.value)}
                placeholder="000000"
                maxLength={8}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="h-10 bg-vialto-fire hover:bg-vialto-bright text-sm uppercase tracking-wider text-white disabled:opacity-60"
            >
              {loading ? "Verificando…" : "Verificar"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMfaActivo(false);
              setMfaCodigo("");
              setError(null);
              setInfo(null);
            }}
            className="mt-4 w-full text-center text-sm text-white/50 hover:text-white/80"
          >
            ← Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal px-4">
      <div className="w-full max-w-md bg-vialto-graphite border border-white/10 shadow-xl p-6">
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl tracking-wide text-white">
          Iniciar sesión
        </h1>

        {error && (
          <p className="mt-4 text-sm text-red-200 bg-red-900/30 border border-red-700/50 px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={googleLoading}
          className="mt-5 h-10 w-full inline-flex items-center justify-center gap-2 border border-white/20 bg-white text-sm uppercase tracking-wider text-vialto-charcoal hover:bg-white/90"
        >
          <img
            src="/google-logo.png"
            alt=""
            aria-hidden="true"
            className="h-4 w-4 object-contain"
          />
          {googleLoading ? "Redirigiendo…" : "Ingresar con Google"}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/55">
          Serás redirigido a Google para continuar.
        </p>

        <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-white/60">
          <span className="h-px flex-1 bg-white/15" />
          <span>o con email y contraseña</span>
          <span className="h-px flex-1 bg-white/15" />
        </div>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/70">
              Email
            </span>
            <input
              type="email"
              className="h-10 border border-white/15 bg-white px-3 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/70">
              Contraseña
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="h-10 w-full border border-white/15 bg-white px-3 pr-24 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-charcoal"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="h-10 bg-vialto-fire hover:bg-vialto-bright text-sm uppercase tracking-wider text-white disabled:opacity-60"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            to="/sign-up"
            className="text-vialto-bright hover:text-vialto-light"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
