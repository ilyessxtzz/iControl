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

// Afficher les chiffres dans les six emplacements
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

// Adapter l'orientation de la vidéo selon celle de l'iPhone
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

// Variables générales
let connected = false;
let hasMessages = false;
let isHost = false;
let isLeaving = false;

// Variables WebRTC
let peerConnection = null;
let screenStream = null;
let activeSessionId = null;

// Les candidats sont conservés séparément pour chaque session.
const pendingCandidates = new Map();

// Configuration WebRTC
const rtcConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ],
    bundlePolicy: "max-bundle"
};

// Créer un identifiant de session
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

// Afficher un message
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

// Afficher la bonne interface de partage
function showScreenShareInterface() {
    screenShareArea.hidden = false;
    senderArea.hidden = !isHost;
    receiverArea.hidden = isHost;
}

// Créer la connexion WebRTC
function createPeerConnection(sessionId) {
    if (peerConnection) {
        return peerConnection;
    }

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

// Ajouter les candidats en attente d'une session
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

// Réception d'un candidat ICE
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

// Nettoyer le partage d'écran
function cleanupScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach((track) => {
            track.stop();
        });

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

    startScreenShare.disabled = false;
    stopScreenShare.disabled = true;
}

// Arrêter le partage et prévenir l'autre appareil
function stopScreenSharing(notifyPeer = true) {
    const sessionId = activeSessionId;

    if (notifyPeer && sessionId && socket.connected) {
        socket.emit("webrtc-stop", { sessionId });
    }

    cleanupScreenSharing();

    screenShareStatus.textContent =
        "Aucun partage en cours.";

    remoteScreenStatus.textContent =
        "En attente du partage...";
}

