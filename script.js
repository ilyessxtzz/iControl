
const iphoneBtn = document.getElementById("iphoneBtn");
const ipadBtn = document.getElementById("ipadBtn");

const iphoneArea = document.getElementById("iphoneArea");
const ipadArea = document.getElementById("ipadArea");

const generatedCode = document.getElementById("generatedCode");
const codeInput = document.getElementById("code");
const joinBtn = document.getElementById("joinBtn");
const message = document.getElementById("message");

iphoneBtn.addEventListener("click", function() {
    iphoneArea.hidden = false;
    ipadArea.hidden = true;
    message.textContent = "";

    const code = Math.floor(100000 + Math.random() * 900000);
    generatedCode.textContent = code;
});

ipadBtn.addEventListener("click", function() {
    ipadArea.hidden = false;
    iphoneArea.hidden = true;
    message.textContent = "";
});

joinBtn.addEventListener("click", function() {
    const code = codeInput.value.trim();

    if (!/^\d{6}$/.test(code)) {
        message.textContent = "Entre un code valide à 6 chiffres.";
        return;
    }

    message.textContent = "Code saisi : " + code;
});
