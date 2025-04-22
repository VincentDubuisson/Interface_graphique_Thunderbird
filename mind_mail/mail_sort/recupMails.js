import { extractNodeNames } from '../mind_map/saveMindMap.js';
import { getSavedMindMap } from "../mind_map/loadMindMap.js";

let accounts;
let folderNodeMap = {}


// Fonction principale qui initialise le système et lance la récupération des mails
export async function executeRecupEmails() {

    clearStoredFoldersData();
    
    await initAccount(); // Récupération des comptes mail disponibles
    await initMainFolder(); // Création du dossier principal "MindMail"
    await createSubFolder(); // Création de la structure de dossiers en fonction de la carte mentale

    // Chargement de la carte mentale sauvegardée
    const mindMapData = await getSavedMindMap();
    if (!mindMapData || !mindMapData.nodeData) return;

    // Récupère tous les mails une seule fois pour éviter les appels redondants
    const allMails = await getAllMails();
    console.log(`Nombre total de mails récupérés : ${allMails.length}`);

    // Lance le parcours de la carte mentale pour trier les mails
    await browseNode(mindMapData.nodeData, allMails, "MindMail", true);
}



// Récupère la liste des comptes de messagerie configurés
export async function initAccount() {
    accounts = await browser.accounts.list();
    console.log(`Nombre de comptes trouvés : ${accounts.length}`);
    for (let account of accounts) {
        console.log(account.name); 
    }       
}



// Parcourt tous les comptes pour récupérer tous les mails des boîtes de réception
async function getAllMails() {
    const allMails = [];

    for (let account of accounts) {
        let fullAccount = await browser.accounts.get(account.id);

        for (let folder of fullAccount.folders) {
            // Ne s'intéresse qu'aux dossiers "Courrier entrant"
            if (folder.name === "Courrier entrant" || folder.path === "/INBOX") {
                try {
                    let page = await messenger.messages.list(folder.id);
                    let messageList = page.messages || [];

                    // Ajoute les premiers mails
                    if (messageList.length > 0) {
                        allMails.push(...messageList);
                    }

                    // Continue la pagination s’il y a plusieurs pages
                    while (page.id) {
                        page = await messenger.messages.continueList(page.id);
                        messageList = page.messages || [];

                        if (messageList.length > 0) {
                            allMails.push(...messageList);
                        }
                    }
                } catch (error) {
                    console.warn(`Impossible de récupérer les emails pour ${folder.name} :`, error);
                }
            }
        }        
    }

    return allMails;
}


async function browseNode(node, baseMails, path = "", isRoot = false) {
    const normalizeTag = tag => tag.trim().toLowerCase();
    const ownTags = (node.tags || []).map(normalizeTag);
    const hasTags = ownTags.length > 0;

    let totalMessages = 0;
    const filteredMails = [];

    const nodePath = isRoot ? "MindMail" : `${path}${node.topic}`;
    const fullPath = `${nodePath}`;
    const folderId = folderNodeMap[`${nodePath}`] || folderNodeMap[`Dossiers locaux/${nodePath}`];
    const alreadyCopiedIds = folderId ? await loadCopiedMailIds(fullPath) : [];

    if (hasTags) {
        for (let mail of baseMails) {
            const subject = mail.subject?.toLowerCase() || "";
            const author = mail.author?.toLowerCase() || "";

            const hasMatchingTag = ownTags.some(tag =>
                tag === "all" || subject.includes(tag) || author.includes(tag)
            );

            if (hasMatchingTag) {
                if (alreadyCopiedIds.includes(mail.id)) {
                    console.log(`Mail déjà présent dans '${fullPath}' → Ignoré : ${mail.subject}`);
                    continue;
                }

                console.log(`     ${mail.subject} - ${mail.author}`);
                filteredMails.push(mail);
                totalMessages++;

                // Copie le mail et stocke son ID
                if (folderId) {
                    try {
                        await browser.messages.copy([mail.id], folderId);
                        await saveCopiedMailId(fullPath, mail.id);
                        console.log(`    ✉️ Copié dans '${fullPath}'`);
                    } catch (copyError) {
                        console.error(`Erreur lors de la copie dans '${fullPath}' :`, copyError);
                    }
                } else {
                    console.warn(`Dossier introuvable pour '${fullPath}'`);
                }
            }
        }

        if (totalMessages > 0) {
            console.log(`"${node.topic}" (${ownTags.join(", ")}) → ${totalMessages} nouveaux mails.`);
        } else {
            console.log(`Aucun nouveau mail pour "${node.topic}"`);
        }
    } else {
        filteredMails.push(...baseMails);
        console.log(`"${node.topic}" sans tag → mails transmis aux enfants`);
    }

    if (node.children && node.children.length > 0) {
        for (let child of node.children) {
            await browseNode(child, filteredMails, `${nodePath}/`);
        }
    }
}


