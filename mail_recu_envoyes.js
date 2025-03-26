async function checkEmailType(messageId) {
    try {
        const message = await messenger.messages.get(messageId);
        const type = message.folder.type === "inbox" ? "📩 Reçu" : "📤 Envoyé";
        console.log(`${type}: ${message.subject}`, message);
        return message; // Retourner le message pour utilisation ultérieure
    } catch (error) {
        console.error("Erreur lors de la récupération du message :", error);
        throw error; // Propager l'erreur si nécessaire
    }
}

async function getEmails(folderType) {
    try {
        const accounts = await messenger.accounts.list();
        let emails = [];

        for (const account of accounts) {
            for (const folder of account.folders) {
                if (folder.type === folderType) {
                    try {
                        // Récupère TOUS les messages sans limite
                        const { messages } = await messenger.messages.list(folder);
                        emails.push(...messages);
                    } catch (error) {
                        console.warn(`Erreur avec le dossier ${folder.name}:`, error);
                    }
                }
            }
        }

        console.log(`📨 ${emails.length} emails (${folderType})`);
        return emails.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error("Erreur critique:", error);
        return [];
    }
}


let currentPage = 0;
const emailsPerPage = 50;
let allEmails = []; // Stockera tous les emails fusionnés

async function displayEmails() {
    const emailList = document.getElementById("emails");
    if (!emailList) return;

    emailList.innerHTML = `<li class="loading">Chargement en cours...</li>`;

    try {
        const [inboxEmails, sentEmails] = await Promise.all([
            getEmails("inbox"),
            getEmails("sent")
        ]);

        // Fusionner et trier tous les emails
        allEmails = [
            ...inboxEmails.map(e => ({...e, type: "received"})),
            ...sentEmails.map(e => ({...e, type: "sent"}))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        emailList.innerHTML = "";

        if (allEmails.length === 0) {
            emailList.innerHTML = "<li class='empty'>Aucun email trouvé</li>";
            return;
        }

        // Calcul des emails à afficher
        const startIdx = currentPage * emailsPerPage;
        const endIdx = startIdx + emailsPerPage;
        const emailsToShow = allEmails.slice(startIdx, endIdx);

        // Afficher les emails
        emailsToShow.forEach(email => {
            const li = document.createElement("li");
            li.className = `email-item ${email.type}`;
            li.innerHTML = `
                <div class="email-header">
                    <span class="type">${email.type === "received" ? "📩" : "📤"}</span>
                    <span class="subject">${email.subject || "Sans sujet"}</span>
                </div>
                <div class="email-details">
                    <span class="author">${email.author || "Inconnu"}</span>
                    <span class="date">${new Date(email.date).toLocaleString()}</span>
                </div>
            `;
            emailList.appendChild(li);
        });

        // Pagination
        const totalPages = Math.ceil(allEmails.length / emailsPerPage);
        if (totalPages > 1) {
            const pagination = document.createElement("div");
            pagination.className = "pagination";
            
            // Bouton Précédent
            const prevBtn = document.createElement("button");
            prevBtn.textContent = "◄ Précédent";
            prevBtn.disabled = currentPage === 0;
            prevBtn.onclick = () => {
                currentPage--;
                displayEmails();
            };
            
            // Info page
            const pageInfo = document.createElement("span");
            pageInfo.className = "page-info";
            pageInfo.textContent = `Page ${currentPage + 1}/${totalPages}`;
            
            // Bouton Suivant
            const nextBtn = document.createElement("button");
            nextBtn.textContent = "Suivant ►";
            nextBtn.disabled = currentPage >= totalPages - 1;
            nextBtn.onclick = () => {
                currentPage++;
                displayEmails();
            };
            
            pagination.appendChild(prevBtn);
            pagination.appendChild(pageInfo);
            pagination.appendChild(nextBtn);
            emailList.appendChild(pagination);
        }

    } catch (error) {
        emailList.innerHTML = `
            <li class="error">
                ❌ Erreur de chargement: ${error.message}
            </li>
        `;
        console.error("Display error:", error);
    }
}

// Gestion des événements
document.addEventListener("DOMContentLoaded", () => {
    console.log("Extension Email Viewer initialisée");
    displayEmails();

    // Rafraîchissement périodique (optionnel)
    setInterval(() => {
        if (document.visibilityState === "visible") {
            displayEmails();
        }
    }, 300000); // 5 minutes
});