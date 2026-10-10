/**
 * EcoPulse Mobile Design Tokens & Visual Identity
 * Light, clean background with subtle green tint, deep forest-green typography,
 * bright environmental green primary actions, white rounded cards, restrained shadows.
 */

export const theme = {
  colors: {
    // Backgrounds
    background: '#F4F8F5', // subtle environmental green tint
    surface: '#FFFFFF',
    surfaceSubtle: '#EDF5F0',
    surfaceBorder: '#E3ECE6',

    // Primary Brand Greens
    primary: '#00A86B', // bright environmental green for actions, active tabs, buttons
    primaryHover: '#00955E',
    primarySubtle: '#E6F7F0',
    forest: '#0E3B2E', // deep forest green for typography, titles, headings
    forestSubtle: '#1C5242',

    // Status Badges
    status: {
      analyzedBg: '#F3E8FF',
      analyzedText: '#7E22CE',
      analyzedBorder: '#E9D5FF',

      processingBg: '#FEF3C7',
      processingText: '#D97706',
      processingBorder: '#FDE68A',

      reviewBg: '#EFF6FF',
      reviewText: '#1D4ED8',
      reviewBorder: '#BFDBFE',

      resolvedBg: '#ECFDF5',
      resolvedText: '#047857',
      resolvedBorder: '#A7F3D0',

      pendingBg: '#F1F5F9',
      pendingText: '#475569',
      pendingBorder: '#CBD5E1',
    },

    // Impact Stat Cards
    impact: {
      reportsBg: '#EBF7EE',
      reportsIcon: '#2E7D32',
      reportsText: '#1B5E20',

      verifiedBg: '#E8F4FD',
      verifiedIcon: '#1976D2',
      verifiedText: '#0D47A1',

      resolvedBg: '#FFF3E0',
      resolvedIcon: '#F57C00',
      resolvedText: '#E65100',

      pointsBg: '#F5E8F7',
      pointsIcon: '#8E24AA',
      pointsText: '#6A1B9A',
    },

    // Neutrals & Text
    textPrimary: '#0E3B2E', // deep forest green
    textSecondary: '#52665D', // muted slate green
    textTertiary: '#8A9E94',
    textMuted: '#8A9E94',
    textInverse: '#FFFFFF',

    // Borders & Dividers
    border: '#E3ECE6',
    borderLight: '#EDF3EF',
    divider: '#E8F0EA',

    // Accents
    flame: '#EF4444',
    amber: '#F59E0B',
    star: '#8B5CF6',
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
  },

  shadows: {
    card: {
      shadowColor: '#0E3B2E',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    floating: {
      shadowColor: '#00A86B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    modal: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 10,
    },
  },
};
