/**
 * CONFIGURATION SIDEBAR-40
 * Configuration des éléments et catégories pour la sidebar
 */

export const sidebarConfig = {
    categories: [
        {
            id: 'architecture',
            name: 'Architecture Projet',
            icon: '🏗️',
            elements: [
                { id: 'frontend', name: 'Frontend', icon: '🖥️', template: 'Frontend([Interface Utilisateur])' },
                { id: 'backend', name: 'Backend', icon: '⚙️', template: 'Backend([Logique Métier])' },
                { id: 'database', name: 'Base de Données', icon: '🗄️', template: 'Database([Stockage])' },
                { id: 'api', name: 'API', icon: '🔌', template: 'API([Services Web])' },
                { id: 'mobile', name: 'Application Mobile', icon: '📱', template: 'Mobile([App Native])' },
                { id: 'desktop', name: 'Application Desktop', icon: '💻', template: 'Desktop([Logiciel])' }
            ]
        },
        {
            id: 'frontend',
            name: 'Composants Frontend',
            icon: '🖼️',
            elements: [
                { id: 'component', name: 'Composant', icon: '🧩', template: 'Component([Composant UI])' },
                { id: 'page', name: 'Page', icon: '📄', template: 'Page([Page Web])' },
                { id: 'form', name: 'Formulaire', icon: '📝', template: 'Form([Formulaire])' },
                { id: 'button', name: 'Bouton', icon: '🔘', template: 'Button([Action])' },
                { id: 'input', name: 'Champ de Saisie', icon: '📝', template: 'Input([Saisie Utilisateur])' },
                { id: 'modal', name: 'Modal/Fenêtre', icon: '🪟', template: 'Modal([Popup])' }
            ]
        },
        {
            id: 'backend',
            name: 'Services Backend',
            icon: '🔧',
            elements: [
                { id: 'service', name: 'Service', icon: '⚙️', template: 'Service([Service Métier])' },
                { id: 'controller', name: 'Contrôleur', icon: '🎮', template: 'Controller([Gestionnaire])' },
                { id: 'model', name: 'Modèle', icon: '📊', template: 'Model([Modèle Données])' },
                { id: 'middleware', name: 'Middleware', icon: '🔗', template: 'Middleware([Intercepteur])' },
                { id: 'auth', name: 'Authentification', icon: '🔐', template: 'Auth([Sécurité])' },
                { id: 'validation', name: 'Validation', icon: '✅', template: 'Validation([Contrôle])' }
            ]
        },
        {
            id: 'database',
            name: 'Modélisation BDD',
            icon: '🗃️',
            elements: [
                { id: 'table', name: 'Table', icon: '📋', template: 'Table([Table BDD])' },
                { id: 'relation', name: 'Relation', icon: '🔗', template: 'Relation([Lien])' },
                { id: 'primary_key', name: 'Clé Primaire', icon: '🔑', template: 'PrimaryKey([PK])' },
                { id: 'foreign_key', name: 'Clé Étrangère', icon: '🔗', template: 'ForeignKey([FK])' },
                { id: 'index', name: 'Index', icon: '⚡', template: 'Index([Optimisation])' },
                { id: 'view', name: 'Vue', icon: '👁️', template: 'View([Vue SQL])' }
            ]
        },
        {
            id: 'workflow',
            name: 'Flux de Développement',
            icon: '🔄',
            elements: [
                { id: 'dev_process', name: 'Processus Dev', icon: '🔄', template: 'DevProcess([Développement])' },
                { id: 'testing', name: 'Tests', icon: '🧪', template: 'Testing([Vérification])' },
                { id: 'deployment', name: 'Déploiement', icon: '🚀', template: 'Deployment([Mise en Prod])' },
                { id: 'monitoring', name: 'Supervision', icon: '📊', template: 'Monitoring([Surveillance])' },
                { id: 'maintenance', name: 'Maintenance', icon: '🔧', template: 'Maintenance([Support])' },
                { id: 'decision', name: 'Décision', icon: '💭', template: 'Decision{Choix?}' }
            ]
        },
        {
            id: 'infrastructure',
            name: 'Infrastructure',
            icon: '☁️',
            elements: [
                { id: 'server', name: 'Serveur', icon: '🖥️', template: 'Server([Serveur])' },
                { id: 'cloud', name: 'Cloud', icon: '☁️', template: 'Cloud([Services Cloud])' },
                { id: 'container', name: 'Conteneur', icon: '📦', template: 'Container([Docker])' },
                { id: 'network', name: 'Réseau', icon: '🌐', template: 'Network([Infrastructure Réseau])' },
                { id: 'security', name: 'Sécurité', icon: '🔒', template: 'Security([Sécurité])' },
                { id: 'cdn', name: 'CDN', icon: '⚡', template: 'CDN([Distribution])' }
            ]
        }
    ],
    
    sidebar: {
        defaultCategory: 'architecture',
        showIcons: true,
        draggable: true,
        searchEnabled: true
    }
};

export default sidebarConfig;