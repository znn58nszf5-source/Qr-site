const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const QRCode = require("qrcode");
const fs = require('fs');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send('<h1 style="font-family:sans-serif;text-align:center;margin-top:50px;color:#25D366;">QR Site is Active ✅</h1>');
});

app.get("/pair/:id", async (req, res) => {
    const id = req.params.id;
    const sessionDir = `./temp_${id}`;
    
    // 1. Setup Auth
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Chrome", "Ubuntu", "20.0.04"]
    });

    // 2. Critical: Save creds every time they update
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        // Show QR
        if (qr) {
            if (!res.headersSent) {
                const qrImage = await QRCode.toDataURL(qr);
                res.send(`
                    <div style="text-align:center;font-family:sans-serif;margin-top:50px;">
                        <h2>Scan for ID: ${id}</h2>
                        <img src="${qrImage}" style="width:300px;border:10px solid #25D366;border-radius:15px;"/>
                        <p>If you already scanned and it's stuck, refresh this page.</p>
                        <script>setTimeout(() => { location.reload(); }, 30000);</script>
                    </div>
                `);
            }
        }

        // 3. Logic for SUCCESSFUL SCAN
        if (connection === 'open') {
            await delay(5000); // Give it a moment to finish writing the file
            try {
                const credsData = fs.readFileSync(`${sessionDir}/creds.json`);
                const sessionId = "GEMINI_SESSION_" + Buffer.from(credsData).toString('base64');
                
                // We can't "send" another response if the QR was already sent,
                // so we use a simple trick: console log it AND try to send it if possible.
                console.log(`\n🚀 SUCCESS FOR ${id}!\nID: ${sessionId}\n`);
                
                // Note: In a real browser, once the QR is scanned, the socket connection 
                // opens but the HTTP request is already finished. 
                // THE BEST WAY: Log into your Railway "Logs" tab to see the ID string!
            } catch (e) {
                console.log("Error reading creds:", e);
            }
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                // Restart if it wasn't a manual logout
                console.log("Connection closed, but not logged out. Try scanning again.");
            }
        }
    });
});

app.listen(PORT, () => console.log(`🚀 Site running on port ${PORT}`));
