import React, { useEffect } from 'react';
import type { CreatorProfile, StorefrontStats } from '../types';
import { buildDynamicSeoMeta, buildStorefrontJsonLd } from '../lib/seo';

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
    const meta = buildDynamicSeoMeta(profile, stats, origin);
    const canonicalUrl = isAdmin ? `${origin}/admin` : meta.canonicalUrl;

    document.title = isAdmin ? `Administração · ${meta.title}` : meta.title;

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

    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'keywords', meta.keywords);
    upsertMeta('name', 'author', profile.display_name);

    // OpenGraph dynamic tags with live DB statistics
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:locale', 'pt_BR');
    upsertMeta('property', 'og:site_name', meta.siteName);
    upsertMeta('property', 'og:title', meta.ogTitle);
    upsertMeta('property', 'og:description', meta.ogDescription);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', meta.imageUrl);
    upsertMeta('property', 'og:image:secure_url', meta.imageUrl);
    upsertMeta('property', 'og:image:type', 'image/jpeg');
    upsertMeta('property', 'og:image:alt', meta.imageAlt);

    // Twitter / X dynamic cards
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', meta.ogTitle);
    upsertMeta('name', 'twitter:description', meta.ogDescription);
    upsertMeta('name', 'twitter:image', meta.imageUrl);
    upsertMeta('name', 'twitter:image:alt', meta.imageAlt);

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
