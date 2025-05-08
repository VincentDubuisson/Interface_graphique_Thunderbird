const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "./popup/popup.css";
document.head.appendChild(style);

export function showMailPopup(mails, keyword) {
  const existingPopup = document.getElementById("mailPopup");
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement("div");
  popup.id = "mailPopup";

  const header = document.createElement("div");
  header.id = "popupHeader";

  if (keyword == "") {
    header.innerHTML = `<strong>Tout les mails</strong>`;
  } else {
    header.innerHTML = `<strong>Mails de ${keyword}</strong>`;
  }
  

  /*const closeBtn = document.createElement("span");
  closeBtn.id = "popupClose";
  closeBtn.innerText = "X";
  closeBtn.onclick = () => popup.remove();
  header.appendChild(closeBtn);*/

  popup.appendChild(header);

  const mailList = document.createElement("div");
  mailList.id = "popupMailList";

  if (mails.length === 0) {
    const noMail = document.createElement("p");
    noMail.innerText = "Aucun mail trouvé.";
    mailList.appendChild(noMail);
  } else {
    for (const mail of mails) {
      const mailCard = document.createElement("div");
      mailCard.className = "mailCard";

      const subject = document.createElement("div");
      subject.className = "mailSubject";
      subject.innerText = mail.subject || "(Pas de sujet)";

      const author = document.createElement("div");
      author.className = "mailAuthor";
      author.innerText = mail.author || "";

      const date = document.createElement("div");
      date.className = "mailDate";
      if (mail.date) {
          const d = new Date(mail.date);
          const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          date.innerText = formattedDate;
      } else {
          date.innerText = "";
      }


      const openBtn = document.createElement("button");
      openBtn.textContent = 'Ouvrir';
      openBtn.onclick = async () => {
        try {
            let tabs = await browser.mailTabs.query({});
            if (tabs.length > 0) {
                await browser.messageDisplay.open({
                    messageId: mail.id,
                    location: 'tab',
                    active: true
                });
            } else {
                console.error('Aucun onglet mail disponible pour ouvrir le message.');
            }
        } catch (error) {
            console.error('Erreur à l\'ouverture du mail :', error);
        }
    };
      mailCard.appendChild(subject);
      mailCard.appendChild(author);
      mailCard.appendChild(date);
      mailCard.appendChild(openBtn);

      mailList.appendChild(mailCard);
    }
  }

  popup.appendChild(mailList);
  document.body.appendChild(popup);
}