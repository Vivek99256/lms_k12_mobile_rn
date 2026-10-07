// Colours mirror the Next.js web app (d:/lms_k12):
//   app/globals.css  -> --primary-blue #4F46E5, --primary-green #7ED957, --app-shell-background #EAF0F8,
//                       --accent-gradient 135deg #0D6EFD -> #7ED957
//   app/components/* -> shell primary #0D6EFD (hover #0B5ED7)
//   app/login/page.tsx -> hero gradient #1e3a8a -> #3557d4 -> #4169E1 (hover #3658c7)
export const colors = {
  primary: '#0d6efd',
  primaryDark: '#0b5ed7',
  primarySoft: '#eff6ff', // web: bg-blue-50
  green: '#7ed957',
  bg: '#eaf0f8', // web app-shell background
  surface: '#ffffff',
  border: '#e5e7eb',
  text: '#171717',
  textMuted: '#6b7280',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  success: '#16a34a',
};

export const gradients = {
  /** The web login panel. */
  hero: ['#1e3a8a', '#3557d4', '#4169e1'] as const,
  /** Primary buttons. */
  button: ['#0d6efd', '#0b5ed7'] as const,
  /** Web --accent-gradient. */
  accent: ['#0d6efd', '#7ed957'] as const,
};

/** Brand tints for cards/icons: `solid` bold card, `on` readable text on it, `soft` pastel bg, `fg` icon/text. */
export const candy = [
  { solid: '#0d6efd', on: '#ffffff', soft: '#eff6ff', fg: '#0b5ed7' },
  { solid: '#7ed957', on: '#143a0a', soft: '#f0fbe8', fg: '#3f8f1d' },
  { solid: '#4f46e5', on: '#ffffff', soft: '#eef2ff', fg: '#4338ca' },
  { solid: '#10b981', on: '#ffffff', soft: '#ecfdf5', fg: '#047857' },
  { solid: '#4169e1', on: '#ffffff', soft: '#eaf0fd', fg: '#3658c7' },
  { solid: '#1e3a8a', on: '#ffffff', soft: '#e8edf9', fg: '#1e3a8a' },
];

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 12, md: 20, lg: 26, xl: 34 };

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const shadow = {
  shadowColor: '#1e3a8a',
  shadowOpacity: 0.1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;
