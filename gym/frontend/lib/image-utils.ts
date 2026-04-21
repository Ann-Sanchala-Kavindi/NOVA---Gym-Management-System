import { API_BASE_URL } from './auth-api';

/**
 * Converts a relative image URL to an absolute URL.
 * If the URL already starts with http, it's returned as-is.
 * If it starts with /, the API_BASE_URL is prepended.
 */
export const getImageUrl = (imageUrl?: string): string | undefined => {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${API_BASE_URL}${imageUrl}`;
  return imageUrl;
};
