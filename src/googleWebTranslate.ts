const GoogleToken: {
  get(text: string, options: { tld: string }): Promise<{ name: string; value: string }>;
} = require('google-translate-token-with-mirror');

export function googleWebTokenOptions(): { tld: string; mirror: string } {
  return { tld: 'com', mirror: '' };
}

/**
 * Adapter for the same unauthenticated web endpoint used by Google Translate.
 * This is intentionally isolated: it is an unofficial interface and may change.
 */
export class GoogleWebTranslate {
  async translate(text: string, targetLanguage: string): Promise<string> {
    if (!text.trim()) return text;

    const token = await GoogleToken.get(text, googleWebTokenOptions());
    const query = new URLSearchParams({
      client: 'gtx',
      sl: 'auto',
      tl: targetLanguage,
      hl: targetLanguage,
      ie: 'UTF-8',
      oe: 'UTF-8',
      otf: '1',
      ssel: '0',
      tsel: '0',
      kc: '7',
      q: text,
      [token.name]: token.value
    });
    for (const value of ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't']) {
      query.append('dt', value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`https://translate.google.com/translate_a/single?${query}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MarkdownTranslator/0.1)'
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Google Translate returned HTTP ${response.status}`);

      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
        throw new Error('Google Translate returned an unexpected response.');
      }
      const result = payload[0]
        .map((sentence: unknown) => Array.isArray(sentence) && typeof sentence[0] === 'string' ? sentence[0] : '')
        .join('');
      if (!result) throw new Error('Google Translate returned an empty translation.');
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
