import { resetMindMap } from './mind_map/mindMap.js';
import { executeRecupEmails } from './mail_sort/recupMails.js';
import { initUnsortedMailsUI } from "./mail_sort/unsortedMailsUI.js";

const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const openNoticeButton = document.getElementById('openNotice');
const resetMindMapButton = document.getElementById('resetMindMap');
const customConfirm = document.getElementById('customConfirm');
const confirmYesButton = document.getElementById('confirmYes');
const confirmNoButton = document.getElementById('confirmNo');
const reloadButton = document.getElementById('reloadBtn');

// Ouvre / ferme le menu
settingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (settingsMenu.style.display === 'none' || settingsMenu.style.display === '') {
        settingsMenu.style.display = 'flex'; // Affiche le menu
    } else {
        settingsMenu.style.display = 'none'; // Cache le menu
    }
});

reloadButton.addEventListener('click', async (event) => {
    event.stopPropagation();

    try {
        const { initUnsortedMailsUI } = await import('./mail_sort/unsortedMailsUI.js');

        await executeRecupEmails();
        await initUnsortedMailsUI();
    } catch (error) {
        console.error("Erreur pendant le rechargement:", error);
    }
});

// Ferme le menu si on clique ailleurs
window.addEventListener('click', (event) => {
    if (!settingsBtn.contains(event.target) && !settingsMenu.contains(event.target)) {
        settingsMenu.style.display = 'none';
    }
});

openNoticeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    window.open('https://docs.google.com/document/d/1jr-BOHhd-yW8ez_JFGWlTmW-lulayzJJkrLUzTZTsyU/edit?usp=sharing', '_blank');
});

resetMindMapButton.addEventListener('click', (event) => {
    event.stopPropagation();
    settingsMenu.style.display = 'none';
    customConfirm.style.display = 'flex';
});

confirmYesButton.addEventListener('click', () => {
    customConfirm.style.display = 'none';
    resetMindMap();
});

confirmNoButton.addEventListener('click', () => {
    customConfirm.style.display = 'none';
});