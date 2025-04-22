browser.browserAction.onClicked.addListener(async () => {
  browser.tabs.create({ url: "index.html" });

  // Charger dynamiquement le fichier
  const moduleMail = await import("./mail_sort/recupMails.js");

  // Exécuter la récupération des emails
  moduleMail.executeRecupEmails(); 
});