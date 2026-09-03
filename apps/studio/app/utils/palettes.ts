export interface PalettePreset {
  id: string
  name: string
  note: string
  colors: string[]
}

export const palettePresets: PalettePreset[] = [
  {
    id: 'zakape-violet',
    name: 'Zakape Violet',
    note: 'Soft violet ramp with a bright magenta signal color.',
    colors: [
      '#120D1C',
      '#241536',
      '#43245F',
      '#6D37A8',
      '#8B5CF6',
      '#C4B5FD',
      '#D946EF',
      '#F5F2FB',
    ],
  },
  {
    id: 'pico-8',
    name: 'PICO-8',
    note: 'A vivid 16-color fantasy-console palette.',
    colors: [
      '#000000',
      '#1D2B53',
      '#7E2553',
      '#008751',
      '#AB5236',
      '#5F574F',
      '#C2C3C7',
      '#FFF1E8',
      '#FF004D',
      '#FFA300',
      '#FFEC27',
      '#00E436',
      '#29ADFF',
      '#83769C',
      '#FF77A8',
      '#FFCCAA',
    ],
  },
  {
    id: 'sweetie-16',
    name: 'Sweetie 16',
    note: 'Balanced darks, skin tones, greens, blues, and highlights.',
    colors: [
      '#1A1C2C',
      '#5D275D',
      '#B13E53',
      '#EF7D57',
      '#FFCD75',
      '#A7F070',
      '#38B764',
      '#257179',
      '#29366F',
      '#3B5DC9',
      '#41A6F6',
      '#73EFF7',
      '#F4F4F4',
      '#94B0C2',
      '#566C86',
      '#333C57',
    ],
  },
  {
    id: 'dawnbringer-16',
    name: 'DawnBringer 16',
    note: 'Compact general-purpose ramps with warm earth colors.',
    colors: [
      '#140C1C',
      '#442434',
      '#30346D',
      '#4E4A4E',
      '#854C30',
      '#346524',
      '#D04648',
      '#757161',
      '#597DCE',
      '#D27D2C',
      '#8595A1',
      '#6DAA2C',
      '#D2AA99',
      '#6DC2CA',
      '#DAD45E',
      '#DEEED6',
    ],
  },
  {
    id: 'endesga-32',
    name: 'Endesga 32',
    note: 'A broad 32-color game-art palette with strong material ramps.',
    colors: [
      '#BE4A2F',
      '#D77643',
      '#EAD4AA',
      '#E4A672',
      '#B86F50',
      '#733E39',
      '#3E2731',
      '#A22633',
      '#E43B44',
      '#F77622',
      '#FEAE34',
      '#FEE761',
      '#63C74D',
      '#3E8948',
      '#265C42',
      '#193C3E',
      '#124E89',
      '#0099DB',
      '#2CE8F5',
      '#FFFFFF',
      '#C0CBDC',
      '#8B9BB4',
      '#5A6988',
      '#3A4466',
      '#262B44',
      '#181425',
      '#FF0044',
      '#68386C',
      '#B55088',
      '#F6757A',
      '#E8B796',
      '#C28569',
    ],
  },
  {
    id: 'game-boy-bgb',
    name: 'Game Boy BGB',
    note: 'Four green values for strict monochrome handheld studies.',
    colors: ['#081820', '#346856', '#88C070', '#E0F8D0'],
  },
]

export const defaultPalette = palettePresets[0]!.colors

export const normalizePalette = (colors: string[]) => {
  const normalized = colors
    .map((color) => color.trim().toLowerCase())
    .filter((color) => /^#[0-9a-f]{6}$/.test(color))
  return [...new Set(normalized)].slice(0, 256)
}
