/**
 * The colour vocabulary a catalogue manager picks from.
 *
 * Hex codes are a developer's way of naming a colour. Someone listing a saree
 * knows it is "Saffron", not "#c2622e", so the admin offers this list and
 * writes both the name and the code to the product. The storefront still reads
 * the hex from the database, so nothing here is a rendering decision.
 *
 * The first group is every colour already in the catalogue, at the exact hex
 * each product stores, so editing an existing piece finds its own colour on the
 * list rather than an approximation of it. Where two pieces shared a name at
 * different shades, the lighter one is qualified rather than merged — an
 * approximation here would silently recolour a live product.
 *
 * Adding a colour is a one-line change rather than a migration, because a
 * product stores the name and hex it was given, not a foreign key into this
 * list. A colour dropped from here keeps working on the products that use it.
 */

export type Colour = { name: string; hex: string };

/** Grouped the way a person would describe a garment, not by hue angle. */
export const COLOUR_GROUPS: { label: string; colours: Colour[] }[] = [
  {
    label: 'In your catalogue',
    colours: [
      { name: 'Berry', hex: '#8a4d58' },
      { name: 'Black', hex: '#25211f' },
      { name: 'Clay', hex: '#b08268' },
      { name: 'Cream', hex: '#efe3cd' },
      { name: 'Gold', hex: '#b79c68' },
      { name: 'Grey', hex: '#8d8f92' },
      { name: 'Indigo', hex: '#3c4a72' },
      { name: 'Ink', hex: '#1f302a' },
      { name: 'Ivory', hex: '#e8dfd1' },
      { name: 'Ivory (warm)', hex: '#efe6da' },
      { name: 'Moss', hex: '#6b7358' },
      { name: 'Olive', hex: '#6f7448' },
      { name: 'Rose', hex: '#c99a95' },
      { name: 'Rose (deep)', hex: '#b77f78' },
      { name: 'Saffron', hex: '#c2622e' },
      { name: 'Sage', hex: '#9ca081' },
      { name: 'Turmeric', hex: '#d0a13f' },
    ],
  },
  {
    label: 'Reds and pinks',
    colours: [
      { name: 'Maroon', hex: '#6d1f2e' },
      { name: 'Wine', hex: '#8f2f4a' },
      { name: 'Rani Pink', hex: '#c2185b' },
      { name: 'Blush', hex: '#edc8c8' },
      { name: 'Coral', hex: '#e2725b' },
      { name: 'Rust', hex: '#9c4221' },
    ],
  },
  {
    label: 'Yellows and golds',
    colours: [
      { name: 'Marigold', hex: '#e9a319' },
      { name: 'Haldi', hex: '#d4a017' },
      { name: 'Mustard', hex: '#b8860b' },
      { name: 'Antique Gold', hex: '#b8893f' },
      { name: 'Champagne', hex: '#e8d5b7' },
    ],
  },
  {
    label: 'Greens and teals',
    colours: [
      { name: 'Bottle Green', hex: '#0b4d3a' },
      { name: 'Emerald', hex: '#1f7a5c' },
      { name: 'Deep Teal', hex: '#155e63' },
      { name: 'Mint', hex: '#cfe3d4' },
    ],
  },
  {
    label: 'Blues and purples',
    colours: [
      { name: 'Navy', hex: '#1b2a4a' },
      { name: 'Peacock Blue', hex: '#1a6b8f' },
      { name: 'Powder Blue', hex: '#b8cddb' },
      { name: 'Aubergine', hex: '#4a2545' },
      { name: 'Lavender', hex: '#c9b8d8' },
    ],
  },
  {
    label: 'Neutrals',
    colours: [
      { name: 'Beige', hex: '#d9c7ac' },
      { name: 'Sand', hex: '#c9b291' },
      { name: 'Chocolate', hex: '#4a3228' },
      { name: 'Charcoal', hex: '#33363b' },
      { name: 'Silver Grey', hex: '#b6b8bb' },
    ],
  },
];

export const COLOURS: Colour[] = COLOUR_GROUPS.flatMap((group) => group.colours);

/** Case-insensitive, so a hex saved as `#C2622E` still matches. */
export function findColour(hex: string): Colour | undefined {
  const wanted = hex.trim().toLowerCase();
  return COLOURS.find((colour) => colour.hex.toLowerCase() === wanted);
}

/**
 * The name for a hex, falling back to the name already stored on the product.
 * A colour dropped from the list above must not silently rename a live product.
 */
export function colourName(hex: string, fallback: string): string {
  return findColour(hex)?.name ?? fallback;
}
