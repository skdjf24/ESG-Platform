/** Next route params can retain percent encoding after client navigation. The
 * repository key is the original project ID, including Chinese characters. */
export function projectIdFromRoute(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
