
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

const rooms = new Map();

function generateCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms.has(code));
    return code;
}

io.on("connection", (socket) => {

    socket.on("create-room", (callback) => {
        const code = generateCode();

        rooms.set(code, {
            host: socket.id,
            guest: null
        });

        socket.data.roomCode = code;
        socket.join(code);

        callback({ success: true, code });
    });

    socket.on("join-room", (code, callback) => {
        code = String(code).trim();
        const room = rooms.get(code);

        if (!/^\d{6}$/.test(code) || !room) {
            return callback({ success: false, message: "Code incorrect." });
        }

        if (room.guest) {
            return callback({ success: false, message: "Connexion déjà utilisée." });
        }

        room.guest = socket.id;
        socket.data.roomCode = code;
        socket.join(code);

        io.to(room.host).emit("peer-joined");
        callback({ success: true });
    });

    // Transmission des messages
    socket.on("send-message", (text) => {
        const code = socket.data.roomCode;
        const room = rooms.get(code);

        if (!room || typeof text !== "string") return;
        if (room.host !== socket.id && room.guest !== socket.id) return;

        socket.to(code).emit("receive-message", text.slice(0, 300));
    });

    socket.on("disconnect", () => {
        const code = socket.data.roomCode;
        const room = rooms.get(code);

        if (!room) return;

        if (room.host === socket.id) {
            io.to(code).emit("peer-left");
            rooms.delete(code);
        } else if (room.guest === socket.id) {
            room.guest = null;
            io.to(room.host).emit("peer-left");
        }
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`iControl fonctionne sur le port ${PORT}`);
});
