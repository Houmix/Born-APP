#!/bin/bash

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================"
echo -e "   Lancement Do-Eat"
echo -e "========================================${NC}\n"

# Obtenir le répertoire du script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}Répertoire de travail: ${SCRIPT_DIR}${NC}\n"

# 1. Lancer Expo dans born_dz
echo -e "${GREEN}[1/2] Lancement d'Expo (born_dz)...${NC}"

if [ ! -d "born_dz" ]; then
    echo -e "${RED}❌ Erreur: Dossier born_dz introuvable${NC}"
    echo -e "${YELLOW}Assurez-vous que ce script est à la racine du projet${NC}"
    read -p "Appuyez sur Entrée pour fermer..."
    exit 1
fi

cd born_dz

# Vérifier node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installation des dépendances npm...${NC}"
    npm install
fi

# Lancer Expo dans un nouveau terminal
osascript -e 'tell app "Terminal"
    do script "cd '"$(pwd)"' && echo \"🚀 Démarrage Expo...\" && npx expo start --clear"
end tell' &

echo -e "${GREEN}✓ Expo lancé dans un nouveau terminal${NC}\n"

cd "$SCRIPT_DIR"

# 2. Attendre qu'Expo soit prêt
echo -e "${YELLOW}⏳ Attente du démarrage d'Expo (15 secondes)...${NC}"
sleep 15

# 3. Lancer Electron dans my-desktop-app
echo -e "${GREEN}[2/2] Lancement d'Electron (my-desktop-app)...${NC}"

if [ ! -d "my-desktop-app" ]; then
    echo -e "${RED}❌ Erreur: Dossier my-desktop-app introuvable${NC}"
    read -p "Appuyez sur Entrée pour fermer..."
    exit 1
fi

cd my-desktop-app

# Vérifier node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installation des dépendances npm...${NC}"
    npm install
fi

# Lancer Electron dans un nouveau terminal
osascript -e 'tell app "Terminal"
    do script "cd '"$(pwd)"' && echo \"🖥️  Démarrage Electron...\" && npm start"
end tell' &

echo -e "${GREEN}✓ Electron lancé dans un nouveau terminal${NC}\n"

cd "$SCRIPT_DIR"

# Résumé
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Tous les services sont lancés !${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Expo:${NC}     Voir le terminal Expo"
echo -e "${YELLOW}Electron:${NC} Voir le terminal Electron"
echo -e "\n${GREEN}Vous pouvez fermer cette fenêtre${NC}\n"

sleep 3
