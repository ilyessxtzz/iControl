
const socket = io();

// Éléments de connexion
const iphoneBtn = document.getElementById("iphoneBtn");
const ipadBtn = document.getElementById("ipadBtn");

const iphoneArea = document.getElementById("iphoneArea");
const ipadArea = document.getElementById("ipadArea");

const generatedCode = document.getElementById("generatedCode");
const codeInput = document.getElementById("code");
const codeSlots = document.querySelectorAll(".code-slot");
const joinBtn = document.getElementById("joinBtn");
const message = document.getElementById("message");

const controlArea = document.getElementById("controlArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const leaveBtn = document.getElementById("leaveBtn");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const messageHistory = document.getElementById("messageHistory");

// Affichage du code à six chiffres
function updateCodeDisplay() {
    codeInput.value = codeInput.value
        .replace(/\D/g, "")
        .slice(0, 6);

    codeSlots.forEach((slot, index) => {
        slot.textContent = codeInput.value[index] || "";
        slot.classList.toggle(
            "active",
            index === codeInput.value.length &&
            codeInput.value.length < 6
        );
    });
}

codeInput.addEventListener("input", updateCodeDisplay);
codeInput.addEventListener("focus", updateCodeDisplay);
codeInput.addEventListener("blur", updateCodeDisplay);

// Éléments du partage d'écran
const screenShareArea = document.getElementById("screenShareArea");
const senderArea = document.getElementById("senderArea");
const receiverArea = document.getElementById("receiverArea");

const startScreenShare = document.getElementById("startScreenShare");
const stopScreenShare = document.getElementById("stopScreenShare");

const screenShareStatus = document.getElementById("screenShareStatus");
const remoteScreenStatus = document.getElementById("remoteScreenStatus");

const screenPreview = document.getElementById("screenPreview");
const remoteScreen = document.getElementById("remoteScreen");

const touchSurface = document.getElementById("touchSurface");
const senderPointer = document.getElementById("senderPointer");
const touchStatus = document.getElementById("touchStatus");

// Variables générales
let connected = false;
let hasMessages = false;
let isHost = false;
let isLeaving = false;

let peerConnection = null;
let screenStream = null;
let activeSessionId = null;

const pendingCandidates = new Map();

const rtcConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ],
    bundlePolicy: "max-bundle"
};

// Identifiant de session
function createSessionId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

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

// Messages
function addMessage(text, sender) {
    if (!hasMessages) {
        messageHistory.innerHTML = "";
        hasMessages = true;
    }

    const item = document.createElement("p");
    item.textContent = sender + " : " + text;

    messageHistory.appendChild(item);
}

function showControls() {
    controlArea.hidden = false;
    updateStatus(true);
}

function showScreenShareInterface() {
    screenShareArea.hidden = false;
    senderArea.hidden = !isHost;
    receiverArea.hidden = isHost;
}

// Orientation de la vidéo distante
function updateRemoteScreenRatio() {
    const width = remoteScreen.videoWidth;
    const height = remoteScreen.videoHeight;

    if (!width || !height) return;

    if (width > height) {
        remoteScreen.style.transform = "rotate(-90deg)";
    } else {
        remoteScreen.style.transform = "none";
    }
}

remoteScreen.addEventListener("loadedmetadata", updateRemoteScreenRatio);
remoteScreen.addEventListener("resize", updateRemoteScreenRatio);

// Connexion WebRTC
function createPeerConnection(sessionId) {
    if (peerConnection) return peerConnection;

    activeSessionId = sessionId;

    const pc = new RTCPeerConnection(rtcConfiguration);
    peerConnection = pc;

    pc.onicecandidate = (event) => {
        if (event.candidate && activeSessionId === sessionId) {
            socket.emit("webrtc-ice-candidate", {
                sessionId,
                candidate: event.candidate.toJSON()
            });
        }
    };

    pc.onconnectionstatechange = () => {
        if (peerConnection !== pc) return;

        const state = pc.connectionState;

        console.log("WebRTC :", state);

        if (state === "connected") {
            if (isHost) {
                screenShareStatus.textContent =
                    "Écran transmis à l'iPad.";
            } else {
                remoteScreenStatus.textContent =
                    "Réception de l'écran en direct.";
            }
        }

        if (state === "failed" || state === "disconnected") {
            if (isHost) {
                screenShareStatus.textContent =
                    "Connexion vidéo interrompue.";
            } else {
                remoteScreenStatus.textContent =
                    "Connexion vidéo interrompue.";
            }
        }
    };

    pc.ontrack = (event) => {
        if (
            !isHost &&
            peerConnection === pc &&
            activeSessionId === sessionId &&
            event.streams[0]
        ) {
            remoteScreen.srcObject = event.streams[0];
            remoteScreen.muted = true;

            remoteScreenStatus.textContent =
                "Écran de l'iPhone reçu.";

            remoteScreen.play().then(() => {
                updateRemoteScreenRatio();
            }).catch(() => {
                remoteScreenStatus.textContent =
                    "Appuie sur la vidéo pour lancer l'affichage.";
            });
        }
    };

    return pc;
}

