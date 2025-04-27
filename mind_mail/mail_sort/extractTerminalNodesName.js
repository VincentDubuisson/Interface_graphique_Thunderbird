import { getSavedMindMap } from "../mind_map/loadMindMap.js";
import { extractNodeNames } from '../mind_map/saveMindMap.js';

export async function getLeafNodes() {
    // Attendre que la promesse se résolve et obtenir la carte mentale
    let mindMapData = await getSavedMindMap();
    let tree = extractNodeNames(mindMapData);

    // Vérifier si l'arbre est bien défini et une structure valide
    console.log("Arbre des noms de noeuds récupéré :", tree);

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

export async function getTags(name_leaf) {
    const mindMapData = await getSavedMindMap();

    if (!mindMapData || !mindMapData.nodeData) {
        console.error("Données invalides reçues :", mindMapData);
        return [];
    }

    function searchPathAndTags(node, target, path = []) {
        if (!node || !node.topic) return null;

        const newPath = [...path, node];

        // Si on trouve le bon nœud, on retourne ses tags
        if (node.topic === target) {
            return newPath;
        }

        // Recherche récursive dans les enfants
        if (node.children && Array.isArray(node.children)) {
            for (let child of node.children) {
                const result = searchPathAndTags(child, target, newPath);
                if (result !== null) return result; // On arrête dès qu'on trouve
            }
        }

        return null; // Si aucun nœud ne correspond
    }

    const pathToNode = searchPathAndTags(mindMapData.nodeData, name_leaf);
    if (!pathToNode) {
        console.warn(`Aucun chemin trouvé pour le nœud "${name_leaf}"`);
        return [];
    }

    // Fusionne tous les tags du chemin (sans doublons)
    const mergedTags = [...new Set(
        pathToNode.flatMap(n => n.tags || [])
    )];

    console.log(`Tags hérités pour le nœud "${name_leaf}" :`, mergedTags);

    return mergedTags;
}


export async function getAllTags() {
    const mindMapData = await getSavedMindMap();
    const allTags = [];

    // Fonction récursive pour parcourir tous les nœuds
    function traverseNode(node) {
        // Si le nœud a des enfants, on les traverse aussi
        if (node.children) {
            node.children.forEach(child => traverseNode(child));
        }
        
        // On ajoute les tags du nœud à la liste si disponible
        if (node.tags) {
            allTags.push({
                node: node.topic,
                tags: node.tags
            });
        }
    }

    // Démarrer la traversée depuis la racine (nodeData)
    traverseNode(mindMapData.nodeData);

    return allTags;
}