import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Upload,
  FolderKanban,
  Receipt,
  UserCog,
  Database,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  Mail,
  ExternalLink,
  KeyRound,
  ArrowLeft,
  LayoutDashboard,
  Users,
  QrCode,
} from 'lucide-react';
import type { CreatorDashboardData, CreatorProfile, SupabaseStatus } from '../types';
import { getBrowserSupabaseClient } from '../lib/supabaseBrowser';
import { AdminOverview } from './studio/AdminOverview';
import { MediaUploader } from './studio/MediaUploader';
import { MediaManager } from './studio/MediaManager';
import { FansManager } from './studio/FansManager';
import { SalesLedger } from './studio/SalesLedger';
import { PixManager } from './studio/PixManager';
import { CreatorProfileSettings } from './studio/CreatorProfileSettings';
import { SupabaseSetup } from './studio/SupabaseSetup';

export type StudioTab = 'overview' | 'upload' | 'manage' | 'fans' | 'pix' | 'sales' | 'profile' | 'supabase';

interface CreatorStudioProps {
  initialTab?: StudioTab;
  supabaseStatus: SupabaseStatus | null;
  profile: CreatorProfile;
  onRefreshStatus: () => Promise<void>;
  onRefreshStorefront: () => Promise<void>;
  onOpenStorefront: () => void;
}

interface AuthConfigResponse {
  needsSetup: boolean;
  needsPasswordSetup: boolean;
  adminEmailHint: string | null;
  adminEmail: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseProjectRef: string | null;
  googleOAuthReady: boolean;
  googleProviderEnabled: boolean;
}

const EMPTY_DASHBOARD: CreatorDashboardData = {
  mediaItems: [],
  sales: [],
  fans: [],
  metrics: {
    totalRevenueBrl: 0,
    vipRevenueBrl: 0,
    ppvRevenueBrl: 0,
    tipsRevenueBrl: 0,
    totalSalesCount: 0,
    activeVipFans: 0,
    totalMediaCount: 0,
  },
};

