import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { useApp } from '../hooks/useApp';

const STRINGS = {
  ru: {
    title: 'О проекте',
    tagline: 'Карта для выгула собак\nв Яфо и Тель-Авиве',
    description: 'afkaf — карта для выгула собак. Отмечай опасные места, находи воду и парки, проверяй температуру асфальта перед прогулкой. Сделано владельцами собак для владельцев собак.',
    faqTitle: 'Частые вопросы',
    faq: [
      {
        title: 'Метки', icon: '📍',
        items: [
          { q: 'Как добавить метку?', a: 'Нажми + на карте, выбери тип метки и укажи место. Метки видят все пользователи.' },
          { q: 'Какие типы меток можно добавить?', a: 'Опасность, агрессивная собака, вода, парк, запрещено для собак, опасный участок. Каждый тип отображается своим цветом и иконкой.' },
          { q: 'Как исправить неверную метку?', a: 'Нажми на метку и используй кнопку голосования. Метки с низким рейтингом скрываются автоматически.' },
          { q: 'Метка устарела — что делать?', a: 'Нажми на метку и проголосуй против. Если несколько пользователей отметят её как неактуальную — она скроется автоматически.' },
        ],
      },
      {
        title: 'Температура асфальта', icon: '🌡️',
        items: [
          { q: 'Как работает температура асфальта?', a: 'Мы берём данные о погоде и считаем примерную температуру асфальта по формуле.' },
          { q: 'Что такое правило 7 секунд?', a: 'Приложи руку к асфальту — если больно за 7 секунд, собаке тоже будет больно. Используй это как быструю проверку перед прогулкой.' },
        ],
      },
      {
        title: 'Приватность', icon: '🔒',
        items: [
          { q: 'Кто видит меня на карте?', a: 'По умолчанию — только друзья. Ты можешь изменить это в Настройки → Приватность. Варианты: все пользователи, только друзья, никто.' },
          { q: 'Что такое домашний радиус?', a: 'Зона вокруг твоего дома, внутри которой твоя геопозиция скрыта от других. Например, при радиусе 200м соседи не увидят из какого подъезда ты вышел. Настраивается в Настройки → Домашняя зона.' },
          { q: 'Как скрыть своё местоположение?', a: 'Открой Настройки → Приватность → Видимость и выбери "Никто". Ты будешь видеть других, но тебя не увидит никто.' },
          { q: 'Что такое режим "Никто" и какие у него ограничения?', a: 'В этом режиме ты не отображаешься на карте. Метки можно добавлять только во время активной прогулки, не чаще одной в 4 часа. Если хочешь добавить кого-то в друзья — получатель увидит твой профиль перед тем как принять решение.' },
        ],
      },
      {
        title: 'Аккаунт', icon: '👤',
        items: [
          { q: 'Почему нужна регистрация?', a: 'Чтобы добавлять метки и участвовать в жизни карты. Смотреть карту можно и без аккаунта.' },
          { q: 'Что такое Trust Level?', a: 'Чем больше твоих меток подтверждают другие — тем выше уровень доверия. Высокий уровень открывает больше возможностей на карте.' },
          { q: 'Хранятся ли мои данные?', a: 'Метки и профиль хранятся на сервере. Настройки приложения (язык, уведомления, домашняя зона) хранятся только на твоём устройстве и не передаются.' },
        ],
      },
      {
        title: 'Прогулки', icon: '🐾',
        items: [
          { q: 'Зачем начинать прогулку в приложении?', a: 'Когда ты на прогулке, другие пользователи видят что рядом есть собака. Это помогает планировать маршрут и избегать нежелательных встреч.' },
          { q: 'Как работает запись маршрута?', a: 'Приложение записывает трек прогулки — расстояние, время, маршрут. После прогулки ты видишь статистику. Маршруты хранятся только на твоём устройстве.' },
        ],
      },
    ],
    donateTitle: 'Поддержать проект',
    donateText: 'afkaf — независимый проект. Если приложение помогает тебе и твоей собаке, можно поддержать донейшном.',
    donateBit: 'Bit',
    donatePaypal: 'PayPal',
    contactTitle: 'Связь',
    contactText: 'Вопросы, баги, идеи — пиши нам',
    contactEmail: 'peskin.vlad@gmail.com',
    madeWith: 'Сделано с ❤️ для Шерлока и всех собак Яфо',
  },
  en: {
    title: 'About',
    tagline: 'Dog walking map\nfor Jaffa & Tel Aviv',
    description: 'afkaf is a community map for dog walks. Mark hazards, find water and parks, check pavement temperature before you head out. Made by dog owners, for dog owners.',
    faqTitle: 'FAQ',
    faq: [
      {
        title: 'Markers', icon: '📍',
        items: [
          { q: 'How do I add a marker?', a: 'Tap + on the map, choose a marker type and place it. All users can see your markers.' },
          { q: 'What marker types are available?', a: 'Hazard, aggressive dog, water, park, no dogs allowed, dangerous area. Each type has its own color and icon.' },
          { q: 'How do I fix an incorrect marker?', a: 'Tap the marker and use the voting button. Low-rated markers are hidden automatically.' },
          { q: 'What if a marker is outdated?', a: 'Tap it and vote against it. If enough users flag it as outdated, it will be hidden automatically.' },
        ],
      },
      {
        title: 'Pavement temperature', icon: '🌡️',
        items: [
          { q: 'How does pavement temperature work?', a: 'We use weather data to estimate pavement temperature using a formula.' },
          { q: 'What is the 7-second rule?', a: "Press your hand to the pavement — if it hurts within 7 seconds, it's too hot for your dog. Use this as a quick check before heading out." },
        ],
      },
      {
        title: 'Privacy', icon: '🔒',
        items: [
          { q: 'Who can see me on the map?', a: 'Friends only by default. You can change this in Settings → Privacy. Options: everyone, friends only, nobody.' },
          { q: 'What is the home radius?', a: "A zone around your home where your location is hidden from others. For example, with a 200m radius your neighbors won't see which entrance you left from. Set it in Settings → Home zone." },
          { q: 'How do I hide my location?', a: 'Go to Settings → Privacy → Visibility and choose "Nobody". You will still see others, but no one will see you.' },
          { q: 'What is "Nobody" mode and what are its limits?', a: 'In this mode you don\'t appear on the map. You can only add markers during an active walk, no more than once every 4 hours. If you want to add a friend, the recipient will see your profile before deciding.' },
        ],
      },
      {
        title: 'Account', icon: '👤',
        items: [
          { q: 'Why do I need to register?', a: 'To add markers and participate in the community. You can browse the map without an account.' },
          { q: 'What is Trust Level?', a: 'The more your markers are confirmed by others, the higher your trust level. Higher levels unlock more features.' },
          { q: 'Is my data stored?', a: 'Markers and your profile are stored on the server. App settings (language, notifications, home zone) are stored only on your device and are not shared.' },
        ],
      },
      {
        title: 'Walks', icon: '🐾',
        items: [
          { q: 'Why start a walk in the app?', a: 'When you\'re on a walk, other users can see there\'s a dog nearby. This helps plan routes and avoid unwanted encounters.' },
          { q: 'How does route recording work?', a: 'The app records your walk track — distance, time, route. After the walk you can see your stats. Routes are stored only on your device.' },
        ],
      },
    ],
    donateTitle: 'Support the project',
    donateText: 'afkaf is an independent project. If the app helps you and your dog, consider supporting us.',
    donateBit: 'Bit',
    donatePaypal: 'PayPal',
    contactTitle: 'Contact',
    contactText: 'Questions, bugs, ideas — reach out',
    contactEmail: 'peskin.vlad@gmail.com',
    madeWith: 'Made with ❤️ for Sherlock and all the dogs of Jaffa',
  },
  he: {
    title: 'על הפרויקט',
    tagline: 'מפת טיולים לכלבים\nביפו ותל אביב',
    description: 'afkaf היא מפה קהילתית לטיולים עם כלבים. סמן מקומות מסוכנים, מצא מים ופארקים, בדוק את טמפרטורת המדרכה לפני היציאה. נעשה על ידי בעלי כלבים, לבעלי כלבים.',
    faqTitle: 'שאלות נפוצות',
    faq: [
      {
        title: 'סימונים', icon: '📍',
        items: [
          { q: 'איך מוסיפים סימון?', a: 'לחץ על + במפה, בחר סוג סימון ומקם אותו. כל המשתמשים יראו את הסימונים שלך.' },
          { q: 'אילו סוגי סימונים קיימים?', a: 'סכנה, כלב תוקפני, מים, פארק, אסור לכלבים, אזור מסוכן. כל סוג מוצג בצבע ואייקון משלו.' },
          { q: 'איך מתקנים סימון שגוי?', a: 'לחץ על הסימון והשתמש בכפתור ההצבעה. סימונים עם דירוג נמוך מוסתרים אוטומטית.' },
          { q: 'מה עושים עם סימון מיושן?', a: 'לחץ עליו והצבע נגד. אם מספיק משתמשים יסמנו אותו כלא רלוונטי — הוא יוסתר אוטומטית.' },
        ],
      },
      {
        title: 'טמפרטורת המדרכה', icon: '🌡️',
        items: [
          { q: 'איך עובדת טמפרטורת המדרכה?', a: 'אנחנו משתמשים בנתוני מזג אוויר כדי לאמוד את חום המדרכה לפי נוסחה.' },
          { q: 'מה זה כלל 7 השניות?', a: 'שים את היד על המדרכה — אם כואב תוך 7 שניות, גם לכלב יהיה חם מדי. השתמש בזה כבדיקה מהירה לפני הצאת.' },
        ],
      },
      {
        title: 'פרטיות', icon: '🔒',
        items: [
          { q: 'מי רואה אותי במפה?', a: 'רק חברים כברירת מחדל. ניתן לשנות בהגדרות → פרטיות. אפשרויות: כולם, רק חברים, אף אחד.' },
          { q: 'מה זה רדיוס הבית?', a: 'אזור סביב הבית שבו המיקום שלך מוסתר מאחרים. לדוגמה, עם רדיוס של 200מ השכנים לא יראו מאיזה כניסה יצאת. מוגדר בהגדרות → אזור הבית.' },
          { q: 'איך מסתירים את המיקום?', a: 'פתח הגדרות → פרטיות → נראות ובחר "אף אחד". תמשיך לראות אחרים, אבל אף אחד לא יראה אותך.' },
          { q: 'מה זה מצב "אף אחד" ומה מגבלותיו?', a: 'במצב זה אינך מופיע במפה. ניתן להוסיף סימונים רק במהלך טיול פעיל, לא יותר מאחד כל 4 שעות. אם תרצה להוסיף חבר — הנמען יראה את הפרופיל שלך לפני ההחלטה.' },
        ],
      },
      {
        title: 'חשבון', icon: '👤',
        items: [
          { q: 'למה צריך להירשם?', a: 'כדי להוסיף סימונים ולהשתתף בקהילה. ניתן לגלוש במפה גם ללא חשבון.' },
          { q: 'מה זה Trust Level?', a: 'ככל שיותר משתמשים מאשרים את הסימונים שלך, כך רמת האמון שלך עולה. רמה גבוהה פותחת אפשרויות נוספות.' },
          { q: 'האם הנתונים שלי נשמרים?', a: 'סימונים ופרופיל נשמרים בשרת. הגדרות האפליקציה (שפה, התראות, אזור הבית) נשמרות רק במכשיר שלך ואינן מועברות.' },
        ],
      },
      {
        title: 'טיולים', icon: '🐾',
        items: [
          { q: 'למה להתחיל טיול באפליקציה?', a: 'כשאתה בטיול, משתמשים אחרים רואים שיש כלב בקרבת מקום. זה עוזר לתכנן מסלול ולהימנע ממפגשים לא רצויים.' },
          { q: 'איך עובד תיעוד המסלול?', a: 'האפליקציה מתעדת את מסלול הטיול — מרחק, זמן, מסלול. אחרי הטיול ניתן לראות סטטיסטיקות. המסלולים נשמרים רק במכשיר שלך.' },
        ],
      },
    ],
    donateTitle: 'תמיכה בפרויקט',
    donateText: 'afkaf הוא פרויקט עצמאי. אם האפליקציה עוזרת לך ולכלב שלך, אפשר לתמוך בתרומה.',
    donateBit: 'Bit',
    donatePaypal: 'PayPal',
    contactTitle: 'יצירת קשר',
    contactText: 'שאלות, באגים, רעיונות — כתוב לנו',
    contactEmail: 'peskin.vlad@gmail.com',
    madeWith: '❤️ נעשה מתוך אהבה לשרלוק ולכל כלבי יפו',
  },
};

