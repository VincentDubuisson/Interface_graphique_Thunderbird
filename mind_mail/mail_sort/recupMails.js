import { extractNodeNames } from '../mind_map/saveMindMap.js';
import { getSavedMindMap } from "../mind_map/loadMindMap.js";

let accounts;
let folderNodeMap = {};
let allCopiedIds = new Set();


// Fonction principale qui initialise le système et lance la récupération des mails
export async function executeRecupEmails() {
    
    await initAccount(); // Récupération des comptes mail disponibles
    await loadAllPreviouslyCopiedIds();
    await initMainFolder(); // Création du dossier principal "MindMail"
    await createSubFolder(); // Création de la structure de dossiers en fonction de la carte mentale

    //await clearStoredFoldersData(); // A utiliser avec précaution : réinitialise les IDs de mail classé

    // Chargement de la carte mentale sauvegardée
    const mindMapData = await getSavedMindMap();
    if (!mindMapData || !mindMapData.nodeData) return;

    // Récupère tous les mails une seule fois pour éviter les appels redondants
    const allMails = await getAllMails();
    console.log(`Nombre total de mails récupérés : ${allMails.length}`);

    // Lance le parcours de la carte mentale pour trier les mails
    await browseNode(mindMapData.nodeData, allMails, "MindMail", true);

    // Copie les mails non classés
    await handleUnsortedMails(allMails);

    //await moveMailFromUnsorted(1548, "MindMail/Steam/Vente"); // Exemple d'utilisation du déplacement de mail non classé
    
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


// Parcourt récursivement les nœuds de la carte mentale pour filtrer et copier les mails selon les tags définis
async function browseNode(node, baseMails, path = "", isRoot = false) {
    const normalizeTag = tag => tag.trim().toLowerCase(); // Normalise les tags pour comparaison
    const ownTags = (node.tags || []).map(normalizeTag); // Récupère les tags du nœud courant
    const hasTags = ownTags.length > 0; // Vérifie s'il y a des tags à utiliser pour le filtrage

    let totalMessages = 0;
    const filteredMails = [];

    const nodePath = isRoot ? "MindMail" : `${path}${node.topic}`; // Construit le chemin vers le dossier
    const fullPath = `${nodePath}`;
    const folderId = folderNodeMap[`${nodePath}`] || folderNodeMap[`Dossiers locaux/${nodePath}`]; // Recherche le dossier cible
    const alreadyCopiedIds = folderId ? await loadCopiedMailIds(fullPath) : []; // Charge les IDs de mails déjà copiés

    if (hasTags) {
        for (let mail of baseMails) {
            const subject = mail.subject?.toLowerCase() || "";
            const author = mail.author?.toLowerCase() || "";

            let bodyText = "";
            try {
                const fullMessage = await browser.messages.getFull(mail.id);
                const parts = fullMessage.parts || [];
                
                // Recherche la première partie de type text/plain
                for (let part of parts) {
                    if (part.contentType === "text/plain" && part.body) {
                        bodyText = part.body.toLowerCase();
                        break;
                    }
                }
            } catch (err) {
                console.warn(`Erreur lors de la récupération du contenu du mail ${mail.id} :`, err);
            }

            // Vérifie si le mail correspond à au moins un tag
            const hasMatchingTag = ownTags.some(tag =>
                tag === "all" ||
                subject.includes(tag) ||
                author.includes(tag) ||
                bodyText.includes(tag)
            );

            if (hasMatchingTag) {
                // Ignore les mails déjà copiés
                if (alreadyCopiedIds.includes(mail.id)) {
                    continue;
                }

                console.log(`     ${mail.subject} - ${mail.author}`);
                filteredMails.push(mail);
                totalMessages++;

                // Copie le mail dans le dossier et enregistre son ID
                if (folderId) {
                    try {
                        await browser.messages.copy([mail.id], folderId);
                        await saveCopiedMailId(fullPath, mail.id);
                        allCopiedIds.add(mail.id);
                        console.log(`    Copié dans '${fullPath}'`);
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
        // S'il n'y a pas de tags, on transmet tous les mails aux enfants
        filteredMails.push(...baseMails);
        console.log(`"${node.topic}" sans tag → mails transmis aux enfants`);
    }

    // Parcours récursif des nœuds enfants
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


// Crée les dossiers de la carte mentale dans le bon compte mail, en finissant par un dossier "Non Classé"
async function createSubFolder(mailAdress = "none") {
    let account;

    // Si aucune adresse n’est spécifiée, on prend le dernier compte
    if (mailAdress === "none") {
        account = accounts[accounts.length - 1];
    } else {
        account = accounts.find(acc => acc.name === mailAdress);
        if (!account) {
            console.error("Aucun compte ne correspond à l'adresse entrée !");
            return;
        }
    }

    const mindMailFolder = await getMindMailFolder(account); // Récupère ou crée le dossier MindMail
    if (!mindMailFolder) {
        console.error("Dossier 'MindMail' introuvable !");
        return;
    }

    const tree = extractNodeNames(await getSavedMindMap()); // Construit la structure d'arborescence à partir de la carte mentale
    tree["Non Classé"] = {}; // Ajoute un dossier par défaut pour les mails non triés
    console.log("Arborescence à créer :", tree);

    folderNodeMap = await createMindMapFolders(tree, mindMailFolder.id); // Crée les dossiers et stocke leurs IDs
}


// Crée récursivement les dossiers de la carte mentale dans Thunderbird
async function createMindMapFolders(tree, parentFolderId, parentPath = "") {
    const folderMap = {};
    const parentInfo = await browser.folders.getSubFolders(parentFolderId); // Récupère les sous-dossiers existants
    const existingNames = parentInfo.map(f => f.name); // Liste des noms existants pour éviter les doublons

    for (let nodeName in tree) {
        const safeName = nodeName.replace(/[\\/:"*?<>|]+/g, "_"); // Nettoie le nom du dossier
        let folderId;
        let newFolder;

        try {
            if (existingNames.includes(safeName)) {
                // Le dossier existe déjà, on récupère son ID
                const existingFolder = parentInfo.find(f => f.name === safeName);
                folderId = existingFolder.id;
                console.log(`Le dossier '${safeName}' existe déjà.`);
            } else {
                // Sinon, on le crée
                newFolder = await browser.folders.create(parentFolderId, safeName);
                folderId = newFolder.id;
                console.log("Dossier créé :", newFolder.path);
            }

            const fullPath = parentPath ? `MindMail/${parentPath}${nodeName}` : `MindMail/${nodeName}`;
            folderMap[fullPath] = folderId; // Associe le chemin complet à l'ID
            if (newFolder) folderMap[newFolder.path] = folderId; // Et aussi le chemin absolu Thunderbird

            // Appel récursif pour les enfants de ce nœud
            const children = tree[nodeName];
            if (children && Object.keys(children).length > 0) {
                const subMap = await createMindMapFolders(children, folderId, `${parentPath}${nodeName}/`);
                Object.assign(folderMap, subMap); // Fusionne les mappings
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


// Copie les mails non triés dans le dossier "Non Classé" s'ils ne sont liés à aucun tag
async function handleUnsortedMails(allMails) {

    const fullPath = "MindMail/Non Classé";
    const folderId = folderNodeMap[fullPath]; // Récupère l’ID du dossier "Non Classé"


    const unclassifiedMails = allMails.filter(mail => !allCopiedIds.has(mail.id)); // Garde uniquement les mails encore non copiés
    if (unclassifiedMails.length === 0) {
        console.log("Tous les mails ont été triés.");
        return;
    }

    if (!folderId) {
        console.warn("Dossier 'Non Classé' introuvable !");
        return;
    }

    for (let mail of unclassifiedMails) {
        try {
            await browser.messages.copy([mail.id], folderId); // Copie le mail
            await saveCopiedMailId(fullPath, mail.id); // Enregistre son ID pour ne pas le copier à nouveau
            allCopiedIds.add(mail.id);
            console.log(`Mail non classé copié : ${mail.subject}`);

            await storeNotification({
                subject: mail.subject,
                author: mail.author,
                messageId: mail.id,
                date: mail.date
            });

        } catch (err) {
            console.error("Erreur copie mail non classé :", err);
        }
    }

    console.log(`${unclassifiedMails.length} mail(s) copié(s) dans 'Non Classé'`);
}


// Récupère les ID des mails classés
async function loadCopiedMailIds(folderPath) {
    const result = await browser.storage.local.get(folderPath);
    return result[folderPath] || [];
}


async function loadAllPreviouslyCopiedIds() {
    const allData = await browser.storage.local.get(null);
    for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith("MindMail/") && Array.isArray(value)) {
            for (const id of value) {
                allCopiedIds.add(id);
            }
        }
    }
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


// Déplace un mail depuis "Non Classé" vers un autre dossier de MindMail
export async function moveMailFromUnsorted(mailId, targetPath) {
    if (Object.keys(folderNodeMap).length === 0) {
        if (!accounts || accounts.length === 0) {
            accounts = await browser.accounts.list();
        }
        const mindMapData = await getSavedMindMap();
        const mindMailFolder = await getMindMailFolder(accounts[accounts.length - 1]);
        if (mindMailFolder && mindMapData && mindMapData.nodeData) {
            const tree = extractNodeNames(mindMapData);
        tree["Non Classé"] = {};
        const newMap = await createMindMapFolders(tree, mindMailFolder.id);
        Object.assign(folderNodeMap, newMap);
        }
    }

    const unsortedPath = "MindMail/Non Classé";
    const sourceFolderId = folderNodeMap[unsortedPath];
    const targetFolderId = folderNodeMap[targetPath];
    console.log("Source folderId:", sourceFolderId);
    console.log("Target folderId:", targetFolderId);

    if (!sourceFolderId || !targetFolderId) {
        console.error("Le dossier source ou cible est introuvable !");
        console.log("sourceFolderId:", sourceFolderId);
        console.log("targetFolderId:", targetFolderId);
        return;
    }

    try {
        // Liste les messages dans "Non Classé"
        const sourceMessages = await getAllMessagesInFolder(sourceFolderId);

        const mail = sourceMessages.find(msg => msg.id === mailId);

        if (!mail) {
            console.warn(`Le mail d'ID ${mailId} n'est pas dans 'Non Classé'.`);
            return;
        }

        // Vérifier que 'mail' existe avant de tenter de le déplacer
        if (mailId !== mail.id) {
            console.warn(`L'ID du mail trouvé (${mail.id}) ne correspond pas à l'ID recherché (${mailId}).`);
            return;
        }

        // Déplacement du mail
        const result = await browser.messages.move([mailId], targetFolderId);
        const movedMail = result?.messages?.[0];

        if (!movedMail) {
            console.warn("Le mail a été déplacé mais aucune info n’a été retournée par l’API.");
        } else {
            // Met à jour la mémoire locale avec le nouvel ID
            await saveCopiedMailId(targetPath, movedMail.id);
            allCopiedIds.delete(mailId);
            allCopiedIds.add(movedMail.id);

            console.log(`Mail déplacé vers '${targetPath}'`);

            // Supprime l'ancien ID de la liste du dossier source
            await removeCopiedMailId(unsortedPath, mailId);
        }

    } catch (err) {
        console.error("Erreur déplacement mail :", err);
    }
}


// Supprime un ID de mail depuis le fichier de suivi associé à un dossier donné
async function removeCopiedMailId(path, idMail) {
    try {
        const storageKey = path;
        const result = await browser.storage.local.get(storageKey);
        const existingIds = result[storageKey] || [];

        const updatedIds = existingIds.filter(id => id !== idMail);

        await browser.storage.local.set({ [storageKey]: updatedIds });
        console.log(`ID supprimé du stockage local pour '${path}'`);
    } catch (err) {
        console.error(`Erreur suppression ID pour '${path}' :`, err);
    }
}

async function getAllMessagesInFolder(folderId) {
    let allMessages = [];
    let result = await browser.messages.query({ folderId });
    allMessages.push(...result.messages);

    while (result.id) {
        result = await browser.messages.continueList(result.id);
        allMessages.push(...result.messages);
    }

    return allMessages;
}

export { folderNodeMap, createMindMapFolders, getMindMailFolder };