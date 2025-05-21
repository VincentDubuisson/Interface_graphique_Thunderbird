import { extractNodeNames } from '../mind_map/saveMindMap.js';
import { getSavedMindMap } from "../mind_map/loadMindMap.js";
import { getAllTags } from "./extractTerminalNodesName.js";
import { emptyTrashFolder } from "./trash/trash.js";

let accounts;
let folderNodeMap = {};
let allCopiedIds = new Set();


// Fonction principale qui initialise le système et lance la récupération des mails
export async function executeMailSort() {

    await initAccount(); // Récupération des comptes mail disponibles
    const mindMailFolder = await initMainFolder();

    // Vérification de la correspondance de structure
    const mindMapTree = extractNodeNames(await getSavedMindMap());
    mindMapTree["Non Classé"] = {};

    const currentFolderTree = await getCurrentMindMailTree(mindMailFolder);

    const isSameStructure = compareFolderTrees(mindMapTree, currentFolderTree);

    // Récupère les tags actuels
    const currentTags = await getAllTags();

    // Compare les tags stockés avec les nouveaux tags
    const savedTags = await getSavedTags();
    const isSameTags = compareTags(savedTags || [], currentTags);

    if (!isSameStructure || !isSameTags) {
        console.warn("Différence détectée entre la carte mentale, les dossiers et/ou les tags. Nettoyage en cours...");
        await clearStoredFoldersData();
        await emptyTrashFolder();
        allCopiedIds = new Set();
        await initAccount();
        await initMainFolder(); // Création du dossier principal "MindMail"
        await saveTags(currentTags); // Sauvegarde des nouveaux tags
        await createSubFolder(); // Création de la structure de dossiers en fonction de la carte mentale
    } else {
        console.log("Structure MindMail correcte, pas de nettoyage nécessaire.");
        await loadAllPreviouslyCopiedIds();
    }


    // Chargement de la carte mentale sauvegardée
    const mindMapData = await getSavedMindMap();
    if (!mindMapData || !mindMapData.nodeData) return;

    // Récupère tous les mails une seule fois pour éviter les appels redondants
    const allMails = await getAllMails();
    console.log(`Nombre total de mails récupérés : ${allMails.length}`);

    // Lance le parcours de la carte mentale pour trier les mails
    await mailSort(mindMapData, allMails);
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


async function mailSort(mindMapData, allMails) {
    console.log("Lancement du tri des mails...");
    const accounts = await browser.accounts.list();
    const lastAccount = accounts[accounts.length - 1]; // "Dossiers locaux"
    const accountName = lastAccount.name;

    const folderNodeMap = {};
    async function buildFolderMap(folder, prefix = folder.name) {
        const path = `${accountName}/${prefix}`;
        folderNodeMap[path] = folder;

        if (folder.subFolders) {
            for (const sub of folder.subFolders) {
                await buildFolderMap(sub, `${prefix}/${sub.name}`);
            }
        }
    }

    for (const folder of lastAccount.folders) {
        await buildFolderMap(folder);
    }

    console.log("Arborescence des dossiers indexée:");
    for (const key in folderNodeMap) {
        console.log(`   - ${key}`);
    }

    const tagNodeMap = indexNodesByTags(mindMapData.nodeData);
    const allTagSet = new Set(tagNodeMap.keys());

    console.log("Index des tags construit:");
    for (const [tag, paths] of tagNodeMap.entries()) {
        console.log(`   - ${tag}: ${Array.from(paths).join(", ")}`);
    }

    const normalize = str => str?.toLowerCase().trim() || "";
    const copiedCache = {};
    const fullPathNonClasse = `${accountName}/MindMail/Non Classé`;
    const folderNonClasse = folderNodeMap[fullPathNonClasse];

    if (!folderNonClasse) {
        console.warn(`Dossier 'Non Classé' introuvable à "${fullPathNonClasse}"`);
    }

    for (const mail of allMails) {
        const subject = normalize(mail.subject);
        const author = normalize(mail.author);

        let bodyText = "";
        try {
            const fullMessage = await browser.messages.getFull(mail.id);
            for (const part of fullMessage.parts || []) {
                if (part.contentType === "text/plain" && part.body) {
                    bodyText = normalize(part.body);
                    break;
                }
            }
        } catch (err) {
        }

        const matchedPaths = new Set();

        for (const [nodePath, tagInfo] of tagNodeMap.entries()) {
            const { inheritedTags, ownTags, isDirectChildOfRoot } = tagInfo;

            const hasOwnTagMatch = [...ownTags].some(tag =>
                subject.includes(tag) || author.includes(tag) || bodyText.includes(tag)
            );

            let match = false;

            if (isDirectChildOfRoot) {
                match = hasOwnTagMatch;
            } else {
                const hasInheritedMatch = [...inheritedTags].some(tag =>
                    subject.includes(tag) || author.includes(tag) || bodyText.includes(tag)
                );
                match = hasOwnTagMatch && hasInheritedMatch;
            }

            if (match) {
                matchedPaths.add(nodePath);
            }
        }


        // Aucune correspondance avec un tag : copier dans "Non Classé"
        if (matchedPaths.size === 0) {
            if (!folderNonClasse) {
                continue;
            }

            const nodePath = "MindMail/Non Classé";
            if (!copiedCache[nodePath]) {
                const loadedIds = await loadCopiedMailIds(nodePath);
                console.log(`Mails déjà copiés pour ${nodePath} : ${loadedIds.length}`);

                copiedCache[nodePath] = new Set(loadedIds);
            }

            if (copiedCache[nodePath].has(mail.id)) {
                continue;
            }

            try {
                console.log(`Non Classé -> ${mail.subject} - <${mail.author}>`)
                await browser.messages.copy([mail.id], folderNonClasse.id);
                await saveCopiedMailId(nodePath, mail.id);
                copiedCache[nodePath].add(mail.id);
                allCopiedIds.add(mail.id);
                await storeNotification({
                    subject: mail.subject,
                    author: mail.author,
                    messageId: mail.id,
                    date: mail.date
                });
            } catch (err) {
                console.error(`Erreur de copie de "${mail.subject}" - <${mail.author}> dans "Non Classé": ${err}`);
            }
            continue;
        }

        // Sinon, on copie dans tous les dossiers liés aux tags
        for (const nodePath of matchedPaths) {
            const fullPath = `${accountName}/${nodePath}`;
            const folder = folderNodeMap[fullPath];

            if (!folder) {
                continue;
            }

            if (!copiedCache[nodePath]) {
                const loadedIds = await loadCopiedMailIds(nodePath);
                copiedCache[nodePath] = new Set(loadedIds);
            }

            if (copiedCache[nodePath].has(mail.id)) {
                continue;
            }

            console.log("Chargement des mails déjà copiés pour tous les dossiers :");
            for (const path in copiedCache) {
                console.log(`${path} -> ${copiedCache[path].size} mails`);
            }


            try {
                console.log(`${nodePath} -> ${mail.subject} - <${mail.author}>`)
                await browser.messages.copy([mail.id], folder.id);
                await saveCopiedMailId(nodePath, mail.id);
                copiedCache[nodePath].add(mail.id);
                allCopiedIds.add(mail.id);
            } catch (e) {
                console.error(`Erreur de copie de "${mail.subject}" - <${mail.author}> dans "${nodePath}":`, e);
            }
        }
    }
    console.log("Tous les mails ont été triés.");
}


function indexNodesByTags(node, path = "MindMail", tagMap = new Map(), isRoot = true, inheritedTags = new Set(), isDirectChild = false) {
    const normalize = tag => tag.trim().toLowerCase();
    const nodePath = isRoot ? path : `${path}/${node.topic}`.replace(/\/+/, '/');

    const ownTags = new Set();
    if (!isRoot && Array.isArray(node.tags)) {
        for (const rawTag of node.tags) {
            ownTags.add(normalize(rawTag));
        }
    }

    if (!isRoot) {
        tagMap.set(nodePath, {
            inheritedTags: new Set(inheritedTags),
            ownTags,
            isDirectChildOfRoot: isDirectChild
        });
    }

    const nextInherited = new Set(inheritedTags);
    ownTags.forEach(tag => nextInherited.add(tag));

    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            // Si ici on est à la racine, les enfants seront des enfants directs de la racine
            indexNodesByTags(child, nodePath, tagMap, false, nextInherited, isRoot);
        }
    }

    return tagMap;
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

    const mindMailFolder = await getMindMailFolder(account); // Récupère le dossier MindMail
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

            const fullPath = `MindMail/${parentPath}${nodeName}`;
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


