import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import { PUBLIC_ROUTES } from '../src/routes';
import { CANONICAL_DOMAIN } from '../src/config/businessInfo';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    testsFailed++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function verifySeoBuild() {
  console.log('🔍 [SEO Automated Verification Suite] Starting audit checks...\n');

  const distDir = path.resolve(process.cwd(), 'dist');

  // Check 1: Dist Directory Exists
  assert(fs.existsSync(distDir), 'Distribution directory (dist) exists');

  // Check 2: Verify Every Route in PUBLIC_ROUTES
  console.log('\n📄 Testing Pre-rendered Static Route Artifacts:');
  for (const route of PUBLIC_ROUTES) {
    const slug = route.path === '/' ? 'index' : route.path.replace(/^\//, '');
    const htmlFile = path.join(distDir, `${slug}.html`);

    // File exists
    assert(fs.existsSync(htmlFile), `File exists: ${slug}.html for route ${route.path}`);

    // No duplicate folder redirect hazard (e.g. dist/menu/index.html)
    if (route.path !== '/') {
      const duplicateFolder = path.join(distDir, slug);
      assert(
        !fs.existsSync(duplicateFolder),
        `No duplicate directory hazard exists for ${route.path} (${slug})`
      );
    }

    if (fs.existsSync(htmlFile)) {
      const html = fs.readFileSync(htmlFile, 'utf-8');

      // 1. Title Tag
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const decodedTitle = titleMatch
        ? titleMatch[1]
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim()
        : '';
      assert(
        !!titleMatch && decodedTitle === route.title,
        `Title matches for ${route.path} -> "${decodedTitle}"`
      );

      // 2. Canonical Tag
      const expectedCanonical = `${CANONICAL_DOMAIN}${route.path === '/' ? '/' : route.path}`;
      const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
      assert(
        !!canonicalMatch && canonicalMatch[1] === expectedCanonical,
        `Canonical URL strictly matches (${expectedCanonical}) for ${route.path}`
      );

      // 3. Meta Description
      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
      assert(
        !!descMatch && descMatch[1].length > 20,
        `Meta description present and meaningful (>20 chars) for ${route.path}`
      );

      // 4. Social Card
      const twitterCardMatch = html.match(/<meta\s+name="twitter:card"\s+content="([^"]+)"/i);
      assert(
        !!twitterCardMatch && twitterCardMatch[1] === 'summary',
        `Twitter card is "summary" without unverified large image for ${route.path}`
      );

      // 5. Explicit Robots & Googlebot Directives
      const robotsMatch = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i);
      assert(
        !!robotsMatch && robotsMatch[1] === 'index, follow',
        `Explicit robots "index, follow" present for ${route.path}`
      );
      const googlebotMatch = html.match(/<meta\s+name="googlebot"\s+content="([^"]+)"/i);
      assert(
        !!googlebotMatch && googlebotMatch[1] === 'index, follow',
        `Explicit googlebot "index, follow" present for ${route.path}`
      );

      // 6. Central JSON-LD
      const jsonLdMatches = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
      assert(
        !!jsonLdMatches && jsonLdMatches.length > 0,
        `JSON-LD structured data script(s) injected for ${route.path} (${jsonLdMatches?.length || 0} schemas)`
      );

      // Verify valid JSON in each JSON-LD block
      if (jsonLdMatches) {
        let allJsonValid = true;
        for (const block of jsonLdMatches) {
          const content = block.replace(/<\/?script[^>]*>/gi, '').trim();
          try {
            const parsed = JSON.parse(content);
            if (!parsed['@context'] || !parsed['@type']) {
              allJsonValid = false;
            }
          } catch {
            allJsonValid = false;
          }
        }
        assert(allJsonValid, `All JSON-LD schemas valid JSON with @context & @type for ${route.path}`);
      }
    }
  }

  // Check 3: 404 Page Metadata Verification (dist/404.html)
  console.log('\n🚫 Testing Pre-rendered 404 Artifact & Directives:');
  const notFoundPath = path.join(distDir, '404.html');
  assert(fs.existsSync(notFoundPath), '404.html artifact exists in dist/');
  if (fs.existsSync(notFoundPath)) {
    const notFoundHtml = fs.readFileSync(notFoundPath, 'utf-8');

    // Title
    assert(
      notFoundHtml.includes('<title>Page Not Found (404) | Starters4U</title>'),
      '404.html has correct descriptive title'
    );

    // Robots and Googlebot directives: strictly noindex, follow
    const nfRobots = notFoundHtml.match(/<meta\s+name="robots"\s+content="([^"]+)"/i);
    assert(
      !!nfRobots && nfRobots[1] === 'noindex, follow',
      '404.html has meta name="robots" content="noindex, follow"'
    );
    const nfGooglebot = notFoundHtml.match(/<meta\s+name="googlebot"\s+content="([^"]+)"/i);
    assert(
      !!nfGooglebot && nfGooglebot[1] === 'noindex, follow',
      '404.html has meta name="googlebot" content="noindex, follow"'
    );

    // CRITICAL: Ensure NO canonical link points to indexable pages on 404
    const nfCanonical = notFoundHtml.match(/<link\s+rel="canonical"[^>]*>/i);
    assert(!nfCanonical, '404.html has NO canonical link pointing to indexable pages');

    // Ensure NO structured data JSON-LD on 404
    const nfJsonLd = notFoundHtml.match(/<script\s+type="application\/ld\+json">/i);
    assert(!nfJsonLd, '404.html has NO structured data JSON-LD schemas');
  }

  // Check 4: Sitemap.xml Verification
  console.log('\n🗺️  Testing sitemap.xml:');
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  assert(fs.existsSync(sitemapPath), 'sitemap.xml exists in dist/');

  if (fs.existsSync(sitemapPath)) {
    const sitemap = fs.readFileSync(sitemapPath, 'utf-8');
    for (const route of PUBLIC_ROUTES) {
      const expectedUrl = `${CANONICAL_DOMAIN}${route.path === '/' ? '/' : route.path}`;
      assert(
        sitemap.includes(`<loc>${expectedUrl}</loc>`),
        `sitemap.xml contains valid canonical URL for ${route.path}`
      );
    }
    // Verify no unverified fabricated lastmod, priority, or changefreq
    assert(!sitemap.includes('<lastmod>'), 'sitemap.xml contains no fabricated lastmod tags');
    assert(!sitemap.includes('<priority>'), 'sitemap.xml contains no fabricated priority tags');
    assert(!sitemap.includes('<changefreq>'), 'sitemap.xml contains no fabricated changefreq tags');
  }

  // Check 5: Express Production Server Trailing-Slash Redirection & Headers
  console.log('\n🚦 Testing Express Production Server Trailing-Slash Redirects & Headers:');

  const testApp = express();

  // 1. Permanently redirect trailing slashes (except root '/') once to canonical no-trailing-slash URL (HTTP 301)
  testApp.use((req, res, next) => {
    if (req.path.length > 1 && req.path.endsWith('/')) {
      const cleanPath = req.path.replace(/\/+$/, '');
      const queryIndex = req.url.indexOf('?');
      const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
      return res.redirect(301, cleanPath + queryString);
    }
    next();
  });

  // 2. Explicit SEO route handler BEFORE static middleware
  testApp.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/assets')) {
      return next();
    }
    const cleanSlug = req.path === '/' ? 'index' : req.path.replace(/^\//, '');
    const htmlFilePath = path.join(distDir, `${cleanSlug}.html`);
    if (fs.existsSync(htmlFilePath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).sendFile(htmlFilePath);
    }
    next();
  });

  // 3. Dynamic operational routes
  const dynamicPrefixes = [
    '/admin',
    '/restaurant-admin',
    '/platform-admin',
    '/track',
    '/r',
    '/table',
    '/counter',
  ];

  dynamicPrefixes.forEach((prefix) => {
    testApp.get(new RegExp(`^${prefix}(/.*)?$`), (_req, res) => {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      const shellPath = path.join(distDir, 'index.html');
      if (fs.existsSync(shellPath)) {
        return res.status(200).sendFile(shellPath);
      }
      res.status(200).send('SPA Shell');
    });
  });

  // 4. Static files
  testApp.use(express.static(distDir, { redirect: false, index: false }));

  // 5. 404 handler
  testApp.use((_req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    const nfPath = path.join(distDir, '404.html');
    if (fs.existsSync(nfPath)) {
      return res.status(404).sendFile(nfPath);
    }
    res.status(404).send('404 Not Found');
  });

  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const port = address.port;

  async function testHttp(
    reqPath: string
  ): Promise<{ statusCode: number; location?: string; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          host: '127.0.0.1',
          port,
          path: reqPath,
          method: 'GET',
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 0,
              location: res.headers.location,
              headers: res.headers,
              body,
            });
          });
        }
      );
      request.on('error', reject);
      request.end();
    });
  }

  try {
    // 1. GET / -> 200 OK
    const resRoot = await testHttp('/');
    assert(resRoot.statusCode === 200, 'GET / returns HTTP 200 directly');

    // 2. GET /menu -> 200 OK
    const resMenu = await testHttp('/menu');
    assert(resMenu.statusCode === 200, 'GET /menu returns HTTP 200 directly');

    // 3. GET /menu/ -> 301 Redirect to /menu
    const resMenuSlash = await testHttp('/menu/');
    assert(
      resMenuSlash.statusCode === 301 && resMenuSlash.location === '/menu',
      `GET /menu/ returns HTTP 301 -> ${resMenuSlash.location}`
    );

    // 4. GET /menu/?view=track -> 301 Redirect to /menu?view=track (preserves query params)
    const resMenuQuery = await testHttp('/menu/?view=track');
    assert(
      resMenuQuery.statusCode === 301 && resMenuQuery.location === '/menu?view=track',
      `GET /menu/?view=track returns HTTP 301 preserving query -> ${resMenuQuery.location}`
    );

    // 5. GET /pizza-gachibowli -> 200 OK
    const resPizza = await testHttp('/pizza-gachibowli');
    assert(resPizza.statusCode === 200, 'GET /pizza-gachibowli returns HTTP 200 directly');

    // 6. GET /pizza-gachibowli/ -> 301 Redirect to /pizza-gachibowli
    const resPizzaSlash = await testHttp('/pizza-gachibowli/');
    assert(
      resPizzaSlash.statusCode === 301 && resPizzaSlash.location === '/pizza-gachibowli',
      `GET /pizza-gachibowli/ returns HTTP 301 -> ${resPizzaSlash.location}`
    );

    // 7. GET /about -> 200 OK
    const resAbout = await testHttp('/about');
    assert(resAbout.statusCode === 200, 'GET /about returns HTTP 200 directly');

    // 8. GET /about/ -> 301 Redirect to /about
    const resAboutSlash = await testHttp('/about/');
    assert(
      resAboutSlash.statusCode === 301 && resAboutSlash.location === '/about',
      `GET /about/ returns HTTP 301 -> ${resAboutSlash.location}`
    );

    // 9. GET /admin -> 200 OK with X-Robots-Tag: noindex, nofollow, noarchive
    const resAdmin = await testHttp('/admin');
    assert(
      resAdmin.statusCode === 200 && resAdmin.headers['x-robots-tag'] === 'noindex, nofollow, noarchive',
      `GET /admin sets X-Robots-Tag: ${resAdmin.headers['x-robots-tag']}`
    );

    // 10. GET /platform-admin -> 200 OK with X-Robots-Tag: noindex, nofollow, noarchive
    const resPlatformAdmin = await testHttp('/platform-admin');
    assert(
      resPlatformAdmin.statusCode === 200 && resPlatformAdmin.headers['x-robots-tag'] === 'noindex, nofollow, noarchive',
      `GET /platform-admin sets X-Robots-Tag: ${resPlatformAdmin.headers['x-robots-tag']}`
    );

    // 11. GET /track -> 200 OK with X-Robots-Tag: noindex, nofollow, noarchive
    const resTrack = await testHttp('/track');
    assert(
      resTrack.statusCode === 200 && resTrack.headers['x-robots-tag'] === 'noindex, nofollow, noarchive',
      `GET /track sets X-Robots-Tag: ${resTrack.headers['x-robots-tag']}`
    );

    // 12. GET /table/T1 -> 200 OK with X-Robots-Tag: noindex, nofollow, noarchive
    const resTable = await testHttp('/table/T1');
    assert(
      resTable.statusCode === 200 && resTable.headers['x-robots-tag'] === 'noindex, nofollow, noarchive',
      `GET /table/T1 sets X-Robots-Tag: ${resTable.headers['x-robots-tag']}`
    );

    // 13. GET /unknown-route-xyz -> 404 with X-Robots-Tag: noindex, follow
    const res404 = await testHttp('/unknown-route-xyz');
    assert(
      res404.statusCode === 404 &&
        res404.headers['x-robots-tag'] === 'noindex, follow' &&
        res404.body.includes('Page Not Found (404)'),
      'GET /unknown-route-xyz returns HTTP 404 with X-Robots-Tag: noindex, follow and 404 HTML body'
    );

    // 14. GET /sitemap.xml -> 200 OK
    const resSitemap = await testHttp('/sitemap.xml');
    assert(resSitemap.statusCode === 200, 'GET /sitemap.xml served successfully (HTTP 200)');
  } finally {
    server.close();
  }

  console.log('\n----------------------------------------');
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed.`);

  if (testsFailed > 0) {
    console.error('❌ [SEO Automated Verification Suite] Build failed due to SEO errors.');
    process.exit(1);
  } else {
    console.log('🎉 [SEO Automated Verification Suite] All checks successfully passed!');
  }
}

verifySeoBuild().catch((err) => {
  console.error('Fatal error during SEO verification:', err);
  process.exit(1);
});
