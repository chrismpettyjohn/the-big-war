/**
 * Match localisation.
 *
 * Tiny dictionary lookup with no dependency: keys are `namespace.key`, values are
 * a per-language record. `t()` falls back EN → key so a missing string is obvious
 * in game rather than throwing. Format params use `{name}` placeholders.
 *
 * Language codes match the shipped game: en, fr, es, de.
 */

export type Language = 'en' | 'fr' | 'es' | 'de';

export const LANGUAGES: readonly Language[] = ['en', 'fr', 'es', 'de'];

/** Native names for the language switcher. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
};

type Entry = Readonly<Record<Language, string>>;

const DICT: Readonly<Record<string, Entry>> = {
  'app.title': {
    en: 'The Big War',
    fr: 'La Grande Guerre',
    es: 'La Gran Guerra',
    de: 'Der Große Krieg',
  },
  'app.tagline': {
    en: 'Build your empire. Make theirs fall.',
    fr: 'Bâtissez votre empire. Faites tomber les leurs.',
    es: 'Construye tu imperio. Haz caer los suyos.',
    de: 'Bau dein Reich auf. Stürze ihre.',
  },
  'menu.play': { en: 'New War', fr: 'Nouvelle guerre', es: 'Nueva guerra', de: 'Neuer Krieg' },
  'menu.language': { en: 'Language', fr: 'Langue', es: 'Idioma', de: 'Sprache' },
  'menu.empires': { en: 'Empires', fr: 'Empires', es: 'Imperios', de: 'Reiche' },
  'menu.speed': { en: 'Game speed', fr: 'Vitesse de jeu', es: 'Velocidad', de: 'Spieltempo' },
  'menu.mapSize': { en: 'Map size', fr: 'Taille de carte', es: 'Tamaño del mapa', de: 'Kartengröße' },
  'menu.mapSmall': { en: 'Small', fr: 'Petite', es: 'Pequeño', de: 'Klein' },
  'menu.mapMedium': { en: 'Medium', fr: 'Moyenne', es: 'Mediano', de: 'Mittel' },
  'menu.mapLarge': { en: 'Large', fr: 'Grande', es: 'Grande', de: 'Groß' },
  'menu.timeLimit': { en: 'Time limit', fr: 'Limite de temps', es: 'Límite de tiempo', de: 'Zeitlimit' },
  'menu.minutes': {
    en: '{n} min',
    fr: '{n} min',
    es: '{n} min',
    de: '{n} Min.',
  },
  'menu.tutorialHint': {
    en: 'Click foreign land to attack, right-click it to inspect, drag to move the map.',
    fr: 'Cliquez sur une terre étrangère pour attaquer, clic droit pour inspecter, glissez pour déplacer la carte.',
    es: 'Haz clic en tierra extranjera para atacar, clic derecho para inspeccionar, arrastra para mover el mapa.',
    de: 'Klicke auf fremdes Land zum Angreifen, Rechtsklick zum Prüfen, ziehen zum Verschieben.',
  },
  'faction.title': { en: 'Choose your faction', fr: 'Choisissez votre faction', es: 'Elige tu facción', de: 'Wähle deine Fraktion' },
  'faction.start': { en: 'Begin the war', fr: 'Commencer la guerre', es: 'Comenzar la guerra', de: 'Krieg beginnen' },
  'faction.back': { en: 'Back', fr: 'Retour', es: 'Atrás', de: 'Zurück' },

  'rail.build': { en: 'Build', fr: 'Construire', es: 'Construir', de: 'Bauen' },
  'rail.army': { en: 'Army', fr: 'Armée', es: 'Ejército', de: 'Armee' },
  'rail.research': { en: 'Research', fr: 'Recherche', es: 'Investigación', de: 'Forschung' },
  'rail.empires': { en: 'Empires', fr: 'Empires', es: 'Imperios', de: 'Reiche' },
  'rail.menu': { en: 'Menu', fr: 'Menu', es: 'Menú', de: 'Menü' },
  'rail.speed': { en: 'Game speed', fr: 'Vitesse', es: 'Velocidad', de: 'Tempo' },
  'rail.pause': { en: 'Pause', fr: 'Pause', es: 'Pausa', de: 'Pause' },
  'rail.resume': { en: 'Resume', fr: 'Reprendre', es: 'Reanudar', de: 'Fortsetzen' },

  'hud.gold': { en: 'Gold', fr: 'Or', es: 'Oro', de: 'Gold' },
  'hud.science': { en: 'Science', fr: 'Science', es: 'Ciencia', de: 'Wissenschaft' },
  'hud.civilians': { en: 'Civilians', fr: 'Civils', es: 'Civiles', de: 'Zivilisten' },
  'hud.soldiers': { en: 'Reserve', fr: 'Réserve', es: 'Reserva', de: 'Reserve' },
  'hud.land': { en: 'Land', fr: 'Territoire', es: 'Territorio', de: 'Land' },
  'hud.time': { en: 'Time', fr: 'Temps', es: 'Tiempo', de: 'Zeit' },
  'hud.workers': { en: 'Workers', fr: 'Ouvriers', es: 'Trabajadores', de: 'Arbeiter' },
  'hud.faction': { en: 'Faction', fr: 'Faction', es: 'Facción', de: 'Fraktion' },

  'terrain.plain': { en: 'Plain', fr: 'Plaine', es: 'Llanura', de: 'Ebene' },
  'terrain.forest': { en: 'Forest', fr: 'Forêt', es: 'Bosque', de: 'Wald' },
  'terrain.mountain': { en: 'Mountain', fr: 'Montagne', es: 'Montaña', de: 'Berg' },
  'terrain.water': { en: 'Water', fr: 'Eau', es: 'Agua', de: 'Wasser' },

  'panel.build.title': { en: 'Construction', fr: 'Construction', es: 'Construcción', de: 'Bau' },
  'panel.build.kind': { en: 'Place a building', fr: 'Placer un bâtiment', es: 'Colocar edificio', de: 'Gebäude setzen' },
  'panel.build.hint': {
    en: 'Pick a building, then click one of your hexes. Buildings need an empty hex around them.',
    fr: 'Choisissez un bâtiment, puis cliquez sur une de vos cases. Les bâtiments ont besoin de place autour.',
    es: 'Elige un edificio y haz clic en una casilla tuya. Necesitan espacio alrededor.',
    de: 'Wähle ein Gebäude, dann klicke auf ein eigenes Feld. Gebäude brauchen Platz.',
  },
  'panel.build.cancel': { en: 'Cancel', fr: 'Annuler', es: 'Cancelar', de: 'Abbrechen' },
  'panel.build.locked': { en: 'Requires research', fr: 'Recherche requise', es: 'Requiere investigación', de: 'Forschung nötig' },

  'panel.army.title': { en: 'Army', fr: 'Armée', es: 'Ejército', de: 'Armee' },
  'panel.army.send': { en: 'Send', fr: 'Envoyer', es: 'Enviar', de: 'Senden' },
  'panel.army.percent': { en: 'Troops to send', fr: 'Troupes à envoyer', es: 'Tropas a enviar', de: 'Truppen senden' },
  'panel.army.reserve': { en: 'Available', fr: 'Disponibles', es: 'Disponibles', de: 'Verfügbar' },
  'panel.army.committed': { en: 'Committed', fr: 'Engagés', es: 'Comprometidos', de: 'Gebunden' },
  'panel.army.attack': { en: 'Attack', fr: 'Attaquer', es: 'Atacar', de: 'Angriff' },
  'panel.army.hold': { en: 'Hold', fr: 'Tenir', es: 'Mantener', de: 'Halten' },
  'panel.army.counter': { en: 'Counterattack', fr: 'Contre-attaque', es: 'Contraataque', de: 'Gegenangriff' },

  'panel.hex.title': { en: 'Territory', fr: 'Territoire', es: 'Territorio', de: 'Gebiet' },
  'panel.hex.empty': { en: 'Nothing here', fr: 'Rien ici', es: 'Nada aquí', de: 'Nichts hier' },
  'panel.hex.neutral': { en: 'Unclaimed', fr: 'Sans maître', es: 'Sin dueño', de: 'Herrenlos' },
  'panel.hex.demolish': { en: 'Demolish', fr: 'Démolir', es: 'Demoler', de: 'Abreißen' },
  'panel.hex.demolishConfirm': { en: 'Confirm demolish', fr: 'Confirmer', es: 'Confirmar', de: 'Bestätigen' },
  'panel.hex.demolishNote': {
    en: 'Stays active 10s, then disappears. No refund.',
    fr: 'Reste actif 10s puis disparaît. Aucun remboursement.',
    es: 'Sigue activo 10s y desaparece. Sin reembolso.',
    de: 'Bleibt 10s aktiv, dann weg. Keine Rückerstattung.',
  },
  'panel.hex.fire': { en: 'Fire', fr: 'Tirer', es: 'Disparar', de: 'Feuern' },
  'panel.hex.upgrade': { en: 'Upgrade', fr: 'Améliorer', es: 'Mejorar', de: 'Ausbauen' },
  'panel.hex.reload': { en: 'Reloading', fr: 'Rechargement', es: 'Recargando', de: 'Lädt' },

  'panel.research.title': { en: 'Research', fr: 'Recherche', es: 'Investigación', de: 'Forschung' },
  'panel.research.start': { en: 'Research', fr: 'Étudier', es: 'Investigar', de: 'Erforschen' },
  'panel.research.active': { en: 'In progress', fr: 'En cours', es: 'En curso', de: 'Läuft' },
  'panel.research.done': { en: 'Completed', fr: 'Terminé', es: 'Completado', de: 'Fertig' },
  'panel.research.locked': { en: 'Locked', fr: 'Verrouillé', es: 'Bloqueado', de: 'Gesperrt' },
  'panel.research.science': { en: 'Science', fr: 'Science', es: 'Ciencia', de: 'Wissenschaft' },
  'panel.research.branch.economy': { en: 'Economy', fr: 'Économie', es: 'Economía', de: 'Wirtschaft' },
  'panel.research.branch.military': { en: 'Military', fr: 'Militaire', es: 'Militar', de: 'Militär' },
  'panel.research.branch.territory': { en: 'Territory', fr: 'Territoire', es: 'Territorio', de: 'Gebiet' },
  'panel.research.requires': {
    en: 'Requires {names}',
    fr: 'Nécessite {names}',
    es: 'Requiere {names}',
    de: 'Benötigt {names}',
  },

  'panel.empires.title': { en: 'Empires', fr: 'Empires', es: 'Imperios', de: 'Reiche' },
  'panel.empires.you': { en: 'You', fr: 'Vous', es: 'Tú', de: 'Du' },
  'panel.empires.dead': { en: 'Destroyed', fr: 'Détruit', es: 'Destruido', de: 'Zerstört' },

  'front.title': { en: 'Front', fr: 'Front', es: 'Frente', de: 'Front' },
  'front.attack': { en: 'Attack', fr: 'Attaque', es: 'Ataque', de: 'Angriff' },
  'front.defence': { en: 'Defence', fr: 'Défense', es: 'Defensa', de: 'Verteidigung' },
  'front.troops': { en: 'Troops', fr: 'Troupes', es: 'Tropas', de: 'Truppen' },
  'front.attackMod': { en: 'Attack mod.', fr: 'Mod. attaque', es: 'Mod. ataque', de: 'Angr.-Mod.' },
  'front.defenceMod': { en: 'Defence mod.', fr: 'Mod. défense', es: 'Mod. defensa', de: 'Vert.-Mod.' },
  'front.losses': { en: 'Losses', fr: 'Pertes', es: 'Bajas', de: 'Verluste' },
  'front.multiFront': { en: 'Multi-front', fr: 'Multi-fronts', es: 'Multi-frente', de: 'Mehrfront' },

  'end.title': { en: 'War is over', fr: 'La guerre est finie', es: 'La guerra terminó', de: 'Der Krieg ist vorbei' },
  'end.victory': { en: 'Victory', fr: 'Victoire', es: 'Victoria', de: 'Sieg' },
  'end.defeat': { en: 'Defeat', fr: 'Défaite', es: 'Derrota', de: 'Niederlage' },
  'end.reason.elimination': {
    en: 'Last empire standing',
    fr: 'Dernier empire debout',
    es: 'Último imperio en pie',
    de: 'Letztes Reich',
  },
  'end.reason.territory': {
    en: '{owner} controls 75% of the land',
    fr: '{owner} contrôle 75% du territoire',
    es: '{owner} controla el 75% del territorio',
    de: '{owner} kontrolliert 75% des Landes',
  },
  'end.reason.timeLimit': {
    en: 'Time limit — largest territory wins',
    fr: 'Temps écoulé — le plus grand territoire gagne',
    es: 'Tiempo agotado — gana el mayor territorio',
    de: 'Zeitlimit — größtes Gebiet gewinnt',
  },
  'end.again': { en: 'Fight again', fr: 'Rejouer', es: 'Revancha', de: 'Nochmal' },
  'end.menu': { en: 'Main menu', fr: 'Menu principal', es: 'Menú principal', de: 'Hauptmenü' },

  'error.insufficient_gold': { en: 'Not enough gold', fr: 'Pas assez d’or', es: 'Sin oro suficiente', de: 'Nicht genug Gold' },
  'error.insufficient_science': {
    en: 'Not enough science',
    fr: 'Pas assez de science',
    es: 'Sin ciencia suficiente',
    de: 'Nicht genug Wissenschaft',
  },
  'error.insufficient_troops': { en: 'No troops free', fr: 'Aucune troupe libre', es: 'Sin tropas libres', de: 'Keine Truppen frei' },
  'error.reserve_full': { en: 'Reserve full', fr: 'Réserve pleine', es: 'Reserva llena', de: 'Reserve voll' },
  'error.invalid_target': { en: 'Invalid target', fr: 'Cible invalide', es: 'Objetivo inválido', de: 'Ungültiges Ziel' },
  'error.not_researched': { en: 'Not researched yet', fr: 'Pas encore étudié', es: 'Sin investigar', de: 'Nicht erforscht' },
  'error.cooldown': { en: 'Still reloading', fr: 'Rechargement', es: 'Recargando', de: 'Lädt noch' },
  'error.not_playing': { en: 'Match not running', fr: 'Partie inactive', es: 'Partida inactiva', de: 'Kein laufendes Spiel' },
  'error.no_empire': { en: 'No empire', fr: 'Aucun empire', es: 'Sin imperio', de: 'Kein Reich' },
  'error.research_unavailable': {
    en: 'Research unavailable',
    fr: 'Recherche indisponible',
    es: 'Investigación no disponible',
    de: 'Forschung nicht möglich',
  },
};

/** Every UI string, in all shipped languages. Keys are stable identifiers. */
export const DICTIONARY: Readonly<Record<string, Entry>> = DICT;

export type TranslationKey = keyof typeof DICT;
export type { Entry };

