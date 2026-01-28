const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const QRCode = require("qrcode");
const fs = require('fs');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

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
        const { connection, qr, lastDisconnect } = update;

        // 1. If QR is generated, send it to the browser
        if (qr) {
            const qrImage = await QRCode.toDataURL(qr);
            res.send(`
                <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                    <h2>Pairing ID: ${id}</h2>
                    <img src="${qrImage}" style="width:300px; border: 5px solid #25D366; border-radius:10px;"/>
                    <p>Scan this QR with your WhatsApp Linked Devices.</p>
                    <p><i>The session ID will appear here after success.</i></p>
                    <script>setTimeout(() => { location.reload(); }, 20000);</script>
                </div>
            `);
        }

        // 2. When Scan is Successful
        if (connection === 'open') {
            const creds = JSON.parse(fs.readFileSync(`${sessionDir}/creds.json`));
            const sessionId = "GEMINI_SESSION_" + Buffer.from(JSON.stringify(creds)).toString('base64');
            
            // Show the ID on the screen for easy copying
            res.send(`
                <div style="text-align:center; font-family:sans-serif; margin-top:50px; padding:20px;">
                    <h2 style="color:#25D366;">✅ Pairing Successful!</h2>
                    <p>Copy the Session ID below:</p>
                    <textarea style="width:100%; height:150px; word-break:break-all; padding:10px; border-radius:10px; border:1px solid #ccc;">${sessionId}</textarea>
                    <br><br>
                    <button onclick="navigator.clipboard.writeText('${sessionId}')" style="padding:10px 20px; background:#25D366; color:white; border:none; border-radius:5px; cursor:pointer;">Copy to Clipboard</button>
                    <p style="color:red;">⚠️ After copying, you can close this page. The temp files will be deleted.</p>
                </div>
            `);

            // Cleanup: Delete the temp folder after 1 minute
            setTimeout(() => {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                process.exit(0); // Optional: Stop the process to save resources
            }, 60000);
        }
    });
});

app.listen(PORT, () => console.log(`🚀 Independent Pairing Site live on port ${PORT}`));
