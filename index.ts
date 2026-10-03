import { registerRootComponent } from 'expo';

import App from './App';
import { lockLayoutLTR } from './src/i18n';
// Defines the background location task — has to happen at bundle load.
import { stopWalkTracking } from './src/lib/walkTracking';
// Registers the notification category + response listener — also at bundle load,
// so a button tap is caught even if it arrives before any screen mounts.
import { initNotifications } from './src/lib/notifications';

// Before anything renders — see lockLayoutLTR for why this runs on every start.
lockLayoutLTR();

// No-op on builds without the native expo-notifications module (guarded inside).
initNotifications();

// A walk never survives an app start (WalkScreen state isn't restored), so a
// location session still running now was orphaned by a crash or a JS reload.
stopWalkTracking();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
