
const express = require("express");

const app = express();
const PORT = 3000;

// Afficher les fichiers du site
app.use(express.static(__dirname));

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`iControl fonctionne sur http://localhost:${PORT}`);
});
