// Vide la corbeille du dernier compte présent dans ThunderBird, généralement le compte 'Dossier locaux'
export async function emptyTrashFolder() {
    let lastAccountTrashFolder = await getTrashFolderOfLastAccount();

    if (!lastAccountTrashFolder) {
      console.warn("Impossible de trouver la corbeille du dernier compte.");
      return;
    }

    await browser.Xpunge.emptyTrash(lastAccountTrashFolder);
}

async function getTrashFolderOfLastAccount() {
  // Récupérer tous les comptes
  const accounts = await browser.accounts.list();

  if (accounts.length === 0) {
    console.error("Aucun compte trouvé.");
    return null;
  }

  const lastAccount = accounts[accounts.length - 1];

  // Fonction récursive pour chercher le dossier "Trash"
  function findTrashFolder(folderList) {
    for (const folder of folderList) {
      if (folder.type === "trash") {
        return folder;
      }
      if (folder.subFolders && folder.subFolders.length > 0) {
        const subResult = findTrashFolder(folder.subFolders);
        if (subResult) return subResult;
      }
    }
    return null;
  }

  const trashFolder = findTrashFolder(lastAccount.folders);

  if (!trashFolder) {
    console.warn("Dossier Corbeille non trouvé pour ce compte.");
    return null;
  }

  console.log("Dossier Corbeille trouvé :", trashFolder);
  return trashFolder;
}