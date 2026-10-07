import Constants from 'expo-constants';

// Отдельное dev-приложение (bundle id com.afkaf.app.dev, «afkaf dev») собирается
// с APP_VARIANT=dev — app.config.js кладёт в конфиг extra.appVariant = 'dev'.
// В обычной сборке поля нет, значение всегда false.
//
// Единственное, что этот флаг меняет: вход в DevPanel (5 тапов по версии на
// About) открыт без аккаунта из DEV_USER_IDS — для device-теста вход не нужен.
export const IS_DEV_VARIANT: boolean = Constants.expoConfig?.extra?.appVariant === 'dev';
