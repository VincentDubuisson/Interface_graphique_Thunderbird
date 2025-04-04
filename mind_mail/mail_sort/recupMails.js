import { getLeafNodes , getTags} from "./extractTerminalNodesName.js";

let accounts;

// Fonction pour exécuter la récupération des emails
export async function executeRecupEmails() {
    await initAccount();
    let mon_arborescence = await getLeafNodes();

    for (let mot of mon_arborescence) {
        console.log(`Email contenant ${mot} : \n\n`);
        await recupEmails(mot); 
    }

    // let tags_leaf1 = await getTags("leaf1"); 
    // let real_tags_leaf1 = tags_leaf1[0].split(" ");
    // console.log(real_tags_leaf1); 

    await createSubFolder(); 
    await initMainFolder(); 
    

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
    try {
        let folder = await browser.folders.create(account.rootFolder.id, "MindMail");

        console.log("Folder created:", folder.path, "dans le compte ", account);
    } catch (error) {
        console.error("Error creating folder:", error);
    }
}

async function createSubFolder() {
    let leaves = []; 
    let leavesNodes = await getLeafNodes();
    for (let leaf of leavesNodes) {
        console.log(leaf); 
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
   

    
}
