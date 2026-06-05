/**
 * Property Schemas — Schémas de propriétés par catégorie
 *
 * Chaque type de nœud est automatiquement mappé à une catégorie via
 * le préfixe de son `type` (avant le premier `-`). Un type sans préfixe
 * connu utilise le schema 'default' (aucun champ spécifique).
 *
 * Usage :
 *   import { getSchemaForType, getCategory, CATEGORY_SCHEMAS } from './propertySchemas.js';
 *   const schema = getSchemaForType('service-api');  // → CATEGORY_SCHEMAS['service']
 *   const cat    = getCategory('devops-ci');          // → 'devops'
 */

/* -------------------------------------------------------------------------- */
/*  Mapping automatique par préfixe                                           */
/* -------------------------------------------------------------------------- */

/**
 * Extrait la catégorie à partir du type du nœud.
 * Ex: 'devops-ci' → 'devops', 'service-api' → 'service', 'process' → 'process'
 */
export function getCategory(type) {
  if (!type) return 'default';
  const i = type.indexOf('-');
  return i > 0 ? type.slice(0, i) : type;
}

/* -------------------------------------------------------------------------- */
/*  Définition d'un champ                                                     */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} FieldSchema
 * @property {string}  key         - Clé dans node.properties
 * @property {'text'|'textarea'|'select'|'date'} type - Type d'input
 * @property {string}  label       - Libellé affiché
 * @property {string}  [placeholder] - Placeholder (text/textarea)
 * @property {string[]} [options]  - Options pour type='select'
 * @property {boolean} [required]  - Validation basique (défaut: false)
 */

/**
 * Helper pour créer un champ de schéma.
 */
function field(key, type, label, opts = {}) {
  return { key, type, label, ...opts };
}

function text(key, label, placeholder = '') {
  return field(key, 'text', label, { placeholder });
}

function textarea(key, label, placeholder = '') {
  return field(key, 'textarea', label, { placeholder });
}

function select(key, label, options) {
  return field(key, 'select', label, { options });
}

function dateField(key, label) {
  return field(key, 'date', label);
}

/* -------------------------------------------------------------------------- */
/*  Schémas par catégorie                                                     */
/* -------------------------------------------------------------------------- */

/**
 * @type {Object<string, { fields: FieldSchema[], label?: string }>}
 */
