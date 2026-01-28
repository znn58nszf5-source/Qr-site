const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const fs = require('fs');
const pino = require('pino');

router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "No number provided" });

    const id = Math.random().toString(36).substring(7);
    const sessionDir = `./temp_${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);
    
    setTimeout(async () => {
        try {
            let code = await sock.requestPairingCode(num);
            if (!res.headersSent) res.json({ code });
        } catch (e) { res.status(500).json({ error: "Failed to get code" }); }
    }, 3000);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
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
