const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");

router.get('/', async (req, res) => {
    let num = req.query.number;
    const { state, saveCreds } = await useMultiFileAuthState('./temp');
    const sock = makeWASocket({ auth: state, browser: ["Ubuntu", "Chrome", "20.0.04"] });

    try {
        let code = await sock.requestPairingCode(num);
        res.json({ code: code }); // This sends the code back to your pair.html
    } catch (err) {
        res.status(500).json({ error: "Service Busy" });
    }
});
module.exports = router;
