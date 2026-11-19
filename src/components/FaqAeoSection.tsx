import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { STOREFRONT_FAQS } from '../lib/seo';

export const FaqAeoSection: React.FC<{ creatorName: string }> = ({ creatorName }) => {
  return (
    <section
      id="perguntas-frequentes"
      aria-labelledby="faq-heading"
      className="bg-[#E4E0DC] text-[#1C1918] border-t border-[#2B2725]/25 p-4 sm:p-8 lg:p-12"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        <div className="lg:col-span-4 space-y-2.5">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A5412]">
            <HelpCircle className="h-3.5 w-3.5 text-[#7A5412]" />
            <span>Guia Rápido · Transparência & Acesso</span>
          </p>
          <h2
            id="faq-heading"
            className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#1C1918]"
          >
            Perguntas Frequentes
          </h2>
          <p className="text-sm text-[#4A4440] leading-relaxed">
            Respostas diretas sobre as vídeo chamadas privativas 1:1 com {creatorName} via Pix, o acervo do Clube VIP, os 6 cartões de mimos e o Nível de Lealdade.
          </p>
        </div>

        <div className="lg:col-span-8 border-t border-[#2B2725]/25 divide-y divide-[#2B2725]/20">
          {STOREFRONT_FAQS.map((item, idx) => (
            <details
              key={item.question}
              open={idx === 0}
              className="group py-4 sm:py-5"
            >
              <summary className="flex items-center justify-between gap-4 list-none cursor-pointer text-left font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-[#1C1918] hover:text-[#7A5412] transition-colors">
                <span>{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#7A5412] transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 text-sm text-[#3D3835] leading-relaxed pr-6">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
