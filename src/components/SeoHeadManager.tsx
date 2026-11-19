import React, { useEffect } from 'react';
import type { CreatorProfile, StorefrontStats } from '../types';
import { buildStorefrontJsonLd } from '../lib/seo';

interface SeoHeadManagerProps {
  activeView: 'storefront' | 'studio';
  profile: CreatorProfile;
  stats: StorefrontStats;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export const SeoHeadManager: React.FC<SeoHeadManagerProps> = ({
  activeView,
  profile,
  stats,
}) => {
  useEffect(() => {
    const origin = window.location.origin;
    const isAdmin = activeView === 'studio';
    const canonicalUrl = isAdmin ? `${origin}/admin` : `${origin}/`;
    const shareImage = `${origin}/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG`;

    const publicTitle =
      profile.display_name && profile.display_name !== 'Lorena Noir'
        ? `Vídeo Chamada Modelo Feminina Atraente ${profile.display_name}`
        : 'Vídeo Chamada Modelo Feminina Atraente Lorena Noir';

    const publicDescription =
      'Vídeo chamada privativa 1 a 1 via Pix somente entre 1 internauta e modelo, 6 cartões de mimos especiais, Clube VIP e acervo exclusivo +18 de Lorena Noir.';

    document.title = isAdmin
      ? `Administração · ${publicTitle}`
      : publicTitle;

    upsertLink('canonical', canonicalUrl);

    if (isAdmin) {
      upsertMeta('name', 'robots', 'noindex, nofollow, noarchive');
      upsertMeta('name', 'googlebot', 'noindex, nofollow');
    } else {
      upsertMeta(
        'name',
        'robots',
        'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      );
      upsertMeta(
        'name',
        'googlebot',
        'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      );
    }

    upsertMeta('name', 'description', publicDescription);
    upsertMeta(
      'name',
      'keywords',
      'vídeo chamada privada 1 a 1, Lorena Noir, vídeo chamada via Pix, modelo feminina atraente, Clube VIP, mimos especiais, acervo 35mm exclusivo +18'
    );
    upsertMeta('name', 'author', profile.display_name);

    // OpenGraph
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:locale', 'pt_BR');
    upsertMeta('property', 'og:site_name', publicTitle);
    upsertMeta('property', 'og:title', publicTitle);
    upsertMeta('property', 'og:description', publicDescription);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', shareImage);
    upsertMeta('property', 'og:image:alt', `Retrato editorial de ${profile.display_name}`);

    // Twitter / X Cards
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', publicTitle);
    upsertMeta('name', 'twitter:description', publicDescription);
    upsertMeta('name', 'twitter:image', shareImage);
    upsertMeta('name', 'twitter:image:alt', `Retrato editorial de ${profile.display_name}`);

    // Live Schema.org @graph JSON-LD (only on public storefront)
    const scriptId = 'dynamic-seo-jsonld';
    let ldScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (isAdmin) {
      if (ldScript) ldScript.remove();
      return;
    }

    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.id = scriptId;
      ldScript.type = 'application/ld+json';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(buildStorefrontJsonLd(profile, stats, origin));
  }, [activeView, profile, stats]);

  return null;
};
