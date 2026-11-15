import { Alert } from 'react-native';
import { blockAndHide, unblockAndShow } from '../hooks/useBlocks';
import type { ModUser } from '../components/UserModMenuButton';

// Диалоги блокировки/разблокировки. Alert-based (без монтируемого UI), поэтому
// любой экран зовёт их напрямую. Запись идёт через SECURITY DEFINER RPC внутри
// blockAndHide/unblockAndShow (стор useBlocks), которые ещё и мгновенно
// прячут/возвращают в общем сторе. t — полный из useApp (с {name}-интерполяцией).

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function confirmBlock(t: TFn, user: ModUser, onDone?: () => void) {
  const name = user.displayName || t('profile.anonymous');
  Alert.alert(t('blockUserTitle', { name }), t('blockUserDescription'), [
    { text: t('blockUserCancel'), style: 'cancel' },
    {
      text: t('blockUserConfirm'),
      style: 'destructive',
      onPress: async () => {
        const err = await blockAndHide(user);
        if (err) {
          Alert.alert(t('common.save_error'));
          return;
        }
        Alert.alert(t('blockUserSuccess'));
        onDone?.();
      },
    },
  ]);
}

export function confirmUnblock(t: TFn, user: ModUser, onDone?: () => void) {
  const name = user.displayName || t('profile.anonymous');
  Alert.alert(t('unblockUserTitle', { name }), t('unblockUserDescription'), [
    { text: t('unblockUserCancel'), style: 'cancel' },
    {
      text: t('unblockUserConfirm'),
      onPress: async () => {
        const err = await unblockAndShow(user.userId);
        if (err) {
          Alert.alert(t('common.save_error'));
          return;
        }
        Alert.alert(t('unblockUserSuccess'));
        onDone?.();
      },
    },
  ]);
}
