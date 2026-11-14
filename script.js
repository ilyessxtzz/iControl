const socket = io();

const iphoneBtn = document.getElementById("iphoneBtn");
const ipadBtn = document.getElementById("ipadBtn");

const iphoneArea = document.getElementById("iphoneArea");
const ipadArea = document.getElementById("ipadArea");

const generatedCode = document.getElementById("generatedCode");
const codeInput = document.getElementById("code");
const joinBtn = document.getElementById("joinBtn");
const message = document.getElementById("message");

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

ipadBtn.addEventListener("click", () => {
    ipadArea.hidden = false;
    iphoneArea.hidden = true;
    message.textContent = "";
});

joinBtn.addEventListener("click", () => {
    const code = codeInput.value.trim();

    if (!/^\d{6}$/.test(code)) {
        message.textContent = "Entre un code valide à 6 chiffres.";
        return;
    }

    message.textContent = "Connexion en cours...";

    socket.emit("join-room", code, (result) => {
        if (result.success) {
            message.textContent = "iPad connecté à la session !";
        } else {
            message.textContent = result.message;
        }
    });
});

socket.on("peer-joined", () => {
    message.textContent = "Ton iPad est connecté !";
});

socket.on("peer-left", () => {
    message.textContent = "L'autre appareil s'est déconnecté.";
});