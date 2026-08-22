// server.js – Node.js backend with Express
// Serves static files from the current directory and proxies /api/* to Firebase.
// Compatible with Node.js v22.20.0

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Firebase configuration (from environment variables)
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://restaurant-6c90e-default-rtdb.firebaseio.com';
const FIREBASE_SECRET = process.env.FIREBASE_SECRET || '';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// =============================================
// FIX: Serve static files from the CURRENT directory
// (where server.js, index.html, style.css, script.js are)
// =============================================
app.use(express.static(__dirname));

// =============================================
// FIX: Explicitly serve index.html for the root route "/"
// =============================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =============================================
// Firebase Proxy – all /api/* requests
// =============================================
app.all(/^\/api\/.*$/, async (req, res) => {
  try {
    const endpoint = req.path.replace(/^\/api\//, '');
    if (!endpoint) {
      return res.status(400).json({ error: 'Invalid endpoint' });
    }

    const authParam = FIREBASE_SECRET ? `?auth=${FIREBASE_SECRET}` : '';
    const firebaseUrl = `${FIREBASE_DB_URL}/${endpoint}.json${authParam}`;

    const fetchOptions = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(firebaseUrl, fetchOptions);
    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${__dirname}`);
  console.log(`Proxying to Firebase: ${FIREBASE_DB_URL}`);
});