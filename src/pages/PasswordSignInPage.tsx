import { useAuth, useClerk, useSignIn } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import {
  AuthAviso,
  AuthBotonGoogle,
  AuthBotonPrincipal,
  AuthCampo,
  AuthCampoPassword,
  AuthSeparador,
} from "@/components/auth/AuthCampos";

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
      <AuthLayout
        titulo="Verificá tu identidad"
        subtitulo="Ingresá el código que te enviamos a tu correo electrónico."
        pie={
          <button
            type="button"
            onClick={() => {
              setMfaActivo(false);
              setMfaCodigo("");
              setError(null);
              setInfo(null);
            }}
            className="font-medium text-vialto-charcoal underline-offset-4 hover:text-vialto-fire hover:underline"
          >
            ← Volver al inicio de sesión
          </button>
        }
      >
        {info && <AuthAviso tipo="info">{info}</AuthAviso>}
        {error && <AuthAviso tipo="error">{error}</AuthAviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onMfaSubmit();
          }}
        >
          <AuthCampo
            label="Código de verificación"
            icon={ShieldCheck}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="tracking-[0.4em]"
            value={mfaCodigo}
            onChange={(e) => setMfaCodigo(e.target.value)}
            placeholder="000000"
            maxLength={8}
          />
          <AuthBotonPrincipal cargando={loading}>
            {loading ? "Verificando" : "Verificar"}
          </AuthBotonPrincipal>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titulo="Iniciar sesión"
      subtitulo="Bienvenido de nuevo. Ingresá para gestionar tu operación."
      pie={
        <>
          ¿No tenés cuenta?{" "}
          <Link to="/sign-up" className="font-semibold text-vialto-fire underline-offset-4 hover:underline">
            Crear cuenta
          </Link>
        </>
      }
    >
      {error && <AuthAviso tipo="error">{error}</AuthAviso>}

      <AuthBotonGoogle onClick={() => void onGoogleSignIn()} cargando={googleLoading}>
        {googleLoading ? "Redirigiendo a Google…" : "Continuar con Google"}
      </AuthBotonGoogle>

      <AuthSeparador texto="o con tu email" />

      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <AuthCampo
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@empresa.com"
          autoComplete="email"
        />
        <AuthCampoPassword
          label="Contraseña"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tu contraseña"
          autoComplete="current-password"
        />
        <AuthBotonPrincipal cargando={loading}>
          {loading ? "Ingresando" : "Ingresar"}
        </AuthBotonPrincipal>
      </form>
    </AuthLayout>
  );
}