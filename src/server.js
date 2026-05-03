const express = require('express');
const path = require('path');
const { createDatabase } = require('./database');
const { createContactsRouter } = require('./routes/contacts');

function createApp(db) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS headers for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Serve static frontend
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // API routes
  app.use('/api/contacts', createContactsRouter(db));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Catch-all: serve frontend
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

// Only start server if run directly
if (require.main === module) {
  const https = require('https');
  const fs = require('fs');

  const db = createDatabase();
  const app = createApp(db);

  const PORT = process.env.PORT || 3000;
  const CERT_PATH = path.join(__dirname, '..', 'certs', 'server.pem');

  if (fs.existsSync(CERT_PATH)) {
    // Split combined PEM into key + cert
    const pem = fs.readFileSync(CERT_PATH, 'utf8');
    const keyMatch = pem.match(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/);
    const certMatch = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);

    if (keyMatch && certMatch) {
      const server = https.createServer({ key: keyMatch[0], cert: certMatch[0] }, app);
      server.listen(PORT, () => console.log(`HTTPS server running on port ${PORT}`));
    } else {
      console.warn('Could not parse server.pem — falling back to HTTP');
      app.listen(PORT, () => console.log(`HTTP server running on port ${PORT}`));
    }
  } else {
    app.listen(PORT, () => console.log(`HTTP server running on port ${PORT}`));
  }
}

module.exports = { createApp };
