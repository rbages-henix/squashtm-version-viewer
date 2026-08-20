# 🏷️ Squash TM - Dynamic Env & Version Badge

Un script pour **Tampermonkey** spécialement conçu pour les équipes QA. Il ajoute une étiquette intelligente, déplaçable et rétractable directement sur l'interface de vos instances **Squash TM**, vous permettant d'identifier immédiatement l'environnement, la version exacte et les dates de mise à jour.

---

## ✨ Fonctionnalités principales

* 🎨 **Identification visuelle par couleur** : Détection automatique de l'environnement d'après l'URL (Vert pour la *Recette*, Rouge pour la *Prod*, Violet pour la *Nightly*, Bleu par défaut).
* 🔄 **Version en temps réel** : Récupération dynamique de la version exacte via les endpoints backend de Squash TM (fonctionne même sur la page de connexion).
* 📅 **Suivi des dates (Nexus)** :
  * **Pour les versions SNAPSHOT** : Date et heure de compilation du package (`private-snapshots`).
  * **Pour les instances NIGHTLY** : Double affichage avec la date de build du Snapshot **ET** la date de déploiement de l'image Docker (`docker-group`).
* 🖱️ **Glisser-Déposer (Drag & Drop)** : Positionnez l'étiquette où vous voulez sur l'écran. La position est mémorisée pour vos prochaines visites.
* 📦 **Rétractable** : Un clic suffit pour réduire le badge en une pastille discrète dans un coin afin de ne jamais gêner vos tests.
* 🔒 **Sécurisé** : Vos identifiants Nexus sont saisis via un formulaire avec mot de passe masqué et stockés dans le coffre-fort local de l'extension (aucun mot de passe dans le code source).
* 🛡️ **Anti-doublons** : Conçu pour ignorer les iframes et ne pas se dupliquer dans les fenêtres de configuration de plugins (ex: *Xsquash4Jira*).

---

## 🛠️ Étape 1 : Installer et autoriser Tampermonkey

> ⚠️ **IMPORTANT POUR CHROME & EDGE** : En raison des règles de sécurité récentes (Manifest V3), **l'extension doit être explicitement autorisée** dans votre navigateur, sinon les scripts ne se lanceront pas.

1. **Installez l'extension Tampermonkey** :
   * [Google Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   * [Mozilla Firefox](https://addons.mozilla.org/fr/firefox/addon/tampermonkey/)
   * [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **Activez les autorisations nécessaires (Chrome & Edge uniquement)** :
   1. Ouvrez la page des extensions de votre navigateur (`chrome://extensions/` ou `edge://extensions/`).
   2. Activez le bouton **Mode développeur** (en haut à droite sur Chrome, en bas à gauche sur Edge).
   3. Sur la carte de Tampermonkey, cliquez sur **Détails** (ou *Gérer l'extension*).
   4. Cochez impérativement la case : **"Autoriser les scripts utilisateur"**.
   5. *(Optionnel mais recommandé)* : Cochez également **"Autoriser dans InPrivate / Navigation privée"** si vous effectuez des tests dans ce mode.

---

## 🚀 Étape 2 : Installer le script Squash TM

1. Cliquez sur l'icône de l'extension **Tampermonkey** en haut à droite de votre navigateur (pensez à l'épingler pour la garder visible).
2. Cliquez sur **Ajouter un nouveau script** (ou *Create a new script*).
3. Supprimez tout le contenu pré-rempli dans l'éditeur.
4. Collez l'intégralité du code du script (version 9.0).
5. Enregistrez avec `Ctrl + S` (ou menu *Fichier > Enregistrer*).
6. Fermez l'onglet de l'éditeur : le script est actif !

---

## ⚙️ Étape 3 : Configurer l'accès à Nexus (Optionnel)

Cette étape est nécessaire si vous travaillez sur des versions **SNAPSHOT** ou **NIGHTLY** et souhaitez afficher les dates de build et de déploiement Docker.

1. Rendez-vous sur n'importe quelle instance Squash TM.
2. Cliquez sur l'icône **Tampermonkey** dans votre barre d'outils.
3. Dans la liste des actions du script, cliquez sur : **⚙️ Configurer identifiants Nexus**.
4. *(Lors de la première utilisation, si Tampermonkey vous demande l'autorisation d'accéder à `nexus.squashtest.org`, cliquez sur **Toujours autoriser**).*
5. Une fenêtre modale s'ouvre : renseignez votre identifiant (ex: `rbages`) et votre mot de passe Nexus, puis cliquez sur **Enregistrer**.

> 🔒 **Sécurité** : Vos identifiants restent stockés localement dans votre propre navigateur via l'API isolée `GM_setValue`. Ils ne sont jamais partagés ni exposés dans le code source.

---

## 💡 Utilisation au quotidien

| Action | Manipulation |
| :--- | :--- |
| **Déplacer l'étiquette** | Maintenez le clic gauche enfoncé sur l'étiquette et glissez-la où vous voulez sur la page (*Drag & Drop*). |
| **Réduire / Agrandir** | Faites un simple clic gauche sur l'étiquette pour alterner entre le mode complet et la pastille compacte. |
| **Réinitialiser la position** | Cliquez sur l'icône Tampermonkey > **🔄 Réinitialiser la position de l'étiquette** (elle revient instantanément en bas à droite en mode déplié, sans recharger la page). |
| **Mettre à jour les accès Nexus** | Cliquez sur l'icône Tampermonkey > **⚙️ Configurer identifiants Nexus**. |
| **Effacer les accès Nexus** | Cliquez sur l'icône Tampermonkey > **🗑️ Effacer identifiants Nexus**. |

---

## ❓ Dépannage (FAQ)

**Le badge n'apparaît pas du tout sur la page.**
1. Vérifiez que la case **"Autoriser les scripts utilisateur"** est bien cochée dans les paramètres de Tampermonkey (voir l'encart d'avertissement de l'Étape 1).
2. Vérifiez que l'URL de votre instance correspond bien aux règles d'activation du script (par défaut : `rec-squashtm-*`, `*.squashtest.org` ou toute URL contenant `squash`).

**Le badge affiche "⚠️ Identifiants Nexus invalides".**
* Votre mot de passe Nexus a probablement été modifié ou a expiré. Cliquez sur l'icône Tampermonkey > **⚙️ Configurer identifiants Nexus** pour le ressaisir.

**Le badge affiche deux dates différentes sur la Nightly, est-ce normal ?**
* **Oui, c'est tout l'intérêt !** 
  * `Nightly` correspond à l'heure à laquelle le conteneur Docker a été déployé.
  * `Snapshot` correspond à l'heure à laquelle le code source Squash TM a été compilé par le serveur de build.