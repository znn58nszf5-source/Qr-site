const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const QRCode = require("qrcode");
const fs = require('fs');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. LANDING PAGE (The "Correct Spot" fix)
app.get("/", (req, res) => {
    res.send(`
        <div style="text-align:center; font-family:sans-serif; margin-top:50px; background:#f9f9f9; padding:40px; border-radius:15px;">
            <h1 style="color:#25D366;">🟢 QR Pairing Tool is Online</h1>
            <p>To start pairing, add a name to the end of the URL.</p>
            <p style="background:#fff; padding:15px; display:inline-block; border-radius:8px; border:1px solid #ddd; font-weight:bold;">
                Example: <code>${req.protocol}://${req.get('host')}/pair/bot1</code>
            </p>
            <p style="color:#888; font-size:0.9em; margin-top:20px;">Scan once, get your ID string, and you're done!</p>
        </div>
    `);
});

// 2. PAIRING ROUTE
app.get("/pair/:id", async (req, res) => {
    const id = req.params.id;
    const sessionDir = `./temp_${id}`;
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Chrome", "Ubuntu", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            const qrImage = await QRCode.toDataURL(qr);
            res.send(`
                <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                    <h2 style="color:#075e54;">Scan to Pair: ${id}</h2>
                    <img src="${qrImage}" style="width:300px; border: 8px solid #25D366; border-radius:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"/>
                    <p style="margin-top:20px;">Open WhatsApp > Linked Devices > Link a Device.</p>
                    <p style="color:#888;">This page will refresh every 30 seconds if not scanned.</p>
                    <script>setTimeout(() => { location.reload(); }, 30000);</script>
                </div>
            `);
        }

        if (connection === 'open') {
            const creds = JSON.parse(fs.readFileSync(`${sessionDir}/creds.json`));
            const sessionId = "GEMINI_SESSION_" + Buffer.from(JSON.stringify(creds)).toString('base64');
            
            res.send(`
                <div style="text-align:center; font-family:sans-serif; margin-top:50px; padding:30px; border: 2px dashed #25D366; border-radius:15px; max-width:600px; margin-left:auto; margin-right:auto;">
                    <h2 style="color:#25D366;">✅ Pairing Successful!</h2>
                    <p>Copy your <b>One-Line Session ID</b> below:</p>
                    <textarea readonly style="width:100%; height:160px; word-break:break-all; padding:15px; border-radius:10px; border:1px solid #ccc; font-family:monospace; font-size:12px; background:#fefefe;">${sessionId}</textarea>
                    <br><br>
                    <button onclick="navigator.clipboard.writeText('${sessionId}')" style="padding:12px 25px; background:#25D366; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Copy ID String</button>
                    <p style="color:#d9534f; margin-top:20px; font-weight:bold;">⚠️ Copy this string and save it. You can now close this tab.</p>
                </div>
            `);

            // Auto-Cleanup temp files
            setTimeout(() => {
                if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
            }, 30000);
        }
    });
});

// 3. START SERVER
app.listen(PORT, () => {
    console.log(`
    =========================================
    🚀 PAIRING SITE LIVE: http://localhost:${PORT}
    =========================================
    `);
});
