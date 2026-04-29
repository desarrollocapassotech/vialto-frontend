import { useSignIn } from '@clerk/clerk-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type ClerkLikeError = {
  errors?: Array<{ longMessage?: string; message?: string }>;
};

function getClerkErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as ClerkLikeError;
    const first = maybe.errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return 'No se pudo iniciar sesión. Revisá las credenciales e intentá de nuevo.';
}

export function PasswordSignInPage() {
  const navigate = useNavigate();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaActivo, setMfaActivo] = useState(false);
  const [mfaCodigo, setMfaCodigo] = useState('');

  async function onSubmit() {
    if (!isLoaded) return;
    if (!email.trim()) {
      setError('Ingresá un email.');
      return;
    }
    if (!password) {
      setError('Ingresá una contraseña.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      console.log('Clerk signIn result:', result);

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        navigate('/', { replace: true });
        return;
      }

      if (result.status === 'needs_second_factor') {
        const hasEmailFactor = signIn.supportedSecondFactors?.some((factor) => factor.strategy === 'email_code');
        if (!hasEmailFactor) {
          setError('Se requiere un segundo factor, pero no está disponible el envío por email.');
          return;
        }

        await signIn.prepareSecondFactor({ strategy: 'email_code' });
        setMfaCodigo('');
        setMfaActivo(true);
        setError('Te enviamos un código de verificación por email.');
        return;
      }

      // Manejar otros estados posibles de Clerk
      if (result.status === 'needs_first_factor') {
        setError('Se requiere información adicional para iniciar sesión.');
        return;
      }

      if (result.status === 'needs_new_password') {
        setError('Debes establecer una nueva contraseña.');
        return;
      }

      if (result.status === 'needs_identifier') {
        setError('Se requiere un identificador válido.');
        return;
      }

      // Para cualquier otro estado desconocido, mostrar el estado
      setError(`Estado de autenticación inesperado: ${result.status}. Revisá tus credenciales.`);
    } catch (e) {
      setError(getClerkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onMfaSubmit() {
    if (!isLoaded || !signIn) return;
    if (!mfaCodigo.trim()) {
      setError('Ingresá el código de verificación que recibiste por email.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: mfaCodigo.trim(),
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        navigate('/', { replace: true });
        return;
      }

      setError('No se pudo completar la verificación por email.');
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
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
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
              {loading ? 'Verificando…' : 'Verificar'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMfaActivo(false);
              setMfaCodigo('');
              setError(null);
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
          <img src="/google-logo.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
          {googleLoading ? 'Redirigiendo…' : 'Ingresar con Google'}
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
                type={showPassword ? 'text' : 'password'}
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
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="h-10 bg-vialto-fire hover:bg-vialto-bright text-sm uppercase tracking-wider text-white disabled:opacity-60"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/sign-up" className="text-vialto-bright hover:text-vialto-light">
            Crear cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
