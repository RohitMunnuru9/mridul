import {
  Flower2,
  Gem,
  Gift,
  Scissors,
  Sparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';

export type NavigationItem = {
  label: string;
  href: string;
  accent?: boolean;
};

export type Category = {
  label: string;
  note: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

export type Product = {
  id: string;
  name: string;
  fabric: string;
  price: string;
  previousPrice?: string;
  badge?: string;
  imagePosition: string;
  swatches: string[];
};

export const navigation: NavigationItem[] = [
  { label: 'New In', href: '#new-arrivals' },
  { label: 'Sarees', href: '#sarees' },
  { label: 'Blouses', href: '#categories' },
  { label: 'Ready to Wear', href: '#categories' },
  { label: 'Occasions', href: '#occasions' },
  { label: 'Our Journal', href: '#story' },
  { label: 'Sale', href: '#new-arrivals', accent: true },
];

export const categories: Category[] = [
  {
    label: 'Everyday Sarees',
    note: 'Airy and easy',
    href: '#new-arrivals',
    icon: Waves,
    tone: 'clay',
  },
  {
    label: 'Silk Stories',
    note: 'Quiet celebration',
    href: '#new-arrivals',
    icon: Sparkles,
    tone: 'moss',
  },
  {
    label: 'Ready to Wear',
    note: 'Drape in a minute',
    href: '#new-arrivals',
    icon: Scissors,
    tone: 'rose',
  },
  {
    label: 'Wedding Edit',
    note: 'For grand days',
    href: '#occasions',
    icon: Gem,
    tone: 'sand',
  },
  {
    label: 'Handloom',
    note: 'Made with time',
    href: '#story',
    icon: Flower2,
    tone: 'ink',
  },
  {
    label: 'Gifting',
    note: 'Wrapped with care',
    href: '#footer',
    icon: Gift,
    tone: 'lilac',
  },
];

export const products: Product[] = [
  {
    id: 'saanjh-sage',
    name: 'Saanjh Sage Saree',
    fabric: 'Handwoven linen silk',
    price: '₹4,650',
    badge: 'New',
    imagePosition: '0%',
    swatches: ['#9ca081', '#caa58e', '#e8dfd1'],
  },
  {
    id: 'raatri-ink',
    name: 'Raatri Ink Saree',
    fabric: 'Soft cotton silk',
    price: '₹5,200',
    imagePosition: '33.333%',
    swatches: ['#1f302a', '#6e4b42', '#b9aa92'],
  },
  {
    id: 'gulab-mist',
    name: 'Gulab Mist Saree',
    fabric: 'Featherlight organza',
    price: '₹4,350',
    previousPrice: '₹4,850',
    badge: 'Bestseller',
    imagePosition: '66.666%',
    swatches: ['#b77f78', '#dcc4bc', '#8a4d58'],
  },
  {
    id: 'noor-ivory',
    name: 'Noor Ivory Saree',
    fabric: 'Chanderi tissue',
    price: '₹5,850',
    imagePosition: '100%',
    swatches: ['#e8dfd1', '#b79c68', '#c49a92'],
  },
];
