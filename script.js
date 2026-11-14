
const socket = io();

const iphoneBtn = document.getElementById("iphoneBtn");
const ipadBtn = document.getElementById("ipadBtn");

const iphoneArea = document.getElementById("iphoneArea");
const ipadArea = document.getElementById("ipadArea");

const generatedCode = document.getElementById("generatedCode");
const codeInput = document.getElementById("code");
const joinBtn = document.getElementById("joinBtn");
const message = document.getElementById("message");

const controlArea = document.getElementById("controlArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const leaveBtn = document.getElementById("leaveBtn");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const messageHistory = document.getElementById("messageHistory");

let connected = false;
let hasMessages = false;

// État de connexion
function updateStatus(isConnected) {
    connected = isConnected;

    statusText.textContent = isConnected
        ? "Connecté"
        : "Déconnecté";

    statusDot.style.color = isConnected
        ? "green"
        : "red";
}

// Afficher un message dans l'historique
function addMessage(text, sender) {
    if (!hasMessages) {
        messageHistory.innerHTML = "";
        hasMessages = true;
    }

    const item = document.createElement("p");
    item.textContent = sender + " : " + text;

    messageHistory.appendChild(item);
}

// Afficher le panneau
function showControls() {
    controlArea.hidden = false;
    updateStatus(true);
}

// Créer une session depuis l'iPhone
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

// Rejoindre depuis l'iPad
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
            message.textContent = "Connexion réussie !";
            showControls();
        } else {
            message.textContent = result.message;
            updateStatus(false);
        }
    });
});

// L'iPad rejoint l'iPhone
socket.on("peer-joined", () => {
    message.textContent = "Ton iPad est connecté !";
    showControls();
});

// L'autre appareil quitte
socket.on("peer-left", () => {
    updateStatus(false);
    message.textContent = "L'autre appareil s'est déconnecté.";
});

// Envoyer un message
sendBtn.addEventListener("click", () => {
    const text = messageInput.value.trim();

    if (!connected) {
        message.textContent = "Aucun appareil connecté.";
        return;
    }

    if (!text) return;

    socket.emit("send-message", text);
    addMessage(text, "Moi");
    messageInput.value = "";
});

// Envoyer avec la touche Entrée
messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendBtn.click();
    }
});

// Recevoir un message
socket.on("receive-message", (text) => {
    addMessage(text, "Autre appareil");
});

// Quitter la session
leaveBtn.addEventListener("click", () => {
    socket.disconnect();

    controlArea.hidden = true;
    iphoneArea.hidden = true;
    ipadArea.hidden = true;

    generatedCode.textContent = "------";
    codeInput.value = "";
    messageInput.value = "";
    message.textContent = "Tu as quitté la session.";

    messageHistory.innerHTML = "<p>Aucun message pour le moment.</p>";
    hasMessages = false;

    updateStatus(false);

    socket.connect();
});

// État du serveur
socket.on("connect", () => {
    console.log("iControl : serveur connecté");
});

socket.on("disconnect", (reason) => {
    console.log("iControl : serveur déconnecté :", reason);
    updateStatus(false);
});

socket.on("connect_error", (error) => {
    console.log("Erreur de connexion :", error.message);
    updateStatus(false);
});
