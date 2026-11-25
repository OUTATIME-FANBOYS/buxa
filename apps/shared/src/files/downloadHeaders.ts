/*
 * Headers for a stored file sent as a download. The browser saves it rather than showing it, the type is the one checked on upload,
 * and nothing caches it: a document belongs to one family and one camp.
 */

/** A file name safe in a header: plain ASCII for the fallback, the full name UTF-8 encoded in `filename*`. */
export function downloadFileName(name: string): { ascii: string; encoded: string } {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

  return { ascii: ascii.trim() === '' ? 'download' : ascii, encoded: encodeURIComponent(name) };
}

export const downloadHeaders = (contentType: string, name: string): Record<string, string> => {
  const { ascii, encoded } = downloadFileName(name);

  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
};
