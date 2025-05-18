const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "./popup/popup.css";
document.head.appendChild(style);

// Fonction qui trouve le contenu des mails et l'affiche
function findTextPart(parts) {
  let plainPart = null;

  for (const part of parts) {
    const ct = part.contentType?.toLowerCase() || "";

    // 1 - on renvoie tout de suite le HTML dès qu'on le trouve
    if (ct.includes("text/html")) {
      return part;
    }
    // 2 - mais on garde en mémoire le plain si jamais on ne trouve pas de HTML
    if (!plainPart && ct.includes("text/plain")) {
      plainPart = part;
    }
    // 3 - on descend récursivement
    if (part.parts) {
      const nested = findTextPart(part.parts);
      if (nested) {
        // si c'est du HTML, on remonte tout de suite
        if (nested.contentType.toLowerCase().includes("text/html")) {
          return nested;
        }
        // sinon on note éventuellement un plain imbriqué
        if (!plainPart && nested.contentType.toLowerCase().includes("text/plain")) {
          plainPart = nested;
        }
      }
    }
  }

  // si pas de HTML, on renvoie le plain stocké (ou null)
  return plainPart;
}

// Cherche une pièce jointe dans le mail
function hasAttachment(parts) {
  for (const part of parts) {
    const type = part.contentType?.toLowerCase();
    const dispo = part.contentDisposition?.toLowerCase();

    // Si le type est un binaire, document ou image
    const isAttachmentByType = type && (
      type.startsWith("application/")
    );

    // Si marqué explicitement comme pièce jointe
    const isAttachmentByDisposition = dispo === "attachment";

    if (isAttachmentByType || isAttachmentByDisposition) {
      return true;
    }

    // Recherche récursive
    if (part.parts && hasAttachment(part.parts)) {
      return true;
    }
  }
  return false;
}


export function showMailPopup(mails, keyword) {
  const existingPopup = document.getElementById("mailPopup");
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement("div");
  popup.id = "mailPopup";

  const header = document.createElement("div");
  header.id = "popupHeader";
  header.innerHTML = keyword
    ? `<strong>Mails de ${keyword} (${mails.length})</strong>`
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

      const subject = document.createElement("div");
      subject.className = "mailSubject";
      subject.textContent = mail.subject || "(Pas de sujet)";

      const date = document.createElement("div");
      date.className = "mailDate";
      if (mail.date) {
        const d = new Date(mail.date);
        date.textContent = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      }

      const author = document.createElement("div");
      author.className = "mailAuthor";
      author.textContent = mail.author || "";

      const openBtn = document.createElement("button");
      openBtn.textContent = 'Ouvrir';
      openBtn.onclick = () => browser.messageDisplay.open({
        messageId: mail.id,
        location: 'tab',
        active: true
      });

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

            const parser = new DOMParser();
            const doc    = parser.parseFromString(textPart.body, "text/html");
            const head   = doc.querySelector("head")?.innerHTML || "";
            const body   = doc.querySelector("body")?.innerHTML || "";

            bodyDiv.appendChild(iframe);
            mailCard.appendChild(bodyDiv);

            // Injecter le HTML dans l'iframe
            iframe.onload = () => {
              iframe.contentDocument.open();
              iframe.contentDocument.write(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="UTF-8">
                    ${head}
                  </head>
                  <body>${body}</body>
                </html>
              `);
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

      // Ajout de l’icône et du contenu à la carte
      const mailIcon = document.createElement("img");
      mailIcon.className = "mailIcon";
      mailIcon.src = mail.isSent ? "../../../ressources/send.png" : "../../../ressources/receive-mail.png";
      mailIcon.alt = mail.isSent ? "Envoyé" : "Reçu";

      // Ligne 1
      const row1 = document.createElement("div");
      row1.className = "mailRow";

      // Colonne 1 : icône (ligne 1)
      const iconContainer = document.createElement("div");
      iconContainer.className = "iconContainer";
      iconContainer.appendChild(mailIcon);

      // Colonne 2 : sujet (ligne 1)
      const subjectContainer = document.createElement("div");
      subjectContainer.className = "subjectContainer";
      subjectContainer.appendChild(subject);

      // Colonne 3 : date (ligne 1)
      const dateContainer = document.createElement("div");
      dateContainer.className = "dateContainer";
      dateContainer.appendChild(date);

      // Ligne 2
      const row2 = document.createElement("div");
      row2.className = "mailRow";

      // Colonne 1 : vide (ligne 2, pour alignement)
      const emptyCol = document.createElement("div");
      emptyCol.className = "iconContainer"; // même taille que icône

      browser.messages.getFull(mail.id).then(full => {
        if (hasAttachment(full.parts || [])) {
          const attachmentIcon = document.createElement("img");
          attachmentIcon.src = "../../../ressources/trombone.png";
          attachmentIcon.alt = "Pièce jointe";
          attachmentIcon.className = "attachmentIcon";

          emptyCol.appendChild(attachmentIcon);
        }
      });

      // Colonne 2 : auteur (ligne 2)
      const authorContainer = document.createElement("div");
      authorContainer.className = "subjectContainer"; // même taille que sujet
      authorContainer.appendChild(author);

      // Colonne 3 : boutons (ligne 2)
      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "buttonContainer";
      buttonsContainer.appendChild(openBtn);
      buttonsContainer.appendChild(viewBtn);

      // Ajout dans lignes
      row1.appendChild(iconContainer);
      row1.appendChild(subjectContainer);
      row1.appendChild(dateContainer);

      row2.appendChild(emptyCol);
      row2.appendChild(authorContainer);
      row2.appendChild(buttonsContainer);

      // Ajout au mailCard
      mailCard.appendChild(row1);
      mailCard.appendChild(row2);

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
      const bodyElement = mailCard.querySelector(".mailBody");
      const content = bodyElement ? bodyElement.textContent.toLowerCase() : "";

      // Afficher ou masquer la carte selon si le texte de la recherche correspond
      if (subject.includes(searchQuery) || author.includes(searchQuery) || content.includes(searchQuery)) {
        mailCard.style.display = "";
      } else {
        mailCard.style.display = "none";
      }
    });
  });
}