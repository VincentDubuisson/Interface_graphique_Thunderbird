// Fetch notifications from storage and display
browser.storage.local.get('notifications').then(data => {
    let notifications = data.notifications || [];

    // Trier par date décroissante (du plus récent au plus ancien)
    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

    const container = document.getElementById('notifications');
    notifications.forEach(notification => {
        const div = document.createElement('div');
        div.className = 'notification';
        div.textContent = `Subject: ${notification.subject} - From: ${notification.author}`;

        const openButton = document.createElement('button');
        openButton.textContent = 'Open Email';
        openButton.onclick = async () => {
            let tabs = await browser.mailTabs.query({});
            if (tabs.length > 0) {
                await browser.messageDisplay.open({
                    messageId: notification.messageId,
                    location: 'tab',
                    active: true
                });
            } else {
                console.error('No tabs available to open the message.');
            }
        };

        const dismissButton = document.createElement('button');
        dismissButton.textContent = 'Dismiss';
        dismissButton.onclick = () => {
            div.remove();
        };

        div.appendChild(openButton);
        div.appendChild(dismissButton);
        container.appendChild(div);
    });
});

document.getElementById('clearNotifications').onclick = async () => {
    await browser.storage.local.clear();
    document.getElementById('notifications').innerHTML = ''; // Clear the displayed notifications
    console.log("All notifications cleared.");
};
