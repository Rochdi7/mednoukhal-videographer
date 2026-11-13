import { CLIENTS, type Client } from './clients';
import type { Localized } from '../i18n';
import { cms, cmsImage, cmsLocalized } from './cms';

// Client reviews for the reviews wall (homepage and /reviews/).
// Each review is tied to a brand from clients.ts, so it shows that brand's logo and name.
// `quote` is shown exactly as written, in the language the client used (dir="auto" handles Arabic).
//
// PLACEHOLDER TEXT: these quotes are drafts written to show the layout. They are NOT real client words.
// Before the site goes live, replace each quote with what the client actually said (or remove the entry),
// and set `placeholder: false`. Do not publish a review a client did not give.
export interface Review {
  client: string; // must match a name in CLIENTS
  sector: Localized;
  quote: string;
  rating: 1 | 2 | 3 | 4 | 5;
  placeholder?: boolean;
}

const REVIEWS: Review[] = [
  {
    client: 'Sol by Meliá',
    sector: { en: 'Hotel · Marrakech', fr: 'Hôtel · Marrakech', ar: 'فندق · مراكش' },
    quote: "Un travail soigné du début à la fin. Les vidéos de l'hôtel ont tout de suite trouvé leur place sur nos réseaux et nos équipes les utilisent encore aujourd'hui.",
    rating: 5,
    placeholder: true,
  },
  {
    client: 'Le Blokk, dîner spectacle',
    sector: { en: 'Dinner show', fr: 'Dîner spectacle', ar: 'عشاء استعراضي' },
    quote: "Filmer un spectacle en direct n'est pas simple. Il a su capter l'énergie de la scène sans jamais gêner les artistes ni le public. Le résultat est bluffant.",
    rating: 5,
    placeholder: true,
  },
  {
    client: 'La Maison Arabe Marrakech',
    sector: { en: 'Hotel & restaurant', fr: 'Hôtel & restaurant', ar: 'فندق ومطعم' },
    quote: 'Very professional and easy to work with. He understood the spirit of the house straight away and the photographs show it exactly as our guests experience it.',
    rating: 5,
    placeholder: true,
  },
  {
    client: 'TH Events',
    sector: { en: 'Events', fr: 'Événementiel', ar: 'تنظيم الفعاليات' },
    quote: 'Réactif, ponctuel et discret le jour J. Les montages ont été livrés dans les délais, avec une vraie qualité cinéma. Nous travaillons avec lui sur chaque événement.',
    rating: 5,
    placeholder: true,
  },
  {
    client: 'Rue Chic',
    sector: { en: 'Fashion brand', fr: 'Marque de mode', ar: 'علامة أزياء' },
    quote: "Des visuels produits élégants qui ont fait la différence sur notre boutique en ligne. Il a l'œil pour la lumière et le détail.",
    rating: 5,
    placeholder: true,
  },
  {
    client: 'The House of the Calligraphy',
    sector: { en: 'Art & craft', fr: 'Art & artisanat', ar: 'فن وحرف' },
    quote: 'تعامل راقٍ واحترافية عالية. نقل جمال الخط العربي بالصورة والفيديو بإحساس فني كبير، وأنصح به بشدة.',
    rating: 5,
    placeholder: true,
  },
  {
    client: '212 Communication',
    sector: { en: 'Communication agency', fr: 'Agence de communication', ar: 'وكالة تواصل' },
    quote: "Un partenaire fiable pour nos clients. Il comprend vite un brief, propose des idées et livre des images qui servent vraiment la marque.",
    rating: 5,
    placeholder: true,
  },
  {
    client: 'El Rssouh',
    sector: { en: 'Brand', fr: 'Marque', ar: 'علامة تجارية' },
    quote: 'Great communication throughout the project and a real eye for detail. The final film went beyond what we had imagined. Highly recommended.',
    rating: 5,
    placeholder: true,
  },
  {
    client: 'Association des Étudiants ISPITS Marrakech',
    sector: { en: 'Student association', fr: 'Association étudiante', ar: 'جمعية طلابية' },
    quote: "Il a couvert notre événement avec beaucoup de professionnalisme. Les étudiants ont adoré la vidéo souvenir, partagée des centaines de fois.",
    rating: 5,
    placeholder: true,
  },
];

const byName = new Map(CLIENTS.map((c) => [c.name, c]));

export type ResolvedReview = Review & { brand: Client };

// Reviews from the dashboard replace the list above as soon as there is at least one.
// A dashboard review can carry its own logo (it replaces the client's), and can name a client outside the client list.
const ownLogo = new Map<Review, Client['logo']>();
const CMS_REVIEWS: Review[] | null = cms?.reviews.length
  ? cms.reviews.map((r) => {
      const review: Review = {
        client: r.client,
        sector: cmsLocalized(r.sector, { en: '', fr: '', ar: '' }),
        quote: r.quote,
        rating: Math.min(5, Math.max(1, Math.round(r.rating || 5))) as Review['rating'],
        placeholder: !!r.placeholder,
      };
      if (r.logo) ownLogo.set(review, cmsImage(r.logo));
      return review;
    })
  : null;

export const reviews: ResolvedReview[] = (CMS_REVIEWS ?? REVIEWS).flatMap((r) => {
  const logo = ownLogo.get(r);
  const client = byName.get(r.client);
  const brand: Client | undefined = logo ? { name: r.client, tone: client?.tone, ...client, logo } : client;
  // A dashboard review whose client was deleted is skipped; in the code a wrong name is a mistake to fix.
  if (!brand && CMS_REVIEWS) return [];
  if (!brand) throw new Error(`reviews.ts: no client named "${r.client}" in clients.ts`);
  return [{ ...r, brand }];
});
