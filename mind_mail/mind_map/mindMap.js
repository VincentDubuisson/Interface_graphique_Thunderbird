import MindElixir from '../api/node_modules/mind-elixir/dist/MindElixir.js';
import nodeMenu from '../api/node_modules/@mind-elixir/node-menu-neo/dist/node-menu-neo.js';
import { saveMindMap } from './saveMindMap.js';
import { clearStoredFoldersData } from "../mail_sort/mailSort.js";
import { showMailPopup } from '../web_interface/popup/popup.js';


let mind;

document.addEventListener("DOMContentLoaded", function () {
    mind = new MindElixir({
        el: "#map",
        direction: MindElixir.SIDE,
        draggable: true,
        contextMenu: true,
        toolBar: true,
        nodeMenu: true,
        keypress: true,
        locale: "fr",
        mainLinkStyle: 1,
        mouseSelectionButton: 0,
        contextMenuOption: {
            focus: true,
            link: true
        },
    });

    // Tente de récupérer la carte mentale sauvegardée
    browser.storage.local.get("mindmap").then(result => {
        // Si la carte est présente
        if (result.mindmap) {
            // On charge la carte
            const data = JSON.parse(result.mindmap); // Convertir la chaîne JSON en objet
            mind.init(data);

        } else {
            // Sinon, initialiser une nouvelle carte mentale
            const data = MindElixir.new("Nouvelle idée");
            mind.init(data);
        }
    });

    // Installe l'extension d'édition avancée des noeuds
    mind.install(nodeMenu);

    // Rend `mind` accessible globalement
    window.mind = mind;

    // Écoute les événements de modification (ajout, suppression, déplacement de noeuds, ...)
    mind.bus.addListener('operation', operation => {
        saveMindMap(window.mind.getData());
    });

    mind.bus.addListener('selectNode', async node => {
        let keyword = node.topic;

        // Vérifie si c'est la racine
        const isRoot = node.parent == null;

        let response;
        if (isRoot) {
            // Récupère tous les mails triés
            response = await browser.runtime.sendMessage({
                action: "getAllSortedMails"
            });
            keyword = null; // Pour afficher "Tous les mails" dans l'en-tête
        } else {
            // Récupère les mails filtrés par mot-clé
            response = await browser.runtime.sendMessage({
                action: "getMailsByKeyword",
                keyword: keyword
            });
        }

        showMailPopup(response.messages || [], keyword);
    });
});

export async function resetMindMap() {
    const newData = MindElixir.new("Nouvelle carte"); // Crée une nouvelle carte
    window.mind.init(newData); // Réinitialise la carte mentale avec les données par défaut
    clearStoredFoldersData();
    saveMindMap(window.mind.getData()); // Sauvegarde la carte mentale
    console.log('Carte mentale réinitialisée.');
}