// Méthode pour supprimer tous les éléments des notifications dans le stockage local
async function clearNotifications() {
    await browser.storage.local.remove('notifications');
    document.getElementById('notifications').innerHTML = '';
    console.log("All notifications removed from local storage.");
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
export async function saveCopiedMailId(nodePath, mailId) {
    const key = `copied_${encodeURIComponent(nodePath)}`;
    const result = await browser.storage.local.get(key);
    const existing = result[key] || [];
    if (!existing.includes(mailId)) {
        existing.push(mailId);
        await browser.storage.local.set({ [key]: existing });
    }
}

// Récupère les ID des mails classés
export async function loadCopiedMailIds(nodePath) {
    const key = `copied_${encodeURIComponent(nodePath)}`;
    const result = await browser.storage.local.get(key);
    return result[key] || [];
}


// Supprime le stockage local des ID de mails classés à utiliser et les dossiers de MindMail
export async function clearStoredFoldersData() {
    try {
        console.log("Suppression du dossier 'MindMail'...");

        const accounts = await browser.accounts.list();
        const account = accounts[accounts.length - 1];
        const mindMailFolder = account.folders.find(f => f.name === "MindMail");

        if (!mindMailFolder) {
            console.log("Le dossier 'MindMail' n'existe pas.");
            return;
        }

        // Suppression du dossier 'MindMail'
        await browser.folders.delete(mindMailFolder.id);
        console.log("Dossier 'MindMail' supprimé.");

        // Nettoyage du stockage local
        const allData = await browser.storage.local.get(null); // Récupère tout
        const keysToDelete = Object.keys(allData).filter(key => key.startsWith("copied_"));
        for (let key of keysToDelete) {
            await browser.storage.local.remove(key);
            console.log(`Données supprimées pour le dossier : ${key}`);
        }

        await clearNotifications();
        console.log("Stockage local supprimé.");

    } catch (error) {
        console.error("Erreur lors de la suppression :", error);
    }
}


// Déplace un mail d'id mailID depuis le dossier source vers le dossier cible
export async function moveMailToFolder(mailId, sourcePath, targetPath) {
    // Récupère les ID des dossiers source et cible
    const sourceFolderId = folderNodeMap[sourcePath];
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
        // Liste les messages du dossier source
        const sourceMessages = await getAllMessagesInFolder(sourceFolderId);

        const mail = sourceMessages.find(msg => msg.id === mailId);

        if (!mail) {
            console.warn(`Le mail d'ID ${mailId} n'est pas dans le dossier source.`);
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
            await removeCopiedMailId(sourcePath, mailId);
        }

    } catch (err) {
        console.error("Erreur déplacement mail :", err);
    }
}


