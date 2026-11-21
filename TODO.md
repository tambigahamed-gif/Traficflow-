# TODO — Espace Super Admin

## Sécurité et accès

- [ ] Conserver toutes les routes admin derrière `superAdminProcedure` et une vérification Supabase server-side.
- [ ] Ne jamais placer la clé `service_role`, les tokens OAuth ou les secrets dans le frontend.
- [ ] Refuser les actions sensibles sans utilisateur authentifié, UUID valide et confirmation côté interface.
- [ ] Empêcher la suspension de l’utilisateur Super Admin courant ou la modification de son rôle depuis l’interface.

## Données et serveur

- [ ] Exposer uniquement les métriques réellement présentes dans Workspaces, profils, abonnements, paiements confirmés, comptes sociaux et snapshots Analytics.
- [ ] Journaliser les suspensions, réactivations et mutations de tickets.
- [ ] Ajouter et valider les tables additives `admin_audit_log` et `support_tickets`.
- [ ] Conserver les plans, tarifs et quotas existants en lecture seule dans ce chantier.

## Interface

- [ ] Ajouter la route `/admin` et une navigation distincte Dashboard, Utilisateurs, Abonnements, Paiements, Plans, Réseaux sociaux, Analytics, Support, Journal d’activité et Paramètres.
- [ ] Afficher des états réels, des états vides explicites et les erreurs d’accès sans données inventées.
- [ ] Prévoir une confirmation avant suspension/réactivation et fermeture d’un ticket.
- [ ] Maintenir le responsive et le dark mode existants.

## Validation finale

- [ ] `pnpm check`.
- [ ] Suite de tests ciblée et suite complète.
- [ ] `pnpm build`.
- [ ] Inspection de migration sans application en production.
- [ ] Vérification Git et revue des secrets avant toute livraison.
