const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "./popup/popup.css";
document.head.appendChild(style);

// Fonction qui trouve le contenu des mails et l'affiche
function findTextPart(parts) {
  for (const part of parts) {
    if (part.contentType?.includes("text/html") || part.contentType?.includes("text/plain")) {
      return part;
    }
    if (part.parts) {
      const nested = findTextPart(part.parts);
      if (nested) return nested;
    }
  }
  return null;
}

export function showMailPopup(mails, keyword) {
  const existingPopup = document.getElementById("mailPopup");
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement("div");
  popup.id = "mailPopup";

  const header = document.createElement("div");
  header.id = "popupHeader";
  header.innerHTML = keyword
    ? `<strong>Mails de ${keyword}</strong>`
    : `<strong>Tous les mails</strong>`;
  popup.appendChild(header);

  const mailList = document.createElement("div");
  mailList.id = "popupMailList";

  if (mails.length === 0) {
    mailList.innerHTML = "<p>Aucun mail trouvé.</p>";
  } else {
    mails.forEach(mail => {
      if (!mail.id) return; // Ignore les mails sans ID

      const mailCard = document.createElement("div");
      mailCard.className = "mailCard";

      // Créer l'icône pour le mail envoyé ou reçu
      const mailIcon = document.createElement("img");
      mailIcon.className = "mailIcon";
      if (mail.isSent) {
        mailIcon.src = "../../../ressources/send.png"; // Icône pour les mails envoyés
        console.log("Icône envoyée :", mailIcon.src);
        mailIcon.alt = "Envoyé";
      } else {
        mailIcon.src = "../../../ressources/receive-mail.png"; // Icône pour les mails reçus
        console.log("Icône reçue :", mailIcon.src);
        mailIcon.alt = "Reçu";
      }

      // Ajouter l'icône à la carte du mail
      mailCard.appendChild(mailIcon);

      const subject = document.createElement("div");
      subject.className = "mailSubject";
      subject.textContent = mail.subject || "(Pas de sujet)";

      const author = document.createElement("div");
      author.className = "mailAuthor";
      author.textContent = mail.author || "";

      const date = document.createElement("div");
      date.className = "mailDate";
      if (mail.date) {
        const d = new Date(mail.date);
        date.textContent = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      }

      const openBtn = document.createElement("button");
      openBtn.textContent = 'Ouvrir';
      openBtn.onclick = () => browser.messageDisplay.open({
        messageId: mail.id,
        location: 'tab',
        active: true
      });

      // BOUTON VOIR CONTENU MAIL
      const viewBtn = document.createElement("button");
      viewBtn.className = "viewMailButton";
      viewBtn.textContent = 'Voir Contenu';
      viewBtn.onclick = async () => {
        const existingBody = mailCard.querySelector(".mailBody");

        // Toggle : si le contenu est déjà là, on le retire
        if (existingBody) {
          existingBody.remove();
          viewBtn.textContent = "Voir Contenu";
          return;
        }

        try {
          // 1. Récupère le contenu COMPLET du mail
          const fullMessage = await browser.messages.getFull(mail.id);

          // 2. Debug: Affiche la structure dans la console
          console.log("Structure du mail:", fullMessage);

          const textPart = findTextPart(fullMessage.parts || []);

          const bodyDiv = document.createElement("div");
          bodyDiv.className = "mailBody";

          if (textPart && textPart.body && textPart.contentType.includes("text/html")) {
            const iframe = document.createElement("iframe");
            iframe.style.width = "100%";
            iframe.style.minHeight = "300px";
            iframe.style.border = "1px solid #ccc";

            bodyDiv.appendChild(iframe);
            mailCard.appendChild(bodyDiv);

            // Injecter le HTML dans l'iframe
            iframe.onload = () => {
              iframe.contentDocument.open();
              iframe.contentDocument.write(textPart.body);
              iframe.contentDocument.close();
            };
          } else if (textPart && textPart.body) {
            // Affichage texte brut
            bodyDiv.innerHTML = `<pre>${textPart.body}</pre>`;
            mailCard.appendChild(bodyDiv);
          }
          viewBtn.textContent = "Cacher Contenu";

        } catch (error) {
          console.error("Erreur:", error);
          alert("Impossible de charger le contenu. Voir la console pour les détails.");
        }
      };

      mailCard.append(subject, author, date, openBtn, viewBtn);
      mailList.appendChild(mailCard);
    });
  }

  popup.appendChild(mailList);
  document.body.appendChild(popup);

  const searchContainer = document.createElement("div");
  searchContainer.id = "popupSearchContainer";
  const searchInput = document.createElement("input");
  searchInput.id = "popupSearchInput";
  searchInput.type = "text";
  searchInput.placeholder = "Rechercher un mail...";

  // Ajouter le champ de recherche dans le conteneur
  searchContainer.appendChild(searchInput);
  popup.insertBefore(searchContainer, mailList); // Ajoute le champ avant la liste des mails

  searchInput.addEventListener("input", () => {
    const searchQuery = searchInput.value.toLowerCase();
    const mailCards = mailList.querySelectorAll(".mailCard");

    mailCards.forEach(mailCard => {
      const subject = mailCard.querySelector(".mailSubject").textContent.toLowerCase();
      const author = mailCard.querySelector(".mailAuthor").textContent.toLowerCase();

      // Afficher ou masquer la carte selon si le texte de la recherche correspond
      if (subject.includes(searchQuery) || author.includes(searchQuery)) {
        mailCard.style.display = "";
      } else {
        mailCard.style.display = "none";
      }
    });
  });
}
