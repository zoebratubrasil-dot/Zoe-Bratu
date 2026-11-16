import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import type { CreatorProfile } from '../../types';

interface CreatorProfileSettingsProps {
  creatorPin: string;
  profile: CreatorProfile;
  supabaseReady: boolean;
  onUpdated: (newPin?: string) => Promise<void>;
}

export const CreatorProfileSettings: React.FC<CreatorProfileSettingsProps> = ({
  creatorPin,
  profile,
  supabaseReady,
  onUpdated,
}) => {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [vipPrice, setVipPrice] = useState(String(profile.vip_monthly_price_brl));
  const [vipDesc, setVipDesc] = useState(profile.vip_description);
  const [pixKey, setPixKey] = useState(profile.pix_key || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [heroUrl, setHeroUrl] = useState(profile.hero_url || '');
  const [newPin, setNewPin] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<'avatar' | 'hero' | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const uploadPreviewAsset = async (file: File, target: 'avatar' | 'hero') => {
    if (!supabaseReady) {
      setMsg({ type: 'err', text: 'Conecte o Supabase antes de enviar fotos de perfil.' });
      return;
    }
    setUploadingAsset(target);
    setMsg(null);
    try {
      const resp = await fetch('/api/creator/media/upload-binary', {
        method: 'POST',
        headers: {
          'x-creator-pin': creatorPin,
          'x-file-name': file.name,
          'x-mime-type': file.type || 'image/jpeg',
          'x-bucket': 'creator-previews',
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao enviar imagem.');
      if (target === 'avatar') setAvatarUrl(data.publicUrl);
      else setHeroUrl(data.publicUrl);
      setMsg({ type: 'ok', text: 'Imagem enviada! Clique em "Salvar Perfil" para aplicar.' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Falha no upload.' });
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
          'x-creator-pin': creatorPin,
        },
        body: JSON.stringify({
          display_name: displayName,
          handle,
          bio,
          location,
          vip_monthly_price_brl: Number(vipPrice || 49.9),
          vip_description: vipDesc,
          pix_key: pixKey,
          avatar_url: avatarUrl,
          hero_url: heroUrl,
          newPin: newPin.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setMsg({ type: 'err', text: data.error || 'Erro ao salvar perfil.' });
      } else {
        setMsg({ type: 'ok', text: 'Perfil da criadora atualizado no Supabase!' });
        await onUpdated(newPin.trim() || undefined);
        setNewPin('');
      }
    } catch {
      setMsg({ type: 'err', text: 'Erro de rede ao salvar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-800 pb-5">
        <h2 className="font-display text-2xl font-semibold text-zinc-50">
          Perfil da Criadora Solo & Preços
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Personalize sua identidade pública, foto de capa, assinatura mensal VIP e chave Pix de recebimento.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-6">
        {/* Visual Identity Uploads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl || '/src/assets/images/creator_avatar_portrait_1794805425733.jpg'}
              alt="Avatar"
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full object-cover border border-zinc-700 shrink-0"
            />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-zinc-200">Foto de Perfil (1:1)</p>
              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-[#D4AF37] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                {uploadingAsset === 'avatar' ? 'Enviando...' : 'Trocar Avatar'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadPreviewAsset(e.target.files[0], 'avatar')}
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <img
              src={heroUrl || '/src/assets/images/creator_hero_editorial_1794805426073.jpg'}
              alt="Capa Hero"
              referrerPolicy="no-referrer"
              className="h-16 w-28 rounded-md object-cover border border-zinc-700 shrink-0"
            />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-zinc-200">Capa Editorial (Hero 16:9)</p>
              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-[#D4AF37] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                {uploadingAsset === 'hero' ? 'Enviando...' : 'Trocar Capa Hero'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadPreviewAsset(e.target.files[0], 'hero')}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Nome Artístico</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Arroba / Handle</label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Cidade / Localização</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Biografia da Vitrine</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-zinc-800 pt-6">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Novo PIN do Estúdio (opcional)
            </label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Mín. 4 dígitos"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Descrição dos Benefícios VIP</label>
          <textarea
            rows={2}
            value={vipDesc}
            onChange={(e) => setVipDesc(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
          />
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

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#D4AF37] px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {saving ? 'Salvando...' : 'Salvar Perfil e Preços'}
        </button>
      </form>
    </div>
  );
};
