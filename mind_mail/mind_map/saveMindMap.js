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
    browser.storage.local.set({ "mindmap": JSON.stringify(mindMapData) })
        .then(() => {
            console.log("Carte mentale sauvegardée.");
        })
        .catch((error) => {
            console.error("Erreur lors de la sauvegarde de la carte mentale : ", error);
        });
}