// Crée le dossier "MindMail" à la racine du compte sélectionné
async function initMainFolder(mailAdress = "none") {
    let account; 

    if (mailAdress == "none") account = accounts[accounts.length - 1]; // Par défaut, sélectionne le dernier compte
    else {
        for (let acc of accounts) {
            if (acc.name == mailAdress) account = acc
        }
    }

    if (!account) {
        console.error("Aucun compte valide trouvé.");
        return;
    }

    // Vérifie si le dossier "MindMail" existe déjà
    let fullAccount = await browser.accounts.get(account.id);
    const existingFolder = fullAccount.folders.find(folder => folder.name === "MindMail");

    if (existingFolder) {
        console.log("Le dossier 'MindMail' existe déjà :", existingFolder.path);
        return existingFolder;
    }

    // Si le dossier n'existe pas, on le créer
    try {
        const folder = await browser.folders.create(account.rootFolder.id, "MindMail");
        console.log("Dossier 'MindMail' créé :", folder.path, "dans le compte ", account.name);
        return folder;
    } catch (error) {
        console.error("Erreur lors de la création du dossier 'MindMail' :", error);
        return null;
    }
 }


 async function createSubFolder(mailAdress = "none") {
    let account;

    if (mailAdress === "none") {
        account = accounts[accounts.length - 1];
    } else {
        account = accounts.find(acc => acc.name === mailAdress);
        if (!account) {
            console.error("Aucun compte ne correspond à l'adresse entrée !");
            return;
        }
    }

    const mindMailFolder = await getMindMailFolder(account);
    if (!mindMailFolder) {
        console.error("Dossier 'MindMail' introuvable !");
        return;
    }

    const tree = extractNodeNames(await getSavedMindMap());
    console.log("Arborescence à créer :", tree);

    folderNodeMap = await createMindMapFolders(tree, mindMailFolder.id); // Stockage global
}


async function createMindMapFolders(tree, parentFolderId, parentPath = "") {
    const folderMap = {};
    const parentInfo = await browser.folders.getSubFolders(parentFolderId);
    const existingNames = parentInfo.map(f => f.name);

    for (let nodeName in tree) {
        const safeName = nodeName.replace(/[\\/:"*?<>|]+/g, "_");
        let folderId;
        let newFolder;

        try {
            if (existingNames.includes(safeName)) {
                const existingFolder = parentInfo.find(f => f.name === safeName);
                folderId = existingFolder.id;
                console.log(`Le dossier '${safeName}' existe déjà.`);
            } else {
                newFolder = await browser.folders.create(parentFolderId, safeName);
                folderId = newFolder.id;
                console.log("Dossier créé :", newFolder.path);
            }

            const fullPath = `MindMail/${parentPath}${nodeName}`;
            folderMap[fullPath] = folderId;
            if (newFolder) folderMap[newFolder.path] = folderId;

            // Appel récursif pour les enfants
            const children = tree[nodeName];
            if (children && Object.keys(children).length > 0) {
                const subMap = await createMindMapFolders(children, folderId, `${parentPath}${nodeName}/`);
                Object.assign(folderMap, subMap);
            }

        } catch (err) {
            console.error(`Erreur création dossier '${nodeName}':`, err);
        }
    }

    return folderMap;
}


// Recherche le dossier "MindMail" dans les dossiers de l'utilisateur
async function getMindMailFolder(account) {
    let fullAccount = await browser.accounts.get(account.id);
    let rootFolders = fullAccount.folders;

    for (let folder of rootFolders) {
        if (folder.name === "MindMail") {
            return folder;
        }
    }

    console.warn("Le dossier 'MindMail' n'a pas été trouvé.");
    return null;
}


async function storeNotification(notification) {
    let notifications = await browser.storage.local.get('notifications');
    notifications = notifications.notifications || [];
    notifications.push(notification);
    await browser.storage.local.set({notifications});
}


// Récupère les ID des mails classés
async function loadCopiedMailIds(folderPath) {
    const result = await browser.storage.local.get(folderPath);
    return result[folderPath] || [];
}


// Sauvegarde les ID des mails classés
async function saveCopiedMailId(folderPath, messageId) {
    const current = await loadCopiedMailIds(folderPath);
    if (!current.includes(messageId)) {
        current.push(messageId);
        await browser.storage.local.set({ [folderPath]: current });
    }
}


// Supprime le stockage local des ID de mails classés à utiliser en supprimant le dossier MindMail
async function clearStoredFoldersData() {
    const allData = await browser.storage.local.get(null); // Récupère tout
    const keysToDelete = Object.keys(allData).filter(key => key.startsWith("MindMail/"));

    for (let key of keysToDelete) {
        await browser.storage.local.remove(key);
        console.log(`Données supprimées pour le dossier : ${key}`);
    }

    console.log("Nettoyage des dossiers terminé.");
}