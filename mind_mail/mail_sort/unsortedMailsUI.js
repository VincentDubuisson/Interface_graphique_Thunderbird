import { extractNodeNames } from '../mind_map/saveMindMap.js';
import { getSavedMindMap } from "../mind_map/loadMindMap.js";
import { moveMailFromUnsorted, getMindMailFolder, createMindMapFolders } from './recupMails.js';
import { folderNodeMap } from '../mail_sort/recupMails.js';

let accounts;

// Initialise les comptes de messagerie
async function initAccounts() {
    accounts = await browser.accounts.list();
    return accounts;
}

// Fonction pour obtenir tous les dossiers disponibles à partir de la carte mentale
async function getAllFolders() {
    const mindMapData = await getSavedMindMap();
    if (!mindMapData || !mindMapData.nodeData) return [];
    
    const folders = [];
    
    function traverseNode(node, currentPath) {
        const nodePath = currentPath ? `${currentPath}/${node.topic}` : node.topic;
        if (node.children && node.children.length > 0) {
            folders.push(`MindMail/${nodePath}`);
            node.children.forEach(child => traverseNode(child, nodePath));
        } else {
            folders.push(`MindMail/${nodePath}`);
        }
    }
    
    traverseNode(mindMapData.nodeData, "");

    folders.push("MindMail/Non Classé");
    return folders;
}

// Fonction pour trouver le dossier "Non Classé"
async function getUnsortedFolder() {
    const accounts = await initAccounts();
    for (let account of accounts) {
        const folders = await browser.folders.getSubFolders(account);
        const mindMailFolder = folders.find(f => f.name === "MindMail");
        if (mindMailFolder) {
            const subFolders = await browser.folders.getSubFolders(mindMailFolder);
            const unsortedFolder = subFolders.find(f => f.name === "Non Classé");
            if (unsortedFolder) {
                return unsortedFolder;
            }
        }
    }
    return null;
}

// Fonction pour récupérer les mails non classés
async function getUnsortedMails() {
    const unsortedFolder = await getUnsortedFolder();
    if (!unsortedFolder) {
        console.error("Dossier 'Non Classé' non trouvé");
        return [];
    }

    try {
        const result = await browser.messages.list(unsortedFolder.id);
        const messages = result.messages || [];

        return messages.map(message => ({
            id: message.id,
            subject: message.subject,
            author: message.author,
            date: new Date(message.date).toLocaleString()
        }));
    } catch (error) {
        console.error("Erreur lors de la récupération des mails non classés:", error);
        return [];
    }
}

// Fonction pour créer l'élément de sélection des dossiers
function createFolderSelect(folders) {
    const select = document.createElement('select');
    select.className = 'folder-select';
    
    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder;
        select.appendChild(option);
    });
    
    return select;
}

// Fonction pour créer un élément de mail non classé
function createMailItem(mail, folders) {
    const mailDiv = document.createElement('div');
    mailDiv.className = 'mail-item';
    
    const mailInfo = document.createElement('div');
    mailInfo.innerHTML = `
        <strong>De:</strong> ${mail.author}<br>
        <strong>Sujet:</strong> ${mail.subject}<br>
        <strong>Date:</strong> ${mail.date}
    `;
    
    const controls = document.createElement('div');
    const select = createFolderSelect(folders);
    
    const moveButton = document.createElement('button');
    moveButton.className = 'move-btn';
    moveButton.textContent = 'Déplacer';
    moveButton.onclick = async () => {
        try {
            await moveMailFromUnsorted(mail.id, select.value);
            mailDiv.remove(); // Supprime l'élément de l'interface après le déplacement
            
            // Affiche une notification de succès
            const notification = {
                type: 'success',
                message: `Mail déplacé avec succès vers ${select.value}`,
                timestamp: new Date().toISOString()
            };
            // Stocke la notification
            await browser.storage.local.get('notifications').then(data => {
                const notifications = data.notifications || [];
                notifications.push(notification);
                return browser.storage.local.set({ notifications });
            });
        } catch (error) {
            console.error('Erreur lors du déplacement du mail:', error);
            // Affiche une notification d'erreur
            const notification = {
                type: 'error',
                message: `Erreur lors du déplacement du mail: ${error.message}`,
                timestamp: new Date().toISOString()
            };
            await browser.storage.local.get('notifications').then(data => {
                const notifications = data.notifications || [];
                notifications.push(notification);
                return browser.storage.local.set({ notifications });
            });
        }
    };
    
    controls.appendChild(select);
    controls.appendChild(moveButton);
    
    mailDiv.appendChild(mailInfo);
    mailDiv.appendChild(controls);
    
    return mailDiv;
}

// Fonction pour initialiser l'interface des mails non classés
async function initUnsortedMailsUI() {
    const unsortedMailsContainer = document.getElementById('unsortedMails');
    if (!unsortedMailsContainer) return;
    
    try {
        // Récupère les dossiers disponibles
        let folders = Object.keys(folderNodeMap);
    if (folders.length === 0) {
        console.log("Folder map empty, reloading MindMap...");

        const mindMapData = await getSavedMindMap();
        const accounts = await browser.accounts.list();
        const mindMailFolder = await getMindMailFolder(accounts[accounts.length - 1]);
        if (mindMapData && mindMailFolder) {
            const tree = extractNodeNames(mindMapData);
            tree["Non Classé"] = {};
            Object.assign(folderNodeMap, await createMindMapFolders(tree, mindMailFolder.id));
            folders = Object.keys(folderNodeMap);
        }
    }
        
        // Récupère la liste des mails non classés
        const unsortedMails = await getUnsortedMails();
        
        if (unsortedMails.length === 0) {
            unsortedMailsContainer.innerHTML = '<p>Aucun mail non classé.</p>';
            return;
        }
        
        // Crée les éléments d'interface pour chaque mail non classé
        unsortedMails.forEach(mail => {
            const mailElement = createMailItem(mail, folders);
            unsortedMailsContainer.appendChild(mailElement);
        });
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'interface des mails non classés:', error);
        unsortedMailsContainer.innerHTML = '<p>Erreur lors du chargement des mails non classés.</p>';
    }
}

// Initialise l'interface au chargement de la page
document.addEventListener('DOMContentLoaded', initUnsortedMailsUI);
