import { sanitizeText } from './profanityFilter';
import { Alert } from 'react-native';

/**
 * Checks if the text contains personal data like email or phone numbers.
 * @param text The text to check
 * @returns true if personal data is found, false otherwise
 */
export const containsPersonalData = (text: string): boolean => {
  if (!text) return false;

  // Extremely basic checks for emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  
  // Checking for phone numbers (at least 8-9 digits, optionally with spaces/dashes/plus)
  const phoneRegex = /(?:\+?\d{1,3}[\s-]*)?(?:\d[\s-]*){8,}\d/;
  
  if (emailRegex.test(text) || phoneRegex.test(text)) {
    return true;
  }
  
  return false;
};

/**
 * Processes a message text before sending.
 * Shows an alert and returns null if personal data is found.
 * Otherwise, sanitizes profanity and returns the clean text.
 */
export const processMessageText = (text: string): string | null => {
  if (containsPersonalData(text)) {
    Alert.alert(
      'Mensaje bloqueado',
      'Por tu seguridad y la de los demás, no está permitido compartir datos personales (teléfono o email) mediante el chat.'
    );
    return null; // Indicates that the message should not be sent
  }

  // If no personal data, sanitize profanity
  return sanitizeText(text);
};
