

let accounts; 

async function initAccount() {
    accounts = await browser.accounts.list();
    console.log(`📬 Nombre de comptes trouvés : ${accounts.length}`);       
}



async function recupEmails(filter) {
    try {
        console.log("✅ Début de la récupération des emails...");

        for (let account of accounts) {
        //     console.log(`📂 Compte : ${account.name}`);

            // ✅ Récupérer les informations complètes du compte
            let fullAccount = await browser.accounts.get(account.id);

            // console.log(`📁 Nombre de dossiers trouvés pour ${account.name} : ${fullAccount.folders.length}`);



            // ✅ Explorer TOUS les dossiers et sous-dossiers
            await explorerDossiers(fullAccount.folders, filter);
        }
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des emails :", error);
    }
}



async function explorerDossiers(folders, filter) {
    for (let folder of folders) {
        // console.log(`📂 Dossier : ${folder.name}`);

        let totalMessages = 0;

        if(folder.name == "Tous les messages") {
            try {
                // ✅ Récupérer les emails du dossier
                let page = await messenger.messages.list(folder.id);  // Utilise folder.id ici
                let messageList = page.messages;
                
                if (!messageList || messageList.length === 0) {
                    // console.warn(`⚠️ Aucun email trouvé dans ${folder.name}`);
                } else {
                    // Afficher les messages de la première page
                    for (let message of messageList) {
                        if (filter == "all") {
                            console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                            totalMessages++; 
                        }
    
                        else {
                            if (message.subject.toLowerCase().includes(filter.toLowerCase())) {
                                console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                                totalMessages++; 
                            }
                            
                        }
                    }
                }
    
                // Pagination : récupération des pages suivantes
                while (page.id) {
                    page = await messenger.messages.continueList(page.id);
                    messageList = page.messages;
    
                    if (!messageList || messageList.length === 0) {
                        // console.warn(`⚠️ Aucun email trouvé dans ${folder.name}`);
                    } else {
                        for (let message of messageList) {
                            if (filter == "all") {
                                console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                                totalMessages++; 
                            }
    
                            else {
                                if (message.subject.toLowerCase().includes(filter.toLowerCase())) {
                                    console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                                    totalMessages++; 
                                }
                                
                            }
                            
                            
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Impossible de récupérer les emails pour ${folder.name} :`, error);
            }
        }

        

        // console.log(`📨 Nombre d'emails dans ${folder.name} : ${totalMessages}`);

        // 🔄 Si ce dossier a des sous-dossiers, explorer récursivement
        if (folder.subFolders && folder.subFolders.length > 0) {
            await explorerDossiers(folder.subFolders, filter);
        }
    }
}



// Exécuter la récupération des emails


// let mon_arborescence = ["microsoft", ]

(async () => {
    await initAccount();
    let mon_arborescence = ["linkedin", "microsoft", "github", "Université"]; 

    for (let mot of mon_arborescence) {
        console.log(`Email contenant ${mot} : \n\n`);
        await recupEmails(mot); 
    }

    
})();




// recupEmails();