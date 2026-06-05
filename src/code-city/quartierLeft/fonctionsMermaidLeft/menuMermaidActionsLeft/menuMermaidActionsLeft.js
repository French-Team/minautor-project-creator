/**
 * Menu Mermaid Actions Left — Palette d'éléments draggables (variantes)
 *
 * Architecture :
 *   - Chaque carte représente un TYPE de nœud (catégorie)
 *   - Chaque carte contient un <select> qui liste les VARIANTES
 *     disponibles pour ce type (icône + couleur de fond)
 *   - Au drag, on transfère `{ type, label, variant, variantLabel, icon,
 *     color }` via `application/json`
 *   - L'icône affichée sur la carte est mise à jour à chaque changement
 *     de variante (et le drag utilise toujours la variante sélectionnée)
 *
 * Le conteneur #palette-container est défini dans code-city.js.
 * La structure HTML de la sidebar (search bar, head) y est aussi définie.
 */

import { getIcon } from '../../../icons.js';

/* -------------------------------------------------------------------------- */
/*  Palette data                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Chaque item de palette a :
 *   - type    : catégorie (pilote la forme Mermaid)
 *   - label   : libellé affiché sur la carte
 *   - tooltip : info-bulle au survol
 *   - variants: liste de variantes disponibles dans le <select>
 *
 * Une variante a :
 *   - id   : identifiant unique (slug)
 *   - icon : nom d'icône dans le registre icons.js
 *   - color: nom de couleur (cf. CSS data-color="<name>")
 *   - label: libellé court affiché dans le <select> et au drag
 *
 * Pour ajouter une variante, il suffit d'ajouter un objet dans le tableau
 * `variants` du type concerné — le mécanisme (select + drag + couleur) le
 * prend en charge automatiquement.
 */
