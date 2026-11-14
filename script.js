
const socket = io();

const iphoneBtn = document.getElementById("iphoneBtn");
const ipadBtn = document.getElementById("ipadBtn");

const iphoneArea = document.getElementById("iphoneArea");
const ipadArea = document.getElementById("ipadArea");

const generatedCode = document.getElementById("generatedCode");
const codeInput = document.getElementById("code");
const joinBtn = document.getElementById("joinBtn");
const message = document.getElementById("message");

// Éléments de communication
const controlArea = document.getElementById("controlArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const receivedMessage = document.getElementById("receivedMessage");

let connected = false;

// Création d'une session depuis l'iPhone
iphoneBtn.addEventListener("click", () => {
    iphoneArea.hidden = false;
    ipadArea.hidden = true;
    message.textContent = "Création de la connexion...";

    socket.emit("create-room", (result) => {
        if (result.success) {
            generatedCode.textContent = result.code;
            message.textContent = "En attente de l'iPad...";
        } else {
            message.textContent = "Impossible de créer la connexion.";
        }
    });
});

// Rejoindre une session depuis l'iPad
ipadBtn.addEventListener("click", () => {
    ipadArea.hidden = false;
    iphoneArea.hidden = true;
    message.textContent = "";
});

// Entrer le code
joinBtn.addEventListener("click", () => {
    const code = codeInput.value.trim();

    if (!/^\d{6}$/.test(code)) {
        message.textContent = "Entre un code valide à 6 chiffres.";
        return;
    }

    message.textContent = "Connexion en cours...";

    socket.emit("join-room", code, (result) => {
        if (result.success) {
            connected = true;
            message.textContent = "iPad connecté à la session !";
            showControls();
        } else {
            message.textContent = result.message;
        }
    });
});

// Quand l'iPad rejoint l'iPhone
socket.on("peer-joined", () => {
    connected = true;
    message.textContent = "Ton iPad est connecté !";
    showControls();
});

// Quand un appareil se déconnecte
socket.on("peer-left", () => {
    connected = false;
    message.textContent = "L'autre appareil s'est déconnecté.";

    if (controlArea) {
        controlArea.hidden = true;
    }
});

// Afficher les commandes
function showControls() {
    if (controlArea) {
        controlArea.hidden = false;
    }
}

// Envoyer un message à l'autre appareil
if (sendBtn) {
    sendBtn.addEventListener("click", () => {
        const text = messageInput.value.trim();

        if (!connected) {
            receivedMessage.textContent = "Aucun appareil connecté.";
            return;
        }

        if (!text) {
            return;
        }

        socket.emit("send-message", text);
        messageInput.value = "";
    });
}

// Recevoir un message de l'autre appareil
socket.on("receive-message", (text) => {
    if (receivedMessage) {
        receivedMessage.textContent = text;
    }
});
