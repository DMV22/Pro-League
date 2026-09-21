export const uiText = {
  brand: {
    name: 'ProLeague',
  },
  metadata: {
    defaultTitle: 'ProLeague — місцевий футбол',
    description:
      'Офіційна інформація про місцеві футбольні змагання, команди, календарі, результати та новини.',
  },
  accessibility: {
    skipToContent: 'Перейти до основного вмісту',
  },
  navigation: {
    publicLabel: 'Основна навігація',
    adminLabel: 'Навігація адміністратора',
    home: 'Головна',
    adminHome: 'Огляд',
    publicPortal: 'Відкрити публічний портал',
  },
  public: {
    kicker: 'ProLeague Portal',
    title: 'Нова платформа місцевого футболу',
    summary:
      'Базова оболонка готова. Новини, турніри, календарі та результати будуть додаватися послідовними вертикальними зрізами.',
    status: 'Next.js foundation · online',
    footer: 'Інформаційний портал місцевих футбольних змагань.',
  },
  admin: {
    metadataTitle: 'Адміністрування',
    metadataDescription: 'Службова оболонка керування порталом ProLeague.',
    eyebrow: 'Службова область',
    title: 'ProLeague Admin',
    kicker: 'Admin shell',
    pageTitle: 'Керування порталом',
    summary: 'Тут з’являться інструменти для новин, змагань, календарів і результатів.',
    authNotice: 'Авторизація та робочі модулі будуть підключені на наступних етапах.',
  },
  feedback: {
    loading: 'Завантажуємо сторінку…',
    loadingAdmin: 'Завантажуємо область адміністрування…',
    errorTitle: 'Не вдалося завантажити сторінку',
    errorDescription: 'Спробуйте повторити дію. Якщо помилка не зникне, поверніться пізніше.',
    retry: 'Спробувати ще раз',
  },
  notFound: {
    metadataTitle: 'Сторінку не знайдено',
    title: 'Такої сторінки немає',
    description: 'Перевірте адресу або поверніться на головну сторінку порталу.',
    backHome: 'Повернутися на головну',
  },
} as const
