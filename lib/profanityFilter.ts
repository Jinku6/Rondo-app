/**
 * Utility to filter profanity and offensive words in user inputs.
 * Ensures the platform remains safe and sportsmanship-oriented.
 */

const BAD_WORDS = [
  'puta', 'puto', 'mierda', 'cabron', 'cabrón', 'zorra', 'gilipollas',
  'subnormal', 'maricon', 'maricón', 'joder', 'concha', 'coño', 'pene',
  'verga', 'polla', 'follar', 'putita', 'putazo', 'idiota', 'imbecil',
  'imbécil', 'estupido', 'estúpido', 'retardado', 'pija', 'pajero',
  'nazi', 'hitler', 'puto el que lo lea', 'puto el que lea esto',
];

// Escapa caracteres especiales de regex para evitar ReDoS si las palabras
// contuviesen caracteres como '.', '*', '+', '(', ')', etc.
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Normaliza texto: minúsculas y sin tildes para comparación uniforme
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Regexes precompiladas una sola vez al cargar el módulo (evita recompilación en cada llamada)
const BAD_WORD_REGEXES: RegExp[] = BAD_WORDS.map(
  word => new RegExp(`\\b${escapeRegex(normalize(word))}\\b`, 'i')
);

export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  const normalizedText = normalize(text);
  return BAD_WORD_REGEXES.some(regex => regex.test(normalizedText));
};

export const sanitizeText = (text: string): string => {
  if (!text) return text;
  const normalizedText = normalize(text);
  let sanitized = text;
  BAD_WORD_REGEXES.forEach((regex, i) => {
    if (regex.test(normalizedText)) {
      // Reemplazar en el texto original (no el normalizado) para preservar formato
      const originalWordRegex = new RegExp(`\\b${escapeRegex(BAD_WORDS[i])}\\b`, 'ig');
      sanitized = sanitized.replace(originalWordRegex, '***');
    }
  });
  return sanitized;
};
