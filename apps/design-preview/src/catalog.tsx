import {
  Bot,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  FileSearch,
  History,
  Languages,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  Scale,
  Search,
  Settings,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AccessDeniedState,
  AppShell,
  Button,
  Card,
  Composer,
  Dropdown,
  EmptyState,
  ErrorState,
  Header,
  Input,
  InsufficientCreditsState,
  LoadingIndicator,
  LocalNavigation,
  MaintenanceState,
  Modal,
  ModelSelector,
  OfflineState,
  ProfileButton,
  ResponsiveGrid,
  SearchField,
  SegmentedControl,
  Sheet,
  Sidebar,
  Skeleton,
  SuccessState,
  Switch,
  Tabs,
  Textarea,
  useLocale,
  useTheme,
  type YuristimModel,
} from "@yuristim/ui";
import type { Locale } from "@yuristim/design-tokens";

const Section = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="catalog-section">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--yr-color-primary)]">
        Yuristim UI
      </p>
      <h2 className="catalog-title">{title}</h2>
    </div>
    {children}
  </section>
);

export const Catalog = () => {
  const { mode, setMode } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [model, setModel] = useState<YuristimModel>("lite");
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [localNav, setLocalNav] = useState("components");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const navItems = useMemo(
    () => [
      {
        id: "overview",
        label: "Umumiy",
        icon: LayoutDashboard,
        active: true,
        onSelect: () => undefined,
      },
      { id: "components", label: "Komponentlar", icon: BrainCircuit, onSelect: () => undefined },
      {
        id: "feedback",
        label: "Holatlar",
        icon: CircleHelp,
        badge: "9",
        onSelect: () => undefined,
      },
      { id: "assets", label: "Asset Registry", icon: FileSearch, onSelect: () => undefined },
      { id: "localization", label: "Lokalizatsiya", icon: Languages, onSelect: () => undefined },
    ],
    [],
  );

  const sidebar = (
    <Sidebar
      items={navItems}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      footer={<ProfileButton name="Design System" onClick={() => undefined} />}
    />
  );

  return (
    <AppShell
      sidebar={sidebar}
      header={
        <Header
          title="Design System"
          onMenu={() => setMobileMenu(true)}
          center={<ModelSelector value={model} onValueChange={setModel} />}
          actions={
            <Dropdown
              label="Ko‘rinish sozlamalari"
              trigger={
                <Button variant="ghost" size="icon" aria-label="Ko‘rinish sozlamalari">
                  <MoreHorizontal aria-hidden="true" className="size-5" />
                </Button>
              }
              items={[
                {
                  id: "light",
                  label: t("theme.light"),
                  icon: <Sun className="size-4" />,
                  selected: mode === "light",
                  onSelect: () => setMode("light"),
                },
                {
                  id: "dark",
                  label: t("theme.dark"),
                  icon: <Moon className="size-4" />,
                  selected: mode === "dark",
                  onSelect: () => setMode("dark"),
                },
                {
                  id: "system",
                  label: t("theme.system"),
                  icon: <Settings className="size-4" />,
                  selected: mode === "system",
                  onSelect: () => setMode("system"),
                },
              ]}
            />
          }
        />
      }
    >
      <Sheet open={mobileMenu} onOpenChange={setMobileMenu} side="left" title="Yuristim">
        <div className="h-[70vh]">{sidebar}</div>
      </Sheet>

      <div className="mb-8 grid gap-3 rounded-[var(--yr-radius-xl)] bg-[var(--yr-color-brand-surface)] p-5 md:p-8">
        <span className="w-fit rounded-full bg-[var(--yr-color-accent)] px-3 py-1 text-xs font-semibold text-[var(--yr-color-secondary)]">
          Stage 06 · v0.6.0
        </span>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
          Premium, sodda va barcha platformalar uchun yagona tizim.
        </h1>
        <p className="max-w-2xl text-[var(--yr-color-muted)]">
          Light/Dark/System, UZ/RU/EN, WCAG 2.2 AA maqsadi va Telegram Mini App safe area
          adapterlari.
        </p>
        <div className="rounded-[var(--yr-radius-md)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Original logo, sticker va animation fayllari repositoryda yo‘q. Preview ularni o‘ylab
          topmaydi va matn fallbackidan foydalanadi.
        </div>
      </div>

      <LocalNavigation
        label="Katalog bo‘limlari"
        value={localNav}
        onValueChange={setLocalNav}
        items={[
          { value: "components", label: "Komponentlar" },
          { value: "navigation", label: "Navigatsiya" },
          { value: "feedback", label: "Feedback" },
        ]}
      />

      <div className="grid gap-12 py-8">
        <Section id="tokens" title="Brand va design tokens">
          <ResponsiveGrid>
            {[
              ["Primary", "#00865F", "bg-[#00865F]"],
              ["Secondary", "#005C40", "bg-[#005C40]"],
              ["Accent", "#DDF5E9", "bg-[#DDF5E9]"],
              ["Surface", "#F0FAF5", "bg-[#F0FAF5]"],
              ["Pro", "#7C3AED", "bg-[#7C3AED]"],
            ].map(([name, hex, color]) => (
              <Card key={name} className="col-span-2 md:col-span-2 lg:col-span-3">
                <div className={`mb-3 h-16 rounded-[var(--yr-radius-md)] ${color}`} />
                <strong className="block text-sm">{name}</strong>
                <code className="text-xs text-[var(--yr-color-muted)]">{hex}</code>
              </Card>
            ))}
          </ResponsiveGrid>
        </Section>

        <Section id="buttons" title="Button, input va composer">
          <Card className="grid gap-6">
            <div className="flex flex-wrap gap-3">
              <Button>Asosiy amal</Button>
              <Button variant="secondary">Ikkinchi amal</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="pro">Pro</Button>
              <Button variant="danger">O‘chirish</Button>
              <Button loading>Yuklanmoqda</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Ismingiz"
                placeholder="Sizni kim deb chaqirsak bo‘ladi?"
                helperText="Istalgan payt o‘zgartirish mumkin."
              />
              <Input
                label="Xatoli maydon"
                value="Noto‘g‘ri qiymat"
                error="Qiymatni tekshiring."
                readOnly
              />
              <Textarea label="Izoh" placeholder="Batafsil yozing…" />
              <div className="grid content-start gap-3">
                <SearchField
                  label="Komponentlarni qidirish"
                  placeholder="Qidirish…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClear={() => setQuery("")}
                />
                <Switch
                  label="Bildirishnomalar"
                  description="Muhim holatlar haqida xabar berish"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
            </div>
            <Composer
              label="Xabar"
              placeholder={t("composer.placeholder")}
              onSubmit={() => undefined}
              onAttach={() => undefined}
            />
          </Card>
        </Section>

        <Section id="overlays" title="Modal, sheet va controls">
          <Card className="grid gap-5">
            <div className="flex flex-wrap gap-3">
              <Modal
                title="Tasdiqlash"
                description="Bu accessible Radix modal namunasi."
                trigger={<Button variant="secondary">Modalni ochish</Button>}
                footer={
                  <>
                    <Button variant="ghost">Bekor qilish</Button>
                    <Button>Davom etish</Button>
                  </>
                }
              >
                <p className="text-sm text-[var(--yr-color-muted)]">
                  Fokus modal ichida saqlanadi va Escape tugmasi uni yopadi.
                </p>
              </Modal>
              <Sheet
                title="Sozlamalar"
                description="Mobile va desktop sheet"
                trigger={<Button variant="secondary">Sheetni ochish</Button>}
              >
                <div className="grid gap-4">
                  <Switch
                    label="System theme"
                    checked={mode === "system"}
                    onCheckedChange={() => setMode("system")}
                  />
                  <Input label="Display name" defaultValue="Yuristim" />
                </div>
              </Sheet>
              <Dropdown
                label="Til"
                trigger={
                  <Button variant="secondary">
                    {locale.toUpperCase()} <ChevronDown className="size-4" />
                  </Button>
                }
                items={(["uz", "ru", "en"] as Locale[]).map((item) => ({
                  id: item,
                  label: item.toUpperCase(),
                  selected: locale === item,
                  onSelect: () => setLocale(item),
                }))}
              />
            </div>
            <SegmentedControl
              label="Tema"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "light", label: t("theme.light") },
                { value: "dark", label: t("theme.dark") },
                { value: "system", label: t("theme.system") },
              ]}
            />
            <Tabs
              label="Xizmat bo‘limlari"
              defaultValue="catalog"
              items={[
                {
                  value: "catalog",
                  label: "Katalog",
                  content: (
                    <p className="text-sm text-[var(--yr-color-muted)]">
                      Yuristlar katalogi kontenti.
                    </p>
                  ),
                },
                {
                  value: "favorites",
                  label: "Sevimlilar",
                  content: (
                    <p className="text-sm text-[var(--yr-color-muted)]">Saqlangan yuristlar.</p>
                  ),
                },
                {
                  value: "cabinet",
                  label: "Kabinet",
                  content: (
                    <p className="text-sm text-[var(--yr-color-muted)]">Professional kabinet.</p>
                  ),
                },
              ]}
            />
          </Card>
        </Section>

        <Section id="navigation" title="Navigatsiya xaritasi">
          <ResponsiveGrid>
            {[
              [BrainCircuit, "Yuristim AI", "Lite va Pro"],
              [UsersRound, "Yurist topish", "Katalog · Sevimlilar · Kabinet"],
              [Search, "Yuridik izlanish", "Izlanish · Loyihalar · Kutubxona · Tarix"],
              [Scale, "Interaktiv xizmatlar", "Xizmatlar · Tarix · Eslatmalar"],
              [History, "Tarix", "Yagona faoliyat tarixi"],
              [UserRound, "Profil", "Hisob va sozlamalar"],
              [Bot, "Telegram bot", "/start · /menu · /new · /balance"],
              [Menu, "Mobile menu", "85% · max 340px"],
            ].map(([Icon, title, description]) => {
              const Component = Icon as typeof BrainCircuit;
              return (
                <Card
                  key={String(title)}
                  interactive
                  className="col-span-4 md:col-span-4 lg:col-span-3"
                >
                  <Component
                    aria-hidden="true"
                    className="mb-4 size-6 text-[var(--yr-color-primary)]"
                    strokeWidth={1.8}
                  />
                  <h3 className="font-semibold">{String(title)}</h3>
                  <p className="mt-1 text-sm text-[var(--yr-color-muted)]">{String(description)}</p>
                </Card>
              );
            })}
          </ResponsiveGrid>
        </Section>

        <Section id="feedback" title="Feedback va tizim holatlari">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <LoadingIndicator label={t("common.loading")} />
              <div className="mt-4 grid gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </Card>
            <Card>
              <EmptyState
                title={t("feedback.empty.title")}
                description={t("feedback.empty.description")}
              />
            </Card>
            <Card>
              <ErrorState
                title={t("feedback.error.title")}
                description={t("feedback.error.description")}
                action={{ label: t("common.retry"), onClick: () => undefined }}
              />
            </Card>
            <Card>
              <OfflineState
                title={t("feedback.offline.title")}
                description={t("feedback.offline.description")}
              />
            </Card>
            <Card>
              <SuccessState
                title={t("feedback.success.title")}
                description="Amal xavfsiz yakunlandi."
              />
            </Card>
            <Card>
              <InsufficientCreditsState
                title={t("feedback.credits.title")}
                description="Davom etish uchun balansni tekshiring."
              />
            </Card>
            <Card>
              <MaintenanceState
                title={t("feedback.maintenance.title")}
                description="Xizmat tez orada qayta ishlaydi."
              />
            </Card>
            <Card>
              <AccessDeniedState
                title="Ruxsat yo‘q"
                description="Bu bo‘lim uchun tegishli rol talab qilinadi."
              />
            </Card>
          </div>
        </Section>
      </div>
    </AppShell>
  );
};
