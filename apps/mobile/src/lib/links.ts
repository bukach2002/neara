import * as Linking from 'expo-linking';

/**
 * Public web pages that App Store review and in-app consent text point at.
 * They are served by apps/web, so deploy the web app before shipping a build.
 */
export const SITE_URL = 'https://neara.co.in';
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const TERMS_URL = `${SITE_URL}/terms`;
export const SUPPORT_URL = `${SITE_URL}/support`;
export const SUPPORT_EMAIL = 'support@neara.co.in';

/** Opens a URL outside the app. Returns false when no handler accepted it. */
export async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Studio accounts cannot be deleted with the customer endpoint, so the app
 * starts a support request with the details support needs to act on it.
 */
export function businessDeletionRequestUrl(input: {
  businessName: string;
  email?: string | null;
}) {
  const subject = `Delete business account: ${input.businessName}`;
  const body = [
    'Please delete my Neara business account.',
    '',
    `Business: ${input.businessName}`,
    `Account email: ${input.email ?? 'not provided'}`,
    '',
    'I understand the studio page will be unpublished, my login removed, and',
    'booking records retained for accounting and legal requirements.',
  ].join('\n');

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
