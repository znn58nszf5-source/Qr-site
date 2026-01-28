const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require('pino');

router.get('/', async (req, res) => {
    const id = Math.random().toString(36).substring(7);
    const sessionDir = `./temp_${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Malvin-XD", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        if (qr && !res.headersSent) {
            let url = await QRCode.toDataURL(qr);
            res.json({ qr: url });
        }
        if (connection === "open") {
            const creds = JSON.parse(fs.readFileSync(`${sessionDir}/creds.json`));
            const session = "MALVIN-XD_SESSION_" + Buffer.from(JSON.stringify(creds)).toString('base64');
            await sock.sendMessage(sock.user.id, { text: session });
            await delay(5000);
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
    });
});

module.exports = router;
