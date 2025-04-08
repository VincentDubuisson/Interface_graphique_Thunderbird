browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({
        url: "index.html"
    });
});


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
          await explorerDossiers(fullAccount.folders, account.id);
      }
  } catch (error) {
      console.error("❌ Erreur lors de la récupération des emails :", error);
  }
}

// 📂 Fonction récursive pour explorer les dossiers et sous-dossiers
async function explorerDossiers(folders, accountId) {
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

              // Vérifier si l'email est classé
              if (!isEmailClassified(message)) {
                  console.log(`📥 Email non classé trouvé : ${message.subject}`);

                  // Déplacer l'email dans le dossier "non classés"
                  await moveToNonClassesFolder(message, accountId);

                  // Update messageId after moving
                  let updatedMessageId = message.id; // Assuming message.id is updated after moving
                  console.log(`Updated messageId: ${updatedMessageId}`);

                  // Store notification for non-classified email
                  await storeNotification({
                      subject: message.subject,
                      author: message.author,
                      messageId: updatedMessageId
                  });
              }
          }
      } catch (error) {
          console.warn(`⚠️ Impossible de récupérer les emails pour ${folder.name} :`, error);
      }

      // 🔄 Si ce dossier a des sous-dossiers, explorer récursivement
      if (folder.subFolders && folder.subFolders.length > 0) {
          await explorerDossiers(folder.subFolders, accountId);
      }
  }
}

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

// Exécuter la récupération des emails
recupEmails();
