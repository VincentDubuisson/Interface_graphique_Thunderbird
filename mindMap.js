import MindElixir from '../node_modules/mind-elixir/dist/MindElixir.js';
import nodeMenu from '../node_modules/@mind-elixir/node-menu-neo/dist/node-menu-neo.js';
import { saveMindMap } from './saveMindMap.js';

// Fonction pour créer un bouton pour afficher les messages
function createViewMessagesButton(folderName) {
    const buttonContainer = document.getElementById("messageButtonContainer");
    
    // Efface le bouton précédent (si présent)
    buttonContainer.innerHTML = '';

    // Crée un bouton
    const button = document.createElement("button");
    button.textContent = `Voir les messages de ${folderName}`;
    button.onclick = async () => {
        await showMails(folderName);  // Affiche les mails du dossier
    };
    
    // Ajoute le bouton dans le conteneur
    buttonContainer.appendChild(button);
}



async function getMessagesFromFolder(folderName) {
    console.log("Recherche des messages dans le dossier:", folderName); // Ajoute ce log pour vérifier
    let accounts = await browser.accounts.list();
    
    // Fonction récursive pour parcourir les dossiers et sous-dossiers
    async function searchInFolders(folders) {
        for (const folder of folders) {
            console.log("Dossier trouvé:", folder.name); // Affiche chaque dossier
            if (folder.name === folderName) {
                console.log(`Dossier trouvé: ${folderName}`);
                let messages = await browser.messages.list(folder);
                console.log(`Messages trouvés: ${messages.messages.length}`);
                return messages.messages; // Retourne les messages du dossier trouvé
            }

            // Si le dossier a des sous-dossiers, on les explore
            if (folder.subFolders && folder.subFolders.length > 0) {
                const messagesInSubFolder = await searchInFolders(folder.subFolders);
                if (messagesInSubFolder.length > 0) {
                    return messagesInSubFolder; // Si des messages sont trouvés dans un sous-dossier, on les retourne
                }
            }
        }
        return []; // Aucun dossier trouvé
    }

    // Parcours tous les comptes pour chercher dans leurs dossiers
    for (const account of accounts) {
        console.log("Dossiers de l'account:", account.folders); // Affiche tous les dossiers de l'account
        const messages = await searchInFolders(account.folders);
        if (messages.length > 0) {
            return messages; // Retourne les messages dès que le dossier est trouvé
        }
    }

    console.log("Aucun dossier trouvé avec ce nom.");
    return []; // Aucun dossier trouvé avec ce nom
}


// Fonction pour afficher les mails
async function showMails(folderName) {
    const messages = await getMessagesFromFolder(folderName);
    const mailList = document.getElementById("mailList");
    mailList.innerHTML = "";

    if (messages.length === 0) {
        mailList.innerHTML = "<li>Aucun message trouvé.</li>";
        console.log("Aucun message trouvé."); // Ajout d'un log pour vérifier
        return;
    }

    messages.forEach(msg => {
        const li = document.createElement("li");
        li.innerHTML = `
            <strong>${msg.subject}</strong><br>
            <em>${msg.author}</em> – ${new Date(msg.date).toLocaleString()}
        `;
        li.style.cursor = "pointer";
        li.onclick = () => displayMail(msg.id);
        mailList.appendChild(li);
    });
}

// Fonction pour afficher un message complet
async function displayMail(messageId) {
    console.log("Affichage du message avec ID:", messageId); // Ajout d'un log
    const full = await messenger.messages.getFull(messageId);
    if (!full) {
        console.log("Erreur: message complet introuvable.");
        return;
    }
    const part = full.parts.find(p => p.contentType === "text/plain");
    const content = part ? part.body : "(Pas de contenu texte)";

    const emailContent = document.getElementById("emailContent");
    emailContent.style.display = "block";  // Affiche le conteneur
    emailContent.innerHTML = `
        <h3>${full.subject}</h3>
        <p><strong>De :</strong> ${full.headers.from}</p>
        <p><strong>Date :</strong> ${new Date(full.date).toLocaleString()}</p>
        <pre style="white-space: pre-wrap;">${content}</pre>
    `;
}

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
    });

    // Charge la carte mentale
    browser.storage.local.get("mindmap").then(result => {
        if (result.mindmap) {
            const data = JSON.parse(result.mindmap);
            mind.init(data);
        } else {
            const data = MindElixir.new("Nouvelle idée");
            mind.init(data);
        }

        mind.bus.addListener("selectNode", async node => {
            console.log("🧠 Nœud cliqué :", node.topic);
            await showMails(node.topic); // Affiche les mails pour ce dossier
            createViewMessagesButton(node.topic); // Crée le bouton pour afficher les messages
        });
    });

    mind.install(nodeMenu);
    window.mind = mind;

    // Enregistrement à chaque opération
    mind.bus.addListener('operation', operation => {
        saveMindMap(window.mind.getData());
    });

    // ✅ C'est ici qu'on écoute les clics sur les nœuds !
    mind.bus.addListener('selectNode', async node => {
        console.log('Noeud cliqué :', node.topic);
        const folderName = node.topic;
        await showMails(folderName);
        createViewMessagesButton(folderName);
    });

    // Bouton réinitialisation
    const resetButton = document.getElementById("resetBtn");
    resetButton.addEventListener("click", function () {
        const newData = MindElixir.new("Nouvelle idée");
        mind.init(newData);
        saveMindMap(window.mind.getData());
        console.log('Carte mentale réinitialisée.');
    });
});