export const CATEGORY_SCHEMAS = {

  /* ---- PROCESSUS ---- */
  process: {
    label: 'Processus',
    fields: [
      textarea('inputs', 'Entrées', 'Données ou prérequis en entrée…'),
      textarea('outputs', 'Sorties', 'Données ou livrables produits…'),
      textarea('steps', 'Étapes détaillées', 'Sous-étapes du processus…'),
    ],
  },

  /* ---- DÉCISION ---- */
  decision: {
    label: 'Décision',
    fields: [
      textarea('options', 'Options envisagées', 'Option A\nOption B\nOption C…'),
      textarea('criteria', 'Critères d\'évaluation', 'Coût, délai, risque, faisabilité…'),
      text('selected', 'Choix retenu', 'Option retenue'),
    ],
  },

  /* ---- SERVICES ---- */
  service: {
    label: 'Service',
    fields: [
      text('endpoint', 'Endpoint', '/api/v1/resource'),
      select('method', 'Méthode HTTP', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      select('auth', 'Authentification', ['Aucune', 'API Key', 'JWT', 'OAuth2', 'Basic']),
      textarea('requestSchema', 'Schéma requête', '{ "key": "value" }'),
      textarea('responseSchema', 'Schéma réponse', '{ "key": "value" }'),
      text('sla', 'SLA', '99.9%, <200ms p95'),
    ],
  },

  /* ---- DEVOPS ---- */
  devops: {
    label: 'DevOps',
    fields: [
      select('tool', 'Outil', ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI', 'Azure DevOps', 'Travis CI', 'Autre']),
      text('triggers', 'Déclencheurs', 'push, PR, schedule, manual…'),
      textarea('steps', 'Étapes du pipeline', 'build → test → deploy…'),
      textarea('rollback', 'Procédure de rollback', 'Comment annuler le déploiement…'),
    ],
  },

  /* ---- ARCHITECTURE ---- */
  arch: {
    label: 'Architecture',
    fields: [
      textarea('problem', 'Problème adressé', 'Quel est le contexte et le problème…'),
      textarea('solution', 'Solution retenue', 'Description de la solution choisie…'),
      textarea('alternatives', 'Alternatives évaluées', 'Autres solutions considérées…'),
      textarea('tradeoffs', 'Compromis', 'Avantages et inconvénients…'),
      textarea('consequences', 'Conséquences', 'Impact à court et long terme…'),
    ],
  },

  /* ---- SÉCURITÉ ---- */
  sec: {
    label: 'Sécurité',
    fields: [
      textarea('threat', 'Menace identifiée', 'Description de la menace / attaque…'),
      select('severity', 'Sévérité', ['Faible', 'Moyen', 'Élevé', 'Critique']),
      textarea('mitigations', 'Mesures de mitigation', 'Contre-mesures mises en place…'),
      text('conformity', 'Conformité', 'RGPD, OWASP, SOC2, ISO27001…'),
    ],
  },

  /* ---- DATA / IA ---- */
  data: {
    label: 'Data',
    fields: [
      text('source', 'Source des données', 'Base de données, API, fichier…'),
      select('format', 'Format', ['JSON', 'CSV', 'XML', 'Parquet', 'Avro', 'Protobuf', 'Autre']),
      text('volume', 'Volume estimé', '1M lignes/jour, 10 Go/mois…'),
      select('frequency', 'Fréquence', ['Temps réel', 'Quotidien', 'Hebdomadaire', 'Mensuel', 'On-demand']),
      textarea('schema', 'Schéma de données', '{ "field": "type" }'),
    ],
  },

  /* ---- GESTION DE PROJET ---- */
  proj: {
    label: 'Projet',
    fields: [
      text('assignee', 'Assigné à', 'Nom ou pseudonyme…'),
      text('estimation', 'Estimation', '2h, 1j, 3j, 5sp…'),
      dateField('deadline', 'Échéance'),
      select('status', 'Statut', ['À faire', 'En cours', 'En revue', 'Terminé', 'Bloqué']),
      textarea('acceptance', 'Acceptance criteria', 'Conditions de validation…'),
    ],
  },

  /* ---- TESTS ---- */
  test: {
    label: 'Tests',
    fields: [
      text('coverage', 'Couverture cible', '80%, 90%…'),
      select('framework', 'Framework', ['Vitest', 'Jest', 'Mocha', 'Pytest', 'JUnit', 'xUnit', 'Cypress', 'Playwright', 'Autre']),
      textarea('testCases', 'Cas de test', 'Scénarios de test…'),
      select('result', 'Dernier résultat', ['Pass', 'Fail', 'Skip', 'Non exécuté']),
    ],
  },

  /* ---- UI/UX ---- */
  uiux: {
    label: 'UI/UX',
    fields: [
      textarea('wireframe', 'Wireframe / Maquette', 'Description ou lien vers la maquette…'),
      textarea('accessibility', 'Accessibilité (WCAG)', 'Contraste, navigation clavier, ARIA…'),
      select('responsive', 'Responsive', ['Desktop', 'Tablet', 'Mobile', 'Tous']),
      text('devices', 'Devices cibles', 'iPhone 15, Galaxy S24, Chrome Desktop…'),
    ],
  },

  /* ---- DESIGN PATTERNS ---- */
  pattern: {
    label: 'Pattern',
    fields: [
      textarea('problem', 'Problème résolu', 'Quel problème ce pattern address…'),
      textarea('solution', 'Solution proposée', 'Comment le pattern résout le problème…'),
      textarea('tradeoffs', 'Compromis', 'Avantages / inconvénients…'),
      textarea('consequences', 'Conséquences', 'Impact sur l\'architecture…'),
    ],
  },

  /* ---- ENVIRONNEMENT ---- */
  env: {
    label: 'Environnement',
    fields: [
      textarea('variables', 'Variables d\'environnement', 'KEY=value (une par ligne)\nPORT=3000\nNODE_ENV=development'),
      textarea('secrets', 'Secrets (noms uniquement)', 'DB_PASSWORD\nAPI_KEY\nJWT_SECRET'),
      text('regions', 'Régions / Zones', 'eu-west-1, us-east-1, asia-southeast-1'),
    ],
  },

  /* ---- COMPOSANTS ---- */
  component: {
    label: 'Composant',
    fields: [
      textarea('props', 'Props / Inputs', 'name: string\nactive: boolean\nonClose: () => void'),
      textarea('states', 'État interne', 'isOpen: boolean\nselectedItem: Item | null'),
      textarea('dependencies', 'Dépendances', 'Autres composants ou services requis…'),
      textarea('api', 'API publique', 'Méthodes exposées, événements émis…'),
    ],
  },

  /* ---- GIT ---- */
  git: {
    label: 'Git',
    fields: [
      text('branch', 'Nom de branche', 'feature/auth, fix/issue-42…'),
      select('merged', 'Statut merge', ['Non', 'Oui', 'En cours', 'Conflits']),
      textarea('conflicts', 'Conflits', 'Description des conflits éventuels…'),
      text('pr', 'PR associée', '#123 ou lien vers la PR…'),
    ],
  },

  /* ---- MESSAGING ---- */
  msg: {
    label: 'Messaging',
    fields: [
      text('protocol', 'Protocole', 'HTTP, AMQP, MQTT, WebSocket…'),
      text('format', 'Format du message', 'JSON, Protobuf, Avro…'),
      select('qos', 'Qualité de service', ['At most once', 'At least once', 'Exactly once']),
      text('retry', 'Politique de retry', '3 retries, backoff exponentiel…'),
    ],
  },

  /* ---- INITIALISATION ---- */
  init: {
    label: 'Initialisation',
    fields: [
      text('version', 'Version cible', '14.x, 3.x, latest…'),
      textarea('dependencies', 'Dépendances principales', 'react, next, express…'),
      text('commande', 'Commande d\'init', 'npx create-next-app, npm init…'),
      textarea('config', 'Configuration', 'Options de configuration…'),
    ],
  },

  /* ---- DÉPENDANCES ---- */
  dep: {
    label: 'Dépendance',
    fields: [
      text('name', 'Nom du package', 'lodash, express, react…'),
      text('version', 'Version', '^4.17.21, ~3.0.0, >=2.0…'),
      select('license', 'Licence', ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'Autre']),
      select('auditStatus', 'Audit sécurité', ['OK', 'Vulnérabilité connue', 'Obsolète', 'Non vérifié']),
    ],
  },

  /* ---- DÉFAUT (types sans préfixe connu) ---- */
  default: {
    label: 'Propriétés',
    fields: [
      // Aucun champ spécifique — description + metadata libres suffisent
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  API publique                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Renvoie le schéma de propriétés adapté au type de nœud donné.
 *
 * @param {string} type - Le type du nœud (ex: 'service-api', 'devops-ci')
 * @returns {{ fields: FieldSchema[], label: string }}
 */
export function getSchemaForType(type) {
  const category = getCategory(type);
  return CATEGORY_SCHEMAS[category] || CATEGORY_SCHEMAS.default;
}

/**
 * Renvoie la liste de toutes les catégories disponibles (hors 'default').
 *
 * @returns {string[]}
 */
export function getAllCategories() {
  return Object.keys(CATEGORY_SCHEMAS).filter((c) => c !== 'default');
}

/**
 * Vérifie si un type a des propriétés spécifiques (champs structurés).
 *
 * @param {string} type
 * @returns {boolean}
 */
export function hasSpecificProperties(type) {
  const schema = getSchemaForType(type);
  return schema.fields.length > 0;
}
