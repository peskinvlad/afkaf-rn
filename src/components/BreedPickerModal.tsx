import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { colors, radii, shadows } from '../theme/tokens';
import { searchBreeds, isBreedKey } from '../lib/breeds';

interface Props {
  visible: boolean;
  // Current stored value — a breed key, legacy/other free text, or null.
  value: string | null;
  // Fires with the new stored value: a breed key when picked from the list, or
  // the raw typed text in "Other" mode (empty string clears the breed).
  onChange: (value: string) => void;
  onClose: () => void;
}

// Bottom-sheet breed picker. Rendered through Modal (per the project rule that
// overlays sit above map/buttons). Search matches all three languages; the list
// shows names in the active language; "Other" drops to a free-text field so any
// breed outside the catalogue (and legacy records) still works.
export function BreedPickerModal({ visible, value, onChange, onClose }: Props) {
  const { t, lang, rtl } = useApp();
  const ty = useTypography();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(ty, rtl), [ty, rtl]);

  const [query, setQuery] = useState('');
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState('');

  // On open, seed from the current value: a non-key value (legacy or previously
  // typed "Other") opens straight into the free-text field; a key or empty
  // value opens the list.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    if (value && !isBreedKey(value)) {
      setOtherMode(true);
      setOtherText(value);
    } else {
      setOtherMode(false);
      setOtherText('');
    }
  }, [visible, value]);

  const results = useMemo(() => searchBreeds(query, lang), [query, lang]);

  function selectKey(key: string) {
    Keyboard.dismiss();
    onChange(key);
    onClose();
  }

  function confirmOther() {
    Keyboard.dismiss();
    onChange(otherText.trim());
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
          pointerEvents="box-none"
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{t('dogProfile.breedModalTitle')}</Text>

            {otherMode ? (
              <View style={styles.otherBox}>
                <TextInput
                  style={styles.input}
                  placeholder={t('dogProfile.breedOtherPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  value={otherText}
                  onChangeText={setOtherText}
                  maxLength={50}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={confirmOther}
                />
                <View style={styles.otherActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionGhost]}
                    onPress={() => setOtherMode(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionGhostTxt}>{rtl ? '›' : '‹'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionPrimary]}
                    onPress={confirmOther}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionPrimaryTxt}>{t('dogProfile.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.input, styles.search]}
                  placeholder={t('dogProfile.breedSearchPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                <FlatList
                  data={results}
                  keyExtractor={(b) => b.key}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  ListEmptyComponent={<Text style={styles.empty}>{t('dogProfile.breedNoResults')}</Text>}
                  renderItem={({ item }) => {
                    const selected = item.key === value;
                    return (
                      <TouchableOpacity style={styles.row} onPress={() => selectKey(item.key)} activeOpacity={0.7}>
                        <Text style={[styles.rowTxt, selected && styles.rowTxtSelected]}>{item[lang]}</Text>
                        {selected && <Text style={styles.check}>✓</Text>}
                      </TouchableOpacity>
                    );
                  }}
                />
                <TouchableOpacity
                  style={styles.otherRow}
                  onPress={() => {
                    setOtherText(value && !isBreedKey(value) ? value : '');
                    setOtherMode(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.otherRowTxt}>{t('dogProfile.breedOther')}…</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>, rtl: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    kav: { width: '100%' },
    sheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      paddingHorizontal: 20,
      paddingTop: 10,
      ...shadows.md,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 10,
    },
    title: {
      fontSize: 18,
      fontFamily: ty.font.display,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: 12,
    },

    // Shared input look (search field + "Other" text field)
    input: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: ty.font.body,
      color: colors.ink,
      textAlign: rtl ? 'right' : 'left',
      writingDirection: rtl ? 'rtl' : 'ltr',
    },
    search: { marginBottom: 6 },

    list: { maxHeight: 360 },
    row: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowTxt: {
      fontSize: 16,
      fontFamily: ty.font.body,
      color: colors.ink,
      textAlign: rtl ? 'right' : 'left',
      flex: 1,
    },
    rowTxtSelected: {
      fontFamily: ty.font.bodyBold,
      color: colors.primary,
    },
    check: {
      fontSize: 16,
      color: colors.primary,
      marginHorizontal: 8,
    },
    empty: {
      fontSize: 14,
      fontFamily: ty.font.body,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 24,
    },

    otherRow: {
      paddingVertical: 15,
      marginTop: 2,
    },
    otherRowTxt: {
      fontSize: 16,
      fontFamily: ty.font.bodyBold,
      color: colors.primary,
      textAlign: rtl ? 'right' : 'left',
    },

    // "Other" free-text mode
    otherBox: { gap: 12 },
    otherActions: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      gap: 10,
    },
    actionBtn: {
      borderRadius: radii.md,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionGhost: {
      paddingHorizontal: 18,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    actionGhostTxt: {
      fontSize: 22,
      fontFamily: ty.font.body,
      color: colors.textMuted,
      lineHeight: 24,
      marginTop: -2,
    },
    actionPrimary: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    actionPrimaryTxt: {
      fontSize: 15,
      fontFamily: ty.font.heading,
      color: colors.white,
    },
  });
