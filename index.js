const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

// 1. IMPORT THE ROUTERS (Logic files)
// Make sure qr.js and pair.js exist in your folder!
let server = require('./qr');
let code = require('./pair');

// 2. MIDDLEWARE CONFIG
require('events').EventEmitter.defaultMaxListeners = 500;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 3. API ROUTES (The background processes)
// These must come BEFORE the page routes
app.use('/server', server); // Handles QR generation
app.use('/code', code);     // Handles Pairing Code generation

// 4. PAGE ROUTES (Serving the HTML files)
// Order matters: specific pages first, then the root '/'
app.get('/pair', async (req, res) => {
    res.sendFile(path.join(__dirname, '/pair.html'));
});

app.get('/qr', async (req, res) => {
    res.sendFile(path.join(__dirname, '/qr.html'));
});

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, '/main.html'));
});

// 5. START SERVER
app.listen(PORT, () => {
    console.log(`
    =========================================
    🚀 Y2KHOLLOW-XD SESSION SITE IS LIVE
    🔗 http://localhost:${PORT}
    =========================================
    `);
});

module.exports = app;
