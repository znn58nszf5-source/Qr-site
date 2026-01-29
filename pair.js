const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const fs = require('fs');
const pino = require('pino');

router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Phone number is required." });

    const id = Math.random().toString(36).substring(7);
    const sessionDir = `./temp_${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // Spoofing browser as Ubuntu helps bypass security blocks
        browser: ["Ubuntu", "Chrome", "20.0.04"] 
    });

    sock.ev.on('creds.update', saveCreds);
    
    // Request pairing code after a short delay
    setTimeout(async () => {
        try {
            let code = await sock.requestPairingCode(num);
            if (!res.headersSent) res.json({ code });
        } catch (e) { 
            if (!res.headersSent) res.status(500).json({ error: "Failed to generate pairing code." }); 
        }
    }, 3000);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        
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
