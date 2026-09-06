import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { app, ensureInitialized } from './server/app.js';

dotenv.config();

async function startServer() {
  const PORT = 3000;

  // Initialize and auto-migrate PostgreSQL connection & base store records
  try {
    await ensureInitialized();
  } catch (err) {
    console.warn('[Server Startup] Warning during initial database connection check:', err);
  }

  // ==========================================================
  // VITE DEV MIDDLEWARE VS PRODUCTION STATIC SERVING
  // ==========================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // 1. Permanently redirect trailing slashes (except root '/') once to canonical no-trailing-slash URL: e.g. /menu/ -> /menu (HTTP 301)
    app.use((req, res, next) => {
      if (req.path.length > 1 && req.path.endsWith('/')) {
        const cleanPath = req.path.replace(/\/+$/, '');
        const queryIndex = req.url.indexOf('?');
        const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
        return res.redirect(301, cleanPath + queryString);
      }
      next();
    });

    // 2. Explicit SEO route handler BEFORE static middleware to prevent express.static directory redirects
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/assets')) {
        return next();
      }

      // Check for pre-rendered clean HTML file: e.g. /menu -> dist/menu.html, / -> dist/index.html
      const cleanSlug = req.path === '/' ? 'index' : req.path.replace(/^\//, '');
      const htmlFilePath = path.join(distPath, `${cleanSlug}.html`);
      if (fs.existsSync(htmlFilePath)) {
        return res.status(200).sendFile(htmlFilePath);
      }
      next();
    });

    // 3. Dynamic operational routes (SPA shell required, search engine indexing blocked)
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
      app.get(new RegExp(`^${prefix}(/.*)?$`), (_req, res) => {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    });

    // 4. Serve static assets with directory redirects and directory index disabled
    app.use(express.static(distPath, { redirect: false, index: false }));

    // 5. True HTTP 404 response for unknown paths
    app.use((_req, res) => {
      res.setHeader('X-Robots-Tag', 'noindex, follow');
      const notFoundPath = path.join(distPath, '404.html');
      if (fs.existsSync(notFoundPath)) {
        return res.status(404).sendFile(notFoundPath);
      }
      res.status(404).send('404 Not Found');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MOZZ Pizzateria SaaS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
