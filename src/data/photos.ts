import type { ImageMetadata } from 'astro';
import type { Localized } from '../i18n';
import { cms, cmsImage, cmsLocalized } from './cms';

const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/photos/*.jpg', { eager: true });

export interface Photo {
  image: ImageMetadata;
  alt: Localized;
  focus?: string; // CSS object-position, from the focus point set in the dashboard
}

export interface Album {
  slug: string;
  title: Localized;
  photos: Photo[];
  category?: string; // slug of a PhotoCategory
  onHome?: boolean; // used in the homepage photo carousels
}

export interface PhotoCategory {
  slug: string;
  title: Localized;
}

const photo = (slug: string, n: number, en: string, fr: string, ar: string): Photo => ({
  image: files[`/src/assets/photos/${slug}-${String(n).padStart(2, '0')}.jpg`].default,
  alt: { en, fr, ar },
});

// Albums and captions describe what each photograph shows.
const LOCAL_ALBUMS: Album[] = [
  {
    slug: 'portraits',
    title: { en: 'Portraits', fr: 'Portraits', ar: 'بورتريه' },
    photos: [
      photo('portraits', 1, 'A smiling woman with long brown hair in a cream shirt, seated at a table outdoors.', 'Une femme souriante aux longs cheveux bruns, en chemise crème, assise à une table en extérieur.', 'امرأة مبتسمة بشعر بني طويل وقميص كريمي تجلس إلى طاولة في الهواء الطلق.'),
      photo('portraits', 2, 'A woman with curly blonde hair holding half a grapefruit over one eye, palm trees behind her.', 'Une femme aux cheveux blonds bouclés tenant un demi-pamplemousse devant un œil, des palmiers derrière elle.', 'امرأة بشعر أشقر مجعد تضع نصف حبة جريب فروت أمام عينها وخلفها أشجار النخيل.'),
      photo('portraits', 3, 'A smiling young girl in a white T-shirt holding a soft toy.', 'Une petite fille souriante en t-shirt blanc tenant une peluche.', 'طفلة مبتسمة بقميص أبيض تحمل دمية محشوة.'),
      photo('portraits', 4, 'A family on a terrace balcony beneath a reed canopy, palm trees beyond.', "Une famille sur le balcon d'une terrasse, sous un auvent de roseaux, des palmiers au loin.", 'عائلة على شرفة تحت مظلة من القصب وأشجار النخيل في الأفق.'),
    ],
  },
  {
    slug: 'caftan',
    title: { en: 'Caftan', fr: 'Caftan', ar: 'القفطان' },
    photos: [
      photo('caftan', 1, 'A seated woman in a pale gold caftan with an embroidered belt, her hands resting on her knee.', 'Une femme assise en caftan or pâle à ceinture brodée, les mains posées sur le genou.', 'امرأة جالسة بقفطان ذهبي فاتح وحزام مطرز ويداها على ركبتها.'),
      photo('caftan', 2, 'A woman in a long beige robe and nude heels seated on a white sofa.', 'Une femme en longue robe beige et talons nude assise sur un canapé blanc.', 'امرأة بعباءة بيج طويلة وكعب عالٍ تجلس على أريكة بيضاء.'),
      photo('caftan', 3, 'A hand decorated with henna resting on an open newspaper, a white robe at the wrist.', "Une main ornée de henné posée sur un journal ouvert, la manche d'un peignoir blanc au poignet.", 'يد مزينة بالحناء على جريدة مفتوحة وكم رداء أبيض عند المعصم.'),
    ],
  },
  {
    slug: 'table',
    title: { en: 'At the Table', fr: 'À table', ar: 'على المائدة' },
    photos: [
      photo('table', 1, 'A cocktail garnished with pineapple on a candlelit table, blue lights glowing behind it.', "Un cocktail garni d'ananas sur une table aux chandelles, des lumières bleues en arrière-plan.", 'كوكتيل مزين بالأناناس على طاولة تضيئها الشموع وخلفه أضواء زرقاء.'),
      photo('table', 2, 'A plated main course with vegetables on a white dish, on a dark table at night.', 'Un plat principal aux légumes dans une assiette blanche, sur une table sombre de nuit.', 'طبق رئيسي بالخضار في صحن أبيض على طاولة داكنة ليلاً.'),
      photo('table', 3, 'Two hands raising glasses of an orange drink against a clear blue sky.', "Deux mains levant des verres d'une boisson orange sur un ciel bleu dégagé.", 'يدان ترفعان كأسين من مشروب برتقالي أمام سماء زرقاء صافية.'),
    ],
  },
  {
    slug: 'interiors',
    title: { en: 'Interiors', fr: 'Intérieurs', ar: 'الفضاءات الداخلية' },
    photos: [
      photo('interiors', 1, 'A reflecting pool between stone columns, beneath a skylight and a tall library.', 'Un bassin entre des colonnes de pierre, sous une verrière et une haute bibliothèque.', 'حوض مائي بين أعمدة حجرية تحت كوة زجاجية ومكتبة عالية.'),
      photo('interiors', 2, 'A golden seated Buddha among plants in a hall with stone columns.', 'Un bouddha doré assis parmi les plantes dans une salle à colonnes de pierre.', 'تمثال بوذا ذهبي جالس بين النباتات في قاعة بأعمدة حجرية.'),
      photo('interiors', 3, 'A woman reading a magazine in a white bed against a blue wall.', 'Une femme lisant un magazine dans un lit blanc, devant un mur bleu.', 'امرأة تقرأ مجلة على سرير أبيض أمام جدار أزرق.'),
      photo('interiors', 4, 'A woven basket filled with Morocco travel guides and magazines.', 'Un panier tressé rempli de guides de voyage et de magazines sur le Maroc.', 'سلة منسوجة مليئة بأدلة سفر ومجلات عن المغرب.'),
    ],
  },
  {
    slug: 'craft',
    title: { en: 'Craft & Performance', fr: 'Artisanat et spectacle', ar: 'حرف وعروض' },
    photos: [
      photo('craft', 1, 'A potter in a blue apron shaping clay on a wheel, on a terrace beneath a reed canopy.', "Un potier en tablier bleu façonnant l'argile sur un tour, sur une terrasse sous un auvent de roseaux.", 'خزّاف بمئزر أزرق يشكل الطين على الدولاب في شرفة تحت مظلة من القصب.'),
      photo('craft', 2, 'A performer in a ruffled dress raising a flaming torch in blue smoke.', 'Une artiste en robe à volants levant une torche enflammée dans une fumée bleue.', 'مؤدية بفستان مكشكش ترفع شعلة نار وسط دخان أزرق.'),
    ],
  },
];

// Albums published in the dashboard replace the ones above as soon as there is at least one.
export const ALBUMS: Album[] = cms?.albums.length
  ? cms.albums.map((a) => ({
      slug: a.slug,
      title: cmsLocalized(a.title),
      category: a.category,
      onHome: a.onHome !== false,
      photos: a.photos.map((p) => ({ image: cmsImage(p), alt: cmsLocalized(p.alt, { en: '', fr: '', ar: '' }), focus: p.focus })),
    }))
  : LOCAL_ALBUMS;

// Only categories that hold at least one album are listed on the site.
export const PHOTO_CATEGORIES: PhotoCategory[] = (cms?.photoCategories ?? [])
  .map((c) => ({ slug: c.slug, title: cmsLocalized(c.title) }))
  .filter((c) => ALBUMS.some((a) => a.category === c.slug));
