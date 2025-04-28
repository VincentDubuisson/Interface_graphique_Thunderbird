import MindElixir from '../node_modules/mind-elixir/dist/MindElixir.js';
import nodeMenu from '../node_modules/@mind-elixir/node-menu-neo/dist/node-menu-neo.js';
import { saveMindMap } from './saveMindMap.js';
import { clearStoredFoldersData } from "../mail_sort/recupMails.js";
import { showMailPopup } from '../popup/popup.js';


let mind;

document.addEventListener("DOMContentLoaded", function () {
    let mind = new MindElixir({
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
        console.log("Clic sur le noeud :", node)
        const keyword = node.topic;
        const response = await browser.runtime.sendMessage({
            action: "getMailsByKeyword",
            keyword: keyword
        });
        showMailPopup(response.messages || [], keyword);
    });
});

export async function resetMindMap() {
    const newData = MindElixir.new("Nouvelle idée"); // Crée une nouvelle carte
    mind.init(newData); // Réinitialise la carte mentale avec les données par défaut
    clearStoredFoldersData();
    saveMindMap(window.mind.getData()); // Sauvegarde la carte mentale
    console.log('Carte mentale réinitialisée.');
}

