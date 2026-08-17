# Gestion Hamza

Application Windows de gestion de stock, caisse, ventes, réparations et dettes.

## Version

1.0.1

## Mise à jour automatique

L'application utilise `electron-updater` et les GitHub Releases. Une version installée depuis un release stable peut détecter, télécharger et installer automatiquement une nouvelle version.

Pour publier une nouvelle version :

1. Modifier la version dans `package.json`.
2. Créer un tag GitHub correspondant, par exemple `v1.0.2`.
3. Le workflow GitHub Actions construit l'installateur Windows et le publie dans GitHub Releases.
