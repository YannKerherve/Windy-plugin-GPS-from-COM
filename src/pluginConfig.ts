import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-gpsfromcom',
    version: '0.1.9',
    icon: '🛰️',
    title: 'GPS from COM',
    description: 'GPS Position from COM port.',
    author: 'Yann Kerherve (ENSM)',
    repository: 'https://github.com/windycom/windy-plugin-template',
    desktopUI: 'rhpane',
    mobileUI: 'fullscreen',
    routerPath: '/gpsfromcom',
};

export default config;
