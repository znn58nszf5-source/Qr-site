const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 8000;

// Link to your logic files
const qrRouter = require('./qr'); 
const pairRouter = require('./pair');

app.use(express.json());

// API Routes
app.use('/server', qrRouter); 
app.use('/code', pairRouter);

// Page Routes
app.get('/qr', (req, res) => res.sendFile(path.join(__dirname, 'qr.html')));
app.get('/pair', (req, res) => res.sendFile(path.join(__dirname, 'pair.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'main.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
