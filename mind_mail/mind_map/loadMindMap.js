export async function getSavedMindMap() {
    try {
        let result = await browser.storage.local.get("mindmap");
        if (result.mindmap) {
            return JSON.parse(result.mindmap); // Retourne la carte mentale sous forme d'objet JSON
        } else {
            return null; // Aucune carte mentale sauvegardée
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de la carte mentale :", error);
        return null;
    }
}