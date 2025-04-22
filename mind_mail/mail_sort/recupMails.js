import { getLeafNodes , getTags, getTagHierarchy } from "./extractTerminalNodesName.js";
import { extractNodeNames } from '../mind_map/saveMindMap.js';
import { getSavedMindMap } from "../mind_map/loadMindMap.js";

let accounts;


// Fonction principale qui initialise le système et lance la récupération des mails
export async function executeRecupEmails() {
    
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
    await browseNode(mindMapData.nodeData, allMails);
}



// Récupère la liste des comptes de messagerie configurés
export async function initAccount() {
    accounts = await browser.accounts.list();
    console.log(`📬 Nombre de comptes trouvés : ${accounts.length}`);
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


// Parcourt récursivement la carte mentale pour trier les mails selon les tags
async function browseNode(node, baseMails) {
    const normalizeTag = tag => tag.trim().toLowerCase();
    const ownTags = (node.tags || []).map(normalizeTag);
    const hasTags = ownTags.length > 0;

    let totalMessages = 0;
    const filteredMails = [];

    if (hasTags) {
        // Si le nœud contient des tags, on filtre les mails correspondants
        for (let mail of baseMails) {
            const subject = mail.subject?.toLowerCase() || "";
            const author = mail.author?.toLowerCase() || "";

            const hasMatchingTag = ownTags.some(tag => {
                return tag === "all" || subject.includes(tag) || author.includes(tag);
            });

            if (hasMatchingTag) {
                console.log(`    📧 ${mail.subject} - ${mail.author}`);
                filteredMails.push(mail);
                totalMessages++;
            }
        }

        if (totalMessages > 0) {
            console.log(`✅ Noeud "${node.topic}" avec tags: ${ownTags.join(", ")} → ${totalMessages} mails trouvés.`);
        } else {
            console.log(`❌ Aucun mail trouvé pour le noeud "${node.topic}" avec les tags : ${ownTags.join(", ")}`);
        }
    } else {
        // Si pas de tags, on transmet tous les mails aux enfants sans filtrage
        filteredMails.push(...baseMails);
        console.log(`➡️  Noeud "${node.topic}" sans tag → mails transmis aux enfants sans filtrage`);
    }

    // Appel récursif sur les enfants du nœud
    if (node.children && node.children.length > 0) {
        for (let child of node.children) {
            await browseNode(child, filteredMails);
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


// Créer tous les sous-dossiers correspondant aux noeuds de la carte mentale
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

    // Récupère la structure hiérarchique des nœuds à partir de la carte mentale
    const tree = extractNodeNames(await getSavedMindMap());
    console.log("Arborescence à créer :", tree);

    // Lance la création des dossiers
    await createMindMapFolders(tree, mindMailFolder.id);
}


// Créer récursivement les dossiers et sous-dossiers selon l’arborescence de la carte mentale
async function createMindMapFolders(tree, parentFolderId) {
    // Récupère les dossiers enfants existants
    const parentInfo = await browser.folders.getSubFolders(parentFolderId);
    const existingNames = parentInfo.map(f => f.name);

    for (let nodeName in tree) {
        try {
            const safeName = nodeName.replace(/[\\/:"*?<>|]+/g, "_");

            // Vérifie si le dossier existe déjà
            if (existingNames.includes(safeName)) {
                console.log(`Le dossier '${safeName}' existe déjà, création ignorée.`);
                const existingFolder = parentInfo.find(f => f.name === safeName);
                await createMindMapFolders(tree[nodeName], existingFolder.id); // Appel récursif même si le dossier existe
                continue;
            }

            // Crée le dossier si inexistant
            const newFolder = await browser.folders.create(parentFolderId, safeName);
            console.log("Dossier créé :", newFolder.path);

            // Appel récursif pour les sous-dossiers
            await createMindMapFolders(tree[nodeName], newFolder.id);
        } catch (err) {
            console.error(`Erreur création dossier '${nodeName}':`, err);
        }
    }
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



async function reset(mailAdress="none") {
    let account;

    if (mailAdress === "none") {
        account = accounts[0]; 
    } else {
        for (let acc of accounts) {
            if (acc.name === mailAdress) {
                account = acc;  
                break;
            }
        }
    }

    let fullAccount = await browser.accounts.get(account.id);
        let rootFolders = fullAccount.folders;
    
        for (let folder of rootFolders) {
            if (folder.name === "MindMail") {
                await browser.folders.delete(folder.id);
                return; 
            }
        }
    
        console.warn("📂 Le dossier 'MindMail' n'a pas été trouvé.");
        
    

}

    // let account; 
    // if (mailAdress == "none") account = accounts[0]; // Select the first account
    // else {
    //     for (let acc of accounts) {
    //         if (acc.name == mailAdress) account = acc
    //     }
    // }
    // if (!account) {
    //     console.error("No account found.");
    //     return;
    // }
    // try {
    //     let folder = await browser.folders.create(account.rootFolder, "MindMail");

    //     console.log("Folder created:", folder.path, "dans le compte ", account);
    // } catch (error) {
    //     console.error("Error creating folder:", error);
    // }
   


  
// Fonction pour vérifier si un email est classé
function isEmailClassified(message) {
    // Logique pour vérifier si l'email est classé
    // Par exemple, vérifier un champ spécifique ou une étiquette
    // Retourner true si classé, sinon false
    return message.tags && message.tags.length > 0; // Exemple de vérification
  }

  // Fonction pour déplacer l'email dans le dossier "non classés"
async function moveToNonClassesFolder(message, accountId) {
    try {
        // Obtenir ou créer le dossier "non classés"
        let nonClassesFolder = await getOrCreateNonClassesFolder(accountId);
  
        // Déplacer l'email
        await browser.messages.move([message.id], nonClassesFolder.id);
        console.log(`📥 Email déplacé vers le dossier "non classés" : ${message.subject}`);
    } catch (error) {
        console.error(`❌ Erreur lors du déplacement de l'email : ${message.subject}`, error);
    }
  }
  
  async function getOrCreateNonClassesFolder(accountId) {
    let account = await browser.accounts.get(accountId);
  
    // Find the "Inbox" folder
    let inboxFolder = account.folders.find(folder => folder.name === "Inbox");
    if (!inboxFolder) {
      console.error("❌ Inbox folder not found.");
      return null;
    }
    // Check for the "non classés" subfolder within "Inbox"
  let nonClassesFolder = inboxFolder.subFolders.find(folder => folder.name === "non classés");

  if (!nonClassesFolder) {
    try {
      // Create the "non classés" subfolder under "Inbox"
      nonClassesFolder = await browser.folders.create(inboxFolder.id, "non classés");
      console.log(`📁 Dossier "non classés" créé sous Inbox.`);
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.warn(`⚠️ Le dossier "non classés" existe déjà sous Inbox.`);
        // Refresh account folders and find the "non classés" folder again
        account = await browser.accounts.get(accountId);
        inboxFolder = account.folders.find(folder => folder.name === "Inbox");
        nonClassesFolder = inboxFolder.subFolders.find(folder => folder.name === "non classés");
        if (!nonClassesFolder) {
          console.error("❌ Échec de la récupération du dossier existant 'non classés'.");
          return null;
        }
      } else {
        throw error;
      }
    }
  }

  return nonClassesFolder;
}

async function storeNotification(notification) {
    let notifications = await browser.storage.local.get('notifications');
    notifications = notifications.notifications || [];
    notifications.push(notification);
    await browser.storage.local.set({notifications});
}

