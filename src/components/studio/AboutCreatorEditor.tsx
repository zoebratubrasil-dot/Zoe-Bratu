import React, { useState } from 'react';
import { Sparkles, Cpu, Video, RotateCcw, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CreatorAboutContent } from '../../types';
import { DEFAULT_CREATOR_ABOUT, sanitizeCreatorAboutContent } from '../../lib/creatorAbout';

interface AboutCreatorEditorProps {
  value: CreatorAboutContent;
  onChange: (next: CreatorAboutContent) => void;
  creatorToken: string;
  onUpdated: () => Promise<void>;
}

type EditorTab = 'carioca' | 'platform' | 'videocall';

export const AboutCreatorEditor: React.FC<AboutCreatorEditorProps> = ({
  value,
  onChange,
  creatorToken,
  onUpdated,
}) => {
  const [subTab, setSubTab] = useState<EditorTab>('carioca');
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickMsg, setQuickMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleResetDefaults = () => {
    setQuickMsg(null);
    onChange(sanitizeCreatorAboutContent(DEFAULT_CREATOR_ABOUT));
  };

  const handleQuickSave = async () => {
    setSavingQuick(true);
    setQuickMsg(null);
    try {
      const resp = await fetch('/api/creator/about', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ about_section: value }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao salvar seção Sobre a Criadora.');
      }
      if (data.about_section) {
        onChange(sanitizeCreatorAboutContent(data.about_section));
      }
      await onUpdated();
      setQuickMsg({
        type: 'ok',
        text: 'Seção "Sobre a Criadora" atualizada e publicada na vitrine pública!',
      });
    } catch (err) {
      setQuickMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Falha de rede ao salvar seção.',
      });
    } finally {
      setSavingQuick(false);
    }
  };

  const updateTrait = (index: number, nextVal: string) => {
    const nextTraits = [...value.carioca_traits];
    nextTraits[index] = nextVal;
    onChange({ ...value, carioca_traits: nextTraits });
  };

  const updateStep = (index: number, field: 'step' | 'title' | 'description', nextVal: string) => {
    const nextSteps = value.site_steps.map((s, idx) =>
      idx === index ? { ...s, [field]: nextVal } : s
    );
    onChange({ ...value, site_steps: nextSteps });
  };

  const updateExp = (
    index: number,
    field: 'badge' | 'title' | 'subtitle' | 'duration_hint' | 'description',
    nextVal: string
  ) => {
    const nextExps = value.videocall_experiences.map((exp, idx) =>
      idx === index ? { ...exp, [field]: nextVal } : exp
    );
    onChange({ ...value, videocall_experiences: nextExps });
  };

  return (
    <div className="rounded-sm border border-[#181615]/25 bg-white p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#181615]/15 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A5412]">
            Seção Pública · Sobre a Criadora
          </p>
          <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#181615]">
            A Carioca, Funcionamento do Site & Vídeo Chamada
          </h3>
          <p className="text-xs text-[#524B45] mt-0.5">
            Personalize o texto envolvente sobre você, as 4 etapas tecnológicas do site e os 3 climas criativos da chamada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#181615]/25 bg-[#F3EFEA] px-3 py-1.5 text-xs font-medium text-[#181615] hover:border-[#181615] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrão
          </button>
          <button
            type="button"
            disabled={savingQuick}
            onClick={handleQuickSave}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#181615] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5 text-[#E5C158]" />
            {savingQuick ? 'Publicando...' : 'Publicar Sobre a Criadora'}
          </button>
        </div>
      </div>

      {quickMsg && (
        <div
          className={`flex items-center gap-2.5 rounded-sm border p-3 text-xs ${
            quickMsg.type === 'ok'
              ? 'border-emerald-700/35 bg-emerald-50 text-emerald-900'
              : 'border-rose-700/35 bg-rose-50 text-rose-900'
          }`}
        >
          {quickMsg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
          )}
          <span>{quickMsg.text}</span>
        </div>
      )}

      {/* Top Identity Tag & Quote */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#181615] mb-1">
            Subtítulo de Origem (Topo da Seção)
          </label>
          <input
            type="text"
            value={value.headline_tag}
            onChange={(e) => onChange({ ...value, headline_tag: e.target.value })}
            className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#181615] mb-1">
            Frase-Assinatura da Criadora
          </label>
          <input
            type="text"
            value={value.signature_quote}
            onChange={(e) => onChange({ ...value, signature_quote: e.target.value })}
            className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
          />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="grid grid-cols-3 border border-[#181615]/20 bg-[#F3EFEA]">
        <button
          type="button"
          onClick={() => setSubTab('carioca')}
          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
            subTab === 'carioca'
              ? 'bg-[#181615] text-[#E5C158]'
              : 'text-[#524B45] hover:text-[#181615]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          1. A Carioca
        </button>
        <button
          type="button"
          onClick={() => setSubTab('platform')}
          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider border-x border-[#181615]/20 transition-colors cursor-pointer ${
            subTab === 'platform'
              ? 'bg-[#181615] text-[#E5C158]'
              : 'text-[#524B45] hover:text-[#181615]'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          2. Como Funciona
        </button>
        <button
          type="button"
          onClick={() => setSubTab('videocall')}
          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
            subTab === 'videocall'
              ? 'bg-[#181615] text-[#E5C158]'
              : 'text-[#524B45] hover:text-[#181615]'
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          3. Vídeo Chamada
        </button>
      </div>

      {/* Panel 1: A Carioca */}
      {subTab === 'carioca' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#181615] mb-1">
              Título do Bloco “A Carioca”
            </label>
            <input
              type="text"
              value={value.carioca_title}
              onChange={(e) => onChange({ ...value, carioca_title: e.target.value })}
              className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#181615] mb-1">
              Apresentação da Carioca (Charme, Beleza, Inteligência, Educação & Feminilidade)
            </label>
            <textarea
              rows={3}
              value={value.carioca_bio}
              onChange={(e) => onChange({ ...value, carioca_bio: e.target.value })}
              className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {value.carioca_traits.map((trait, idx) => (
              <div key={idx}>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#524B45] mb-1">
                  Atributo 0{idx + 1}
                </label>
                <input
                  type="text"
                  value={trait}
                  onChange={(e) => updateTrait(idx, e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-xs font-medium text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel 2: Como Funciona */}
      {subTab === 'platform' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#181615] mb-1">
              Título de Funcionamento & Tecnologia do Site
            </label>
            <input
              type="text"
              value={value.site_how_title}
              onChange={(e) => onChange({ ...value, site_how_title: e.target.value })}
              className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#181615] mb-1">
              Explicação Geral do Site
            </label>
            <textarea
              rows={3}
              value={value.site_how_intro}
              onChange={(e) => onChange({ ...value, site_how_intro: e.target.value })}
              className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {value.site_steps.map((step, idx) => (
              <div key={step.id} className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-3 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                      Núm.
                    </label>
                    <input
                      type="text"
                      value={step.step}
                      onChange={(e) => updateStep(idx, 'step', e.target.value)}
                      className="w-full rounded-sm border border-[#181615]/20 bg-white px-2 py-1.5 font-mono text-xs text-[#181615]"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                      Título da Etapa
                    </label>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => updateStep(idx, 'title', e.target.value)}
                      className="w-full rounded-sm border border-[#181615]/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#181615]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                    Descrição da Etapa
                  </label>
                  <textarea
                    rows={2}
                    value={step.description}
                    onChange={(e) => updateStep(idx, 'description', e.target.value)}
                    className="w-full rounded-sm border border-[#181615]/20 bg-white px-2.5 py-1.5 text-xs text-[#181615]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel 3: Vídeo Chamada Criativa */}
      {subTab === 'videocall' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#181615] mb-1">
              Título “Como Aproveitar na Vídeo Chamada”
            </label>
            <input
              type="text"
              value={value.videocall_title}
              onChange={(e) => onChange({ ...value, videocall_title: e.target.value })}
              className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#181615] mb-1">
              Introdução Criativa da Experiência 1 a 1
            </label>
            <textarea
              rows={3}
              value={value.videocall_intro}
              onChange={(e) => onChange({ ...value, videocall_intro: e.target.value })}
              className="w-full rounded-sm border border-[#181615]/25 bg-[#FAF8F5] px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            {value.videocall_experiences.map((exp, idx) => (
              <div key={exp.id} className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-3.5 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                      Etiqueta do Modo
                    </label>
                    <input
                      type="text"
                      value={exp.badge}
                      onChange={(e) => updateExp(idx, 'badge', e.target.value)}
                      className="w-full rounded-sm border border-[#181615]/20 bg-white px-2.5 py-1.5 font-mono text-xs text-[#181615]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                      Subtítulo / Clima
                    </label>
                    <input
                      type="text"
                      value={exp.subtitle}
                      onChange={(e) => updateExp(idx, 'subtitle', e.target.value)}
                      className="w-full rounded-sm border border-[#181615]/20 bg-white px-2.5 py-1.5 text-xs text-[#181615]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                      Sugestão de Duração
                    </label>
                    <input
                      type="text"
                      value={exp.duration_hint}
                      onChange={(e) => updateExp(idx, 'duration_hint', e.target.value)}
                      className="w-full rounded-sm border border-[#181615]/20 bg-white px-2.5 py-1.5 font-mono text-xs text-[#181615]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                    Título da Experiência Criativa
                  </label>
                  <input
                    type="text"
                    value={exp.title}
                    onChange={(e) => updateExp(idx, 'title', e.target.value)}
                    className="w-full rounded-sm border border-[#181615]/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#181615]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-[#524B45] mb-1">
                    Descrição de Como Aproveitar ao Vivo
                  </label>
                  <textarea
                    rows={2}
                    value={exp.description}
                    onChange={(e) => updateExp(idx, 'description', e.target.value)}
                    className="w-full rounded-sm border border-[#181615]/20 bg-white px-2.5 py-1.5 text-xs text-[#181615]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
