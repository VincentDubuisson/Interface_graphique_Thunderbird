import { getMindMailFolder } from './mailSort.js'

export async function getAllSortedMessages() {
    const results = [];
    const accounts = await browser.accounts.list();
    const account = accounts[accounts.length - 1];
    const mindMailFolder = await getMindMailFolder(account)

    const fullSubFolders = await browser.folders.getSubFolders({
        accountId: mindMailFolder.accountId,
        path: mindMailFolder.path
    });

    for (const folder of fullSubFolders) {
        await collectMessages(folder, results);
    }
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    return results;
}

async function collectMessages(folder, results) {
    // Ignore le dossier "Non Classé"
    if (folder.name === "Non Classé") {
        return;
    }

    try {
        let page = await messenger.messages.list({ accountId: folder.accountId, path: folder.path });

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