/**
 * URL absoluta do formulário do funil (mesmo host/porta atuais).
 * @param {string} slug
 */
export function getFormAbsoluteUrl(slug) {
  if (typeof window === "undefined") return `/form/${slug}`;
  return `${window.location.origin}/form/${slug}`;
}
