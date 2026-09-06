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

    // Serve static assets from dist
    app.use(express.static(distPath));

    // Dynamic operational routes (SPA shell required, search engine indexing blocked)
    const dynamicPrefixes = [
      '/admin',
      '/restaurant-admin',
      '/platform-admin',
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

    // Handle pre-rendered static HTML routes and real 404 responses
    app.get('*', (req, res) => {
      const cleanPath = req.path.replace(/\/$/, '') || '/index';
      const candidateFiles = [
        path.join(distPath, `${cleanPath}.html`),
        path.join(distPath, cleanPath, 'index.html'),
        path.join(distPath, `${req.path}.html`),
      ];

      for (const filePath of candidateFiles) {
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }

      // If route doesn't match any pre-rendered file, return true HTTP 404 status
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
