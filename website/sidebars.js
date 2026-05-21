// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  designSidebar: [
    {
      type: 'category',
      label: 'Concepto',
      collapsed: false,
      items: ['gdd/game-concept'],
    },
    {
      type: 'category',
      label: 'Arte',
      collapsed: false,
      items: ['art/art-bible'],
    },
    {
      type: 'category',
      label: 'Game Design (GDDs)',
      collapsed: false,
      items: [
        'gdd/systems-index',
        'gdd/data-configuration-system',
        'gdd/scene-management-system',
        'gdd/card-system',
        'gdd/status-effect-system',
        'gdd/situation-system',
        'gdd/player-character-system',
        'gdd/enemy-system',
        'gdd/relic-system',
        'gdd/combat-system',
        'gdd/deck-building-system',
        'gdd/node-map-system',
        'gdd/save-system',
      ],
    },
    // Agregar nuevos GDDs acá a medida que se vayan creando
  ],
};

export default sidebars;
