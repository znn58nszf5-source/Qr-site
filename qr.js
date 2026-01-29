const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require('pino');

router.get('/', async (req, res) => {
    const id = Math.random().toString(36).substring(7);
    const sessionDir = `./temp_${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ceasar-Bot", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        // Send QR to frontend
        if (qr && !res.headersSent) {
            let url = await QRCode.toDataURL(qr);
            res.json({ qr: url });
        }
        
        if (connection === "open") {
            const credsData = fs.readFileSync(`${sessionDir}/creds.json`);
            // Convert credentials to CEASAR session string
            const session = "CEASAR_SESSION_" + Buffer.from(credsData).toString('base64');
            
            await delay(2000);
            await sock.sendMessage(sock.user.id, { 
                text: `🔱 *CEASAR BOT CONNECTED*\n\nYour session ID is ready! Copy it to your bot's config:\n\n${session}` 
            });
            
            await delay(5000);
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
    });
});

module.exports = router;
