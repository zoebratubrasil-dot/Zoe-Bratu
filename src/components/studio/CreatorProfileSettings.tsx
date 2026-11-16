import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Upload, RotateCcw } from 'lucide-react';
import type { CreatorProfile } from '../../types';
import { inferMediaKind, uploadFileToSupabaseBucket } from '../../lib/uploadMedia';
import { ProtectedImage } from '../ProtectedMedia';

const DEFAULT_AVATAR_ASSET_PATH = '/src/assets/images/creator_avatar_portrait_1794805425733.jpg';
const DEFAULT_HERO_ASSET_PATH = '/src/assets/images/creator_hero_editorial_1794805426073.jpg';
const DEFAULT_AVATAR_URL = '/api/profile/asset/avatar';
const DEFAULT_HERO_URL = '/api/profile/asset/hero';

interface CreatorProfileSettingsProps {
  creatorToken: string;
  adminEmail: string;
  profile: CreatorProfile;
  supabaseReady: boolean;
  onUpdated: () => Promise<void>;
  onOpenVideoCalls?: () => void;
}

export const CreatorProfileSettings: React.FC<CreatorProfileSettingsProps> = ({
  creatorToken,
  adminEmail,
  profile,
  supabaseReady,
  onUpdated,
  onOpenVideoCalls,
}) => {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [vipPrice, setVipPrice] = useState(String(profile.vip_monthly_price_brl));
  const [vipDesc, setVipDesc] = useState(profile.vip_description);
  const [pixKey, setPixKey] = useState(profile.pix_key || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || DEFAULT_AVATAR_URL);
  const [heroUrl, setHeroUrl] = useState(profile.hero_url || DEFAULT_HERO_URL);
  const [newAdminEmail, setNewAdminEmail] = useState(adminEmail || '');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<'avatar' | 'hero' | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setDisplayName(profile.display_name);
    setHandle(profile.handle);
    setBio(profile.bio);
    setLocation(profile.location);
    setVipPrice(String(profile.vip_monthly_price_brl));
    setVipDesc(profile.vip_description);
    setPixKey(profile.pix_key || '');
    setAvatarUrl(profile.avatar_url || DEFAULT_AVATAR_URL);
    setHeroUrl(profile.hero_url || DEFAULT_HERO_URL);
  }, [profile]);

  useEffect(() => {
    if (adminEmail) {
      setNewAdminEmail((prev) => prev || adminEmail);
    }
  }, [adminEmail]);

  const uploadPreviewAsset = async (file: File, target: 'avatar' | 'hero') => {
    if (!supabaseReady) {
      setMsg({ type: 'err', text: 'Conecte o Supabase antes de enviar fotos de perfil.' });
      return;
    }
    if (inferMediaKind(file) !== 'photo') {
      setMsg({ type: 'err', text: 'Selecione um arquivo de imagem válido (JPG, PNG, WEBP).' });
      return;
    }

    setUploadingAsset(target);
    setMsg(null);
    try {
      const uploaded = await uploadFileToSupabaseBucket(file, 'creator-previews', creatorToken);
      const uploadedUrl = uploaded.publicUrl;
      if (!uploadedUrl) {
        throw new Error('Não foi possível obter a URL pública da imagem enviada.');
      }

      if (target === 'avatar') setAvatarUrl(uploadedUrl);
      else setHeroUrl(uploadedUrl);

      // Persist immediately in Supabase so the photo stays on the site even without clicking Save below
      const patchResp = await fetch('/api/creator/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify(target === 'avatar' ? { avatar_url: uploadedUrl } : { hero_url: uploadedUrl }),
      });
      const patchData = await patchResp.json();
      if (!patchResp.ok) {
        throw new Error(patchData.error || 'Imagem enviada, mas falhou ao salvar no perfil.');
      }

      await onUpdated();
      setMsg({
        type: 'ok',
        text:
          target === 'avatar'
            ? 'Foto de perfil enviada e publicada no site com proteção ativa!'
            : 'Capa principal enviada e publicada no site com proteção ativa!',
      });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Falha no upload.' });
    } finally {
      setUploadingAsset(null);
    }
  };

  const resetAssetToDefault = async (target: 'avatar' | 'hero') => {
    if (!supabaseReady) return;
    setUploadingAsset(target);
    setMsg(null);
    try {
      const patchBody =
        target === 'avatar'
          ? { avatar_url: DEFAULT_AVATAR_ASSET_PATH }
          : { hero_url: DEFAULT_HERO_ASSET_PATH };
      const resp = await fetch('/api/creator/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify(patchBody),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Erro ao restaurar imagem padrão.');
      }
      await onUpdated();
      setMsg({
        type: 'ok',
        text:
          target === 'avatar'
            ? 'Foto de perfil restaurada para o padrão.'
            : 'Capa principal restaurada para o padrão.',
      });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Falha ao restaurar imagem.' });
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!supabaseReady) {
      setMsg({ type: 'err', text: 'Conecte o Supabase na aba "Conexão Supabase" para salvar seu perfil.' });
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch('/api/creator/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({
          display_name: displayName,
          handle,
          bio,
          location,
          vip_monthly_price_brl: Number(vipPrice || 49.9),
          vip_description: vipDesc,
          pix_key: pixKey,
          newAdminEmail:
            newAdminEmail.trim() && newAdminEmail.trim().toLowerCase() !== adminEmail.trim().toLowerCase()
              ? newAdminEmail.trim()
              : undefined,
          newAdminPassword: newAdminPassword.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setMsg({ type: 'err', text: data.error || 'Erro ao salvar informações.' });
      } else {
        setMsg({ type: 'ok', text: 'Informações e imagens do site atualizadas com sucesso!' });
        await onUpdated();
        setNewAdminPassword('');
      }
    } catch {
      setMsg({ type: 'err', text: 'Erro de rede ao salvar informações.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#453F3B] pb-5">
        <h2 className="font-display text-2xl font-semibold text-zinc-50">
          Informações do Site, Fotos de Capa & Preços
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Edite a foto de perfil, banner principal da vitrine, textos, assinatura mensal VIP, chave Pix e dados de acesso.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#453F3B] bg-[#23201E] p-6 space-y-6">
        {/* Visual Identity Uploads (zero URL exposure) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#453F3B]">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden border border-[#453F3B] shrink-0 bg-[#1C1918]">
                <ProtectedImage
                  src={avatarUrl || DEFAULT_AVATAR_URL}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-200">Foto de Perfil (Avatar 1:1)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-md border border-[#453F3B] bg-[#1C1918] px-3 py-1.5 text-xs text-zinc-200 hover:border-[#D4AF37] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingAsset === 'avatar' ? 'Enviando...' : 'Enviar Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const chosen = e.target.files?.[0];
                        e.target.value = '';
                        if (chosen) uploadPreviewAsset(chosen, 'avatar');
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={uploadingAsset === 'avatar'}
                    onClick={() => resetAssetToDefault('avatar')}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Padrão
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Armazenada com endereço oculto e bloqueio contra cópia.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="h-16 w-28 rounded-md overflow-hidden border border-[#453F3B] shrink-0 bg-[#1C1918]">
                <ProtectedImage
                  src={heroUrl || DEFAULT_HERO_URL}
                  alt="Capa Hero"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-200">Capa Principal da Vitrine (Hero)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-md border border-[#453F3B] bg-[#1C1918] px-3 py-1.5 text-xs text-zinc-200 hover:border-[#D4AF37] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingAsset === 'hero' ? 'Enviando...' : 'Enviar Capa'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const chosen = e.target.files?.[0];
                        e.target.value = '';
                        if (chosen) uploadPreviewAsset(chosen, 'hero');
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={uploadingAsset === 'hero'}
                    onClick={() => resetAssetToDefault('hero')}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Padrão
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Exibição via streaming protegido sem exposição de link.
            </p>
          </div>
        </div>

        {msg && (
          <div
            className={`flex items-center gap-2.5 rounded-lg border p-3.5 text-xs ${
              msg.type === 'ok'
                ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
            }`}
          >
            {msg.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Nome Artístico / Marca</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Arroba / Handle</label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Cidade / Localização</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Biografia da Vitrine (Hero)</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#453F3B] pt-6">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Mensalidade Clube VIP (R$)
            </label>
            <input
              type="number"
              step="0.50"
              min="9.90"
              value={vipPrice}
              onChange={(e) => setVipPrice(e.target.value)}
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Chave Pix de Recebimento
            </label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="E-mail, CPF/CNPJ ou Chave Aleatória"
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              E-mail de Login do Administrador (ou Gmail)
            </label>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="seu@gmail.com"
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Nova Senha de Acesso (opcional)
            </label>
            <input
              type="password"
              minLength={6}
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Descrição dos Benefícios VIP</label>
          <textarea
            rows={2}
            value={vipDesc}
            onChange={(e) => setVipDesc(e.target.value)}
            className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        {onOpenVideoCalls && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#453F3B] bg-[#1C1918] px-4 py-3.5">
            <div>
              <p className="text-xs font-semibold text-zinc-100">Planos de Vídeo Chamada na Vitrine (4 planos)</p>
              <p className="text-xs text-zinc-400">
                Personalize minutos, valores em R$ e títulos exibidos no destaque da página pública.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenVideoCalls}
              className="rounded-lg border border-[#D4AF37]/60 bg-[#D4AF37]/10 px-3.5 py-2 text-xs font-medium text-[#E5C158] hover:bg-[#D4AF37]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Editar Planos de Vídeo Chamada →
            </button>
          </div>
        )}

        {msg && (
          <div
            className={`flex items-center gap-2.5 rounded-lg border p-3.5 text-xs ${
              msg.type === 'ok'
                ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
            }`}
          >
            {msg.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#E5C158] px-6 py-2.5 text-sm font-semibold text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {saving ? 'Salvando...' : 'Salvar Informações do Site'}
        </button>
      </form>
    </div>
  );
};