export const CreatorStudio: React.FC<CreatorStudioProps> = ({
  initialTab = 'overview',
  supabaseStatus,
  profile,
  onRefreshStatus,
  onRefreshStorefront,
  onOpenStorefront,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);
  const [creatorToken, setCreatorToken] = useState<string>(
    () => localStorage.getItem('mp_creator_token') || ''
  );
  const [adminEmail, setAdminEmail] = useState<string>(
    () => localStorage.getItem('mp_creator_email') || ''
  );

  const [authConfig, setAuthConfig] = useState<AuthConfigResponse | null>(null);
  const [authMode, setAuthMode] = useState<'password' | 'otp' | 'service_key'>('password');
  const [emailInput, setEmailInput] = useState(() => localStorage.getItem('mp_creator_email') || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [serviceKeyInput, setServiceKeyInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleOAuthUrl, setGoogleOAuthUrl] = useState<string | null>(null);
  const [activeBridgeId, setActiveBridgeId] = useState<string | null>(null);
  const processingOAuthRef = useRef(false);

  const [dashboard, setDashboard] = useState<CreatorDashboardData>(EMPTY_DASHBOARD);
  const [studioProfile, setStudioProfile] = useState<CreatorProfile>(profile);
  const [loadingDash, setLoadingDash] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setStudioProfile(profile);
  }, [profile]);

  const loadAuthConfig = useCallback(async () => {
    try {
      const resp = await fetch('/api/creator/auth-config');
      if (resp.ok) {
        const data: AuthConfigResponse = await resp.json();
        setAuthConfig(data);
        if (data.adminEmail) {
          setEmailInput((prev) => prev || data.adminEmail || '');
        }
        return data;
      }
    } catch {
      // ignore transient errors
    }
    return null;
  }, []);

  useEffect(() => {
    loadAuthConfig();
  }, [loadAuthConfig, supabaseStatus?.connected]);

  // Poll server OAuth/Magic-Link bridge when user completes login in a separate tab from iframe
  useEffect(() => {
    if (!activeBridgeId || creatorToken) return;
    const timer = window.setInterval(async () => {
      try {
        const resp = await fetch(`/api/creator/oauth-bridge/${encodeURIComponent(activeBridgeId)}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.ready && data.token) {
          localStorage.setItem('mp_creator_token', data.token);
          localStorage.setItem('mp_creator_email', data.email);
          setCreatorToken(data.token);
          setAdminEmail(data.email);
          setGoogleOAuthUrl(null);
          setActiveBridgeId(null);
          setOtpSent(false);
        }
      } catch {
        // ignore transient network glitches while polling
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeBridgeId, creatorToken]);

  // Parse OAuth error query/hash if Google/Supabase returned an error
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errDesc = searchParams.get('error_description') || hashParams.get('error_description');
    if (errDesc) {
      setAuthError(`Erro na autenticação Google/Supabase: ${errDesc}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Complete Google OAuth or Magic Link callback via Supabase Auth
  useEffect(() => {
    if (creatorToken || !authConfig?.supabaseUrl || !authConfig?.supabaseAnonKey) return;
    const sb = getBrowserSupabaseClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey);
    if (!sb) return;

    let cancelled = false;
    const checkOAuthSession = async () => {
      if (processingOAuthRef.current || cancelled) return;

      const searchParams = new URLSearchParams(window.location.search);
      const bridgeId = searchParams.get('bridge');
      const tokenHash = searchParams.get('token_hash');
      const authType = searchParams.get('type');
      const authCode = searchParams.get('code');

      let accessToken: string | undefined;

      // 1. Check URL hash directly for implicit flow (#access_token=...)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      accessToken = hashParams.get('access_token') || undefined;

      // 2. Check Magic Link / OTP token_hash query param
      if (!accessToken && tokenHash && authType) {
        const { data } = await sb.auth.verifyOtp({
          token_hash: tokenHash,
          type: authType as 'magiclink' | 'email' | 'recovery' | 'signup',
        });
        accessToken = data.session?.access_token;
      }

      // 3. Check PKCE code query param if returned
      if (!accessToken && authCode) {
        const { data } = await sb.auth.exchangeCodeForSession(authCode);
        accessToken = data.session?.access_token;
      }

      // 4. Or check active Supabase browser session
      if (!accessToken) {
        const { data } = await sb.auth.getSession();
        accessToken = data.session?.access_token;
      }

      if (!accessToken || cancelled) return;

      processingOAuthRef.current = true;
      try {
        const resp = await fetch('/api/creator/oauth-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, bridgeId }),
        });
        const result = await resp.json();
        if (!cancelled && resp.ok && result.token) {
          localStorage.setItem('mp_creator_token', result.token);
          localStorage.setItem('mp_creator_email', result.email);
          setCreatorToken(result.token);
          setAdminEmail(result.email);
          setGoogleOAuthUrl(null);
          setActiveBridgeId(null);
          if (
            window.location.hash ||
            window.location.search.includes('studio_auth=') ||
            window.location.search.includes('code=') ||
            window.location.search.includes('token_hash=')
          ) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (!cancelled && !resp.ok && result.error) {
          setAuthError(result.error);
          await sb.auth.signOut();
        }
      } finally {
        processingOAuthRef.current = false;
      }
    };

    checkOAuthSession();

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && !cancelled && !processingOAuthRef.current) {
        checkOAuthSession();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [creatorToken, authConfig?.supabaseUrl, authConfig?.supabaseAnonKey]);

  const fetchDashboard = useCallback(async (token: string) => {
    if (!token) return;
    setLoadingDash(true);
    try {
      const resp = await fetch('/api/creator/dashboard', {
        headers: { 'x-creator-token': token },
      });
      if (resp.status === 401) {
        localStorage.removeItem('mp_creator_token');
        setCreatorToken('');
        return;
      }
      const data = await resp.json();
      if (data.dashboard) setDashboard(data.dashboard);
      if (data.profile) setStudioProfile(data.profile);
    } finally {
      setLoadingDash(false);
    }
  }, []);

  useEffect(() => {
    if (creatorToken) {
      fetchDashboard(creatorToken);
    }
  }, [creatorToken, fetchDashboard, supabaseStatus?.connected, supabaseStatus?.schemaReady]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);
    try {
      const resp = await fetch('/api/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAuthError(data.error || 'Não foi possível entrar.');
      } else {
        localStorage.setItem('mp_creator_token', data.token);
        localStorage.setItem('mp_creator_email', data.email);
        setCreatorToken(data.token);
        setAdminEmail(data.email);
        setPasswordInput('');
        await loadAuthConfig();
      }
    } catch {
      setAuthError('Erro de conexão ao validar login.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Digite o e-mail Gmail da administradora antes de enviar o código.');
      return;
    }

    setAuthLoading(true);
    try {
      const isInIframe = window.self !== window.top;
      const bridgeId = isInIframe
        ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        : null;
      const redirectTo = bridgeId
        ? `${window.location.origin}/?studio_auth=google&bridge=${bridgeId}`
        : `${window.location.origin}/?studio_auth=google`;

      const resp = await fetch('/api/creator/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, redirectTo }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAuthError(data.error || 'Não foi possível enviar o código para seu Gmail.');
      } else {
        if (bridgeId) setActiveBridgeId(bridgeId);
        setOtpSent(true);
        setAuthInfo(
          `Enviamos um acesso para ${data.email}. Verifique sua caixa de entrada (ou Spam) no Gmail: digite o código recebido abaixo ou clique no link do e-mail.`
        );
      }
    } catch {
      setAuthError('Erro de conexão ao enviar código para o Gmail.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);
    try {
      const resp = await fetch('/api/creator/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          code: otpCodeInput.trim(),
          newPassword: newPasswordInput,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAuthError(data.error || 'Código inválido ou expirado.');
      } else {
        localStorage.setItem('mp_creator_token', data.token);
        localStorage.setItem('mp_creator_email', data.email);
        setCreatorToken(data.token);
        setAdminEmail(data.email);
        setOtpCodeInput('');
        setNewPasswordInput('');
        setOtpSent(false);
        setActiveBridgeId(null);
        await loadAuthConfig();
      }
    } catch {
      setAuthError('Erro de conexão ao verificar código.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetWithServiceKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);
    try {
      const resp = await fetch('/api/creator/reset-with-service-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          serviceRoleKey: serviceKeyInput.trim(),
          newPassword: newPasswordInput,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAuthError(data.error || 'Não foi possível redefinir a senha.');
      } else {
        localStorage.setItem('mp_creator_token', data.token);
        localStorage.setItem('mp_creator_email', data.email);
        setCreatorToken(data.token);
        setAdminEmail(data.email);
        setServiceKeyInput('');
        setNewPasswordInput('');
        await loadAuthConfig();
      }
    } catch {
      setAuthError('Erro de conexão ao validar Service Role Key.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGmailLogin = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setGoogleOAuthUrl(null);

    if (!authConfig?.supabaseUrl || !authConfig?.supabaseAnonKey) {
      setAuthError(
        'Conecte seu projeto Supabase primeiro usando o acesso por E-mail e Senha abaixo.'
      );
      return;
    }

    if (!authConfig.googleProviderEnabled) {
      setAuthError(
        'O provedor Google OAuth está desativado no seu Supabase. Ative em Authentication → Providers → Google, ou use o botão "Entrar com código no Gmail" abaixo que já funciona agora.'
      );
      return;
    }

    const sb = getBrowserSupabaseClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey);
    if (!sb) {
      setAuthError('Não foi possível inicializar o cliente Supabase Auth.');
      return;
    }

    setAuthLoading(true);
    try {
      const isInIframe = window.self !== window.top;
      const bridgeId = isInIframe
        ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        : null;
      const redirectTo = bridgeId
        ? `${window.location.origin}/?studio_auth=google&bridge=${bridgeId}`
        : `${window.location.origin}/?studio_auth=google`;

      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: isInIframe,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error) {
        setAuthError(`Erro ao iniciar login com Gmail: ${error.message}`);
        setAuthLoading(false);
        return;
      }
      if (isInIframe && data?.url) {
        setActiveBridgeId(bridgeId);
        setGoogleOAuthUrl(data.url);
        setAuthLoading(false);
      }
    } catch {
      setAuthError('Erro ao redirecionar para a conta Google/Gmail.');
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('mp_creator_token');
    setCreatorToken('');
    if (authConfig?.supabaseUrl && authConfig?.supabaseAnonKey) {
      const sb = getBrowserSupabaseClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey);
      await sb?.auth.signOut().catch(() => {});
    }
  };

  const supabaseReady = Boolean(supabaseStatus?.connected && supabaseStatus?.schemaReady);
  const isFirstPasswordCreation = Boolean(authConfig?.needsSetup || authConfig?.needsPasswordSetup);

  if (!creatorToken) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-14 lg:px-10">
        <div className="mx-auto max-w-md rounded-xl border border-zinc-800 bg-[#121215] p-8 space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-[#D4AF37] shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-zinc-50">
                Acesso da Administradora
              </h1>
              <p className="text-xs text-zinc-400">
                {authConfig?.needsSetup
                  ? 'Defina seu e-mail e senha ou conecte seu Gmail'
                  : authConfig?.needsPasswordSetup
                  ? `Defina sua senha para ${authConfig.adminEmailHint}`
                  : authConfig?.adminEmailHint
                  ? `Conta autorizada: ${authConfig.adminEmailHint}`
                  : 'Entre com e-mail e senha ou conecte seu Gmail'}
              </p>
            </div>
          </div>

          {/* Gmail / Google Login Button */}
          <button
            type="button"
            onClick={handleGmailLogin}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:border-[#D4AF37] hover:bg-zinc-800/80 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.5c-.24 1.25-.96 2.31-2.05 3.02l3.31 2.57c1.93-1.78 3.04-4.4 3.04-7.5 0-.72-.06-1.41-.19-2.09H12z"
              />
              <path
                fill="#34A853"
                d="M12 21c2.76 0 5.07-.91 6.76-2.48l-3.31-2.57c-.92.61-2.09.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.88v2.64C4.56 18.71 8.01 21 12 21z"
              />
              <path
                fill="#4A90E2"
                d="M6.3 12.73A5.41 5.41 0 0 1 6 11c0-.6.11-1.18.3-1.73V6.63H2.88A8.98 8.98 0 0 0 2 11c0 1.45.35 2.82.88 4.37l3.42-2.64z"
              />
              <path
                fill="#FBBC05"
                d="M12 5.07c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.06 2.02 14.76 1 12 1 8.01 1 4.56 3.29 2.88 6.63l3.42 2.64C7.1 6.86 9.35 5.07 12 5.07z"
              />
            </svg>
            Continuar com Gmail (Google)
          </button>

          {authConfig && !authConfig.googleProviderEnabled && authConfig.supabaseProjectRef && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3.5 text-xs text-zinc-300 space-y-2">
              <p className="text-zinc-300 leading-relaxed">
                O provedor Google ainda está desativado no seu Supabase. Para ativar o botão Google acima, habilite-o no painel e adicione esta URL em <span className="text-zinc-100 font-medium">Redirect URLs</span>:
              </p>
              <code className="block rounded bg-zinc-950 px-2.5 py-1.5 text-[11px] text-[#E5C158] break-all select-all">
                {window.location.origin}/
              </code>
              <a
                href={`https://supabase.com/dashboard/project/${authConfig.supabaseProjectRef}/auth/providers`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#E5C158] hover:underline font-medium"
              >
                Abrir Providers no Supabase Dashboard
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {googleOAuthUrl && (
            <div className="rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/10 p-3.5 text-xs text-zinc-200 space-y-2.5">
              <p>
                Clique abaixo para autorizar sua conta Google em uma nova aba. Esta tela será liberada automaticamente após o login:
              </p>
              <a
                href={googleOAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors"
              >
                Abrir Login Google em Nova Aba
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="h-px flex-1 bg-zinc-800" />
            <span>
              {authMode === 'password'
                ? 'ou entre com e-mail e senha'
                : authMode === 'otp'
                ? 'entrar com código no Gmail'
                : 'redefinir com Service Role Key'}
            </span>
            <span className="h-px flex-1 bg-zinc-800" />
          </div>

          {authMode === 'password' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  E-mail da Administradora
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="zoebratubrasil@gmail.com"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    {isFirstPasswordCreation ? 'Criar Senha de Acesso (mín. 6 dígitos)' : 'Senha'}
                  </label>
                  {!isFirstPasswordCreation && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setAuthInfo(null);
                        setAuthMode('otp');
                      }}
                      className="text-[11px] text-[#E5C158] hover:underline cursor-pointer"
                    >
                      Esqueci a senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={isFirstPasswordCreation ? 'Digite a senha que deseja usar' : 'Sua senha de acesso'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-3.5 pr-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {authInfo && (
                <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200 leading-relaxed">
                  {authInfo}
                </p>
              )}

              {authError && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 leading-relaxed">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {authLoading
                  ? 'Autenticando...'
                  : isFirstPasswordCreation
                  ? 'Definir Senha e Entrar'
                  : 'Entrar no Estúdio'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthInfo(null);
                  setAuthMode('otp');
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 transition-colors cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#D4AF37]" />
                Esqueci a senha / Entrar com código ou chave Supabase
              </button>
            </form>
          ) : authMode === 'otp' ? (
            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  E-mail Gmail da Administradora
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="zoebratubrasil@gmail.com"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              {otpSent && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Código recebido no Gmail
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={otpCodeInput}
                      onChange={(e) => setOtpCodeInput(e.target.value)}
                      placeholder="Ex: 123456"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm tracking-widest text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Definir nova senha (opcional, mín. 6 dígitos)
                    </label>
                    <input
                      type="password"
                      minLength={6}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Deixe vazio ou crie uma nova senha"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {authInfo && (
                <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200 leading-relaxed">
                  {authInfo}
                </p>
              )}

              {authError && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 leading-relaxed">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {authLoading
                  ? 'Processando...'
                  : otpSent
                  ? 'Validar Código e Entrar'
                  : 'Enviar código / link para o Gmail'}
              </button>

              {otpSent && (
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => handleSendOtp()}
                  className="w-full text-center text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Reenviar código para o Gmail
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthInfo(null);
                  setAuthMode('service_key');
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-[#E5C158] hover:border-[#D4AF37]/60 transition-colors cursor-pointer"
              >
                Código não chegou? Redefinir com a Service Role Key do Supabase
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthInfo(null);
                  setOtpSent(false);
                  setAuthMode('password');
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para E-mail e Senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetWithServiceKey} className="space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Copie sua chave <span className="font-mono text-zinc-200">service_role</span> no painel do Supabase (Settings → API) para definir uma nova senha imediatamente sem depender de e-mail.
              </p>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  E-mail da Administradora
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="zoebratubrasil@gmail.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Service Role Key (Supabase)
                </label>
                <input
                  type="password"
                  required
                  value={serviceKeyInput}
                  onChange={(e) => setServiceKeyInput(e.target.value)}
                  placeholder="eyJhbGciOi... ou sb_secret_..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Nova Senha de Acesso (mín. 6 dígitos)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Digite sua nova senha"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              {authError && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 leading-relaxed">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {authLoading ? 'Validando...' : 'Redefinir Senha e Entrar'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthInfo(null);
                  setAuthMode('password');
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para E-mail e Senha
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  const navItems: Array<{ id: StudioTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Visão Geral', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'manage', label: 'Editar Fotos & Vídeos', icon: <FolderKanban className="h-4 w-4" /> },
    { id: 'upload', label: 'Enviar Fotos & Vídeos', icon: <Upload className="h-4 w-4" /> },
    { id: 'profile', label: 'Informações & Capa', icon: <UserCog className="h-4 w-4" /> },
    { id: 'fans', label: 'Assinantes & VIPs', icon: <Users className="h-4 w-4" /> },
    { id: 'pix', label: 'Pix & QR Code', icon: <QrCode className="h-4 w-4" /> },
    { id: 'sales', label: 'Banco de Vendas', icon: <Receipt className="h-4 w-4" /> },
    { id: 'supabase', label: 'Supabase & Código (.zip)', icon: <Database className="h-4 w-4" /> },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 rounded-xl border border-zinc-800/80 bg-[#121215] p-4 space-y-6">
          <div className="px-2 pt-1">
            <p className="text-xs text-[#D4AF37] font-medium">Administração do Site</p>
            <p className="font-display text-lg font-semibold text-zinc-50 truncate">
              {studioProfile.display_name}
            </p>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{adminEmail}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {supabaseReady ? 'Supabase conectado e ativo' : 'Supabase pendente de conexão'}
            </p>
          </div>

          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="studio-sidebar-pill"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded-lg bg-[#D4AF37]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sair da Conta Adm
            </button>
          </div>
        </aside>

        <section className="lg:col-span-9 min-w-0">
          {loadingDash && dashboard.mediaItems.length === 0 && activeTab !== 'supabase' ? (
            <div className="rounded-xl border border-zinc-800 bg-[#121215] p-12 text-center text-xs text-zinc-400">
              Sincronizando dados do Supabase...
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'overview' && (
                <AdminOverview
                  profile={studioProfile}
                  dashboard={dashboard}
                  supabaseStatus={supabaseStatus}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onOpenStorefront={onOpenStorefront}
                />
              )}

              {activeTab === 'upload' && (
                <MediaUploader
                  creatorToken={creatorToken}
                  supabaseReady={supabaseReady}
                  onUploaded={async () => {
                    await fetchDashboard(creatorToken);
                    await onRefreshStorefront();
                  }}
                  onGoToSupabase={() => setActiveTab('supabase')}
                />
              )}

              {activeTab === 'manage' && (
                <MediaManager
                  creatorToken={creatorToken}
                  mediaItems={dashboard.mediaItems}
                  onRefresh={async () => {
                    await fetchDashboard(creatorToken);
                    await onRefreshStorefront();
                  }}
                  onGoToUpload={() => setActiveTab('upload')}
                />
              )}

              {activeTab === 'fans' && (
                <FansManager
                  creatorToken={creatorToken}
                  fans={dashboard.fans}
                  supabaseReady={supabaseReady}
                  onRefresh={() => fetchDashboard(creatorToken)}
                />
              )}

              {activeTab === 'pix' && (
                <PixManager
                  creatorToken={creatorToken}
                  profile={studioProfile}
                  dashboard={dashboard}
                  supabaseReady={supabaseReady}
                  onRefreshAll={async () => {
                    await fetchDashboard(creatorToken);
                    await onRefreshStorefront();
                  }}
                  onGoToSales={() => setActiveTab('sales')}
                />
              )}

              {activeTab === 'sales' && (
                <SalesLedger
                  creatorToken={creatorToken}
                  dashboard={dashboard}
                  onRefresh={() => fetchDashboard(creatorToken)}
                  onOpenPix={() => setActiveTab('pix')}
                />
              )}

              {activeTab === 'profile' && (
                <CreatorProfileSettings
                  creatorToken={creatorToken}
                  adminEmail={adminEmail}
                  profile={studioProfile}
                  supabaseReady={supabaseReady}
                  onUpdated={async () => {
                    await fetchDashboard(creatorToken);
                    await onRefreshStorefront();
                    await loadAuthConfig();
                  }}
                />
              )}

              {activeTab === 'supabase' && (
                <SupabaseSetup
                  creatorToken={creatorToken}
                  status={supabaseStatus}
                  onRefreshStatus={async () => {
                    await onRefreshStatus();
                    await onRefreshStorefront();
                    await fetchDashboard(creatorToken);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
};
