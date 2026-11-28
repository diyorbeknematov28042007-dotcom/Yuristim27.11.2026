import type { Locale } from "@yuristim/design-tokens";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const uz = {
  "common.close": "Yopish",
  "common.cancel": "Bekor qilish",
  "common.save": "Saqlash",
  "common.continue": "Davom etish",
  "common.search": "Qidirish",
  "common.retry": "Qayta urinish",
  "common.loading": "Yuklanmoqda",
  "nav.ai": "Yuristim AI",
  "nav.lawyers": "Yurist topish",
  "nav.research": "Yuridik izlanish",
  "nav.interactive": "Interaktiv xizmatlar",
  "nav.history": "Tarix",
  "nav.profile": "Profil",
  "model.lite": "Lite",
  "model.pro": "Pro",
  "feedback.empty.title": "Hozircha hech narsa yo‘q",
  "feedback.empty.description": "Yangi amal boshlaganingizda natijalar shu yerda ko‘rinadi.",
  "feedback.error.title": "Xatolik yuz berdi",
  "feedback.error.description":
    "Qayta urinib ko‘ring. Muammo davom etsa, xatolik ID sini yuboring.",
  "feedback.offline.title": "Internet aloqasi yo‘q",
  "feedback.offline.description": "Ulanish tiklangach, xavfsiz davom etishingiz mumkin.",
  "feedback.success.title": "Muvaffaqiyatli",
  "feedback.credits.title": "Kredit yetarli emas",
  "feedback.maintenance.title": "Texnik xizmat",
  "composer.placeholder": "Huquqiy savolingizni yozing…",
  "theme.light": "Yorug‘",
  "theme.dark": "Qorong‘i",
  "theme.system": "Tizim",
  "bot.start": "Boshlash",
  "bot.menu": "Menyu",
  "bot.balance": "Balans",
  "bot.help": "Yordam",
} as const;

export type TranslationKey = keyof typeof uz;
type Dictionary = Record<TranslationKey, string>;

const ru: Dictionary = {
  "common.close": "Закрыть",
  "common.cancel": "Отмена",
  "common.save": "Сохранить",
  "common.continue": "Продолжить",
  "common.search": "Поиск",
  "common.retry": "Повторить",
  "common.loading": "Загрузка",
  "nav.ai": "Yuristim AI",
  "nav.lawyers": "Найти юриста",
  "nav.research": "Юридическое исследование",
  "nav.interactive": "Интерактивные услуги",
  "nav.history": "История",
  "nav.profile": "Профиль",
  "model.lite": "Lite",
  "model.pro": "Pro",
  "feedback.empty.title": "Пока ничего нет",
  "feedback.empty.description": "Результаты появятся здесь после начала нового действия.",
  "feedback.error.title": "Произошла ошибка",
  "feedback.error.description": "Попробуйте снова. Если ошибка повторится, отправьте её ID.",
  "feedback.offline.title": "Нет подключения к интернету",
  "feedback.offline.description": "После восстановления связи можно безопасно продолжить.",
  "feedback.success.title": "Готово",
  "feedback.credits.title": "Недостаточно кредитов",
  "feedback.maintenance.title": "Технические работы",
  "composer.placeholder": "Введите юридический вопрос…",
  "theme.light": "Светлая",
  "theme.dark": "Тёмная",
  "theme.system": "Системная",
  "bot.start": "Начать",
  "bot.menu": "Меню",
  "bot.balance": "Баланс",
  "bot.help": "Помощь",
};

const en: Dictionary = {
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.continue": "Continue",
  "common.search": "Search",
  "common.retry": "Try again",
  "common.loading": "Loading",
  "nav.ai": "Yuristim AI",
  "nav.lawyers": "Find a lawyer",
  "nav.research": "Legal research",
  "nav.interactive": "Interactive services",
  "nav.history": "History",
  "nav.profile": "Profile",
  "model.lite": "Lite",
  "model.pro": "Pro",
  "feedback.empty.title": "Nothing here yet",
  "feedback.empty.description": "Results will appear here after you start a new action.",
  "feedback.error.title": "Something went wrong",
  "feedback.error.description": "Try again. If it continues, send the safe error ID.",
  "feedback.offline.title": "You are offline",
  "feedback.offline.description": "You can continue safely when the connection returns.",
  "feedback.success.title": "Completed",
  "feedback.credits.title": "Insufficient credits",
  "feedback.maintenance.title": "Maintenance",
  "composer.placeholder": "Type your legal question…",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "bot.start": "Start",
  "bot.menu": "Menu",
  "bot.balance": "Balance",
  "bot.help": "Help",
};

export const dictionaries: Record<Locale, Dictionary> = { uz, ru, en };

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider = ({
  children,
  defaultLocale = "uz",
}: {
  children: ReactNode;
  defaultLocale?: Locale;
}) => {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key) => dictionaries[locale][key] }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (context === null) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
};
