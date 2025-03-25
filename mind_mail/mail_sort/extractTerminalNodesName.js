import { getSavedMindMap } from "../mind_map/loadMindMap.js";

export async function getLeafNodes() {
    // Attendre que la promesse se résolve et obtenir la carte mentale
    let tree = await getSavedMindMap();

    // Vérifier si l'arbre est bien défini et une structure valide
    console.log("Arbre récupéré :", tree);

    let leaves = [];

    function traverse(node, path = "") {
        if (!node || typeof node !== "object") return; // Vérifie si le nœud est valide

        let keys = Object.keys(node);
        
        if (keys.length === 0) { 
            leaves.push(path); // Ajoute le chemin si c'est une feuille
        } else {
            for (let key of keys) {
                traverse(node[key], key); 
            }
        }
    }

    // Vérifie que l'arbre est bien un objet
    if (tree && typeof tree === "object") { 
        traverse(tree);
    } else {
        console.warn("Arbre invalide ou vide !");
    }

    // Retourne le tableau des feuilles
    return leaves;
}
