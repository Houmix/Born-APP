# Born Desktop App

Application Electron pour Born DZ - Une application de caisse frontend-only construite avec React Native (Expo Router) et Electron.

## 📋 Table des matières

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Développement](#développement)
- [Build pour Production](#build-pour-production)
- [Fonctionnalités](#fonctionnalités)
- [Dépannage](#dépannage)

## 🏗️ Architecture

- **Frontend**: React Native Web (Expo Router) dans `born_dz/`
- **Desktop**: Electron qui encapsule le frontend via Express (mode prod) ou Expo dev server (mode dev)
- **Base de données**: SQLite locale (via react-native-sqlite-storage)

### Pourquoi Express ?

Express est utilisé pour servir les fichiers statiques buildés en production. Sans serveur HTTP, le routing React/Expo Router ne fonctionnerait pas avec `file://` car :
- ❌ Les imports ES modules échouent
- ❌ Le routing SPA (Single Page Application) est cassé
- ❌ Les service workers ne fonctionnent pas

Avec Express (`http://127.0.0.1:8081`) :
- ✅ Tous les chemins renvoient `index.html` (SPA fallback)
- ✅ Navigation entre pages fonctionnelle
- ✅ Imports JavaScript corrects

## 📦 Prérequis

- **Node.js** 18+ et npm
- **Git** (pour versionner le projet)

## 🚀 Installation

### 1. Installation des dépendances Electron
```bash
cd my-desktop-app
npm install
```

### 2. Installation des dépendances du frontend
```bash
cd ../born_dz
npm install
```

## 💻 Développement

### Mode Développement

Il existe **2 façons** de lancer l'app en développement :

#### Option 1 : Avec Expo Dev Server (Hot Reload)
```bash
cd my-desktop-app
npm start
```
⚠️ Plus lent au démarrage (90 secondes), mais avec hot-reload automatique.

#### Option 2 : Avec build statique (Recommandé)
```bash
# 1. Builder le frontend une fois
cd born_dz
npx expo export --platform web --output-dir web-build

# 2. Lancer Electron
cd ../my-desktop-app
npm start
```
✅ Démarrage rapide (~5 secondes), pas de hot-reload.

### DevTools

En mode développement, les DevTools s'ouvrent automatiquement. Pour les rouvrir : `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Option+I` (Mac).

## 🔨 Build pour Production

### 1. Builder le frontend
```bash
cd born_dz
npx expo export --platform web --output-dir web-build
```

### 2. Installer electron-builder (si pas déjà fait)
```bash
cd ../my-desktop-app
npm install --save-dev electron-builder
```

### 3. Builder l'application

#### Windows
```powershell
# Désactiver la signature automatique
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
npm run build:win
```

L'application sera dans `dist\win-unpacked\BornDZ.exe`

**Note** : L'erreur de signature est normale si vous n'avez pas de certificat. L'application fonctionne quand même !

#### Pour créer un installeur NSIS

Si vous voulez un vrai installeur (pas juste l'exe), lancez PowerShell **en Administrateur** :

```powershell
# Activer les permissions pour les liens symboliques
New-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Command Processor" -Name "DelayedExpansion" -Value 1 -PropertyType DWORD -Force

# Puis builder
cd my-desktop-app
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
npm run build:win
```

Sinon, vous pouvez simplement distribuer le dossier `dist\win-unpacked` complet.

#### macOS
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:mac
```

#### Linux
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:linux
```

### 4. Tester l'application buildée

```powershell
# Windows
.\dist\win-unpacked\BornDZ.exe

# ou double-cliquez sur le fichier
```

## 🎨 Modes de fonctionnement

| Mode | Serveur | Port | Hot Reload | Temps démarrage |
|------|---------|------|------------|-----------------|
| **Dev (sans build)** | Expo dev server | 8081 | ✅ Oui | ~90s |
| **Dev (avec build)** | Express statique | 8081 | ❌ Non | ~5s |
| **Production** | Express statique | 8081 | ❌ Non | ~2s |

## 📁 Structure du projet

```
Born-APP/
├── my-desktop-app/           # Application Electron
│   ├── main.js              # Point d'entrée Electron + Express
│   ├── splash.html          # Écran de chargement
│   ├── package.json         # Dépendances Electron
│   ├── README.md
│   └── node_modules/
│
├── born_dz/                 # Application React Native (Expo Router)
│   ├── app/                 # Pages et navigation
│   │   ├── (tabs)/         # Navigation par onglets
│   │   │   ├── home.tsx
│   │   │   ├── menu.tsx
│   │   │   ├── cart.tsx
│   │   │   ├── order.tsx
│   │   │   └── ...
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   ├── components/          # Composants réutilisables
│   ├── assets/             # Images, fonts, etc.
│   ├── constants/          # Constantes et config
│   ├── hooks/              # Custom React hooks
│   ├── web-build/          # Build web (généré par Expo)
│   ├── package.json
│   └── node_modules/
│
└── README.md               # Ce fichier
```

## ✨ Fonctionnalités

- ✅ **Application desktop native** pour Windows, macOS, Linux
- ✅ **Splash screen** avec logo pendant le chargement
- ✅ **Mode dev avec hot-reload** via Expo dev server
- ✅ **Mode prod optimisé** avec Express et fichiers statiques
- ✅ **DevTools intégrés** en mode développement
- ✅ **Gestion propre des processus** (arrêt automatique des serveurs)
- ✅ **Routing SPA fonctionnel** grâce à Express
- ✅ **Base de données SQLite locale**
- ✅ **Offline-first** (pas besoin de backend)

## 🐛 Dépannage

### L'application ne démarre pas

**Problème** : `npm start` échoue
```bash
# Vérifier que vous êtes dans le bon dossier
cd my-desktop-app
pwd  # Doit afficher .../Born-APP/my-desktop-app

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Le routing ne fonctionne pas (pages vides)

**Cause** : Vous avez utilisé `loadFile()` au lieu de `loadURL()`

**Solution** : Assurez-vous que `main.js` contient :
```javascript
mainWindow.loadURL('http://127.0.0.1:8081');  // ✅ Correct
// PAS : mainWindow.loadFile(...)  ❌ Ne marche pas pour le routing
```

### Erreur "web-build manquant"

**Solution** : Builder le frontend
```bash
cd born_dz
npx expo export --platform web --output-dir web-build
```

### L'application est très lente au démarrage

**Cause** : Expo dev server prend 60-90 secondes à démarrer

**Solution** : Builder d'abord le frontend (voir ci-dessus), puis :
```bash
cd my-desktop-app
npm start  # Démarrage rapide avec Express
```

### Erreurs Autofill dans la console

```
Request Autofill.enable failed...
```
Ces warnings sont normaux et sans impact. Ignorez-les.

### Erreur "Cannot create symbolic link" lors du build

**Cause** : Manque de privilèges Windows pour créer des liens symboliques

**Solutions** :

1. **Solution simple** : L'application est quand même buildée ! Utilisez :
   ```powershell
   .\dist\win-unpacked\BornDZ.exe
   ```

2. **Pour créer un installeur** : Lancez PowerShell en Administrateur, puis :
   ```powershell
   $env:CSC_IDENTITY_AUTO_DISCOVERY="false"
   npm run build:win
   ```

3. **Distribuer l'app** : Compressez le dossier `dist\win-unpacked` en ZIP et distribuez-le

## 🔄 Mettre le projet sur Git

### 1. Initialiser Git
```bash
cd C:\Users\HoumameLachache\Documents\Born-APP
git init
```

### 2. Créer .gitignore
Créez un fichier `.gitignore` à la racine :
```
# Node modules
node_modules/
*/node_modules/

# Expo
born_dz/.expo/
born_dz/.expo-shared/
born_dz/web-build/

# Build outputs
my-desktop-app/dist/
*.log

# OS
.DS_Store
Thumbs.db
```

### 3. Premier commit
```bash
git add .
git commit -m "Initial commit - Born Desktop App"
```

### 4. Pousser sur GitHub
```bash
# Créer un repo sur github.com, puis :
git remote add origin https://github.com/votre-username/Born-APP.git
git branch -M main
git push -u origin main
```

## 📝 Scripts disponibles

### Dans `my-desktop-app/`
```bash
npm start        # Lancer l'application Electron
npm run build    # Builder l'installeur (nécessite electron-builder)
```

### Dans `born_dz/`
```bash
npm start                # Lancer Expo dev server
npx expo export --platform web --output-dir web-build  # Builder pour le web
```

## 🛠️ Technologies utilisées

- **Electron** 39.x - Framework desktop
- **React Native** 0.76.x - UI framework
- **Expo Router** 4.x - Navigation
- **Express** 4.x - Serveur HTTP statique
- **TypeScript** 5.x - Langage
- **SQLite** - Base de données locale

## 📄 Licence

Privé - Born DZ

---

**Développé avec ❤️ pour Born DZ**
