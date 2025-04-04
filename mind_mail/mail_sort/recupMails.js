import { getLeafNodes , getTags} from "./extractTerminalNodesName.js";

let accounts;
let mindMailFolder; 

// Fonction pour exécuter la récupération des emails
export async function executeRecupEmails() {
   
    await initAccount();
    // await reset(); 
    let mon_arborescence = await getLeafNodes();

    for (let mot of mon_arborescence) {
        console.log(`Email contenant ${mot} : \n\n`);
        await recupEmails(mot); 
    }

    // let tags_leaf1 = await getTags("leaf1"); 
    // let real_tags_leaf1 = tags_leaf1[0].split(" ");
    // console.log(real_tags_leaf1); 

   
    await initMainFolder(); 
    await createSubFolder(); 
    

    // let leafNodes = getLeafNodes(); 
    // for(let leaf of leafNodes) {
    //     console.log(leaf); 
    // }
    
   

    
}

export async function initAccount() {
    accounts = await browser.accounts.list();
    console.log(`📬 Nombre de comptes trouvés : ${accounts.length}`);
    for (let account of accounts) {
        console.log(account.name); 
    }       
}

export async function recupEmails(filter) {
    try {
        console.log("✅ Début de la récupération des emails...");
        for (let account of accounts) {
            let fullAccount = await browser.accounts.get(account.id);
            await explorerDossiers(fullAccount.folders, filter);
        }
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des emails :", error);
    }
}

async function explorerDossiers(folders, filter) {
    for (let folder of folders) {
        let totalMessages = 0;
        if (folder.name == "Tous les messages") {
            try {
                let page = await messenger.messages.list(folder.id);
                let messageList = page.messages;
                
                if (messageList && messageList.length > 0) {
                    for (let message of messageList) {
                        if (filter === "all" || message.subject.toLowerCase().includes(filter.toLowerCase())) {
                            console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                            totalMessages++; 
                        }
                    }
                }
                
                while (page.id) {
                    page = await messenger.messages.continueList(page.id);
                    messageList = page.messages;

                    if (messageList && messageList.length > 0) {
                        for (let message of messageList) {
                            if (filter === "all" || message.subject.toLowerCase().includes(filter.toLowerCase())) {
                                console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                                totalMessages++; 
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Impossible de récupérer les emails pour ${folder.name} :`, error);
            }
        }

        if (folder.subFolders && folder.subFolders.length > 0) {
            await explorerDossiers(folder.subFolders, filter);
        }
    }
}

async function initMainFolder(mailAdress = "none") {
    let account; 
    if (mailAdress == "none") account = accounts[0]; // Select the first account
    else {
        for (let acc of accounts) {
            if (acc.name == mailAdress) account = acc
        }
    }
    if (!account) {
        console.error("No account found.");
        return;
    }
    let folder; 
    try {

        folder = await browser.folders.create(account.rootFolder.id, "MindMail");
        console.log("Folder created:", folder.path, "dans le compte ", account);
        
    } catch (error) {
        console.error("Error creating folder:", error);
    }
    return folder; 
}

async function createSubFolder(mailAdress = "none") {
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

        if (!account) {
            console.error("❌ Aucun compte ne correspond à l'adresse entrée !");
            return;
        }
    }

    mindMailFolder = await getMindMailFolder(account);

    if (!mindMailFolder) {
        console.error("❌ Dossier 'MindMail' introuvable pour ce compte !");
        return;
    }

    const leavesNodes = await getLeafNodes();

    // for (let leaf of leavesNodes) {
    //     const tags = await getTags(leaf);
    //     console.log(`📎 Tags de ${leaf}:`);

    //     for (let tag of tags) {
    //         const safeTag = tag.replace(/[\\/:"*?<>|]+/g, "_");
    //         
    //     }
    // }

    for (let leaf of leavesNodes) {
        try {
            const subFolder = await browser.folders.create(mindMailFolder.id, leaf);
            console.log("📂 Sous-dossier créé :", subFolder.path, "dans le compte", account.name);
        } catch (err) {
            console.error(`❌ Erreur lors de la création du dossier '${leaf}':`, err);
        }
    }
}


    async function getMindMailFolder(account) {
        let fullAccount = await browser.accounts.get(account.id);
        let rootFolders = fullAccount.folders;
    
        for (let folder of rootFolders) {
            if (folder.name === "MindMail") {
                return folder;
            }
        }
    
        console.warn("📂 Le dossier 'MindMail' n'a pas été trouvé.");
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
   

    

