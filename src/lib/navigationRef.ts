import { createNavigationContainerRef } from '@react-navigation/native';

// Lets components rendered outside <NavigationContainer> (global overlays
// like AddFriendSheet, mounted as siblings of the navigator in
// RootNavigator) trigger navigation without a navigation prop.
export const navigationRef = createNavigationContainerRef();
