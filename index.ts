import { registerRootComponent } from 'expo';

import App from './App';
import { lockLayoutLTR } from './src/i18n';
// Defines the background location task — has to happen at bundle load.
import { stopWalkTracking } from './src/lib/walkTracking';

// Before anything renders — see lockLayoutLTR for why this runs on every start.
lockLayoutLTR();

// A walk never survives an app start (WalkScreen state isn't restored), so a
// location session still running now was orphaned by a crash or a JS reload.
stopWalkTracking();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
