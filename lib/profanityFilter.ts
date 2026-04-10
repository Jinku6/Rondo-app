/**
 * Utility to filter profanity and offensive words in user inputs.
 * Ensures the platform remains safe and sportsmanship-oriented.
 */

const BAD_WORDS = [
  'puta', 'puto', 'mierda', 'cabron', 'cabrón', 'zorra', 'gilipollas',
  'subnormal', 'maricon', 'maricón', 'joder', 'concha', 'coño', 'pene',
  'verga', 'polla', 'follar', 'putita', 'putazo', 'idiota', 'imbecil',
  'imbécil', 'estupido', 'estúpido', 'retardado', 'pija', 'pajero',
  'nazi', 'hitler', 'puto el que lo lea', 'puto el que lea esto', 'puto el que lea esto',
];

export const containsProfanity = (text: string): boolean => {
  if (!text) return false;

  // Normalize text to lowercase and remove accents for stricter checking
  const normalizedText = text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Check if any bad word is included as a distinct word
  // Using word boundary (\b) so "computadora" doesn't trigger "puta"
  for (const word of BAD_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalizedText)) {
      return true;
    }
  }

  return false;
};

export const sanitizeText = (text: string): string => {
  if (!text) return text;
  let sanitized = text;

  BAD_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'ig');
    sanitized = sanitized.replace(regex, '***');
  });

  return sanitized;
};
