import type { ImageMetadata } from 'astro';
import sol from '../assets/clients/sol-by-melia.png';
import blokk from '../assets/clients/le-blokk.png';
import maisonArabe from '../assets/clients/la-maison-arabe.png';
import thEvents from '../assets/clients/th-events.png';
import rueChic from '../assets/clients/rue-chic.png';
import calligraphy from '../assets/clients/house-of-calligraphy.png';
import com212 from '../assets/clients/212-communication.png';
import rssouh from '../assets/clients/el-rssouh.png';
import aei from '../assets/clients/aei-ispits.png';

// Client logos for the homepage film strip, in display order.
// tone: multi-colour logos that would lose detail as a flat white silhouette, so they rest in greyscale instead.
export interface Client {
  name: string;
  logo: ImageMetadata;
  tone?: boolean;
}

export const CLIENTS: Client[] = [
  { name: 'Sol by Meliá', logo: sol },
  { name: 'Le Blokk, dîner spectacle', logo: blokk, tone: true },
  { name: 'La Maison Arabe Marrakech', logo: maisonArabe },
  { name: 'TH Events', logo: thEvents, tone: true },
  { name: 'Rue Chic', logo: rueChic },
  { name: 'The House of the Calligraphy', logo: calligraphy },
  { name: '212 Communication', logo: com212, tone: true },
  { name: 'El Rssouh', logo: rssouh },
  { name: 'Association des Étudiants ISPITS Marrakech', logo: aei },
];