// L'iPhone démarre le partage
startScreenShare.addEventListener("click", async () => {
    if (!isHost || !connected) {
        screenShareStatus.textContent =
            "Aucun iPad connecté.";
        return;
    }

    if (peerConnection) {
        screenShareStatus.textContent =
            "Un partage est déjà en cours.";
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

        const stream =
            await navigator.mediaDevices.getDisplayMedia({
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
            console.log(
                "Optimisation FPS non appliquée :",
                error
            );
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

        screenShareStatus.textContent =
            "Connexion vidéo en cours...";

        stream.getVideoTracks()[0].addEventListener(
            "ended",
            () => {
                if (activeSessionId === sessionId) {
                    stopScreenSharing(true);
                }
            },
            { once: true }
        );

    } catch (error) {
        console.error("Erreur de partage :", error);

        screenShareStatus.textContent =
            "Partage impossible : " + error.message;

        stopScreenSharing(true);
    }
});

// L'iPad reçoit l'offre de l'iPhone
socket.on("webrtc-offer", async (data) => {
    if (isHost || !data || !data.sessionId || !data.description) {
        return;
    }

    const { sessionId, description } = data;

    if (peerConnection) {
        return;
    }

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

// L'iPhone reçoit la réponse de l'iPad
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

// L'autre appareil arrête le partage
socket.on("webrtc-stop", (data) => {
    if (
        !data ||
        data.sessionId !== activeSessionId
    ) {
        return;
    }

    cleanupScreenSharing();

    screenShareStatus.textContent =
        "Aucun partage en cours.";

    remoteScreenStatus.textContent =
        "Le partage a été arrêté par l'iPhone.";
});

// Arrêter le partage avec le bouton
stopScreenShare.addEventListener("click", () => {
    stopScreenSharing(true);
});

// Créer une session depuis l'iPhone
iphoneBtn.addEventListener("click", () => {
    if (!socket.connected) {
        message.textContent =
            "Connexion au serveur en cours...";
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
            message.textContent =
                "Impossible de créer la connexion.";
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
        message.textContent =
            "Entre un code valide à 6 chiffres.";
        return;
    }

    if (!socket.connected) {
        message.textContent =
            "Connexion au serveur en cours...";
        return;
    }

    message.textContent = "Connexion en cours...";

    socket.emit("join-room", code, (result) => {
        if (result.success) {
            message.textContent = "Connexion réussie !";

            showControls();
            showScreenShareInterface();

            remoteScreenStatus.textContent =
                "En attente du partage...";
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

    message.textContent =
        "L'autre appareil s'est déconnecté.";

    remoteScreenStatus.textContent =
        "En attente de reconnexion...";
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

// Envoyer avec Entrée
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

    messageHistory.innerHTML =
        "<p>Aucun message pour le moment.</p>";

    hasMessages = false;
    isHost = false;

    updateStatus(false);

    screenShareStatus.textContent =
        "Aucun partage en cours.";

    remoteScreenStatus.textContent =
        "En attente du partage...";

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


// CALCULATRICE D'ACCUEIL

const calculatorArea = document.getElementById("calculatorArea");
const calculatorDisplay = document.getElementById("calculatorDisplay");
const calculatorMessage = document.getElementById("calculatorMessage");
const openIControlBtn = document.getElementById("openIControlBtn");
const appContent = document.getElementById("appContent");
const backToCalculatorBtn = document.getElementById("backToCalculatorBtn");

// Le bouton est caché au départ.
function hideIControlButton() {
    openIControlBtn.hidden = true;
    openIControlBtn.style.display = "none";
}

// Afficher le bouton après le calcul demandé.
function showIControlButton() {
    openIControlBtn.hidden = false;
    openIControlBtn.style.display = "";
}

// Masquer le bouton dès le chargement.
hideIControlButton();

function calculateExpression(expression) {
    const normalized = expression
        .replace(/×/g, "*")
        .replace(/[÷:]/g, "/")
        .replace(/−/g, "-")
        .replace(/,/g, ".")
        .replace(/\s+/g, "");

    if (!normalized || !/^[0-9.+\-*/()]+$/.test(normalized)) {
        throw new Error("Expression invalide.");
    }

    let index = 0;

    function parseExpression() {
        let value = parseTerm();

        while (
            normalized[index] === "+" ||
            normalized[index] === "-"
        ) {
            const operator = normalized[index++];
            const right = parseTerm();

            value = operator === "+"
                ? value + right
                : value - right;
        }

        return value;
    }

    function parseTerm() {
        let value = parseFactor();

        while (
            normalized[index] === "*" ||
            normalized[index] === "/"
        ) {
            const operator = normalized[index++];
            const right = parseFactor();

            if (operator === "/" && right === 0) {
                throw new Error("Division par zéro impossible.");
            }

            value = operator === "*"
                ? value * right
                : value / right;
        }

        return value;
    }

    function parseFactor() {
        if (normalized[index] === "+") {
            index++;
            return parseFactor();
        }

        if (normalized[index] === "-") {
            index++;
            return -parseFactor();
        }

        if (normalized[index] === "(") {
            index++;

            const value = parseExpression();

            if (normalized[index] !== ")") {
                throw new Error("Parenthèses incorrectes.");
            }

            index++;
            return value;
        }

        const match = normalized
            .slice(index)
            .match(/^(?:\d+(?:\.\d*)?|\.\d+)/);

        if (!match) {
            throw new Error("Expression invalide.");
        }

        index += match[0].length;
        return Number(match[0]);
    }

    const result = parseExpression();

    if (index !== normalized.length || !Number.isFinite(result)) {
        throw new Error("Expression invalide.");
    }

    return result;
}

function runCalculation() {
    // Garder l'expression saisie avant d'afficher le résultat.
    const originalExpression = calculatorDisplay.value
        .replace(/\s+/g, "");

    // Cacher le bouton avant chaque nouveau calcul.
    hideIControlButton();

    try {
        const result = calculateExpression(
            calculatorDisplay.value.trim()
        );

        const displayedResult = String(
            Number(result.toFixed(10))
        );

        calculatorDisplay.value = displayedResult;

        calculatorMessage.textContent =
            "Résultat : " + displayedResult;

        // Le bouton apparaît uniquement après le calcul exact 24:2.
        if (
            originalExpression === "24:2" &&
            displayedResult === "12"
        ) {
            showIControlButton();
        }

    } catch (error) {
        calculatorMessage.textContent = error.message;
        hideIControlButton();
    }
}

// Touches de la calculatrice
document.querySelectorAll("[data-value]").forEach((button) => {
    button.addEventListener("click", () => {
        hideIControlButton();

        calculatorDisplay.value += button.dataset.value;
        calculatorMessage.textContent = "";
        calculatorDisplay.focus();
    });
});

// Actions de la calculatrice
document.querySelectorAll("[data-calc]").forEach((button) => {
    button.addEventListener("click", () => {
        const action = button.dataset.calc;

        if (action === "clear") {
            calculatorDisplay.value = "";
            calculatorMessage.textContent = "";
            hideIControlButton();

        } else if (action === "backspace") {
            calculatorDisplay.value =
                calculatorDisplay.value.slice(0, -1);

            hideIControlButton();

        } else if (action === "equals") {
            runCalculation();
        }
    });
});

// Si l'utilisateur modifie directement le texte, cacher le bouton.
calculatorDisplay.addEventListener("input", () => {
    hideIControlButton();
    calculatorMessage.textContent = "";
});

// Calcul avec la touche Entrée
calculatorDisplay.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        runCalculation();
    }
});

// Ouvrir iControl sans changer l'adresse ni recharger la page.
openIControlBtn.addEventListener("click", () => {
    calculatorArea.hidden = true;
    appContent.hidden = false;
    document.title = "iControl";
});

// Retour à la calculatrice
backToCalculatorBtn.addEventListener("click", () => {
    appContent.hidden = true;
    calculatorArea.hidden = false;
    document.title = "Calculatrice";

    calculatorDisplay.value = "";
    calculatorMessage.textContent = "";

    hideIControlButton();
});