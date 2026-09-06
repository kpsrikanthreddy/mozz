import { SeoRouteConfig } from '../types/seoTypes';
import { getRouteJsonLd } from '../routes';
import { BUSINESS_INFO, CANONICAL_DOMAIN } from '../config/businessInfo';

export interface MetadataOptions {
  isTracking?: boolean;
  isAdmin?: boolean;
}

function setMetaTag(selector: string, attrName: string, attrValue: string, content: string) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function removeMetaTag(selector: string) {
  const element = document.head.querySelector(selector);
  if (element) {
    element.remove();
  }
}

function setCanonicalTag(url: string) {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function removeCanonicalTag() {
  const link = document.head.querySelector('link[rel="canonical"]');
  if (link) {
    link.remove();
  }
}

function removeAllJsonLd() {
  const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
  scripts.forEach((script) => script.remove());
}

export function updateDocumentMetadata(
  route: SeoRouteConfig | undefined,
  path: string,
  options: MetadataOptions = {}
) {
  if (typeof document === 'undefined') return;

  const normalizedPath = path.split('?')[0].replace(/\/$/, '') || '/';
  const isPrivateOrSystem =
    options.isAdmin ||
    options.isTracking ||
    normalizedPath.startsWith('/admin') ||
    normalizedPath.startsWith('/platform-admin') ||
    normalizedPath.startsWith('/restaurant-admin') ||
    normalizedPath.startsWith('/track') ||
    normalizedPath.startsWith('/r/') ||
    normalizedPath.startsWith('/table/') ||
    normalizedPath.startsWith('/counter') ||
    normalizedPath.startsWith('/checkout') ||
    normalizedPath.startsWith('/order-confirmation');

  // Case 1: Administrative, Private, Order-Confirmation, and System Paths
  if (isPrivateOrSystem) {
    // Explicit noindex, nofollow for both robots and googlebot
    setMetaTag('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    setMetaTag('meta[name="googlebot"]', 'name', 'googlebot', 'noindex, nofollow');

    // Clean up canonical to prevent search engines from indexing private routes
    removeCanonicalTag();

    // Clean up structured data schemas
    removeAllJsonLd();

    // Clean up social sharing metadata
    removeMetaTag('meta[property="og:url"]');
    removeMetaTag('meta[property="og:title"]');
    removeMetaTag('meta[property="og:description"]');
    removeMetaTag('meta[property="og:type"]');
    removeMetaTag('meta[property="og:site_name"]');
    removeMetaTag('meta[name="twitter:card"]');
    removeMetaTag('meta[name="twitter:title"]');
    removeMetaTag('meta[name="twitter:description"]');

    if (options.isAdmin || normalizedPath.includes('admin')) {
      document.title = 'Staff Portal | Starters4U Admin';
      setMetaTag('meta[name="description"]', 'name', 'description', 'Authorized restaurant administration portal.');
    } else if (options.isTracking || normalizedPath === '/track') {
      document.title = 'Live Order Tracker | Starters4U';
      setMetaTag('meta[name="description"]', 'name', 'description', 'Real-time kitchen preparation and fulfillment tracking.');
    } else {
      document.title = 'Table Order Session | Starters4U';
      setMetaTag('meta[name="description"]', 'name', 'description', 'Interactive dining session.');
    }
    return;
  }

  // Case 2: 404 Not Found Page
  if (!route) {
    document.title = 'Page Not Found (404) | Starters4U';
    setMetaTag('meta[name="description"]', 'name', 'description', 'The page you requested could not be found on Starters4U.');

    // Directives: noindex, follow for both robots and googlebot
    setMetaTag('meta[name="robots"]', 'name', 'robots', 'noindex, follow');
    setMetaTag('meta[name="googlebot"]', 'name', 'googlebot', 'noindex, follow');

    // Remove canonical tag so it never points to indexable pages
    removeCanonicalTag();

    // Remove JSON-LD schemas
    removeAllJsonLd();

    // Clean up social sharing metadata
    removeMetaTag('meta[property="og:url"]');
    removeMetaTag('meta[property="og:title"]');
    removeMetaTag('meta[property="og:description"]');
    removeMetaTag('meta[property="og:type"]');
    removeMetaTag('meta[property="og:site_name"]');
    removeMetaTag('meta[name="twitter:card"]');
    removeMetaTag('meta[name="twitter:title"]');
    removeMetaTag('meta[name="twitter:description"]');
    return;
  }

  // Case 3: Public Indexable Route
  // Cleanly restore indexable metadata when returning from a private or 404 route
  document.title = route.title;
  setMetaTag('meta[name="robots"]', 'name', 'robots', 'index, follow');
  setMetaTag('meta[name="googlebot"]', 'name', 'googlebot', 'index, follow');
  setMetaTag('meta[name="description"]', 'name', 'description', route.metaDescription);

  const canonicalUrl = `${CANONICAL_DOMAIN}${route.path === '/' ? '/' : route.path}`;
  setCanonicalTag(canonicalUrl);

  // Set Open Graph metadata
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', 'website');
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', route.title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', route.metaDescription);
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', BUSINESS_INFO.platformName);

  // Set Twitter Card metadata
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', route.title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', route.metaDescription);

  // Clean and re-inject structured JSON-LD schemas
  removeAllJsonLd();
  const schemas = getRouteJsonLd(route);
  for (const schema of schemas) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo', 'true');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }
}
