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
    let mindMapData = await getSavedMindMap();

    if (!mindMapData || !mindMapData.nodeData) {
        console.error("Données invalides reçues :", mindMapData);
        return null;
    }

    function searchTags(node) {
        if (!node || !node.topic) return null;

        // Si on trouve le bon nœud, on retourne ses tags
        if (node.topic === name_leaf) {
            return node.tags || [];
        }

        // Recherche récursive dans les enfants
        if (node.children && Array.isArray(node.children)) {
            for (let child of node.children) {
                let result = searchTags(child);
                if (result !== null) {
                    return result; // On arrête dès qu'on trouve
                }
            }
        }

        return null; // Si aucun nœud ne correspond
    }

    return searchTags(mindMapData.nodeData);
}

