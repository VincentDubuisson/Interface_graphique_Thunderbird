## Interface_graphique_Thunderbird
Interface graphique interactive, intégrée au logiciel de messagerie Thunderbird (extension) permettant d’organiser et visualiser les mails.

Projet réalisé dans le cadre de l'UE BE-SHS de la licence informatique de Université de Toulouse.

Maîtrise d'ouvrage:

    • Chiara Giraudo

Maîtrise d'oeuvre:

    • Mariama DIALLO
    • Vincent DUBUISSON
    • Yassine LAMRABETE
    • Alex TSAN
    • Petar VUKOSAVLJEVIC



## Comment tester ? (extension temporaire)
Pour tester le principe de l'extension ThunderBird et de la carte mentale avec la librairie Mind Elexir, suivez les instructions suivantes:

- Ouvrez ThunderBird et allez dans le menu du logiciel (en haut à droite), puis sélectionnez 'Modules complémentaires et thèmes'

<p align="center">
  <img src="readme_images/image1.png" alt="Texte" width="75%">
</p>

- Cliquez ensuite sur la roue dentée, puis sur 'Déboguer des modules'

<p align="center">
  <img src="readme_images/image2.png" alt="Texte" width="75%">
</p>

- Ensuite, dans 'Extensions temporaires', chargez un module complémentaire temporaire et ouvrez le fichier 'manifest.json' du dossier 'mind_mail'.

<p align="center">
  <img src="readme_images/image3.png" alt="Texte" width="75%">
</p>

- Enfin, rendez vous dans l'onglet 'Courrier', l'extension devrait s'afficher en haut à droite de l'interface.

<p align="center">
  <img src="readme_images/image4.png" alt="Texte" width="75%">
</p>


## Comment installer ? (extension permanente)
Pour installer l'extension ThunderBird, suivez les instructions suivantes:

- Ouvrez le dossier 'mind_mail', sélectionnez tout les fichiers et dossiers, et compressez le tout en format .zip

- Renommez le dossier compressé par:
```txt
mindmail@ut3.fr.xpi
```
Le nom correspond à l'id défini dans le fichier manifest.json + l'extension .xpi

- Ensuite, ouvrez ThunderBird et allez dans le menu du logiciel (en haut à droite), puis sélectionnez 'Modules complémentaires et thèmes'

<p align="center">
  <img src="readme_images/image1.png" alt="Texte" width="75%">
</p>

- Cliquez ensuite sur la roue dentée, puis sur 'Installer un module depuis un fichier...'

<p align="center">
  <img src="readme_images/image2.png" alt="Texte" width="75%">
</p>

- Enfin, sélectionnez le fichier .xpi nouvellement crée