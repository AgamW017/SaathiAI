// This bot uses the whatsapp-web.js library to listen for messages.
// It responds to any personal message, and any group message where it is mentioned.
// It forwards the user's query to an external API and replies with the response.

// Import necessary libraries
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log("Initializing WhatsApp Bot with Web Interface...");

// Initialize Express app and Socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/snap/chromium/3459/usr/lib/chromium-browser/chrome',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--memory-pressure-off'
        ],
        timeout: 60000
    }
});

let stats = {
    totalMessages: 0,
    apiCalls: 0,
    startTime: Date.now()
};

// Event fired when a QR code is generated.
client.on('qr', async (qr) => {
    console.log('QR Code Received, please scan with your phone.');
    qrcode.generate(qr, { small: true });
    
    // Generate QR code for web interface
    try {
        const qrCodeDataURL = await QRCode.toDataURL(qr);
        io.emit('qr', qrCodeDataURL);
    } catch (err) {
        console.error('Error generating QR code:', err);
    }
});

// Event fired when the client has successfully authenticated.
client.on('authenticated', () => {
    console.log('Authentication successful!');
    io.emit('authenticated');
});

// Event fired when the client is ready to send and receive messages.
client.on('ready', () => {
    console.log('Client is ready! Listening for messages...');
    io.emit('ready');
});

// Event fired on incoming messages.
client.on('message_create', async (msg) => {
    // Stop the bot from replying to its own messages to prevent a loop.
    if (msg.fromMe) return;
});

// Event fired if the client fails to auth.
client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
    io.emit('log', `Authentication failure: ${msg}`);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Web client connected');
    io.emit('log', 'Web dashboard connected');
    
    // Send current stats to new connection
    socket.emit('stats', stats);
    
    socket.on('disconnect', () => {
        console.log('Web client disconnected');
    });
});


// Start the WhatsApp client with retry logic
async function initializeClient() {
    let retries = 3;
    
    while (retries > 0) {
        try {
            console.log(`Attempting to initialize WhatsApp client... (${4 - retries}/3)`);
            await client.initialize();
            console.log('WhatsApp client initialized successfully');
            break;
        } catch (error) {
            retries--;
            console.error(`Failed to initialize client: ${error.message}`);
            io.emit('log', `Initialization failed: ${error.message}`);
            
            if (retries > 0) {
                console.log(`Retrying in 10 seconds... (${retries} attempts remaining)`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            } else {
                console.error('All initialization attempts failed. Exiting...');
                io.emit('log', 'All initialization attempts failed');
                process.exit(1);
            }
        }
    }
}

// Start initialization
initializeClient();