// Candidats ICE en attente
async function addPendingCandidates(sessionId) {
    const pc = peerConnection;

    if (
        !pc ||
        activeSessionId !== sessionId ||
        !pc.remoteDescription
    ) {
        return;
    }

    const candidates = pendingCandidates.get(sessionId) || [];
    pendingCandidates.delete(sessionId);

    for (const candidate of candidates) {
        if (
            peerConnection !== pc ||
            activeSessionId !== sessionId
        ) {
            return;
        }

        try {
            await pc.addIceCandidate(candidate);
        } catch (error) {
            console.error("Erreur ICE :", error);
        }
    }
}

socket.on("webrtc-ice-candidate", async (data) => {
    if (!data || !data.sessionId || !data.candidate) return;

    const { sessionId, candidate } = data;

    if (
        !peerConnection ||
        activeSessionId !== sessionId ||
        !peerConnection.remoteDescription
    ) {
        if (!pendingCandidates.has(sessionId)) {
            pendingCandidates.set(sessionId, []);
        }

        pendingCandidates.get(sessionId).push(candidate);
        return;
    }

    try {
        await peerConnection.addIceCandidate(candidate);
    } catch (error) {
        console.error("Erreur ICE :", error);
    }
});

// Nettoyage du partage
function cleanupScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        screenStream = null;
    }

    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;

        peerConnection.close();
        peerConnection = null;
    }

    activeSessionId = null;
    pendingCandidates.clear();

    screenPreview.srcObject = null;
    remoteScreen.srcObject = null;
    remoteScreen.style.transform = "none";

    senderPointer.hidden = true;

    startScreenShare.disabled = false;
    stopScreenShare.disabled = true;
}

function stopScreenSharing(notifyPeer = true) {
    const sessionId = activeSessionId;

    if (notifyPeer && sessionId && socket.connected) {
        socket.emit("webrtc-stop", { sessionId });
    }

    cleanupScreenSharing();

    screenShareStatus.textContent = "Aucun partage en cours.";
    remoteScreenStatus.textContent = "En attente du partage...";
    touchStatus.textContent = "En attente d'un toucher...";
}

// Démarrer le partage depuis l'iPhone
startScreenShare.addEventListener("click", async () => {
    if (!isHost || !connected) {
        screenShareStatus.textContent = "Aucun iPad connecté.";
        return;
    }

    if (peerConnection) {
        screenShareStatus.textContent = "Un partage est déjà en cours.";
        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia
    ) {
        screenShareStatus.textContent =
            "Ce navigateur ne propose pas la capture d'écran.";
        return;
    }

    try {
        screenShareStatus.textContent =
            "Demande d'autorisation de partage...";

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: {
                    ideal: 60,
                    max: 60
                }
            },
            audio: false
        });

        screenStream = stream;

        const track = stream.getVideoTracks()[0];

        track.applyConstraints({
            frameRate: {
                ideal: 60,
                max: 60
            }
        }).catch((error) => {
            console.log("Optimisation FPS non appliquée :", error);
        });

        console.log("Dimensions capturées :", track.getSettings());

        screenPreview.srcObject = stream;
        screenPreview.play().catch(() => {});

        const sessionId = createSessionId();
        const pc = createPeerConnection(sessionId);

        stream.getVideoTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
            sessionId,
            description: pc.localDescription
        });

        startScreenShare.disabled = true;
        stopScreenShare.disabled = false;

        screenShareStatus.textContent = "Connexion vidéo en cours...";

        track.addEventListener("ended", () => {
            if (activeSessionId === sessionId) {
                stopScreenSharing(true);
            }
        }, { once: true });

    } catch (error) {
        console.error("Erreur de partage :", error);

        screenShareStatus.textContent =
            "Partage impossible : " + error.message;

        stopScreenSharing(true);
    }
});

// Réception de l'offre sur l'iPad
socket.on("webrtc-offer", async (data) => {
    if (isHost || !data || !data.sessionId || !data.description) {
        return;
    }

    const { sessionId, description } = data;

    if (peerConnection) return;

    try {
        const pc = createPeerConnection(sessionId);

        await pc.setRemoteDescription(
            new RTCSessionDescription(description)
        );

        await addPendingCandidates(sessionId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
            sessionId,
            description: pc.localDescription
        });

        remoteScreenStatus.textContent =
            "Connexion à l'écran de l'iPhone...";

    } catch (error) {
        console.error("Erreur de réception :", error);

        remoteScreenStatus.textContent =
            "Impossible de recevoir le partage.";

        cleanupScreenSharing();
    }
});

