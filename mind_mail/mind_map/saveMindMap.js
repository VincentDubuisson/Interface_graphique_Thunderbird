// Sauvegarde la carte mentale dans le stockage local de Thunderbird
export function saveMindMap(mindMapData) {

    // Export des noms des noeuds et tags selon la hiérarchie
    const nodeNames = extractNodeAndTagNames(mindMapData);

    // Sauvegarde dans stockage local
    browser.storage.local.set({ "mindmap": JSON.stringify(mindMapData) })
        .then(() => {
            console.log("Carte mentale sauvegardée.");
        })
        .catch((error) => {
            console.error("Erreur lors de la sauvegarde de la carte mentale : ", error);
        });
}

// Extrait les noeuds de la carte mentale selon la hiérarchie
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

// Extrait les noeuds et tags de la carte mentale selon la hiérarchie
export function extractNodeAndTagNames(mindMapData) {
    if (!mindMapData || !mindMapData.nodeData) {
        console.error("Données invalides reçues :", mindMapData);
        return {};
    }

    // Méthode récursive pour l'extraction
    function traverse(node) {
        if (!node || !node.topic) {
            return {};
        }

        let result = {
            tags: node.tags || [], // Ajoute les tags, ou un tableau vide si aucun tag
            children: {} // Stocke les enfants
        };

        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => {
                result.children[child.topic] = traverse(child);
            });
        }

        return result;
    }

    return traverse(mindMapData.nodeData); // Démarrer à partir de la racine
}



