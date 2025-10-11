@echo off
echo 🚀 Démarrage du serveur Mermaid Canvas Generator...
echo.

REM Vérifier si Node.js est disponible
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Node.js n'est pas installé. Utilisation de Python...
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Ni Node.js ni Python ne sont disponibles.
        echo Installez Node.js depuis https://nodejs.org ou Python depuis https://python.org
        pause
        exit /b 1
    )
    echo ✅ Python détecté. Démarrage du serveur sur le port 8081...
    python -m http.server 8081
) else (
    echo ✅ Node.js détecté. Démarrage du serveur sur le port 8081...
    npx http-server -p 8081 -c-1
)

echo.
echo 🌐 Serveur démarré ! Ouvrez votre navigateur et allez à :
echo http://localhost:8080
echo.
echo Appuyez sur Ctrl+C pour arrêter le serveur.
pause