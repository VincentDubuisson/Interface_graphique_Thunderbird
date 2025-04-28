browser.browserAction.onClicked.addListener(async () => {
  browser.tabs.create({ url: "index.html" });

  // Charger dynamiquement le fichier
  const moduleMail = await import("./mail_sort/recupMails.js");

  // Exécuter la récupération des emails
  moduleMail.executeRecupEmails(); 
});
browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "getMailsByKeyword") {
    const keyword = message.keyword;
    try {
      const moduleMail = await import("./mail_sort/recupMails.js");
      const mails = await moduleMail.getMailsFromFolder(keyword);
      return Promise.resolve({ messages: mails });
    } catch (error) {
      console.error("Erreur lors de la récupération ciblée :", error);
      return Promise.resolve({ messages: [] });
    }
  }
});