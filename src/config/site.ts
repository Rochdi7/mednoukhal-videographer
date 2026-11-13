// Everything specific to Mednoukhal lives here. Empty values are hidden on the site.
// The values below are the defaults: whatever is filled in under "Site settings & logo" in the dashboard replaces them.
import type { ImageMetadata } from 'astro';
import { cms, cmsImage } from '../data/cms';
import lockup from '../assets/branding/mn-visual-lockup.png';
import mark from '../assets/branding/mn-visual-mark.png';
import wordmark from '../assets/branding/mednoukhal-wordmark.png';

export type SocialIcon = 'instagram' | 'youtube' | 'threads';

const DEFAULTS = {
  name: 'Mednoukhal',
  displayName: 'Med Noukhal', // the name as written in the logo, used in the footer credits
  logoAlt: 'MN Visual', // what the logo image reads
  jobTitle: 'Videographer and Photographer',
  email: 'mednoukhal00@gmail.com' as string | null,
  whatsapp: '212624084279' as string | null, // international digits only, used in wa.me links
  phone: '+212 624 084 279' as string | null, // shown as text; also used for tel: links
  socials: [
    { label: 'Instagram', handle: '@med_noukhal', href: 'https://www.instagram.com/med_noukhal/', icon: 'instagram' },
    { label: 'YouTube', handle: '@mednoukhal', href: 'https://www.youtube.com/@mednoukhal', icon: 'youtube' },
    { label: 'Threads', handle: '@med_noukhal', href: 'https://www.threads.com/@med_noukhal', icon: 'threads' },
  ] as { label: string; handle: string; href: string; icon: SocialIcon }[],
  developer: { name: 'Codesommet', href: 'https://codesommet.com/' },
};

const set = cms?.settings;
export const SITE: typeof DEFAULTS = {
  ...DEFAULTS,
  ...(set?.name ? { name: set.name } : {}),
  ...(set?.logoAlt ? { logoAlt: set.logoAlt } : {}),
  ...(set?.jobTitle ? { jobTitle: set.jobTitle } : {}),
  // Contact fields follow the dashboard exactly once it is connected: emptying one there hides it on the site.
  ...(set ? { email: set.email || null, whatsapp: set.whatsapp || null, phone: set.phone || null } : {}),
  ...(set?.socials ? { socials: set.socials.map((x) => ({ label: x.label, handle: x.handle ?? '', href: x.href, icon: (x.icon ?? 'instagram') as SocialIcon })) } : {}),
};

// The wide logo (footer) and the square mark (header, menu, About badge).
export const LOGO: ImageMetadata = set?.logo ? cmsImage(set.logo) : lockup;
export const LOGO_MARK: ImageMetadata = set?.logoMark ? cmsImage(set.logoMark) : mark;
/** The "MED NOUKHAL / VISUALS" wordmark shown large in the homepage hero. */
export const LOGO_WORDMARK: ImageMetadata = set?.logoWordmark ? cmsImage(set.logoWordmark) : wordmark;
