import { getLeafNodes } from "./extractTerminalNodesName.js";

let accounts;

// Fonction pour exécuter la récupération des emails
export async function executeRecupEmails() {
    await initAccount();
    let mon_arborescence = await getLeafNodes();
    console.log("Mon arborescence :", mon_arborescence);

    for (let mot of mon_arborescence) {
        console.log(`Email contenant ${mot} : \n\n`);
        await recupEmails(mot); 
    }

    await initMainFolder(); 
}

export async function initAccount() {
    accounts = await browser.accounts.list();
    console.log(`📬 Nombre de comptes trouvés : ${accounts.length}`);       
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
        let folder = await browser.folders.create(account, "MindMail");

        console.log("Folder created:", folder.path, "dans le compte ", account);
    } catch (error) {
        console.error("Error creating folder:", error);
    }
}
