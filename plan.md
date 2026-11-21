# TrafficFlow V2 — plan d’intégration finale

## Périmètre

Faire évoluer le snapshot V2 existant sans recréer l’application. Les Workspaces, Supabase Auth, RLS, rôles, publications, calendrier, analytics, assistants IA, notifications et automatisations existants sont conservés et améliorés.

## Décisions d’architecture

- **Frontend** : React/Vite existant, routes Wouter conservées, composants existants réutilisés.
- **Backend** : Express + tRPC existant ; les contrôles d’accès et limites restent côté serveur.
- **Données** : Supabase/PostgreSQL et migrations additives uniquement.
- **Paiement** : adaptateur SASPay côté serveur, sans endpoint inventé. Tant que les variables ne sont pas configurées, l’interface affiche « Configuration requise » et aucun paiement n’est simulé.
- **OAuth social** : secrets et tokens uniquement côté serveur ; aucune connexion ne sera affichée comme réelle sans autorisation et configuration valides.
- **Environnement de test** : données de test séparées et explicitement étiquetées ; jamais exposées en production.

## Phases

1. Fondations : identité visuelle, logo officiel, routes publiques, configuration, health check et garde-fous de sécurité.
2. Landing/Auth : landing commerciale, login/signup/reset, Google OAuth via Supabase et protection des routes.
3. Link Pages : schéma, RLS, API, builder, page publique `/p/:slug`, QR et analytics de base.
4. Social Control Center : OAuth configurables, statuts, historique et limites de publication.
5. IA/automatisations : Gemini puis Groq si configurés, exécution durable et historique.
6. Abonnements : Trial/Base/Pro/Business, compteurs serveur et activation SASPay lorsque l’intégration est configurée.
7. Validation : check, tests, build, endpoint health, responsive et audit des secrets.

## Direction design

- **Mouvement** : Clean Shadow SaaS, premium mais sobre.
- **Principes** : hiérarchie lisible, surfaces blanches/indigo, ombres douces, interactions rapides et mobile-first.
- **Palette** : indigo/violet propriétaire pour exprimer contrôle et intelligence ; neutres clairs pour préserver la lisibilité.
- **Signature** : logo officiel TrafficFlow, halos indigo subtils, cartes arrondies et badges d’état.
- **Voix** : directe, experte et rassurante. Exemple : « Vos réseaux, enfin orchestrés au même endroit. » / « Commencez gratuitement, gardez le contrôle. »
- **Positionnement** : cockpit social et Link Pages pour créateurs, marques et équipes.

## Extension approuvée — espace Super Admin

L’espace `/admin` est ajouté sans recréer l’application. Il réutilise React, Wouter, Tailwind, tRPC et le thème TrafficFlow existants. Le serveur protège toutes les procédures par `superAdminProcedure`, puis utilise le client `service_role` uniquement après cette vérification pour lire les données globales. Les plans et quotas existants restent en lecture seule pendant ce chantier.

La migration additive ajoute le journal `admin_audit_log` et les tickets `support_tickets`. Le dashboard affiche uniquement des données Supabase réelles et sépare les sections Dashboard, Utilisateurs, Abonnements, Paiements, Plans, Réseaux sociaux, Analytics, Support, Journal d’activité et Paramètres. Les actions de suspension/réactivation et de support sont confirmées et journalisées. Aucun déploiement ni application de migration en production n’est inclus.
