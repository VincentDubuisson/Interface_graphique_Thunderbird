browser.browserAction.onClicked.addListener(async () => {
  browser.tabs.create({ url: "./web_interface/index.html" });

  // Charger dynamiquement le fichier
  const moduleMail = await import("./mail_sort/mailSort.js");

  // Exécuter la récupération des emails
  moduleMail.executeMailSort();
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "getMailsByKeyword") {
    const keyword = message.keyword;
    try {
      const moduleMail = await import("./mail_sort/mailSort.js");
      const mails = await moduleMail.getMailsFromFolder(keyword);
      return Promise.resolve({ messages: mails });
    } catch (error) {
      console.error("Erreur lors de la récupération ciblée :", error);
      return Promise.resolve({ messages: [] });
    }
  }

  if (message.action === "getAllSortedMails") {
    try {
      const moduleMail = await import("./mail_sort/getMail.js");
      const mails = await moduleMail.getAllSortedMessages();
      return Promise.resolve({ messages: mails });
    } catch (error) {
      console.error("Erreur lors de la récupération globale :", error);
      return Promise.resolve({ messages: [] });
    }
  }
});