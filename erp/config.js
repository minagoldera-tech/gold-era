/*
 * GOLD ERA ERP — settings.
 *
 * Leave `firebase` empty to run in LOCAL MODE: data and accounts stay in this browser only.
 * On first open you create the owner account; the owner then creates the employees' accounts.
 * Good for trying the system and its permissions on one computer.
 *
 * To run it for the whole factory (shared data on every device), paste your Firebase web-app
 * config below. See README.md. The Firebase web config is not a secret; access is enforced
 * by firestore.rules.
 */
window.GOLD_ERA_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDa_6hZbiEfB6K-JmWnL_CoY3vnvtRz7dU",
    authDomain: "gold-era-erp.firebaseapp.com",
    projectId: "gold-era-erp",
    storageBucket: "gold-era-erp.firebasestorage.app",
    messagingSenderId: "997373223457",
    appId: "1:997373223457:web:b59c6a5790a317a254f960"
  },
  // Username(s) of the owner. The owner sees everything and manages users.
  // Must match OWNER in firestore.rules as <username>@<userDomain>.
  ownerUsernames: ["admin"],
  // Internal domain Firebase uses for usernames. No e-mail is ever sent to it.
  userDomain: "users.gold-era.local"
};
