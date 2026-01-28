const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require("@whiskeysockets/baileys");
const express = require("express");
const QRCode = require("qrcode");
const fs = require('fs');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. HOME PAGE - Choice between QR or Phone Pairing
app.get("/", (req, res) => {
    res.send(`
        <div style="text-align:center; font-family:sans-serif; margin-top:50px; background:#f4f4f9; padding:40px; border-radius:20px; max-width:500px; margin-left:auto; margin-right:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            <h1 style="color:#25D366;">🚀 Gemini Multi-Pair</h1>
            <p>Choose your pairing method:</p>
            
            <a href="/qr" style="display:block; background:#25D366; color:white; padding:15px; border-radius:10px; text-decoration:none; font-weight:bold; margin-bottom:10px;">Option 1: Scan QR Code</a>
            
            <div style="margin: 20px 0; color:#888;">— OR —</div>
            
            <form action="/code" method="get">
                <input type="number" name="num" placeholder="233240000000" required style="width:80%; padding:10px; border-radius:5px; border:1px solid #ccc; margin-bottom:10px;"><br>
                <button type="submit" style="background:#075e54; color:white; padding:10px 20px; border:none; border-radius:10px; cursor:pointer; font-weight:bold;">Option 2: Get 8-Digit Code</button>
            </form>
        </div>
    `);
});

// 2. PAIRING LOGIC (Handles both QR and Code)
async function startPairing(method, number, res) {
    const id = 'user_' + Math.floor(Math.random() * 10000);
    const sessionDir = `./temp_${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Chrome (Ubuntu)", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    // If user wants a pairing code
    if (method === 'code' && number) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(number);
                res.send(`
                    <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                        <h2 style="color:#075e54;">Your Pairing Code:</h2>
                        <div style="font-size:3em; letter-spacing:10px; font-weight:bold; color:#25D366; background:white; display:inline-block; padding:20px; border-radius:10px; border:3px solid #eee;">${code}</div>
                        <p style="margin-top:20px;">1. Open WhatsApp > Linked Devices > Link a Device.</p>
                        <p>2. Tap <b>"Link with phone number instead"</b> and enter this code.</p>
                    </div>
                `);
            } catch (e) { res.send("Error generating code. Check the number format."); }
        }, 3000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        // If user wants a QR code
        if (qr && method === 'qr' && !res.headersSent) {
            const qrImage = await QRCode.toDataURL(qr);
            res.send(`<div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2>Scan QR Code</h2>
                <img src="${qrImage}" style="width:300px; border:10px solid #25D366; border-radius:20px;"/>
                <script>setTimeout(() => { location.reload(); }, 30000);</script>
            </div>`);
        }

        if (connection === 'open') {
            await delay(5000);
            const credsData = fs.readFileSync(`${sessionDir}/creds.json`);
            const sessionId = "GEMINI_SESSION_" + Buffer.from(credsData).toString('base64');
            
            // Send ID to the user on WhatsApp
            await sock.sendMessage(sock.user.id, { text: `✅ *CONNECTED!*\n\n*YOUR SESSION ID:*\n\n${sessionId}` });
            
            // Cleanup
            setTimeout(() => { if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true }); }, 10000);
        }
    });
}

app.get("/qr", (req, res) => startPairing('qr', null, res));
app.get("/code", (req, res) => startPairing('code', req.query.num, res));

app.listen(PORT, () => console.log(`🚀 Multifunctional Site live on ${PORT}`));
