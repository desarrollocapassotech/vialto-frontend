import { useSignUp } from '@clerk/clerk-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import {
  AuthAviso,
  AuthBotonGoogle,
  AuthBotonPrincipal,
  AuthCampo,
  AuthCampoPassword,
  AuthSeparador,
} from '@/components/auth/AuthCampos';

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
  return 'No se pudo crear la cuenta. Revisá los datos e intentá de nuevo.';
}

export function PasswordSignUpPage() {
  const navigate = useNavigate();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!isLoaded) return;
    if (!firstName.trim()) { setError('Ingresá tu nombre.'); return; }
    if (!lastName.trim()) { setError('Ingresá tu apellido.'); return; }
    if (!email.trim()) { setError('Ingresá un email.'); return; }
    if (!password) { setError('Ingresá una contraseña.'); return; }

    setLoading(true);
    setError(null);
    try {
      await signUp.create({ firstName: firstName.trim(), lastName: lastName.trim(), emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (e) {
      setError(getClerkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    if (!isLoaded) return;
    if (!code.trim()) { setError('Ingresá el código de verificación.'); return; }

    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        navigate('/', { replace: true });
      } else {
        setError('No se pudo completar la verificación.');
      }
    } catch (e) {
      setError(getClerkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignUp() {
    if (!isLoaded) return;
    setError(null);
    setGoogleLoading(true);
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/#/sso-callback',
        redirectUrlComplete: '/#/',
      });
    } catch (e) {
      setError(getClerkErrorMessage(e));
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout
      titulo={pendingVerification ? 'Verificá tu email' : 'Crear cuenta'}
      subtitulo={
        pendingVerification ? (
          <>
            Te enviamos un código a <span className="font-medium text-vialto-charcoal">{email}</span>.
            Ingresalo para activar tu cuenta.
          </>
        ) : (
          'Empezá a gestionar viajes, facturación y flota en minutos.'
        )
      }
      pie={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/sign-in" className="font-semibold text-vialto-fire underline-offset-4 hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      {error && <AuthAviso tipo="error">{error}</AuthAviso>}

      {!pendingVerification ? (
        <>
          <AuthBotonGoogle onClick={() => void onGoogleSignUp()} cargando={googleLoading}>
            {googleLoading ? 'Redirigiendo a Google…' : 'Registrarse con Google'}
          </AuthBotonGoogle>

          <AuthSeparador texto="o con tu email" />

          <form
            className="grid gap-4"
            onSubmit={(e) => { e.preventDefault(); void onSubmit(); }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthCampo
                label="Nombre"
                icon={User}
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
                autoComplete="given-name"
              />
              <AuthCampo
                label="Apellido"
                icon={User}
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="García"
                autoComplete="family-name"
              />
            </div>
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
              placeholder="Elegí una contraseña"
              autoComplete="new-password"
            />
            <AuthBotonPrincipal cargando={loading}>
              {loading ? 'Creando cuenta' : 'Crear cuenta'}
            </AuthBotonPrincipal>
          </form>
        </>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => { e.preventDefault(); void onVerify(); }}
        >
          <AuthCampo
            label="Código de verificación"
            icon={ShieldCheck}
            type="text"
            inputMode="numeric"
            className="tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            autoFocus
          />
          <AuthBotonPrincipal cargando={loading}>
            {loading ? 'Verificando' : 'Verificar'}
          </AuthBotonPrincipal>
        </form>
      )}
    </AuthLayout>
  );
}