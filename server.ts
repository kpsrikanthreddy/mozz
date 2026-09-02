import express from 'express';
import path from 'path';
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
  // SPA Wildcard fallback ensures /admin, /platform-admin, /
  // and all direct browser refreshes render cleanly.
  // ==========================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MOZZ Pizzateria SaaS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
