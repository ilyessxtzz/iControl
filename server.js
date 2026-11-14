
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

// Transmettre un signal uniquement à l'autre appareil
function relayToPeer(socket, event, data) {
    const code = socket.data.roomCode;
    const room = rooms.get(code);

    if (!room) return;

    if (room.host !== socket.id && room.guest !== socket.id) {
        return;
    }

    socket.to(code).emit(event, data);
}

io.on("connection", (socket) => {

    // Créer une session
    socket.on("create-room", (callback) => {
        const code = generateCode();

        rooms.set(code, {
            host: socket.id,
            guest: null
        });

        socket.data.roomCode = code;
        socket.join(code);

        if (typeof callback === "function") {
            callback({ success: true, code });
        }
    });

    // Rejoindre une session
    socket.on("join-room", (code, callback) => {
        code = String(code).trim();

        const room = rooms.get(code);

        if (!/^\d{6}$/.test(code) || !room) {
            if (typeof callback === "function") {
                callback({
                    success: false,
                    message: "Code incorrect."
                });
            }
            return;
        }

        if (room.guest) {
            if (typeof callback === "function") {
                callback({
                    success: false,
                    message: "Connexion déjà utilisée."
                });
            }
            return;
        }

        room.guest = socket.id;
        socket.data.roomCode = code;
        socket.join(code);

        io.to(room.host).emit("peer-joined");

        if (typeof callback === "function") {
            callback({ success: true });
        }
    });

    // Transmission des messages
    socket.on("send-message", (text) => {
        const code = socket.data.roomCode;
        const room = rooms.get(code);

        if (!room || typeof text !== "string") return;

        if (room.host !== socket.id && room.guest !== socket.id) {
            return;
        }

        socket.to(code).emit("receive-message", text.slice(0, 300));
    });

    // Signaux WebRTC
    socket.on("webrtc-offer", (offer) => {
        relayToPeer(socket, "webrtc-offer", offer);
    });

    socket.on("webrtc-answer", (answer) => {
        relayToPeer(socket, "webrtc-answer", answer);
    });

    socket.on("webrtc-ice-candidate", (candidate) => {
        relayToPeer(socket, "webrtc-ice-candidate", candidate);
    });
socket.on("webrtc-stop", (data) => {
    relayToPeer(socket, "webrtc-stop", data);
});
    // Déconnexion
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
