async function recupEmails() {
    try {
        console.log("✅ Début de la récupération des emails...");

        // Récupérer les comptes
        let accounts = await browser.accounts.list();
        console.log(`📬 Nombre de comptes trouvés : ${accounts.length}`);

        for (let account of accounts) {
            console.log(`📂 Compte : ${account.name}`);

            // ✅ Récupérer les informations complètes du compte
            let fullAccount = await browser.accounts.get(account.id);

            console.log(`📁 Nombre de dossiers trouvés pour ${account.name} : ${fullAccount.folders.length}`);



            // ✅ Explorer TOUS les dossiers et sous-dossiers
            await explorerDossiers(fullAccount.folders);
        }
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des emails :", error);
    }
}

// 📂 Fonction récursive pour explorer les dossiers et sous-dossiers
// async function explorerDossiers(folders) {
//     for (let folder of folders) {
//         console.log(`📂 Dossier : ${folder.name}`);

//         try {
//             // ✅ Récupérer les emails du dossier
//             let messageList = await browser.messages.list(folder.id);
//             let page = await messenger.messages.list(folder);

//             if (!messageList || !messageList.messages) {
//                 console.warn(`⚠️ Aucun email trouvé dans ${folder.name}`);
//                 continue;
//             }

             

//             let totalMessages = messageList.messages.length;
            
            

//             for (let message of messageList.messages) {
//                 console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
//             }
//         } catch (error) {
//             console.warn(`⚠️ Impossible de récupérer les emails pour ${folder.name} :`, error);
//         }

//         console.log(`📨 Nombre d'emails dans ${folder.name} : ${totalMessages}`);

//         // 🔄 Si ce dossier a des sous-dossiers, explorer récursivement
//         if (folder.subFolders && folder.subFolders.length > 0) {
//             await explorerDossiers(folder.subFolders);
//         }
//     }
// }


async function explorerDossiers(folders) {
    for (let folder of folders) {
        console.log(`📂 Dossier : ${folder.name}`);

        let totalMessages = 0;

        try {
            // ✅ Récupérer les emails du dossier
            let page = await messenger.messages.list(folder.id);  // Utilise folder.id ici
            let messageList = page.messages;
            
            if (!messageList || messageList.length === 0) {
                console.warn(`⚠️ Aucun email trouvé dans ${folder.name}`);
            } else {
                // Afficher les messages de la première page
                for (let message of messageList) {
                    console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                    totalMessages++; 
                }
            }

            // Pagination : récupération des pages suivantes
            while (page.id) {
                page = await messenger.messages.continueList(page.id);
                messageList = page.messages;

                if (!messageList || messageList.length === 0) {
                    console.warn(`⚠️ Aucun email trouvé dans ${folder.name}`);
                } else {
                    for (let message of messageList) {
                        console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
                        totalMessages++; 
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️ Impossible de récupérer les emails pour ${folder.name} :`, error);
        }

        console.log(`📨 Nombre d'emails dans ${folder.name} : ${totalMessages}`);

        // 🔄 Si ce dossier a des sous-dossiers, explorer récursivement
        if (folder.subFolders && folder.subFolders.length > 0) {
            await explorerDossiers(folder.subFolders);
        }
    }
}

// Exécuter la récupération des emails



  
recupEmails();
console.log('bonjour'); 




// recupEmails();