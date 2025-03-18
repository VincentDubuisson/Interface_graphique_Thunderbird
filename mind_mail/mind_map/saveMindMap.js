import { setNodeNames } from "../globals/globals.js";

/* Code pour sauvegarder si appui bouton sauvagarde manuel
document.addEventListener("DOMContentLoaded", () => {
    const saveButton = document.getElementById("saveBtn");

    saveButton.addEventListener("click", async () => {
        if (!window.mind) {
            console.error("MindElixir n'est pas encore chargé.");
            return;
        }

        const mindMapData = window.mind.getData(); // Récupérer l'objet JSON
        const mindMapString = JSON.stringify(mindMapData); // Convertir en string JSON

        await browser.storage.local.set({ "mindmap": mindMapString });
        console.log("Carte mentale sauvegardée.");
    });
});

*/

// Sauvegarde la carte mentale dans le stockage local de Thunderbird
export function saveMindMap(mindMapData) {

    // Export des noms des noeuds et hiérarchie
    const nodeNames = extractNodeNames(mindMapData);
    setNodeNames(nodeNames);

    // Sauvegarde dans stockage local
    browser.storage.local.set({ "mindmap": JSON.stringify(mindMapData) })
        .then(() => {
            console.log("Carte mentale sauvegardée.");
        })
        .catch((error) => {
            console.error("Erreur lors de la sauvegarde de la carte mentale : ", error);
        });
}

export function extractNodeNames(mindMapData) {
    if (!mindMapData || !mindMapData.nodeData) {
        console.error("Données invalides reçues :", mindMapData);
        return {};
    }

    function traverse(node) {
        if (!node || !node.topic) {
            return {};  // Si le nœud est invalide, retourne un objet vide
        }

        let result = {}; // Objet pour stocker les enfants

        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => {
                result[child.topic] = traverse(child); // Ajout récursif des enfants
            });
        }

        return result;
    }

    return traverse(mindMapData.nodeData); // Démarrer à partir de la racine
}


