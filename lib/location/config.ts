export const DEFAULT_COUNTRY_CODE = 'ES';

export const LOCATION_CONFIG = {
  defaultCountryCode: DEFAULT_COUNTRY_CODE,
  supportedCountries: ['ES'],
  language: 'es',
  defaultLimit: 6,
  externalLimit: 4,
  strongDuplicateDistanceMeters: 150,
  probableDuplicateDistanceMeters: 500,
} as const;

export type SupportedCountryCode = (typeof LOCATION_CONFIG.supportedCountries)[number];
