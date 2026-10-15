# Pigeon : mise en ligne sur Netlify

> **Déjà fait pour toi** : le projet Supabase « pigeon » est créé, `schema.sql` est déjà exécuté et `config.js` est déjà rempli. Passe directement à l'étape 3 (réglage e-mail), puis à l'étape 5 ou au déploiement GitHub, et termine par l'étape 6.

Le site est une page statique (Netlify) qui parle à Supabase, un service gratuit qui gère les comptes, la base de données et les messages en direct. Compte une quinzaine de minutes.

## 1. Créer le projet Supabase

1. Va sur https://supabase.com, crée un compte, puis **New project**.
2. Donne un nom au projet, choisis un mot de passe de base de données (garde-le de côté) et une région proche (par exemple Frankfurt).
3. Attends que le projet soit prêt.

## 2. Créer les tables

1. Dans Supabase, ouvre **SQL Editor** puis **New query**.
2. Copie tout le contenu de `schema.sql`, colle-le, clique sur **Run**.
3. Tu dois voir « Success ». Ne lance le script qu'une seule fois.

## 3. Régler la connexion par e-mail

Dans **Authentication > Providers**, vérifie que **Email** est activé.

Pour tester vite, tu peux désactiver **Confirm email** : les gens entrent dans le chat dès l'inscription. Si tu le laisses activé, chaque personne reçoit un e-mail de confirmation avant sa première connexion. Les envois gratuits de Supabase sont limités à quelques e-mails par heure.

## 4. Brancher le site sur Supabase

1. Dans Supabase, ouvre **Project Settings > API**.
2. Copie la **Project URL** et la clé **anon public**.
3. Ouvre `config.js` et colle-les entre les guillemets.

## 5. Mettre le site en ligne sur Netlify

1. Va sur https://app.netlify.com/drop (connecte-toi si besoin).
2. Glisse tout le dossier `pigeon-site` dans la zone indiquée.
3. Netlify te donne une adresse en `.netlify.app`. Tu peux la renommer dans **Site configuration**.

Pour modifier le site plus tard, change les fichiers et redépose le dossier.

## 6. Dernier réglage

Dans Supabase, ouvre **Authentication > URL Configuration** et mets ton adresse Netlify dans **Site URL**. Sans ça, les liens des e-mails de confirmation pointent au mauvais endroit.

## Bon à savoir

- Les mots de passe sont gérés et chiffrés par Supabase, ils ne passent jamais par ton code.
- Chacun ne peut supprimer que ses propres messages, c'est imposé par la base et pas seulement par la page.
- Le plan gratuit de Supabase met un projet en pause après une semaine sans activité. Il se réveille depuis le tableau de bord.
- Pour ajouter un salon à la main, insère une ligne dans la table `rooms`. Les membres connectés peuvent aussi en créer depuis le site.