const FAQItem = ({ q, a, isRTL }: { q: string; a: string; isRTL: boolean }) => {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={styles.faqItem} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
      <View style={[styles.faqHeader, isRTL && styles.rowReverse]}>
        <Text style={[styles.faqQ, isRTL && styles.textRight]}>{q}</Text>
        <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>›</Text>
      </View>
      {open && <Text style={[styles.faqA, isRTL && styles.textRight]}>{a}</Text>}
    </TouchableOpacity>
  );
};

const FAQSection = ({ title, icon, items, isRTL }: { title: string; icon: string; items: { q: string; a: string }[]; isRTL: boolean }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faqSection}>
      <TouchableOpacity style={[styles.faqSectionHeader, isRTL && styles.rowReverse]} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <View style={[styles.faqSectionLeft, isRTL && styles.rowReverse]}>
          <Text style={styles.faqSectionIcon}>{icon}</Text>
          <Text style={[styles.faqSectionTitle, isRTL && styles.textRight]}>{title}</Text>
        </View>
        <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>›</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.faqSectionItems}>
          {items.map((item, i) => <FAQItem key={i} q={item.q} a={item.a} isRTL={isRTL} />)}
        </View>
      )}
    </View>
  );
};

export default function AboutScreen() {
  const { lang } = useApp();
  const t = STRINGS[lang] ?? STRINGS.en;
  const isRTL = lang === 'he';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.pawIcon}>🐾</Text>
        <Text style={styles.appName}>afkaf</Text>
        <Text style={[styles.tagline, isRTL && styles.textRight]}>{t.tagline}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.bodyText, isRTL && styles.textRight]}>{t.description}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.faqTitle}</Text>
        {t.faq.map((section, i) => (
          <FAQSection key={i} title={section.title} icon={section.icon} items={section.items} isRTL={isRTL} />
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.donateTitle}</Text>
        <Text style={[styles.bodyText, isRTL && styles.textRight]}>{t.donateText}</Text>
        <View style={[styles.donateRow, isRTL && styles.rowReverse]}>
          <TouchableOpacity style={styles.donateBtn} onPress={() => Linking.openURL('https://bit.co.il')} activeOpacity={0.8}>
            <Text style={styles.donateBtnText}>{t.donateBit}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.donateBtn, styles.donateBtnSecondary]} onPress={() => Linking.openURL('https://paypal.me')} activeOpacity={0.8}>
            <Text style={[styles.donateBtnText, styles.donateBtnTextSecondary]}>{t.donatePaypal}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.contactTitle}</Text>
        <Text style={[styles.bodyText, isRTL && styles.textRight]}>{t.contactText}</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${t.contactEmail}`)} activeOpacity={0.7}>
          <Text style={styles.emailLink}>{t.contactEmail}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t.madeWith}</Text>
      </View>
    </ScrollView>
  );
}

const PRIMARY = '#2c5f25';
const PRIMARY_MID = '#4a8a3f';
const PRIMARY_LIGHT = '#e8f0e7';
const TEXT_DARK = '#1a1a1a';
const TEXT_MID = '#555';
const TEXT_LIGHT = '#888';
const BG = '#f7f9f7';
const WHITE = '#ffffff';
const BORDER = '#dde8dc';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 48 },
  hero: { backgroundColor: PRIMARY, paddingTop: 48, paddingBottom: 36, alignItems: 'center' },
  pawIcon: { fontSize: 40, marginBottom: 8 },
  appName: { fontFamily: 'Nunito-ExtraBold', fontSize: 36, color: WHITE, letterSpacing: 1 },
  tagline: { fontFamily: 'Nunito-Regular', fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 6, lineHeight: 22 },
  section: { paddingHorizontal: 20, paddingVertical: 24 },
  sectionTitle: { fontFamily: 'Nunito-Bold', fontSize: 18, color: TEXT_DARK, marginBottom: 16 },
  bodyText: { fontFamily: 'Nunito-Regular', fontSize: 15, color: TEXT_MID, lineHeight: 23 },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 20 },
  faqItem: { backgroundColor: WHITE, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: BORDER },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: TEXT_DARK, flex: 1, lineHeight: 21 },
  faqChevron: { fontSize: 22, color: TEXT_LIGHT, marginLeft: 8 },
  faqChevronOpen: { transform: [{ rotate: '90deg' }] },
  faqA: { fontFamily: 'Nunito-Regular', fontSize: 14, color: TEXT_MID, lineHeight: 21, marginTop: 10 },
  donateRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  donateBtn: { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  donateBtnSecondary: { backgroundColor: WHITE, borderWidth: 1.5, borderColor: PRIMARY },
  donateBtnText: { fontFamily: 'Nunito-Bold', fontSize: 15, color: WHITE },
  donateBtnTextSecondary: { color: PRIMARY },
  emailLink: { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: PRIMARY_MID, marginTop: 8, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, alignItems: 'center' },
  footerText: { fontFamily: 'Nunito-Regular', fontSize: 13, color: TEXT_LIGHT, textAlign: 'center' },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  faqSection: { marginBottom: 8 },
  faqSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: PRIMARY_LIGHT, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER },
  faqSectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  faqSectionIcon: { fontSize: 18 },
  faqSectionTitle: { fontFamily: 'Nunito-Bold', fontSize: 15, color: PRIMARY },
  faqSectionItems: { marginTop: 4, paddingLeft: 8 },
});
