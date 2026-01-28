const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require("@whiskeysockets/baileys");
const express = require("express");
const QRCode = require("qrcode");
const fs = require('fs');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. HOME PAGE - No more typing /pair/bot1
app.get("/", (req, res) => {
    res.send(`
        <div style="text-align:center; font-family:sans-serif; margin-top:50px; background:#f4f4f9; padding:40px; border-radius:20px; max-width:500px; margin-left:auto; margin-right:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            <h1 style="color:#25D366;">🚀 Gemini Multi-Pair</h1>
            <p style="margin-bottom:30px;">Choose how you want to connect:</p>
            
            <a href="/qr" style="display:block; background:#25D366; color:white; padding:15px; border-radius:10px; text-decoration:none; font-weight:bold; margin-bottom:15px;">Option 1: Scan QR Code</a>
            
            <div style="margin: 20px 0; color:#888; font-weight:bold;">— OR —</div>
            
            <form action="/code" method="get" style="background:white; padding:20px; border-radius:10px; border:1px solid #ddd;">
                <p style="font-size:0.9em; color:#666;">Enter number with country code<br>(e.g. 233500000000)</p>
                <input type="number" name="num" placeholder="233..." required style="width:90%; padding:12px; border-radius:5px; border:1px solid #ccc; margin-bottom:10px; font-size:1.1em;"><br>
                <button type="submit" style="width:95%; background:#075e54; color:white; padding:12px; border:none; border-radius:10px; cursor:pointer; font-weight:bold;">Option 2: Get 8-Digit Code</button>
            </form>
        </div>
    `);
});

// 2. CORE LOGIC
async function startPairing(method, number, res) {
    const id = 'session_' + Math.floor(Math.random() * 10000);
    const sessionDir = `./temp_${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // "Chrome (Ubuntu)" helps avoid the "Couldn't Log In" error
        browser: ["Chrome (Ubuntu)", "Chrome", "20.0.04"] 
    });

    sock.ev.on('creds.update', saveCreds);

    // If using Pairing Code
    if (method === 'code' && number) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(number);
                res.send(`
                    <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                        <h2 style="color:#075e54;">Your Pairing Code:</h2>
                        <div style="font-size:3.5em; letter-spacing:8px; font-weight:bold; color:#25D366; background:#f0f0f0; display:inline-block; padding:20px; border-radius:15px; border:4px solid #25D366;">${code}</div>
                        <p style="margin-top:25px; font-size:1.1em;">1. Open WhatsApp > Linked Devices > Link a Device.</p>
                        <p style="font-weight:bold;">2. Tap "Link with phone number instead" and enter this code.</p>
                    </div>
                `);
            } catch (e) { res.send("<h1>Error!</h1><p>Check your number format and try again.</p>"); }
        }, 3000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        // If using QR
        if (qr && method === 'qr' && !res.headersSent) {
            const qrImage = await QRCode.toDataURL(qr);
            res.send(`
                <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                    <h2>Scan to Connect</h2>
                    <img src="${qrImage}" style="width:300px; border:10px solid #25D366; border-radius:20px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"/>
                    <p style="margin-top:20px;">If it fails, use the <b>Phone Number</b> method on the home page.</p>
                    <script>setTimeout(() => { location.reload(); }, 30000);</script>
                </div>
            `);
        }

        if (connection === 'open') {
            await delay(5000);
            const credsData = fs.readFileSync(`${sessionDir}/creds.json`);
            const sessionId = "GEMINI_SESSION_" + Buffer.from(credsData).toString('base64');
            
            // Send the ID to you on WhatsApp instantly
            await sock.sendMessage(sock.user.id, { text: `✅ *CONNECTED!*\n\n*YOUR SESSION ID:*\n\n${sessionId}` });
            
            // Cleanup temp files
            setTimeout(() => { if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true }); }, 10000);
        }
    });
}

app.get("/qr", (req, res) => startPairing('qr', null, res));
app.get("/code", (req, res) => startPairing('code', req.query.num, res));

app.listen(PORT, () => console.log(`🚀 Multi-Pair site live on ${PORT}`));