// Réponse reçue sur l'iPhone
socket.on("webrtc-answer", async (data) => {
    if (
        !isHost ||
        !data ||
        !data.sessionId ||
        !data.description ||
        !peerConnection ||
        activeSessionId !== data.sessionId
    ) {
        return;
    }

    try {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.description)
        );

        await addPendingCandidates(data.sessionId);
    } catch (error) {
        console.error("Erreur de réponse WebRTC :", error);
    }
});

// Arrêt du partage par l'autre appareil
socket.on("webrtc-stop", (data) => {
    if (!data || data.sessionId !== activeSessionId) return;

    cleanupScreenSharing();

    screenShareStatus.textContent = "Aucun partage en cours.";
    remoteScreenStatus.textContent =
        "Le partage a été arrêté par l'iPhone.";
});

// Bouton d'arrêt
stopScreenShare.addEventListener("click", () => {
    stopScreenSharing(true);
});

// EXPÉRIMENTATION : toucher sur l'iPad
let lastTouchSent = 0;

touchSurface.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    touchSurface.setPointerCapture(event.pointerId);
    sendTouchCoordinates(event, "move");
});

touchSurface.addEventListener("pointermove", (event) => {
    if (event.buttons === 0 && event.pointerType !== "touch") return;

    event.preventDefault();
    sendTouchCoordinates(event, "move");
});

touchSurface.addEventListener("pointerup", (event) => {
    event.preventDefault();
    sendTouchCoordinates(event, "end");
});

touchSurface.addEventListener("pointercancel", () => {
    touchStatus.textContent = "Toucher interrompu.";
});

function sendTouchCoordinates(event, action) {
    if (!connected || isHost || !peerConnection) {
        touchStatus.textContent = "Partage vidéo non connecté.";
        return;
    }

    const rect = touchSurface.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    const now = performance.now();

    if (action !== "end" && now - lastTouchSent < 30) return;

    lastTouchSent = now;

    socket.emit("remote-touch", { x, y, action });

    touchStatus.textContent =
        `Position transmise : ${Math.round(x * 100)} % / ${Math.round(y * 100)} %`;
}

// Réception des coordonnées sur l'iPhone
socket.on("remote-touch", (data) => {
    if (!isHost || !data) return;

    const x = Math.max(0, Math.min(1, data.x));
    const y = Math.max(0, Math.min(1, data.y));

    senderPointer.style.left = `${x * 100}%`;
    senderPointer.style.top = `${y * 100}%`;
    senderPointer.hidden = false;

    if (data.action === "end") {
        setTimeout(() => {
            senderPointer.hidden = true;
        }, 350);
    }

    console.log("Coordonnées reçues de l'iPad :", x, y);
});

// Créer une session depuis l'iPhone
iphoneBtn.addEventListener("click", () => {
    if (!socket.connected) {
        message.textContent = "Connexion au serveur en cours...";
        return;
    }

    isHost = true;

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
    isHost = false;

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

    if (!socket.connected) {
        message.textContent = "Connexion au serveur en cours...";
        return;
    }

    message.textContent = "Connexion en cours...";

    socket.emit("join-room", code, (result) => {
        if (result.success) {
            message.textContent = "Connexion réussie !";

            showControls();
            showScreenShareInterface();

            remoteScreenStatus.textContent = "En attente du partage...";
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
    showScreenShareInterface();
});

// L'autre appareil quitte
socket.on("peer-left", () => {
    updateStatus(false);
    stopScreenSharing(false);

    message.textContent = "L'autre appareil s'est déconnecté.";
    remoteScreenStatus.textContent = "En attente de reconnexion...";
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

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendBtn.click();
    }
});

socket.on("receive-message", (text) => {
    addMessage(text, "Autre appareil");
});

// Quitter la session
leaveBtn.addEventListener("click", () => {
    isLeaving = true;

    stopScreenSharing(true);
    socket.disconnect();

    controlArea.hidden = true;
    iphoneArea.hidden = true;
    ipadArea.hidden = true;
    screenShareArea.hidden = true;

    generatedCode.textContent = "------";
    codeInput.value = "";
    updateCodeDisplay();

    messageInput.value = "";
    message.textContent = "Tu as quitté la session.";

    messageHistory.innerHTML = "<p>Aucun message pour le moment.</p>";
    hasMessages = false;
    isHost = false;

    updateStatus(false);

    screenShareStatus.textContent = "Aucun partage en cours.";
    remoteScreenStatus.textContent = "En attente du partage...";
    touchStatus.textContent = "En attente d'un toucher.";

    socket.connect();
});

// État du serveur
socket.on("connect", () => {
    console.log("iControl : serveur connecté");

    if (isLeaving) {
        isLeaving = false;
    }
});

socket.on("disconnect", (reason) => {
    console.log("iControl : serveur déconnecté :", reason);

    updateStatus(false);

    if (!isLeaving) {
        stopScreenSharing(false);
    }
});

socket.on("connect_error", (error) => {
    console.log("Erreur de connexion :", error.message);
    updateStatus(false);
});
