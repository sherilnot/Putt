// Puttum Kadalayum design tokens: a warm Kerala palette (kadala curry, turmeric,
// banana leaf, rice paper), Fraunces for display type and Manrope for UI text.

export const colors = {
  // Surfaces
  bg: '#F6F0E6', // rice paper
  surface: '#FFFDF9',
  surfaceAlt: '#F1E8DA',
  ink: '#1E1813', // espresso: dark hero cards, primary text
  inkSoft: '#3A2F27',

  // Text
  text: '#1E1813',
  textSoft: '#5E5348',
  textMuted: '#998C7E',
  textOnDark: '#FBF5EC',
  textOnDarkSoft: '#C9BBA9',

  // Brand
  brand: '#A8401F', // kadala curry
  brandDeep: '#7E2B12',
  brandSoft: '#F5E1D6',
  gold: '#D9A441', // turmeric
  goldSoft: '#F7EBD0',
  leaf: '#2F6B45', // banana leaf (veg)
  leafSoft: '#DDEDE2',
  chili: '#B3261E', // non-veg, errors
  chiliSoft: '#F8DEDB',
  sky: '#2B5F8A',
  skySoft: '#DCE8F2',

  line: '#E6DAC8',
  lineSoft: '#EFE6D8',
  overlay: 'rgba(30, 24, 19, 0.45)',
};

export const gradients = {
  brand: ['#C25A2C', '#A8401F', '#7E2B12'] as const,
  ink: ['#2E241D', '#1E1813'] as const,
  gold: ['#E7BE62', '#D9A441', '#B9852A'] as const,
  paper: ['#FBF6EE', '#F6F0E6'] as const,
};

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_500Medium_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = {
  soft: {
    shadowColor: '#4A3420',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  lifted: {
    shadowColor: '#4A3420',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
};
