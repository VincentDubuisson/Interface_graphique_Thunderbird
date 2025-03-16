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
async function explorerDossiers(folders) {
    for (let folder of folders) {
        console.log(`📂 Dossier : ${folder.name}`);

        try {
            // ✅ Récupérer les emails du dossier
            let messageList = await browser.messages.list(folder.id);

            if (!messageList || !messageList.messages) {
                console.warn(`⚠️ Aucun email trouvé dans ${folder.name}`);
                continue;
            }

            let totalMessages = messageList.messages.length;
            console.log(`📨 Nombre d'emails dans ${folder.name} : ${totalMessages}`);

            for (let message of messageList.messages) {
                console.log(`📧 Sujet : ${message.subject}, Expéditeur : ${message.author}`);
            }
        } catch (error) {
            console.warn(`⚠️ Impossible de récupérer les emails pour ${folder.name} :`, error);
        }

        // 🔄 Si ce dossier a des sous-dossiers, explorer récursivement
        if (folder.subFolders && folder.subFolders.length > 0) {
            await explorerDossiers(folder.subFolders);
        }
    }
}

// Exécuter la récupération des emails
recupEmails();