// Supprime un ID de mail depuis le fichier de suivi associé à un dossier donné
async function removeCopiedMailId(path, idMail) {
    try {
        const storageKey = `copied-${path}`;
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

    // Format date without timezone
    return allMessages.map(msg => {
        const dateObj = new Date(msg.date);
        const formattedDate = dateObj.toString().replace(/\s*\([^)]*\)/, '');
        return {
            ...msg,
            date: formattedDate
        };
    });
}


async function getCurrentMindMailTree(mindMailFolder) {
    const buildTree = async (folder) => {
        const children = await browser.folders.getSubFolders(folder.id);
        const tree = {};
        for (const child of children) {
            tree[child.name] = await buildTree(child); // récursif
        }
        return tree;
    };

    return await buildTree(mindMailFolder);
}

// Comparer les arbres entre deux nœuds
function compareFolderTrees(tree1, tree2) {
    const keys1 = Object.keys(tree1);
    const keys2 = Object.keys(tree2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!compareFolderTrees(tree1[key], tree2[key])) return false;
    }
    return true;
}


// Fonction pour récupérer les tags précédemment stockés
async function getSavedTags() {
    const result = await browser.storage.local.get("tagsHierarchy");
    return result.tagsHierarchy ? JSON.parse(result.tagsHierarchy) : null;
}


// Fonction pour sauvegarder la nouvelle hiérarchie des tags
async function saveTags(tagsHierarchy) {
    await browser.storage.local.set({ tagsHierarchy: JSON.stringify(tagsHierarchy) });
}


// Fonction de comparaison des hiérarchies de tags
function compareTags(oldTags, newTags) {
    // Si les tailles sont différentes, les tags ont changé
    if (oldTags.length !== newTags.length) return false;

    // Comparer chaque tag
    for (let i = 0; i < oldTags.length; i++) {
        const oldTag = oldTags[i];
        const newTag = newTags[i];
        if (oldTag.node !== newTag.node || !arraysEqual(oldTag.tags, newTag.tags)) {
            return false;
        }
    }

    return true;
}


// Fonction utilitaire pour comparer des tableaux (tags)
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

// Fonction interface menu ////////////////////////////////////////////////////////////////

export async function getMailsFromFolder(folderName) {
    const results = [];
  
    const accounts = await browser.accounts.list();
  
    for (const account of accounts) {
        const rootFolders = account.folders || [];
    
        for (const folder of rootFolders) {
            if (folder.name === "MindMail") {
                const match = await findFolderIdByName(folder.subFolders, folderName);
                if (match) {
                    try {
                        let page = await messenger.messages.list(match);

                        while (page) {
                            const messages = page.messages || [];

                            for (let msg of messages) {
                                results.push({
                                    subject: msg.subject,
                                    author: msg.author,
                                    id: msg.id,
                                    date: msg.date,
                                    folderId: {
                                        accountId: folder.accountId,
                                        path: folder.path
                                    }
                                });
                            }

                            // Vérifie s'il y a d'autres pages de messages
                            if (page.id) {
                                page = await messenger.messages.continueList(page.id);
                            } else {
                                break; // Plus de messages à charger
                            }
                        }

                    } catch (e) {
                        console.warn(`Impossible de lire le dossier ${folder.name} :`, e);
                    }
                }
            }
        }
    }

    results.sort((a, b) => new Date(b.date) - new Date(a.date));
  
    return results;
}
  
async function findFolderIdByName(folders, name) {
    for (let folder of folders) {
        if (folder.name.toLowerCase() === name.toLowerCase()) {
            return { accountId: folder.accountId, path: folder.path };
        }
    
        if (folder.subFolders && folder.subFolders.length > 0) {
            const found = await findFolderIdByName(folder.subFolders, name);
            if (found) return found;
        }
    }
    return null;
}

export { folderNodeMap, createMindMapFolders, getMindMailFolder, getAllMessagesInFolder};