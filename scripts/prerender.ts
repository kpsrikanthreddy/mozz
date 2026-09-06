import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { PUBLIC_ROUTES, getRouteConfig } from '../src/routes';
import {
  BUSINESS_INFO,
  CANONICAL_DOMAIN,
  generateRestaurantJsonLd,
  generateBreadcrumbJsonLd,
  generateFaqJsonLd,
} from '../src/config/businessInfo';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function runPrerender() {
  console.log('🚀 [SSG Pre-renderer] Starting build-time static HTML generation...');

  const distDir = path.resolve(process.cwd(), 'dist');
  const templatePath = path.join(distDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Base template not found at ${templatePath}. Run "vite build" first.`);
  }

  const baseTemplate = fs.readFileSync(templatePath, 'utf-8');

  // 1. Generate Static HTML for all 15 Public SEO Routes
  for (const route of PUBLIC_ROUTES) {
    console.log(`  ⚡ Pre-rendering: ${route.path} (${route.name})`);

    // Render component tree to static markup
    const appHtml = renderToString(React.createElement(App, { initialPath: route.path }));

    // Prepare JSON-LD schemas
    const restaurantJsonLd = generateRestaurantJsonLd();
    const breadcrumbJsonLd = generateBreadcrumbJsonLd(route.breadcrumbs);
    const faqJsonLd = generateFaqJsonLd(route.faqs);

    const structuredDataScripts = [
      `<script type="application/ld+json">\n${JSON.stringify(restaurantJsonLd, null, 2)}\n</script>`,
      `<script type="application/ld+json">\n${JSON.stringify(breadcrumbJsonLd, null, 2)}\n</script>`,
    ];

    if (faqJsonLd) {
      structuredDataScripts.push(
        `<script type="application/ld+json">\n${JSON.stringify(faqJsonLd, null, 2)}\n</script>`
      );
    }

    const canonicalUrl = `${CANONICAL_DOMAIN}${route.path === '/' ? '/' : route.path}`;

    const headInjections = `
    <!-- Primary SEO Metadata -->
    <title>${escapeHtml(route.title)}</title>
    <meta name="description" content="${escapeHtml(route.description)}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(route.title)}" />
    <meta property="og:description" content="${escapeHtml(route.description)}" />
    <meta property="og:site_name" content="${escapeHtml(BUSINESS_INFO.platformName)}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(route.title)}" />
    <meta name="twitter:description" content="${escapeHtml(route.description)}" />

    <!-- JSON-LD Structured Data -->
    ${structuredDataScripts.join('\n    ')}
    `;

    // Replace <title> and clean existing meta tags to prevent duplicates
    let pageHtml = baseTemplate
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<meta\s+name="description"[\s\S]*?>/gi, '')
      .replace(/<link\s+rel="canonical"[\s\S]*?>/gi, '')
      .replace(/<meta\s+property="og:[^"]*"[\s\S]*?>/gi, '')
      .replace(/<meta\s+name="twitter:[^"]*"[\s\S]*?>/gi, '');

    // Inject head tags right before </head>
    pageHtml = pageHtml.replace('</head>', `${headInjections}\n  </head>`);

    // Inject prerendered markup into <div id="root">
    pageHtml = pageHtml.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`
    );

    // Determine target output paths
    if (route.path === '/') {
      fs.writeFileSync(path.join(distDir, 'index.html'), pageHtml, 'utf-8');
    } else {
      const cleanSlug = route.path.replace(/^\//, '');
      const routeDir = path.join(distDir, cleanSlug);
      if (!fs.existsSync(routeDir)) {
        fs.mkdirSync(routeDir, { recursive: true });
      }
      fs.writeFileSync(path.join(routeDir, 'index.html'), pageHtml, 'utf-8');
      fs.writeFileSync(path.join(distDir, `${cleanSlug}.html`), pageHtml, 'utf-8');
    }
  }

  // 2. Pre-render 404 Not Found Page
  console.log('  ⚡ Pre-rendering 404 Not Found Page (/404)');
  const notFoundHtml = renderToString(React.createElement(App, { initialPath: '/404' }));
  const notFoundHead = `
    <title>Page Not Found (404) | Starters4U</title>
    <meta name="description" content="The page you requested could not be found on Starters4U." />
    <meta name="robots" content="noindex, follow" />
  `;

  let notFoundPage = baseTemplate
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name="description"[\s\S]*?>/gi, '')
    .replace(/<link\s+rel="canonical"[\s\S]*?>/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[\s\S]*?>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[\s\S]*?>/gi, '')
    .replace(/<meta\s+name="robots"[\s\S]*?>/gi, '');

  notFoundPage = notFoundPage.replace('</head>', `${notFoundHead}\n  </head>`);
  notFoundPage = notFoundPage.replace(
    '<div id="root"></div>',
    `<div id="root">${notFoundHtml}</div>`
  );

  fs.writeFileSync(path.join(distDir, '404.html'), notFoundPage, 'utf-8');
  const notFoundDir = path.join(distDir, '404');
  if (!fs.existsSync(notFoundDir)) {
    fs.mkdirSync(notFoundDir, { recursive: true });
  }
  fs.writeFileSync(path.join(notFoundDir, 'index.html'), notFoundPage, 'utf-8');

  // 3. Generate Valid sitemap.xml
  console.log('  📑 Generating XML Sitemap with 15 public routes...');
  const sitemapEntries = PUBLIC_ROUTES.map((route) => {
    const loc = `${CANONICAL_DOMAIN}${route.path === '/' ? '/' : route.path}`;
    const priority =
      route.path === '/'
        ? '1.0'
        : route.path === '/menu'
        ? '0.9'
        : route.path.startsWith('/privacy') ||
          route.path.startsWith('/terms') ||
          route.path.startsWith('/refund')
        ? '0.5'
        : '0.8';

    const changefreq = route.path === '/' || route.path === '/menu' ? 'daily' : 'weekly';

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>2026-09-06</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf-8');
  fs.writeFileSync(path.resolve(process.cwd(), 'public', 'sitemap.xml'), sitemapXml, 'utf-8');

  console.log('✅ [SSG Pre-renderer] All 15 routes pre-rendered, 404 generated, and sitemap.xml saved!');
}

runPrerender().catch((err) => {
  console.error('❌ [SSG Pre-renderer] Fatal error during pre-rendering:', err);
  process.exit(1);
});