export const PALETTE = [

  /* ================================================================== */
  /*  🎨 FONDAMENTAUX                                                    */
  /* ================================================================== */

  {
    id: 'base',
    label: 'Diagrammes de base',
    defaultOpen: false,
    items: [
      {
        type: 'start',
        label: 'Début',
        tooltip: 'Point de départ',
        variants: [
          { id: 'standard', icon: 'start',    color: 'green', label: 'Classique' },
          { id: 'launch',   icon: 'rocket',   color: 'blue',  label: 'Lancement' },
          { id: 'trigger',  icon: 'sparkles', color: 'cyan',  label: 'Réception' },
        ],
      },
      {
        type: 'end',
        label: 'Fin',
        tooltip: 'Point de fin',
        variants: [
          { id: 'standard',  icon: 'end',     color: 'red',    label: 'Stop' },
          { id: 'delivered', icon: 'success', color: 'green',  label: 'Validée' },
          { id: 'failed',    icon: 'xCircle', color: 'orange', label: 'Échec' },
        ],
      },
      {
        type: 'process',
        label: 'Processus',
        tooltip: 'Étape de traitement',
        variants: [
          { id: 'standard', icon: 'process', color: 'blue',   label: 'Étape' },
          { id: 'data',     icon: 'storage', color: 'indigo', label: 'Données' },
          { id: 'api',      icon: 'code',    color: 'purple', label: 'API' },
        ],
      },
      {
        type: 'decision',
        label: 'Décision',
        tooltip: 'Point de décision',
        variants: [
          { id: 'standard',  icon: 'decision', color: 'yellow', label: 'Losange' },
          { id: 'condition', icon: 'branch',   color: 'orange', label: 'Branchement' },
        ],
      },
      {
        type: 'document',
        label: 'Document',
        tooltip: 'Document ou fichier',
        variants: [
          { id: 'standard', icon: 'document', color: 'blue',   label: 'Document' },
          { id: 'image',    icon: 'photo',    color: 'purple', label: 'Image' },
          { id: 'code',     icon: 'code',     color: 'slate',  label: 'Code' },
        ],
      },
      {
        type: 'user',
        label: 'Utilisateur',
        tooltip: 'Action utilisateur',
        variants: [
          { id: 'standard', icon: 'user',  color: 'cyan',  label: 'Utilisateur' },
          { id: 'team',     icon: 'users', color: 'blue',  label: 'Équipe' },
        ],
      },
      {
        type: 'storage',
        label: 'Stockage',
        tooltip: 'Sauvegarde de données',
        variants: [
          { id: 'standard', icon: 'storage', color: 'slate', label: 'Serveur' },
          { id: 'cloud',    icon: 'cloud',   color: 'blue',  label: 'Cloud' },
        ],
      },
    ],
  },

  {
    id: 'advanced',
    label: 'Éléments avancés',
    defaultOpen: false,
    items: [
      {
        type: 'module',
        label: 'Module',
        tooltip: 'Module ou fonction',
        variants: [
          { id: 'standard',  icon: 'module', color: 'indigo', label: 'Module' },
          { id: 'component', icon: 'cube',   color: 'purple', label: 'Composant' },
        ],
      },
      {
        type: 'important',
        label: 'Important',
        tooltip: 'Point important',
        variants: [
          { id: 'standard', icon: 'important', color: 'amber', label: 'Étoile' },
        ],
      },
      {
        type: 'attention',
        label: 'Attention',
        tooltip: "Point d'attention",
        variants: [
          { id: 'standard', icon: 'attention', color: 'orange', label: 'Triangle' },
        ],
      },
      {
        type: 'idea',
        label: 'Idée',
        tooltip: 'Idée ou concept',
        variants: [
          { id: 'standard', icon: 'idea', color: 'pink', label: 'Ampoule' },
        ],
      },
      {
        type: 'goal',
        label: 'Objectif',
        tooltip: 'Objectif à atteindre',
        variants: [
          { id: 'standard', icon: 'goal', color: 'emerald', label: 'Drapeau' },
        ],
      },
      {
        type: 'success',
        label: 'Succès',
        tooltip: 'Succès ou accomplissement',
        variants: [
          { id: 'standard', icon: 'success', color: 'green', label: 'Badge' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  🖥️ FRONTEND                                                        */
  /* ================================================================== */

  {
    id: 'components',
    label: 'Composants',
    defaultOpen: false,
    items: [
      {
        type: 'component-header',
        label: 'Header',
        tooltip: 'Composant Header',
        variants: [
          { id: 'minimal', icon: 'module', color: 'blue',   label: 'Minimal' },
          { id: 'search',  icon: 'module', color: 'purple', label: 'Avec recherche' },
        ],
      },
      {
        type: 'component-footer',
        label: 'Footer',
        tooltip: 'Composant Footer',
        variants: [
          { id: 'basique', icon: 'module', color: 'slate', label: 'Basique' },
          { id: 'social',  icon: 'module', color: 'blue',  label: 'Avec réseaux' },
        ],
      },
      {
        type: 'component-navbar',
        label: 'Navbar',
        tooltip: 'Composant Navbar',
        variants: [
          { id: 'horizontal', icon: 'module', color: 'blue',   label: 'Horizontale' },
          { id: 'vertical',   icon: 'module', color: 'purple', label: 'Verticale' },
        ],
      },
      {
        type: 'component-form',
        label: 'Formulaire',
        tooltip: 'Composant Formulaire',
        variants: [
          { id: 'simple', icon: 'module', color: 'blue',   label: 'Simple' },
          { id: 'multi',  icon: 'module', color: 'indigo', label: 'Multi-étapes' },
        ],
      },
      {
        type: 'component-modal',
        label: 'Modal',
        tooltip: 'Fenêtre modale',
        variants: [
          { id: 'basique',      icon: 'module', color: 'purple', label: 'Basique' },
          { id: 'confirmation', icon: 'module', color: 'orange', label: 'Confirmation' },
        ],
      },
      {
        type: 'component-table',
        label: 'Tableau',
        tooltip: 'Composant Tableau',
        variants: [
          { id: 'simple',     icon: 'module', color: 'slate', label: 'Simple' },
          { id: 'pagination', icon: 'module', color: 'blue',  label: 'Avec pagination' },
        ],
      },
      {
        type: 'component-sidebar',
        label: 'Sidebar',
        tooltip: 'Barre latérale',
        variants: [
          { id: 'gauche', icon: 'module', color: 'blue',   label: 'Gauche' },
          { id: 'droite', icon: 'module', color: 'purple', label: 'Droite' },
        ],
      },
      {
        type: 'component-breadcrumb',
        label: 'Breadcrumb',
        tooltip: 'Fil d\'Ariane',
        variants: [
          { id: 'simple',  icon: 'arrow', color: 'blue',  label: 'Simple' },
          { id: 'icone',   icon: 'arrow', color: 'slate', label: 'Avec icônes' },
        ],
      },
      {
        type: 'component-stepper',
        label: 'Stepper',
        tooltip: 'Indicateur d\'étapes',
        variants: [
          { id: 'horizontal', icon: 'process', color: 'blue',   label: 'Horizontal' },
          { id: 'vertical',   icon: 'process', color: 'indigo', label: 'Vertical' },
        ],
      },
      {
        type: 'component-tabs',
        label: 'Tabs',
        tooltip: 'Onglets',
        variants: [
          { id: 'ligne',     icon: 'module', color: 'blue',  label: 'En ligne' },
          { id: 'pilule',    icon: 'module', color: 'indigo', label: 'Pilule' },
        ],
      },
      {
        type: 'component-drawer',
        label: 'Drawer',
        tooltip: 'Tiroir coulissant',
        variants: [
          { id: 'gauche', icon: 'module', color: 'blue',   label: 'Gauche' },
          { id: 'droite', icon: 'module', color: 'purple', label: 'Droite' },
        ],
      },
      {
        type: 'component-card',
        label: 'Card',
        tooltip: 'Carte d\'information',
        variants: [
          { id: 'simple',   icon: 'module', color: 'blue',  label: 'Simple' },
          { id: 'media',    icon: 'photo',  color: 'purple', label: 'Avec média' },
        ],
      },
    ],
  },

  {
    id: 'uiux',
    label: 'UI/UX Design',
    defaultOpen: false,
    items: [
      {
        type: 'uiux-designsystem',
        label: 'Design System',
        tooltip: 'Système de design',
        variants: [
          { id: 'bibliotheque', icon: 'cube', color: 'blue',   label: 'Bibliothèque' },
          { id: 'tokens',       icon: 'cube', color: 'purple', label: 'Tokens' },
        ],
      },
      {
        type: 'uiux-responsive',
        label: 'Responsive',
        tooltip: 'Adaptation responsive',
        variants: [
          { id: 'mobile',  icon: 'photo', color: 'cyan',  label: 'Mobile' },
          { id: 'desktop', icon: 'photo', color: 'slate', label: 'Desktop' },
        ],
      },
      {
        type: 'uiux-a11y',
        label: 'Accessibilité',
        tooltip: 'Accessibilité (a11y)',
        variants: [
          { id: 'semantique', icon: 'users', color: 'emerald', label: 'Sémantique' },
          { id: 'wcag',       icon: 'users', color: 'green',   label: 'WCAG' },
        ],
      },
      {
        type: 'uiux-animation',
        label: 'Animation',
        tooltip: 'Animations & transitions',
        variants: [
          { id: 'css', icon: 'sparkles', color: 'pink',   label: 'CSS' },
          { id: 'js',  icon: 'sparkles', color: 'purple', label: 'JS' },
        ],
      },
      {
        type: 'uiux-theming',
        label: 'Thématisation',
        tooltip: 'Thèmes & personnalisation',
        variants: [
          { id: 'light', icon: 'sparkles', color: 'yellow', label: 'Clair' },
          { id: 'dark',  icon: 'sparkles', color: 'slate',  label: 'Sombre' },
        ],
      },
      {
        type: 'uiux-gestures',
        label: 'Gestes tactiles',
        tooltip: 'Interactions tactiles',
        variants: [
          { id: 'swipe', icon: 'arrow', color: 'blue',   label: 'Swipe' },
          { id: 'pinch', icon: 'arrow', color: 'purple', label: 'Pinch' },
        ],
      },
      {
        type: 'uiux-loading',
        label: 'Chargement',
        tooltip: 'États de chargement',
        variants: [
          { id: 'skeleton', icon: 'process', color: 'slate',  label: 'Skeleton' },
          { id: 'spinner',  icon: 'refresh', color: 'blue',   label: 'Spinner' },
        ],
      },
      {
        type: 'uiux-error',
        label: 'Erreurs',
        tooltip: 'États d\'erreur',
        variants: [
          { id: '404',    icon: 'xCircle', color: 'red',    label: '404' },
          { id: 'generic', icon: 'xCircle', color: 'orange', label: 'Générique' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  ⚙️ BACKEND                                                         */
  /* ================================================================== */

  {
    id: 'services',
    label: 'Services',
    defaultOpen: false,
    items: [
      {
        type: 'service-api',
        label: 'API',
        tooltip: 'Service API',
        variants: [
          { id: 'rest',    icon: 'code', color: 'blue',   label: 'REST' },
          { id: 'graphql', icon: 'code', color: 'purple', label: 'GraphQL' },
        ],
      },
      {
        type: 'service-auth',
        label: 'Auth',
        tooltip: "Service d'authentification",
        variants: [
          { id: 'jwt',   icon: 'key', color: 'blue',   label: 'JWT' },
          { id: 'oauth', icon: 'key', color: 'indigo', label: 'OAuth' },
        ],
      },
      {
        type: 'service-database',
        label: 'Database',
        tooltip: 'Service de base de données',
        variants: [
          { id: 'postgres', icon: 'storage', color: 'blue',  label: 'PostgreSQL' },
          { id: 'mongodb',  icon: 'storage', color: 'green', label: 'MongoDB' },
        ],
      },
      {
        type: 'service-cache',
        label: 'Cache',
        tooltip: 'Service de cache',
        variants: [
          { id: 'redis',     icon: 'storage', color: 'red',    label: 'Redis' },
          { id: 'memcached', icon: 'storage', color: 'orange', label: 'Memcached' },
        ],
      },
      {
        type: 'service-queue',
        label: "File d'attente",
        tooltip: 'Service de message/queue',
        variants: [
          { id: 'rabbitmq', icon: 'process', color: 'blue',   label: 'RabbitMQ' },
          { id: 'kafka',    icon: 'process', color: 'purple', label: 'Kafka' },
        ],
      },
      {
        type: 'service-notif',
        label: 'Notifications',
        tooltip: 'Notifications push/SMS',
        variants: [
          { id: 'push', icon: 'sparkles', color: 'blue',  label: 'Push' },
          { id: 'sms',  icon: 'sparkles', color: 'green', label: 'SMS' },
        ],
      },
      {
        type: 'service-email',
        label: 'Email Service',
        tooltip: "Service d'email",
        variants: [
          { id: 'transactionnel', icon: 'document', color: 'blue',   label: 'Transactionnel' },
          { id: 'marketing',      icon: 'document', color: 'purple', label: 'Marketing' },
        ],
      },
      {
        type: 'service-webhook',
        label: 'Webhooks',
        tooltip: 'Hooks HTTP',
        variants: [
          { id: 'entrant', icon: 'link', color: 'blue',   label: 'Entrant' },
          { id: 'sortant', icon: 'link', color: 'orange', label: 'Sortant' },
        ],
      },
      {
        type: 'service-search',
        label: 'Search Engine',
        tooltip: 'Moteur de recherche',
        variants: [
          { id: 'elasticsearch', icon: 'funnel', color: 'blue',   label: 'Elasticsearch' },
          { id: 'algolia',       icon: 'funnel', color: 'purple', label: 'Algolia' },
        ],
      },
      {
        type: 'service-s3',
        label: 'S3 Storage',
        tooltip: 'Stockage objet',
        variants: [
          { id: 'aws', icon: 'cloud', color: 'amber',  label: 'AWS S3' },
          { id: 'minio', icon: 'cloud', color: 'slate', label: 'MinIO' },
        ],
      },
      {
        type: 'service-payment',
        label: 'Payment',
        tooltip: 'Service de paiement',
        variants: [
          { id: 'stripe',   icon: 'key', color: 'indigo', label: 'Stripe' },
          { id: 'paypal',   icon: 'key', color: 'blue',   label: 'PayPal' },
        ],
      },
      {
        type: 'service-logging',
        label: 'Logging',
        tooltip: 'Service de journalisation',
        variants: [
          { id: 'struct', icon: 'document', color: 'slate',  label: 'Structuré' },
          { id: 'json',   icon: 'document', color: 'blue',   label: 'JSON' },
        ],
      },
    ],
  },

  {
    id: 'messaging',
    label: 'Communication & Messaging',
    defaultOpen: false,
    items: [
      {
        type: 'msg-event',
        label: 'Événement',
        tooltip: "Système d'événements",
        variants: [
          { id: 'emitter', icon: 'sparkles', color: 'blue',   label: 'EventEmitter' },
          { id: 'pubsub',  icon: 'sparkles', color: 'purple', label: 'Pub/Sub' },
        ],
      },
      {
        type: 'msg-websocket',
        label: 'WebSocket',
        tooltip: 'Communication temps réel',
        variants: [
          { id: 'bidirectionnel', icon: 'link', color: 'cyan',  label: 'Bidirectionnel' },
          { id: 'socketio',       icon: 'link', color: 'blue',  label: 'Socket.IO' },
        ],
      },
      {
        type: 'msg-rest',
        label: 'Requête HTTP',
        tooltip: 'Communication REST',
        variants: [
          { id: 'get',  icon: 'arrow', color: 'blue',  label: 'GET' },
          { id: 'post', icon: 'arrow', color: 'green', label: 'POST' },
        ],
      },
      {
        type: 'msg-microservice',
        label: 'Microservice',
        tooltip: 'Architecture microservices',
        variants: [
          { id: 'independant', icon: 'cube', color: 'indigo', label: 'Indépendant' },
          { id: 'gateway',     icon: 'cube', color: 'purple', label: 'Gateway' },
        ],
      },
      {
        type: 'msg-grpc',
        label: 'gRPC',
        tooltip: 'Communication gRPC',
        variants: [
          { id: 'unary',    icon: 'code', color: 'blue',   label: 'Unary' },
          { id: 'streaming', icon: 'code', color: 'indigo', label: 'Streaming' },
        ],
      },
      {
        type: 'msg-mqtt',
        label: 'MQTT',
        tooltip: 'Protocole IoT léger',
        variants: [
          { id: 'qos0', icon: 'process', color: 'green',  label: 'QoS 0' },
          { id: 'qos1', icon: 'process', color: 'blue',   label: 'QoS 1' },
        ],
      },
      {
        type: 'msg-sse',
        label: 'SSE',
        tooltip: 'Server-Sent Events',
        variants: [
          { id: 'direct', icon: 'arrow', color: 'cyan',  label: 'Direct' },
          { id: 'reconnect', icon: 'arrow', color: 'blue', label: 'Reconnect' },
        ],
      },
      {
        type: 'msg-graphql-sub',
        label: 'GraphQL Sub',
        tooltip: 'Abonnements GraphQL',
        variants: [
          { id: 'ws',      icon: 'link', color: 'purple', label: 'WebSocket' },
          { id: 'sse',     icon: 'link', color: 'cyan',   label: 'SSE' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  🏗️ ARCHITECTURE                                                    */
  /* ================================================================== */

  {
    id: 'arch',
    label: 'Architecture',
    defaultOpen: false,
    items: [
      {
        type: 'arch-clean',
        label: 'Clean Architecture',
        tooltip: 'Architecture propre',
        variants: [
          { id: 'couches',     icon: 'module', color: 'indigo', label: 'Couches' },
          { id: 'portsadap',   icon: 'module', color: 'purple', label: 'Ports & Adapters' },
        ],
      },
      {
        type: 'arch-hexagonal',
        label: 'Hexagonale',
        tooltip: 'Architecture hexagonale',
        variants: [
          { id: 'hexagone', icon: 'module', color: 'blue',   label: 'Hexagone' },
          { id: 'cqrs',     icon: 'module', color: 'indigo', label: 'CQRS' },
        ],
      },
      {
        type: 'arch-microfrontend',
        label: 'Micro-frontend',
        tooltip: 'Frontend distribué',
        variants: [
          { id: 'independant',  icon: 'module', color: 'purple', label: 'Indépendant' },
          { id: 'modfed',       icon: 'module', color: 'blue',   label: 'Module Federation' },
        ],
      },
      {
        type: 'arch-monolith',
        label: 'Monolithe',
        tooltip: 'Application monolithique',
        variants: [
          { id: 'monolithique', icon: 'module', color: 'slate',  label: 'Monolithique' },
          { id: 'modulaire',    icon: 'module', color: 'indigo', label: 'Modulaire' },
        ],
      },
      {
        type: 'arch-event-driven',
        label: 'Event-Driven',
        tooltip: 'Architecture événementielle',
        variants: [
          { id: 'emitter',  icon: 'sparkles', color: 'blue',   label: 'EventEmitter' },
          { id: 'cqrs-es',  icon: 'sparkles', color: 'purple', label: 'CQRS+ES' },
        ],
      },
      {
        type: 'arch-serverless',
        label: 'Serverless',
        tooltip: 'Architecture serverless',
        variants: [
          { id: 'lambda',    icon: 'process', color: 'blue',   label: 'Lambda' },
          { id: 'functions', icon: 'process', color: 'purple', label: 'Functions' },
        ],
      },
      {
        type: 'arch-microservices',
        label: 'Microservices',
        tooltip: 'Architecture microservices',
        variants: [
          { id: 'independant', icon: 'cube', color: 'blue',   label: 'Indépendant' },
          { id: 'orchestre',  icon: 'cube', color: 'indigo', label: 'Orchestre' },
        ],
      },
      {
        type: 'arch-layered',
        label: 'En couches',
        tooltip: 'Architecture en couches (N-tier)',
        variants: [
          { id: '3tier', icon: 'module', color: 'blue',   label: '3-Tier' },
          { id: 'ntier', icon: 'module', color: 'indigo', label: 'N-Tier' },
        ],
      },
      {
        type: 'arch-soa',
        label: 'SOA',
        tooltip: 'Service-Oriented Architecture',
        variants: [
          { id: 'esb',   icon: 'process', color: 'blue',   label: 'ESB' },
          { id: 'light', icon: 'process', color: 'green',  label: 'Léger' },
        ],
      },
      {
        type: 'arch-ddd',
        label: 'DDD',
        tooltip: 'Domain-Driven Design',
        variants: [
          { id: 'aggregat',  icon: 'module', color: 'purple', label: 'Agrégat' },
          { id: 'bounded',   icon: 'module', color: 'indigo', label: 'Bounded Context' },
        ],
      },
    ],
  },

  {
    id: 'patterns',
    label: 'Design Patterns',
    defaultOpen: false,
    items: [
      {
        type: 'pattern-singleton',
        label: 'Singleton',
        tooltip: 'Instance unique',
        variants: [
          { id: 'classe', icon: 'module', color: 'indigo', label: 'Classe' },
        ],
      },
      {
        type: 'pattern-observer',
        label: 'Observer',
        tooltip: 'Patron observateur',
        variants: [
          { id: 'evenement', icon: 'sparkles', color: 'blue',   label: 'Événement' },
          { id: 'reactif',   icon: 'sparkles', color: 'purple', label: 'Réactif' },
        ],
      },
      {
        type: 'pattern-factory',
        label: 'Factory',
        tooltip: 'Fabrique',
        variants: [
          { id: 'simple',    icon: 'cube', color: 'blue',   label: 'Simple' },
          { id: 'abstraite', icon: 'cube', color: 'indigo', label: 'Abstraite' },
        ],
      },
      {
        type: 'pattern-adapter',
        label: 'Adapter',
        tooltip: 'Adaptateur',
        variants: [
          { id: 'interface', icon: 'branch', color: 'orange', label: 'Interface' },
        ],
      },
      {
        type: 'pattern-strategy',
        label: 'Strategy',
        tooltip: 'Stratégie',
        variants: [
          { id: 'composition', icon: 'branch', color: 'purple', label: 'Composition' },
        ],
      },
      {
        type: 'pattern-decorator',
        label: 'Decorator',
        tooltip: 'Emballage dynamique',
        variants: [
          { id: 'wrapper', icon: 'module', color: 'blue',   label: 'Wrapper' },
          { id: 'enhanced', icon: 'module', color: 'purple', label: 'Enhanced' },
        ],
      },
      {
        type: 'pattern-builder',
        label: 'Builder',
        tooltip: 'Construction étape par étape',
        variants: [
          { id: 'chaine', icon: 'module', color: 'indigo', label: 'Chaîné' },
          { id: 'direct', icon: 'module', color: 'blue',   label: 'Direct' },
        ],
      },
      {
        type: 'pattern-composite',
        label: 'Composite',
        tooltip: 'Structure arborescente',
        variants: [
          { id: 'arbre', icon: 'branch', color: 'green',  label: 'Arbre' },
          { id: 'feuille', icon: 'branch', color: 'blue', label: 'Feuille' },
        ],
      },
      {
        type: 'pattern-proxy',
        label: 'Proxy',
        tooltip: 'Intermédiaire contrôlé',
        variants: [
          { id: 'controle', icon: 'shield', color: 'blue',   label: 'Contrôle' },
          { id: 'cache',    icon: 'storage', color: 'indigo', label: 'Cache' },
        ],
      },
      {
        type: 'pattern-state',
        label: 'State',
        tooltip: 'État interne',
        variants: [
          { id: 'fsm', icon: 'process', color: 'blue',   label: 'FSM' },
          { id: 'contexte', icon: 'process', color: 'purple', label: 'Contexte' },
        ],
      },
      {
        type: 'pattern-command',
        label: 'Command',
        tooltip: 'Encapsulation de requête',
        variants: [
          { id: 'action', icon: 'process', color: 'green',  label: 'Action' },
          { id: 'undo',   icon: 'refresh', color: 'orange', label: 'Undo/Redo' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  📊 DATA                                                            */
  /* ================================================================== */

  {
    id: 'data',
    label: 'Data / IA',
    defaultOpen: false,
    items: [
      {
        type: 'data-ml',
        label: 'Modèle ML',
        tooltip: 'Modèle de machine learning',
        variants: [
          { id: 'classification', icon: 'cube', color: 'blue',   label: 'Classification' },
          { id: 'regression',     icon: 'cube', color: 'indigo', label: 'Régression' },
        ],
      },
      {
        type: 'data-training',
        label: "Données d'entraînement",
        tooltip: "Dataset d'entraînement",
        variants: [
          { id: 'dataset',      icon: 'storage', color: 'blue',   label: 'Dataset' },
          { id: 'augmentation', icon: 'storage', color: 'purple', label: 'Augmentation' },
        ],
      },
      {
        type: 'data-pipeline',
        label: 'Pipeline de données',
        tooltip: 'ETL / streaming',
        variants: [
          { id: 'etl',    icon: 'process', color: 'blue',  label: 'ETL' },
          { id: 'stream', icon: 'process', color: 'cyan',  label: 'Stream' },
        ],
      },
      {
        type: 'data-ai',
        label: 'API IA',
        tooltip: "API d'intelligence artificielle",
        variants: [
          { id: 'llm',    icon: 'sparkles', color: 'purple', label: 'LLM' },
          { id: 'vision', icon: 'sparkles', color: 'blue',   label: 'Vision' },
        ],
      },
      {
        type: 'data-warehouse',
        label: 'Entrepôt de données',
        tooltip: 'Data warehouse',
        variants: [
          { id: 'snowflake', icon: 'storage', color: 'blue',   label: 'Snowflake' },
          { id: 'bigquery',  icon: 'storage', color: 'indigo', label: 'BigQuery' },
        ],
      },
      {
        type: 'data-viz',
        label: 'Visualisation',
        tooltip: 'Visualisation de données',
        variants: [
          { id: 'dashboard', icon: 'chartBar', color: 'blue',   label: 'Dashboard' },
          { id: 'graphique', icon: 'chartBar', color: 'purple', label: 'Graphique' },
        ],
      },
      {
        type: 'data-streaming',
        label: 'Streaming temps réel',
        tooltip: 'Traitement en flux continu',
        variants: [
          { id: 'kafka',   icon: 'process', color: 'blue',   label: 'Kafka' },
          { id: 'flink',   icon: 'process', color: 'cyan',   label: 'Flink' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  ✅ QUALITÉ                                                         */
  /* ================================================================== */

  {
    id: 'testing',
    label: 'Tests & Qualité',
    defaultOpen: false,
    items: [
      {
        type: 'test-unit',
        label: 'Test unitaire',
        tooltip: 'Test unitaire',
        variants: [
          { id: 'fonction', icon: 'success', color: 'green', label: 'Fonction' },
          { id: 'mock',     icon: 'process', color: 'blue',  label: 'Mock' },
        ],
      },
      {
        type: 'test-integration',
        label: "Test d'intégration",
        tooltip: "Test d'intégration",
        variants: [
          { id: 'module', icon: 'success', color: 'indigo', label: 'Module' },
          { id: 'api',    icon: 'code',    color: 'purple', label: 'API' },
        ],
      },
      {
        type: 'test-e2e',
        label: 'Test E2E',
        tooltip: 'Test end-to-end',
        variants: [
          { id: 'cypress',    icon: 'process', color: 'blue',   label: 'Cypress' },
          { id: 'playwright', icon: 'process', color: 'purple', label: 'Playwright' },
        ],
      },
      {
        type: 'test-coverage',
        label: 'Couverture',
        tooltip: 'Couverture de code',
        variants: [
          { id: 'rapport', icon: 'document', color: 'green',   label: 'Rapport' },
          { id: 'seuil',   icon: 'goal',     color: 'emerald', label: 'Seuil' },
        ],
      },
      {
        type: 'test-lint',
        label: 'Linting',
        tooltip: 'Linting & formatage',
        variants: [
          { id: 'eslint',   icon: 'beaker', color: 'blue',   label: 'ESLint' },
          { id: 'prettier', icon: 'beaker', color: 'purple', label: 'Prettier' },
        ],
      },
      {
        type: 'test-review',
        label: 'Code Review',
        tooltip: 'Revue de code',
        variants: [
          { id: 'solo',  icon: 'eye',   color: 'orange', label: 'Solo' },
          { id: 'pair',  icon: 'users', color: 'blue',   label: 'Pair Programming' },
        ],
      },
      {
        type: 'test-metrics',
        label: 'Métriques',
        tooltip: 'Métriques de code',
        variants: [
          { id: 'complexite',   icon: 'chartBar', color: 'amber',  label: 'Complexité' },
          { id: 'duplication',  icon: 'chartBar', color: 'red',    label: 'Duplication' },
        ],
      },
      {
        type: 'test-snapshot',
        label: 'Snapshot',
        tooltip: 'Tests de snapshot',
        variants: [
          { id: 'composant', icon: 'photo', color: 'blue',   label: 'Composant' },
          { id: 'visual',    icon: 'photo', color: 'purple', label: 'Visual' },
        ],
      },
      {
        type: 'test-perf',
        label: 'Performance',
        tooltip: 'Tests de performance',
        variants: [
          { id: 'load',  icon: 'chartBar', color: 'blue',   label: 'Load' },
          { id: 'stress', icon: 'chartBar', color: 'red',   label: 'Stress' },
        ],
      },
      {
        type: 'test-mutation',
        label: 'Mutation Testing',
        tooltip: 'Tests de mutation',
        variants: [
          { id: 'auto',   icon: 'beaker', color: 'green',  label: 'Automatisé' },
          { id: 'guide',  icon: 'beaker', color: 'indigo', label: 'Guidé' },
        ],
      },
      {
        type: 'test-bdd',
        label: 'BDD',
        tooltip: 'Behavior-Driven Development',
        variants: [
          { id: 'scenarios', icon: 'document', color: 'green',  label: 'Scénarios' },
          { id: 'gherkin',   icon: 'document', color: 'emerald', label: 'Gherkin' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  📋 PROCESSUS                                                       */
  /* ================================================================== */

  {
    id: 'project',
    label: 'Gestion de projet',
    defaultOpen: false,
    items: [
      {
        type: 'proj-story',
        label: 'User Story',
        tooltip: 'Récit utilisateur',
        variants: [
          { id: 'simple', icon: 'document', color: 'blue',   label: 'Simple' },
          { id: 'epic',   icon: 'document', color: 'purple', label: 'Epic' },
        ],
      },
      {
        type: 'proj-task',
        label: 'Tâche',
        tooltip: 'Tâche de développement',
        variants: [
          { id: 'principale', icon: 'process', color: 'blue',   label: 'Principale' },
          { id: 'sous-tache', icon: 'process', color: 'indigo', label: 'Sous-tâche' },
        ],
      },
      {
        type: 'proj-sprint',
        label: 'Sprint',
        tooltip: 'Itération / sprint',
        variants: [
          { id: 'scrum',  icon: 'rocket', color: 'blue',  label: 'Scrum' },
          { id: 'kanban', icon: 'rocket', color: 'green', label: 'Kanban' },
        ],
      },
      {
        type: 'proj-bug',
        label: 'Bug / Incident',
        tooltip: 'Bug ou incident',
        variants: [
          { id: 'bug',      icon: 'xCircle',   color: 'red',    label: 'Bug' },
          { id: 'incident', icon: 'attention', color: 'orange', label: 'Incident' },
        ],
      },
      {
        type: 'proj-ticket',
        label: 'Ticket',
        tooltip: 'Ticket / issue',
        variants: [
          { id: 'normal', icon: 'tag', color: 'blue',  label: 'Normal' },
          { id: 'urgent', icon: 'tag', color: 'red',   label: 'Urgent' },
        ],
      },
      {
        type: 'proj-roadmap',
        label: 'Roadmap',
        tooltip: 'Feuille de route produit',
        variants: [
          { id: 'planifiee',  icon: 'document', color: 'indigo', label: 'Planifiée' },
          { id: 'evolutive',  icon: 'document', color: 'purple', label: 'Évolutive' },
        ],
      },
      {
        type: 'proj-retro',
        label: 'Rétrospective',
        tooltip: 'Rétrospective de sprint',
        variants: [
          { id: 'sprint', icon: 'refresh', color: 'blue',   label: 'Sprint' },
          { id: 'kaizen', icon: 'refresh', color: 'green',  label: 'Kaizen' },
        ],
      },
      {
        type: 'proj-backlog',
        label: 'Backlog',
        tooltip: 'Arriéré de tâches',
        variants: [
          { id: 'priorise', icon: 'funnel', color: 'amber',  label: 'Priorisé' },
          { id: 'groomed',  icon: 'funnel', color: 'indigo', label: 'Groomed' },
        ],
      },
      {
        type: 'proj-estimation',
        label: 'Estimation',
        tooltip: 'Estimation de complexité',
        variants: [
          { id: 'sp',    icon: 'chartBar', color: 'blue',   label: 'Story Points' },
          { id: 'poker', icon: 'chartBar', color: 'purple', label: 'Planning Poker' },
        ],
      },
      {
        type: 'proj-milestone',
        label: 'Jalon',
        tooltip: 'Jalon / milestone',
        variants: [
          { id: 'livrable', icon: 'goal', color: 'green',  label: 'Livrable' },
          { id: 'gate',     icon: 'goal', color: 'orange', label: 'Gate' },
        ],
      },
    ],
  },

  {
    id: 'git',
    label: 'Git & Versioning',
    defaultOpen: false,
    items: [
      {
        type: 'git-branch',
        label: 'Branche',
        tooltip: 'Gestion de branches',
        variants: [
          { id: 'feature', icon: 'branch', color: 'blue',  label: 'Feature' },
          { id: 'release', icon: 'branch', color: 'green', label: 'Release' },
        ],
      },
      {
        type: 'git-merge',
        label: 'Merge / Rebase',
        tooltip: 'Fusion de branches',
        variants: [
          { id: 'merge',  icon: 'branch', color: 'indigo', label: 'Merge' },
          { id: 'rebase', icon: 'branch', color: 'purple', label: 'Rebase' },
        ],
      },
      {
        type: 'git-pr',
        label: 'Pull Request',
        tooltip: 'Demande de fusion',
        variants: [
          { id: 'simple',      icon: 'code', color: 'blue',   label: 'Simple' },
          { id: 'code-review', icon: 'code', color: 'orange', label: 'Code Review' },
        ],
      },
      {
        type: 'git-tag',
        label: 'Tag',
        tooltip: 'Étiquette de version',
        variants: [
          { id: 'annotated', icon: 'tag', color: 'blue',   label: 'Annotated' },
          { id: 'lightweight', icon: 'tag', color: 'slate', label: 'Léger' },
        ],
      },
      {
        type: 'git-stash',
        label: 'Stash',
        tooltip: 'Mise de côté temporaire',
        variants: [
          { id: 'stash',   icon: 'storage', color: 'amber',  label: 'Stash' },
          { id: 'pop',     icon: 'refresh', color: 'green',  label: 'Pop' },
        ],
      },
      {
        type: 'git-cherrypick',
        label: 'Cherry-pick',
        tooltip: 'Sélection de commit',
        variants: [
          { id: 'single', icon: 'process', color: 'red',    label: 'Simple' },
          { id: 'range',  icon: 'process', color: 'orange', label: 'Plage' },
        ],
      },
      {
        type: 'git-revert',
        label: 'Revert',
        tooltip: 'Annulation de commit',
        variants: [
          { id: 'commit',  icon: 'refresh', color: 'red',    label: 'Commit' },
          { id: 'merge',   icon: 'refresh', color: 'orange', label: 'Merge' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  🖧 INFRASTRUCTURE                                                   */
  /* ================================================================== */

  {
    id: 'devops',
    label: 'DevOps & Infrastructure',
    defaultOpen: false,
    items: [
      {
        type: 'devops-ci',
        label: 'CI',
        tooltip: 'Intégration continue',
        variants: [
          { id: 'ghactions', icon: 'process', color: 'blue',   label: 'GitHub Actions' },
          { id: 'gitlabci',  icon: 'process', color: 'orange', label: 'GitLab CI' },
        ],
      },
      {
        type: 'devops-cd',
        label: 'CD',
        tooltip: 'Déploiement continu',
        variants: [
          { id: 'automatise', icon: 'rocket', color: 'blue',  label: 'Automatisé' },
          { id: 'canary',     icon: 'rocket', color: 'amber', label: 'Canary' },
        ],
      },
      {
        type: 'devops-container',
        label: 'Container',
        tooltip: 'Conteneurisation',
        variants: [
          { id: 'docker',     icon: 'cube', color: 'blue',   label: 'Docker' },
          { id: 'kubernetes', icon: 'cube', color: 'indigo', label: 'Kubernetes' },
        ],
      },
      {
        type: 'devops-monitoring',
        label: 'Monitoring',
        tooltip: 'Supervision',
        variants: [
          { id: 'logs',      icon: 'document', color: 'slate', label: 'Logs' },
          { id: 'metriques', icon: 'process',  color: 'green', label: 'Métriques' },
        ],
      },
      {
        type: 'devops-infra',
        label: 'Infrastructure',
        tooltip: 'Infrastructure as Code',
        variants: [
          { id: 'terraform', icon: 'module', color: 'purple', label: 'Terraform' },
          { id: 'ansible',   icon: 'module', color: 'red',    label: 'Ansible' },
        ],
      },
      {
        type: 'devops-dns',
        label: 'DNS',
        tooltip: 'Résolution DNS',
        variants: [
          { id: 'principal', icon: 'globe',       color: 'blue',   label: 'Principal' },
          { id: 'failover',  icon: 'globe',       color: 'indigo', label: 'Failover' },
        ],
      },
      {
        type: 'devops-lb',
        label: 'Load Balancer',
        tooltip: 'Répartition de charge',
        variants: [
          { id: 'roundrobin', icon: 'serverStack', color: 'blue',   label: 'Round Robin' },
          { id: 'ha',         icon: 'serverStack', color: 'indigo', label: 'HA' },
        ],
      },
      {
        type: 'devops-cdn',
        label: 'CDN',
        tooltip: 'Content Delivery Network',
        variants: [
          { id: 'classique', icon: 'cloud', color: 'cyan',  label: 'Classique' },
          { id: 'edge',      icon: 'cloud', color: 'blue',  label: 'Edge' },
        ],
      },
      {
        type: 'devops-registry',
        label: 'Container Registry',
        tooltip: 'Registre de conteneurs',
        variants: [
          { id: 'dockerhub', icon: 'serverStack', color: 'blue',   label: 'Docker Hub' },
          { id: 'prive',     icon: 'lock',        color: 'indigo', label: 'Privé' },
        ],
      },
      {
        type: 'devops-secrets',
        label: 'Secrets Mgmt',
        tooltip: 'Gestion centralisée des secrets',
        variants: [
          { id: 'vault', icon: 'lock', color: 'purple', label: 'Vault' },
          { id: 'ssm',   icon: 'lock', color: 'amber',  label: 'SSM' },
        ],
      },
      {
        type: 'devops-alerting',
        label: 'Alertes',
        tooltip: 'Système d\'alertes',
        variants: [
          { id: 'pagerduty', icon: 'attention', color: 'red',    label: 'PagerDuty' },
          { id: 'email',     icon: 'document',  color: 'orange', label: 'Email' },
        ],
      },
      {
        type: 'devops-feature-flag',
        label: 'Feature Flags',
        tooltip: 'Gestion des feature flags',
        variants: [
          { id: 'launchdarkly', icon: 'goal', color: 'blue',   label: 'LaunchDarkly' },
          { id: 'unleash',      icon: 'goal', color: 'green',  label: 'Unleash' },
        ],
      },
    ],
  },

  {
    id: 'security',
    label: 'Sécurité',
    defaultOpen: false,
    items: [
      {
        type: 'sec-auth',
        label: 'Authentification',
        tooltip: "Mécanisme d'authentification",
        variants: [
          { id: 'mfa', icon: 'shield', color: 'green', label: 'MFA' },
          { id: 'sso', icon: 'shield', color: 'blue',  label: 'SSO' },
        ],
      },
      {
        type: 'sec-encrypt',
        label: 'Chiffrement',
        tooltip: 'Chiffrement des données',
        variants: [
          { id: 'tls', icon: 'lock', color: 'blue',   label: 'TLS' },
          { id: 'aes', icon: 'lock', color: 'indigo', label: 'AES' },
        ],
      },
      {
        type: 'sec-rbac',
        label: "Contrôle d'accès",
        tooltip: 'Gestion des rôles',
        variants: [
          { id: 'rbac', icon: 'users', color: 'amber',  label: 'RBAC' },
          { id: 'acl',  icon: 'key',   color: 'orange', label: 'ACL' },
        ],
      },
      {
        type: 'sec-firewall',
        label: 'Pare-feu',
        tooltip: 'Protection réseau',
        variants: [
          { id: 'filtrage', icon: 'shield', color: 'red',    label: 'Filtrage' },
          { id: 'waf',      icon: 'shield', color: 'orange', label: 'WAF' },
        ],
      },
      {
        type: 'sec-oauth2',
        label: 'OAuth2',
        tooltip: 'Protocole OAuth2',
        variants: [
          { id: 'authorization', icon: 'key', color: 'blue',   label: 'Authorization Code' },
          { id: 'pkce',          icon: 'key', color: 'indigo', label: 'PKCE' },
        ],
      },
      {
        type: 'sec-ratelimit',
        label: 'Rate Limiting',
        tooltip: 'Limitation de débit',
        variants: [
          { id: 'fixed',    icon: 'funnel', color: 'orange', label: 'Fenêtre fixe' },
          { id: 'sliding',  icon: 'funnel', color: 'amber',  label: 'Glissante' },
        ],
      },
      {
        type: 'sec-cors',
        label: 'CORS',
        tooltip: 'Cross-Origin Resource Sharing',
        variants: [
          { id: 'permissif', icon: 'shield', color: 'green',  label: 'Permissif' },
          { id: 'strict',    icon: 'shield', color: 'red',    label: 'Strict' },
        ],
      },
      {
        type: 'sec-csp',
        label: 'CSP',
        tooltip: 'Content Security Policy',
        variants: [
          { id: 'report',  icon: 'eye', color: 'blue',   label: 'Report' },
          { id: 'enforce', icon: 'eye', color: 'orange', label: 'Enforce' },
        ],
      },
      {
        type: 'sec-audit',
        label: 'Audit',
        tooltip: 'Traçabilité & audit',
        variants: [
          { id: 'log',      icon: 'document', color: 'slate',  label: 'Log' },
          { id: 'compliant', icon: 'document', color: 'green',  label: 'Conforme' },
        ],
      },
    ],
  },

  /* ================================================================== */
  /*  🛠️ SUPPORT                                                         */
  /* ================================================================== */

  {
    id: 'dependencies',
    label: 'Gestion de dépendances',
    defaultOpen: false,
    items: [
      {
        type: 'dep-package',
        label: 'Package',
        tooltip: 'Bibliothèque / package',
        variants: [
          { id: 'npm',  icon: 'module', color: 'red',  label: 'NPM' },
          { id: 'pypi', icon: 'module', color: 'blue', label: 'PyPI' },
        ],
      },
      {
        type: 'dep-version',
        label: 'Versioning',
        tooltip: 'Gestion de version',
        variants: [
          { id: 'semver', icon: 'tag',    color: 'blue',  label: 'Semver' },
          { id: 'lock',   icon: 'shield', color: 'slate', label: 'Lock' },
        ],
      },
      {
        type: 'dep-mono',
        label: 'Monorepo',
        tooltip: 'Gestion monorepo',
        variants: [
          { id: 'workspaces', icon: 'module', color: 'indigo', label: 'Workspaces' },
          { id: 'turborepo',  icon: 'module', color: 'purple', label: 'Turborepo' },
        ],
      },
      {
        type: 'dep-audit',
        label: 'Audit sécurité',
        tooltip: 'Audit de vulnérabilités',
        variants: [
          { id: 'auto',    icon: 'shield', color: 'green',  label: 'Automatisé' },
          { id: 'manuel',  icon: 'shield', color: 'amber',  label: 'Manuel' },
        ],
      },
      {
        type: 'dep-license',
        label: 'Conformité licence',
        tooltip: 'Vérification des licences',
        variants: [
          { id: 'permissive', icon: 'document', color: 'green',  label: 'Permissive' },
          { id: 'copyleft',   icon: 'document', color: 'orange', label: 'Copyleft' },
        ],
      },
      {
        type: 'dep-update',
        label: 'Mise à jour',
        tooltip: 'Stratégie de mise à jour',
        variants: [
          { id: 'patch',   icon: 'refresh', color: 'blue',  label: 'Patch' },
          { id: 'majeure', icon: 'refresh', color: 'red',   label: 'Majeure' },
        ],
      },
      {
        type: 'dep-registry',
        label: 'Registry',
        tooltip: 'Registre de paquets',
        variants: [
          { id: 'prive',  icon: 'lock', color: 'indigo', label: 'Privé' },
          { id: 'public', icon: 'globe', color: 'blue',   label: 'Public' },
        ],
      },
      {
        type: 'dep-lockfile',
        label: 'Lockfile',
        tooltip: 'Fichier de verrouillage',
        variants: [
          { id: 'pinned',   icon: 'lock', color: 'slate',  label: 'Pinned' },
          { id: 'resolu',   icon: 'lock', color: 'blue',   label: 'Résolu' },
        ],
      },
    ],
  },

  {
    id: 'init',
    label: 'Initialisation',
    defaultOpen: false,
    items: [
      {
        type: 'init-nextjs',
        label: 'Init Next.js',
        tooltip: 'Initialiser un projet Next.js',
        variants: [
          { id: 'typescript', icon: 'rocket', color: 'blue',   label: 'TypeScript' },
          { id: 'javascript', icon: 'rocket', color: 'yellow', label: 'JavaScript' },
        ],
      },
      {
        type: 'init-react',
        label: 'Init React',
        tooltip: 'Initialiser un projet React',
        variants: [
          { id: 'vite', icon: 'rocket', color: 'blue',   label: 'Vite' },
          { id: 'cra',  icon: 'cube',   color: 'orange', label: 'CRA' },
        ],
      },
      {
        type: 'init-vue',
        label: 'Init Vue',
        tooltip: 'Initialiser un projet Vue',
        variants: [
          { id: 'vite', icon: 'rocket', color: 'green', label: 'Vite' },
          { id: 'cli',  icon: 'code',   color: 'blue',  label: 'CLI' },
        ],
      },
      {
        type: 'init-angular',
        label: 'Init Angular',
        tooltip: 'Initialiser un projet Angular',
        variants: [
          { id: 'standalone', icon: 'rocket', color: 'red',    label: 'Standalone' },
          { id: 'modules',    icon: 'rocket', color: 'blue',   label: 'Modules' },
        ],
      },
      {
        type: 'init-svelte',
        label: 'Init Svelte',
        tooltip: 'Initialiser un projet Svelte',
        variants: [
          { id: 'sveltekit', icon: 'rocket', color: 'orange', label: 'SvelteKit' },
          { id: 'vite',      icon: 'rocket', color: 'amber',  label: 'Vite' },
        ],
      },
      {
        type: 'init-nestjs',
        label: 'Init NestJS',
        tooltip: 'Initialiser un projet NestJS',
        variants: [
          { id: 'typescript', icon: 'rocket', color: 'red',  label: 'TypeScript' },
          { id: 'monorepo',   icon: 'rocket', color: 'blue', label: 'Monorepo' },
        ],
      },
      {
        type: 'init-express',
        label: 'Init Express',
        tooltip: 'Initialiser un projet Express',
        variants: [
          { id: 'minimal', icon: 'rocket', color: 'slate',  label: 'Minimal' },
          { id: 'full',    icon: 'rocket', color: 'green',  label: 'Full' },
        ],
      },
    ],
  },

  {
    id: 'env',
    label: 'Environnement',
    defaultOpen: false,
    items: [
      {
        type: 'env-secure',
        label: 'Env sécurisé',
        tooltip: 'Mettre en place un environnement sécurisé',
        variants: [
          { id: 'basique',  icon: 'shield', color: 'green', label: 'Basique' },
          { id: 'renforce', icon: 'shield', color: 'red',   label: 'Renforcé' },
        ],
      },
      {
        type: 'env-vars',
        label: "Variables d'env",
        tooltip: "Configurer les variables d'environnement",
        variants: [
          { id: 'local',      icon: 'cog', color: 'blue', label: 'Local' },
          { id: 'production', icon: 'cog', color: 'red',  label: 'Production' },
        ],
      },
      {
        type: 'env-config',
        label: 'Configuration',
        tooltip: 'Fichier de configuration',
        variants: [
          { id: 'json', icon: 'document', color: 'blue',   label: 'JSON' },
          { id: 'yaml', icon: 'document', color: 'purple', label: 'YAML' },
        ],
      },
      {
        type: 'env-secrets',
        label: 'Secrets',
        tooltip: 'Gestion des secrets',
        variants: [
          { id: 'vault',    icon: 'lock', color: 'indigo', label: 'Vault' },
          { id: 'env-file', icon: 'lock', color: 'slate',  label: '.env File' },
        ],
      },
      {
        type: 'env-feature-flag',
        label: 'Feature Flags',
        tooltip: 'Drapeaux de fonctionnalités',
        variants: [
          { id: 'active',  icon: 'goal', color: 'green',  label: 'Activé' },
          { id: 'ab-test', icon: 'goal', color: 'purple', label: 'A/B Test' },
        ],
      },
      {
        type: 'env-staging',
        label: 'Staging',
        tooltip: 'Environnement de pré-production',
        variants: [
          { id: 'preview', icon: 'eye', color: 'blue',   label: 'Preview' },
          { id: 'preprod', icon: 'eye', color: 'orange', label: 'Pré-prod' },
        ],
      },
      {
        type: 'env-local',
        label: 'Dev local',
        tooltip: 'Environnement de développement local',
        variants: [
          { id: 'docker-compose', icon: 'cube', color: 'cyan',   label: 'Docker Compose' },
          { id: 'devcontainer',   icon: 'cube', color: 'blue',   label: 'Dev Container' },
        ],
      },
      {
        type: 'env-logging',
        label: 'Logs locaux',
        tooltip: 'Journalisation locale',
        variants: [
          { id: 'console', icon: 'code', color: 'slate',  label: 'Console' },
          { id: 'fichier', icon: 'document', color: 'blue',   label: 'Fichier' },
        ],
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  State                                                                     */
/* -------------------------------------------------------------------------- */

let container = null;
let searchInput = null;
let searchClear = null;
let countEl = null;
const openSections = new Set();

PALETTE.forEach((cat) => {
  if (cat.defaultOpen) openSections.add(cat.id);
});

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ouvre ou ferme toutes les sections de la palette.
 * @param {boolean} open - true pour ouvrir, false pour fermer
 */
export function toggleAllSections(open) {
  if (open) {
    PALETTE.forEach((cat) => openSections.add(cat.id));
  } else {
    openSections.clear();
  }
  renderPalette();
}

export async function initializeMenuMermaidActionsLeft() {
  console.log('📋 Initialisation de la palette…');

  container = document.getElementById('palette-container');
  searchInput = document.getElementById('palette-search');
  searchClear = document.getElementById('palette-search-clear');
  countEl = document.getElementById('palette-count');

  if (!container) throw new Error('#palette-container introuvable');

  renderPalette();

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (searchClear) searchClear.hidden = q.length === 0;
      renderPalette(q);
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.hidden = true;
      renderPalette('');
      searchInput.focus();
    });
  }

  updateCount();
  console.log('✅ Palette initialisée');
}

/* -------------------------------------------------------------------------- */
/*  Render                                                                    */
/* -------------------------------------------------------------------------- */

function renderPalette(searchQuery = '') {
  container.innerHTML = '';
  const q = searchQuery.toLowerCase();

  for (const category of PALETTE) {
    const visibleItems = q
      ? category.items.filter((it) => {
          if (it.label.toLowerCase().includes(q)) return true;
          if (it.type.toLowerCase().includes(q)) return true;
          if ((it.tooltip || '').toLowerCase().includes(q)) return true;
          if (it.variants.some((v) => v.label.toLowerCase().includes(q))) return true;
          return false;
        })
      : category.items;

    if (visibleItems.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'palette-section';
    if (openSections.has(category.id) || q) section.classList.add('is-open');

    const header = document.createElement('button');
    header.className = 'palette-section__header';
    header.type = 'button';
    header.setAttribute('aria-expanded', section.classList.contains('is-open'));
    header.innerHTML = `
      <span class="palette-section__chevron">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </span>
      <span class="palette-section__label">${category.label}</span>
      <span class="palette-section__count">${visibleItems.length}</span>
    `;

    header.addEventListener('click', () => {
      const isOpen = section.classList.toggle('is-open');
      header.setAttribute('aria-expanded', isOpen);
      if (isOpen) openSections.add(category.id);
      else openSections.delete(category.id);
      updateCollapseButton();
    });

    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'palette-section__body';

    const grid = document.createElement('div');
    grid.className = 'elements-grid';

    for (const item of visibleItems) {
      grid.appendChild(createCard(item));
    }

    body.appendChild(grid);
    section.appendChild(body);
    container.appendChild(section);
  }

  if (q && container.children.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = `Aucun résultat pour « ${searchQuery} »`;
    container.appendChild(empty);
  }

  updateCount();
  updateCollapseButton();
}

/* -------------------------------------------------------------------------- */
/*  Collapse button sync                                                      */
/* -------------------------------------------------------------------------- */

function updateCollapseButton() {
  const btn = document.getElementById('palette-collapse-btn');
  if (!btn) return;
  const anyOpen = openSections.size > 0;
  btn.textContent = anyOpen ? 'Tout fermer' : 'Tout ouvrir';
  btn.title = anyOpen ? 'Fermer toutes les catégories' : 'Ouvrir toutes les catégories';
}

/* -------------------------------------------------------------------------- */
/*  Card creation                                                             */
/* -------------------------------------------------------------------------- */

function createCard(item) {
  const el = document.createElement('div');
  el.className = 'element-card element-card--selector';
  el.draggable = true;
  el.title = item.tooltip || item.label;
  // Variante active (par défaut : la première)
  const initialVariant = item.variants[0];

  el.innerHTML = `
    <span class="element-card__icon"></span>
    <span class="element-card__label">${item.label}</span>
    <span class="element-card__select-wrap">
      <select class="element-card__select" aria-label="Variante pour ${item.label}">
        ${item.variants.map((v) => `<option value="${v.id}">${v.label}</option>`).join('')}
      </select>
      <span class="element-card__chevron" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    </span>
  `;

  const iconEl = el.querySelector('.element-card__icon');
  const selectEl = el.querySelector('.element-card__select');

  // Met à jour l'icône et le data-color de la carte en fonction de la variante
  const applyVariant = (variantId) => {
    const variant = item.variants.find((v) => v.id === variantId) || initialVariant;
    iconEl.innerHTML = getIcon(variant.icon);
    el.dataset.color = variant.color;
    el.dataset.variant = variant.id;
    el.dataset.variantIcon = variant.icon;
    el.dataset.variantColor = variant.color;
    el.dataset.variantLabel = variant.label;
  };
  applyVariant(initialVariant.id);

  // À chaque changement de <select> : met à jour l'aperçu de la carte
  selectEl.addEventListener('change', () => {
    applyVariant(selectEl.value);
  });
  // Empêche le drag de se déclencher quand on interagit avec le select
  selectEl.addEventListener('mousedown', (e) => e.stopPropagation());
  selectEl.addEventListener('click', (e) => e.stopPropagation());
  // Sur la zone du select-wrap aussi
  el.querySelector('.element-card__select-wrap').addEventListener('mousedown', (e) => e.stopPropagation());
  el.querySelector('.element-card__select-wrap').addEventListener('click', (e) => e.stopPropagation());

  el.addEventListener('dragstart', (e) => {
    const variant = item.variants.find((v) => v.id === selectEl.value) || initialVariant;
    const payload = JSON.stringify({
      type: item.type,
      label: item.label,
      variant: variant.id,
      variantLabel: variant.label,
      icon: variant.icon,
      color: variant.color,
    });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'copy';
    el.classList.add('is-dragging');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
  });

  return el;
}

/* -------------------------------------------------------------------------- */
/*  Count badge                                                               */
/* -------------------------------------------------------------------------- */

function updateCount() {
  if (!countEl) return;
  let total = 0;
  for (const cat of PALETTE) {
    total += cat.items.length;
  }
  countEl.textContent = total;
}
