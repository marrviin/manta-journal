/**
 * Standalone settings window (WorkBuddy-style look; replaces the old antd Modal):
 * the shell is a gray sidebar (search box + grouped menu) + a gray content area on
 * the right holding white rounded cards with row-style settings (title/desc on the
 * left, control on the right). Pane switching is a component-local controlled
 * activeKey (no nested Router); the sidebar search filters the menu items. The
 * BrowserWindow loads the same renderer with `?window=settings`, which main.tsx
 * routes here; the main window opens it via the `open_settings` IPC.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Dropdown,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Switch,
  Tag,
} from "antd";
import {
  ApiOutlined,
  CloseOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  ExperimentOutlined,
  GithubOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
  UserOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import cx from "classnames";
import { AgentIcon, agentLabel } from "./agent-icon";
import { useI18n } from "./i18n";
import {
  t,
  sbtiLocalized,
  SBTI_TYPES,
  type I18nKey,
} from "@manta-journal/shared";
import { SBTI_IMAGES } from "./sbti-images";
import { AppProviders } from "./theme";
import * as api from "./api";
import appIcon from "./assets/app-icon.png";
import openaiIcon from "./assets/providers/openai.svg";
import minimaxIcon from "./assets/providers/minimax.svg";
import deepseekIcon from "./assets/providers/deepseek.ico";
import kimiIcon from "./assets/providers/kimi.ico";
import zhipuIcon from "./assets/providers/zhipu.png";
import siliconflowIcon from "./assets/providers/siliconflow.png";
import alibabacloudIcon from "./assets/providers/alibabacloud.svg";
import geminiIcon from "./assets/providers/gemini.svg";
import mistralIcon from "./assets/providers/mistral.svg";
import openrouterIcon from "./assets/providers/openrouter.svg";
import ollamaIcon from "./assets/providers/ollama.svg";
import volcengineIcon from "./assets/providers/volcengine.png";
import xaiIcon from "./assets/providers/xai.ico";
import groqIcon from "./assets/providers/groq.ico";
import pkg from "../package.json";

type Notify = (message: string, type?: "info" | "error") => void;

/** Unified settings-card shell shared by the watch and connector panes' card
 *  lists (32px icon + title/desc column + trailing toggle) — white card on the
 *  gray content page, WorkBuddy-style. */
const CARD = "flex items-center gap-3 rounded-xl bg-white px-4 py-3";

const TABS: { key: string; label: I18nKey; icon: React.ReactNode }[] = [
  { key: "common", label: "settings.tab.common", icon: <SettingOutlined /> },
  { key: "personalization", label: "settings.tab.personalization", icon: <UserOutlined /> },
  { key: "general", label: "settings.tab.general", icon: <ExperimentOutlined /> },
  { key: "watch", label: "settings.tab.watch", icon: <ApiOutlined /> },
  { key: "connector", label: "settings.tab.connector", icon: <LinkOutlined /> },
  { key: "data", label: "settings.tab.data", icon: <DatabaseOutlined /> },
  { key: "about", label: "settings.tab.about", icon: <InfoCircleOutlined /> },
];

/** Sidebar menu groups (WorkBuddy-style: a muted group label above each run of
 *  items). Keys must exist in TABS. */
const MENU_GROUPS: { label: I18nKey; keys: string[] }[] = [
  { label: "settings.group.setup", keys: ["common"] },
  { label: "settings.group.features", keys: ["personalization", "general", "watch", "connector"] },
  { label: "settings.group.data", keys: ["data"] },
  { label: "settings.group.other", keys: ["about"] },
];

/** Window entry (mounted by main.tsx when the URL carries ?window=settings):
 *  its own toast context — the settings window never shares the main window's
 *  AntdApp instance. */
export function SettingsWindow() {
  return (
    <AppProviders>
      <SettingsWindowInner />
    </AppProviders>
  );
}

function SettingsWindowInner() {
  const { message } = AntdApp.useApp();
  // The settings window is its own renderer process: bootstrap the memory-service
  // HTTP endpoint the same way the main window's Shell does, BEFORE rendering any
  // pane — server-backed panes (personalization, journals) call requireEndpoint()
  // synchronously on mount and would throw「未连接」even when the service is up.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void api
      .initMemoryEndpoint()
      .catch(() => false)
      .finally(() => setReady(true));
  }, []);
  const notify = useCallback<Notify>(
    (msg, type = "info") => {
      if (!msg) return;
      if (type === "error") message.error(msg);
      else message.info(msg);
    },
    [message],
  );
  if (!ready) return null;
  return <SettingsShell onNotify={notify} />;
}

function SettingsShell({ onNotify }: { onNotify: Notify }) {
  const { t } = useI18n();
  const [pane, setPane] = useState("common");
  const [query, setQuery] = useState("");
  // macOS hiddenInset: the traffic lights float over the sidebar's top-left, so the
  // sidebar starts with a drag strip below them. Other platforms have a native
  // title bar and need no spacer.
  const isMac = navigator.userAgent.includes("Mac");

  // Search filters the menu across groups (substring match on the label); when the
  // active pane is filtered out, jump to the first visible match so the content
  // never shows a pane the menu no longer lists.
  const visibleKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return TABS.filter((t) => t.label.toLowerCase().includes(q)).map(
      (t) => t.key,
    );
  }, [query]);

  useEffect(() => {
    if (!visibleKeys) {
      // Search cleared: restore a pane if an empty result had blanked it out.
      if (!pane) setPane("common");
      return;
    }
    if (!visibleKeys.includes(pane)) {
      setPane(visibleKeys[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeys]);

  return (
    <div className="flex h-screen overflow-hidden bg-panel *:min-h-0 *:min-w-0">
      {/* Left sidebar: drag strip (macOS traffic lights) + search box + grouped menu.
          Same gray as the content area — WorkBuddy-style, no divider between them. */}
      <nav className="box-border flex h-full w-52 shrink-0 flex-col overflow-auto pb-4">
        {isMac && <div className="pc-settings-drag h-13 shrink-0" />}
        <div className={cx("px-3", isMac ? "" : "pt-4")}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settings.searchPlaceholder")}
            prefix={<SearchOutlined className="text-muted" />}
            allowClear
            variant="filled"
          />
        </div>
        <div className="mt-3 flex flex-col gap-5 px-3">
          {MENU_GROUPS.map((group) => {
            const items = TABS.filter(
              (t) =>
                group.keys.includes(t.key) &&
                (!visibleKeys || visibleKeys.includes(t.key)),
            );
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="px-2.5 pb-1.5 text-xs text-muted select-none">
                  {query.trim() ? t("settings.searchResults") : t(group.label)}
                </div>
                <div className="flex flex-col gap-0.5">
                  {items.map((tab) => {
                    const active = tab.key === pane;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setPane(tab.key)}
                        className={cx(
                          "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg border-0 px-2.5 text-[13px] transition-colors",
                          active
                            ? "bg-black/[0.06] font-medium text-fg"
                            : "bg-transparent text-fg hover:bg-hover",
                        )}
                      >
                        <span className="text-muted">{tab.icon}</span>
                        <span>{t(tab.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Right content area: gray page with white cards. The empty top strip is the
          macOS drag region (static in-flow, .pc-settings-header); the content below
          scrolls independently (box-border: the project has no global border-box
          reset — no Tailwind preflight — so without it flex-1 + vertical padding
          would overflow by exactly the padding amount). */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="pc-settings-header h-[54px] shrink-0" />
        {/* 纵向 flex：面板容器 flex-1 撑满滚动区，子页面的 min-h-full 才有确定的
            参照高度（否则关于页等垂直居中失效——百分比高度对着内容高度解析不出）。 */}
        <div className="box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-6 pb-6">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
            {pane === "about" ? (
              <AboutPane />
            ) : pane === "personalization" ? (
              <PersonalizationPane onNotify={onNotify} />
            ) : pane === "watch" ? (
              <WatchPane onNotify={onNotify} />
            ) : pane === "connector" ? (
              <ConnectorsPane onNotify={onNotify} />
            ) : pane === "data" ? (
              <DataPane onNotify={onNotify} />
            ) : pane === "general" ? (
              <GeneralPane onNotify={onNotify} />
            ) : pane === "common" ? (
              <CommonPane />
            ) : (
              <p className="m-0 py-10 text-center text-xs text-muted">
                {t("settings.noMatch", query.trim())}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 服务预设（对齐 joybuddy 模型配置的预设下拉交互）：命中预设自动填 Base URL 和
 *  默认模型名，选「自定义」才手填。接入更多上游：往这里追加一条即可。baseUrl 为
 *  null 的是「自定义」项。所有预设都走 OpenAI 兼容协议（标准 /chat/completions）。
 *  命名对齐行业主流（Cherry Studio / LobeChat 的服务商清单）。
 *
 *  图标来源（打包进安装包，离线可用）：openai/minimax/alibabacloud/gemini/
 *  openrouter/ollama/mistral 取自 simple-icons（CC0）；deepseek/xai/groq 取自
 *  官网 favicon.ico；zhipu/volcengine 取自官网 favicon.png；siliconflow 取自
 *  siliconflow.cn 的 favicon（实为 PNG）；kimi 取自 kimi.com 的 favicon.ico。 */
const LLM_PRESETS: {
  key: string;
  label: string;
  /** Localized display name (Chinese-named presets); absent → label as-is */
  labelKey?: I18nKey;
  baseUrl: string | null;
  model: string;
  iconSrc: string | null;
}[] = [
  {
    key: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    iconSrc: openaiIcon,
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    iconSrc: deepseekIcon,
  },
  {
    key: "kimi",
    label: "Moonshot",
    labelKey: "settings.preset.moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2",
    iconSrc: kimiIcon,
  },
  {
    key: "zhipu",
    label: "Zhipu GLM",
    labelKey: "settings.preset.zhipu",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.6",
    iconSrc: zhipuIcon,
  },
  {
    key: "minimax",
    label: "MiniMax",
    baseUrl: "https://api.minimax.cn/v1",
    model: "MiniMax-M2.7",
    iconSrc: minimaxIcon,
  },
  {
    key: "minimax-global",
    label: "MiniMax Global",
    baseUrl: "https://api.minimax.io/v1",
    model: "MiniMax-M2.7",
    iconSrc: minimaxIcon,
  },
  {
    key: "siliconflow",
    label: "SiliconFlow",
    labelKey: "settings.preset.siliconflow",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
    iconSrc: siliconflowIcon,
  },
  {
    key: "dashscope",
    label: "Bailian",
    labelKey: "settings.preset.dashscope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    iconSrc: alibabacloudIcon,
  },
  {
    key: "ark",
    label: "Volcengine Ark",
    labelKey: "settings.preset.ark",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1.6",
    iconSrc: volcengineIcon,
  },
  {
    key: "gemini",
    label: "Gemini",
    // Google AI Studio 的 OpenAI 兼容端点（路径含尾斜杠，Google 官方如此定义）。
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-2.5-flash",
    iconSrc: geminiIcon,
  },
  {
    key: "xai",
    label: "xAI",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4",
    iconSrc: xaiIcon,
  },
  {
    key: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    iconSrc: groqIcon,
  },
  {
    key: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-large-latest",
    iconSrc: mistralIcon,
  },
  {
    key: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    // 聚合路由的自动选型模型，按上游计费规则分发。
    model: "openrouter/auto",
    iconSrc: openrouterIcon,
  },
  {
    key: "ollama",
    label: "Ollama",
    labelKey: "settings.preset.ollama",
    baseUrl: "http://localhost:11434/v1",
    // 本地模型的常用占位；用户按已 pull 的模型改。
    model: "qwen3:8b",
    iconSrc: ollamaIcon,
  },
  {
    key: "custom",
    label: "Custom",
    labelKey: "settings.preset.custom",
    baseUrl: null,
    model: "",
    iconSrc: null,
  },
];

/** 内置本地 embedding 模型（固定，无配置面；仅供提示文案展示）。 */
const LOCAL_EMBED_MODEL = "bge-small-zh-v1.5";

/** 由当前 baseUrl 反查命中的预设（未命中 → null，即自定义）。 */
function presetFor(baseUrl: string): (typeof LLM_PRESETS)[number] | null {
  return LLM_PRESETS.find((p) => p.baseUrl && p.baseUrl === baseUrl) ?? null;
}

/** Localized display label: presets with a Chinese display name carry a
 *  labelKey; brand-name presets render their label verbatim. */
function presetLabel(p: (typeof LLM_PRESETS)[number], lang: "zh" | "en"): string {
  return p.labelKey ? t(lang, p.labelKey) : p.label;
}

/** 由当前 baseUrl 反查命中的预设 key（未命中 → 「自定义」）。 */
function presetKeyFor(baseUrl: string): string {
  return presetFor(baseUrl)?.key ?? "custom";
}

/** 卡片标题（对齐 joybuddy ModelCard 的 entry.name）：baseUrl 命中预设用预设名，
 *  未命中读作自定义服务。 */
function presetLabelFor(baseUrl: string, lang: "zh" | "en"): string {
  const preset = presetFor(baseUrl);
  return preset ? presetLabel(preset, lang) : t(lang, "settings.model.customService");
}

/** 卡片圆标图标：命中预设用其品牌图标，未命中（自定义）回退到 API 图标。 */
function presetIconFor(baseUrl: string): string | null {
  return presetFor(baseUrl)?.iconSrc ?? null;
}

/** WorkBuddy-style section: muted heading + a stack of white cards below it. */
function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <div className="px-1 text-[13px] font-medium text-muted">{title}</div>
      )}
      {children}
    </section>
  );
}

/** WorkBuddy-style setting row inside a white card: bold title + muted desc on the
 *  left, the control on the right (vertically centered). `children` renders below
 *  the row inside the same card (e.g. the personality picker's preview). */
function SettingRow({
  title,
  desc,
  control,
  children,
}: {
  title: string;
  desc?: React.ReactNode;
  control?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white">
      <div className="flex items-center gap-6 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-fg">{title}</div>
          {desc && (
            <div className="mt-0.5 text-xs leading-5 text-muted">{desc}</div>
          )}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

/** 表单字段行（编辑弹窗内用）：label 在上、控件在下，desc 跟在 label 后。 */
function FormField({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-fg">
        {label}
        {desc && <span className="text-xs font-normal text-muted">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

/** "Common" pane: 常规分组。语言切换即改主进程 store（ui_language），所有窗口
 *  经 journal://language-changed 即时跟随，并推给记忆服务（journal_language）。 */
function CommonPane() {
  const { t, lang, setLang } = useI18n();
  return (
    <SettingsSection title={t("settings.section.general")}>
      <SettingRow
        title={t("settings.language")}
        control={
          <Select
            value={lang}
            onChange={setLang}
            className="w-40"
            options={[
              { value: "zh" as const, label: t("settings.lang.zh") },
              { value: "en" as const, label: t("settings.lang.en") },
            ]}
          />
        }
      />
    </SettingsSection>
  );
}

/** "Model" pane: a library of model-service configs (对齐 joybuddy — 添加多个模型，
 *  列表展示、点卡片编辑、可切换使用中). The active entry drives the memory service
 *  (activation hot-reloads watching; an embedding change invalidates stored vectors —
 *  the backend returns the notice). Storage mode lives in the 数据管理 pane. */
function GeneralPane({ onNotify }: { onNotify: Notify }) {
  const { t, lang } = useI18n();
  const [models, setModels] = useState<api.ModelEntry[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "remote">("local");
  /** Edit-modal draft: null = closed. `id` undefined = adding a new entry;
   *  `orig` is the snapshot for dirty detection. */
  const [draft, setDraft] = useState<{
    id?: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    apiKeyTouched: boolean;
    hasKey: boolean;
    orig: {
      baseUrl: string;
      model: string;
    };
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .listModels()
      .then((r) => {
        setModels(r.models);
        setActiveId(r.activeId);
      })
      .catch((e) =>
        onNotify(t("err.loadModels", String(e?.message ?? e)), "error"),
      );
    api
      .getSettings()
      .then((s) => setMode(s.mode))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setDraft({
      baseUrl: "",
      model: "",
      apiKey: "",
      apiKeyTouched: false,
      hasKey: false,
      orig: {
        baseUrl: "",
        model: "",
      },
    });
  };

  const openEdit = (m: api.ModelEntry) => {
    setDraft({
      id: m.id,
      baseUrl: m.baseUrl,
      model: m.model,
      apiKey: "",
      apiKeyTouched: false,
      hasKey: m.hasApiKey,
      orig: {
        baseUrl: m.baseUrl,
        model: m.model,
      },
    });
  };

  const closeEdit = () => setDraft(null);

  const saveDraft = async () => {
    if (!draft) return;
    const url = draft.baseUrl.trim();
    const name = draft.model.trim();
    if (!url) {
      onNotify(t("settings.model.needUrl"), "error");
      return;
    }
    if (!name) {
      onNotify(t("settings.model.needModel"), "error");
      return;
    }
    setSaving(true);
    try {
      // apiKey: untouched = keep the stored key; touched empty = clear; typed = replace.
      const key = draft.apiKeyTouched ? draft.apiKey.trim() : undefined;
      const res = await api.saveModel(
        {
          id: draft.id,
          baseUrl: url,
          model: name,
        },
        key,
      );
      setModels((prev) =>
        prev
          ? prev.some((m) => m.id === res.model.id)
            ? prev.map((m) => (m.id === res.model.id ? res.model : m))
            : [...prev, res.model]
          : [res.model],
      );
      setActiveId(res.activeId);
      closeEdit();
      // 主进程在 embedding 模型变更时会带回向量失效警告——原样展示。
      onNotify(res.notice || (draft.id ? t("settings.model.saved") : t("settings.model.added")));
    } catch (e) {
      onNotify(t("err.save", String(e)), "error");
    } finally {
      setSaving(false);
    }
  };

  /** Make a library entry the active model service (hot-reloads in the main process). */
  const activate = async (m: api.ModelEntry) => {
    try {
      const res = await api.activateModel(m.id);
      setActiveId(res.activeId);
      onNotify(res.notice || t("settings.model.switched"));
    } catch (e) {
      onNotify(t("err.switch", String(e)), "error");
    }
  };

  /** Delete a library entry. Deleting the active one doesn't touch the running
   *  config — it just leaves the library (activeId becomes null until re-added). */
  const remove = async (m: api.ModelEntry) => {
    try {
      await api.deleteModel(m.id);
      setModels((prev) => prev?.filter((x) => x.id !== m.id) ?? prev);
      if (m.id === activeId) setActiveId(null);
    } catch (e) {
      onNotify(t("err.delete", String(e)), "error");
    }
  };

  // Only meaningful with a draft open; a baseUrl matching no preset reads as「自定义」.
  const presetKey = draft ? presetKeyFor(draft.baseUrl) : "custom";
  const dirty =
    !!draft &&
    (draft.baseUrl.trim() !== draft.orig.baseUrl.trim() ||
      draft.model.trim() !== draft.orig.model.trim() ||
      draft.apiKeyTouched);

  // 弹窗标题区分「新增」与「编辑」：draft.id 为空即为新增。
  const isNew = !draft?.id;

  return (
    <div className="flex flex-col gap-5">
      {mode === "local" && (
        <SettingsSection>
          {/* 顶部卡片（对齐记忆采集）：标题 + 描述在卡内，添加按钮在右侧。 */}
          <SettingRow
            title={t("settings.model.title")}
            desc={t("settings.model.desc")}
            control={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAdd}
                className="shrink-0"
              >
                {t("settings.model.add")}
              </Button>
            }
          />

          {models?.length === 0 && (
            <p className="m-0 px-1 text-xs text-muted">
              {t("settings.model.empty", LOCAL_EMBED_MODEL)}
            </p>
          )}

          {/* 模型列表（对齐 joybuddy ModelCard 两段式布局）：上段圆形图标 + 标题/
              使用中标 + model id + 右侧「生效」开关（同库只能开一个）；dashed 分隔
              的 footer 放服务地址，删除收进右侧三点菜单。整卡可点进编辑。 */}
          {models?.map((m) => {
            const isActive = m.id === activeId;
            return (
              <div
                key={m.id}
                className="model-card cursor-pointer rounded-xl bg-white transition-shadow"
                onClick={() => openEdit(m)}
              >
                <div className="flex items-center gap-3.5 px-4 py-3.5">
                  {/* 圆形 accent 图标：命中预设用其品牌图标，自定义回退 API 图标。 */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--ant-color-info-text-bg)">
                    {presetIconFor(m.baseUrl) ? (
                      <img
                        src={presetIconFor(m.baseUrl)!}
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="h-[22px] w-[22px] rounded object-contain select-none"
                      />
                    ) : (
                      <ApiOutlined className="text-[18px] text-(--ant-color-info-text)" />
                    )}
                  </div>

                  {/* 中段：标题 + 使用中标 + model id */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-fg">
                        {presetLabelFor(m.baseUrl, lang)}
                      </span>
                      {isActive && (
                        <Tag
                          bordered={false}
                          color="green"
                          className="m-0 shrink-0 text-[10px]"
                        >
                          {t("settings.model.active")}
                        </Tag>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {m.model || t("settings.model.noModel")}
                    </div>
                  </div>

                  {/* 「生效」开关：同库只能有一个开启（使用中常亮实心金星的旧交互
                      已移除）；打开即 activate（主进程热切换），关闭无效——切换
                      生效模型只能通过打开另一张卡的开关。 */}
                  <Switch
                    checked={isActive}
                    className="shrink-0 self-center"
                    onChange={(next) => {
                      if (next) void activate(m);
                    }}
                    onClick={(_, e) => e.stopPropagation()}
                  />
                </div>

                {/* dashed 分隔 + footer：服务地址 + API Key 状态 + 右侧三点菜单 */}
                <div className="flex flex-wrap items-center gap-3.5 border-0 border-t border-dashed border-line px-4 pb-3.5 pt-2.5 text-xs text-muted">
                  <span className="inline-flex min-w-0 items-center gap-1 overflow-hidden">
                    <LinkOutlined className="shrink-0" />
                    <span className="max-w-[320px] truncate">
                      {m.baseUrl || t("settings.model.noUrl")}
                    </span>
                  </span>
                  <Dropdown
                    trigger={["click"]}
                    placement="leftBottom"
                    menu={{
                      items: [
                        {
                          key: "delete",
                          icon: <DeleteOutlined />,
                          label: t("common.delete"),
                          danger: true,
                        },
                      ],
                      onClick: ({ key, domEvent }) => {
                        domEvent.stopPropagation();
                        if (key === "delete") void remove(m);
                      },
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      className="ml-auto shrink-0"
                      icon={<EllipsisOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t("settings.model.more", m.model)}
                    />
                  </Dropdown>
                </div>
              </div>
            );
          })}
        </SettingsSection>
      )}

      {/* 编辑弹窗（对齐 joybuddy 的 ModelForm + 弹窗交互）：预设下拉 + 脏检测，保存成功自动关闭。 */}
      <Modal
        title={isNew ? t("settings.model.addTitle") : t("settings.model.editTitle")}
        open={!!draft}
        onCancel={closeEdit}
        width={480}
        centered
        destroyOnHidden
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={closeEdit}>{t("common.cancel")}</Button>
            <Button
              type="primary"
              disabled={!dirty}
              loading={saving}
              onClick={() => void saveDraft()}
            >
              {t("common.save")}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4 py-2">
            <FormField label={t("settings.model.preset")}>
              <Select
                value={presetKey}
                onChange={(key: string) => {
                  const preset = LLM_PRESETS.find((p) => p.key === key);
                  setDraft({
                    ...draft,
                    // 切到自定义时清空 Base URL 让用户手填；命中预设则自动带入
                    // baseUrl 和该服务的默认模型名。
                    baseUrl: preset?.baseUrl || "",
                    model: preset?.model || "",
                  });
                }}
                // 下拉选项与选中值都带品牌图标（对齐 joybuddy 的 ModelForm）。
                options={LLM_PRESETS.map((p) => ({
                  value: p.key,
                  label: (
                    <span className="flex items-center gap-1.5">
                      {p.iconSrc ? (
                        <img
                          src={p.iconSrc}
                          alt=""
                          aria-hidden
                          draggable={false}
                          className="h-4 w-4 rounded-xs object-contain select-none"
                        />
                      ) : (
                        <ApiOutlined className="text-[14px] text-muted" />
                      )}
                      <span>{presetLabel(p, lang)}</span>
                    </span>
                  ),
                }))}
                className="w-full"
              />
            </FormField>

            {presetKey === "custom" && (
              <FormField label="API Base URL">
                <Input
                  value={draft.baseUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, baseUrl: e.target.value })
                  }
                  placeholder="https://api.openai.com/v1"
                  allowClear
                  autoComplete="off"
                  spellCheck={false}
                />
              </FormField>
            )}

            <FormField label="API Key">
              <Input.Password
                value={draft.apiKey}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    apiKey: e.target.value,
                    apiKeyTouched: true,
                  })
                }
                placeholder={draft.hasKey ? "••••••••" : "sk-..."}
                autoComplete="new-password"
              />
            </FormField>

            <FormField label={t("settings.model.modelName")}>
              <Input
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder={presetFor(draft.baseUrl)?.model || "gpt-5-mini"}
                allowClear
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** "Personalization" pane: server-owned preferences that shape how the journal
 *  writer treats you — 搭档如何称呼你 (empty = default「搭档」) and 搭档性格
 *  (SBTI 27-type card picker; empty = the writer's default voice). Text fields
 *  blur-save, cards save on click; failures roll the inputs back. */
function PersonalizationPane({ onNotify }: { onNotify: Notify }) {
  const { t, lang } = useI18n();
  /** null = still loading; "" = unset. */
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [personality, setPersonality] = useState("");
  /** These preferences live in the memory service; without a configured model
   *  service there's nothing to load/save — degrade to an inline notice instead
   *  of toasting an error. */
  const [noService, setNoService] = useState(false);
  /** Last persisted values — blur also fires after allowClear's clear and after
   *  an Enter-save, so identical saves are skipped (idempotent anyway). */
  const savedRef = useRef<{ displayName: string; personality: string } | null>(
    null,
  );

  useEffect(() => {
    api
      .getPersonalization()
      .then((p) => {
        setDisplayName(p.displayName);
        setPersonality(p.personality);
        savedRef.current = {
          displayName: p.displayName,
          personality: p.personality,
        };
      })
      .catch((e) => {
        setDisplayName("");
        if (e instanceof api.NotConnectedError) {
          setNoService(true);
        } else {
          onNotify(t("settings.persona.loadFailed", String(e?.message ?? e)), "error");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Optimistically persist the full personalization block (both fields are
   *  always sent — the API is one PUT); rollback both inputs on failure. */
  const persist = async (next: {
    displayName?: string;
    personality?: string;
  }) => {
    if (!savedRef.current) return;
    const target = {
      displayName: next.displayName ?? savedRef.current.displayName,
      personality: next.personality ?? savedRef.current.personality,
    };
    if (
      target.displayName === savedRef.current.displayName &&
      target.personality === savedRef.current.personality
    ) {
      return;
    }
    const prev = savedRef.current;
    savedRef.current = target;
    if (next.displayName !== undefined) setDisplayName(next.displayName);
    if (next.personality !== undefined) setPersonality(next.personality);
    try {
      await api.savePersonalization(target.displayName, target.personality);
    } catch (e) {
      savedRef.current = prev;
      setDisplayName(prev.displayName);
      setPersonality(prev.personality);
      onNotify(t("err.save", String(e)), "error");
    }
  };

  if (noService) {
    return (
      <div className="rounded-xl bg-white px-5 py-4 text-xs leading-5 text-muted">
        {t("settings.persona.noService")}
      </div>
    );
  }

  if (displayName === null) {
    return <p className="m-0 text-xs text-muted">{t("common.loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection>
        <SettingRow
          title={t("settings.persona.howCalled")}
          control={
            <Input
              value={displayName}
              placeholder={t("settings.persona.namePlaceholder")}
              onChange={(e) => setDisplayName(e.target.value)}
              onPressEnter={() => void persist({ displayName })}
              onBlur={() => void persist({ displayName })}
              maxLength={50}
              allowClear
              className="w-60"
            />
          }
        />
      </SettingsSection>
      <SettingsSection>
        <SettingRow
          title={t("settings.persona.personality")}
          control={
            <Button
              icon={<SyncOutlined />}
              type="text"
              size="small"
              aria-label={t("settings.persona.reroll")}
              onClick={() => {
                // 重抽：从其余 26 型里随机换一个，失败回滚由 persist 处理
                const pool = SBTI_TYPES.filter((t) => t.id !== personality);
                const next = pool[Math.floor(Math.random() * pool.length)]!;
                void persist({ personality: next.id });
              }}
            />
          }
        >
          <div className="flex flex-col gap-3">
            {(() => {
              const found = SBTI_TYPES.find((x) => x.id === personality);
              const current = found ? sbtiLocalized(lang, found) : null;
              return current ? (
                <div className="flex items-start gap-3">
                  <img
                    src={SBTI_IMAGES[found!.id] ?? ""}
                    alt={current.name}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover select-none"
                    draggable={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-[12px] ml-1">{current.name}</span>
                    </div>
                    <div className="relative rounded-xl bg-panel px-4 py-2.5">
                      {current.lines.map((line) => (
                        <p
                          key={line}
                          className="m-0 text-[13px] leading-6 text-fg"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-xs text-muted">
                  {t("settings.persona.unset")}
                </p>
              );
            })()}
          </div>
        </SettingRow>
      </SettingsSection>
    </div>
  );
}

/** "Data" pane: memory-storage mode (local child service / user-deployed remote,
 *  moved here from the manage-memory pane). The model-config fields are a silent
 *  passthrough — every saveSettings call must re-send them, or the backend resets
 *  them to defaults. */
function DataPane({ onNotify }: { onNotify: Notify }) {
  const { t } = useI18n();
  /** Memory storage: local child service (default) or a user-deployed remote service. */
  const [mode, setMode] = useState<"local" | "remote">("local");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteToken, setRemoteToken] = useState("");
  const [hasRemoteToken, setHasRemoteToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [llm, setLlm] = useState<{
    baseUrl: string;
    model: string;
  } | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setMode(s.mode);
        setRemoteUrl(s.remoteUrl);
        setHasRemoteToken(s.hasRemoteToken);
        setLlm({
          baseUrl: s.baseUrl,
          model: s.model,
        });
      })
      .catch((e) => onNotify(t("settings.data.loadFailed", String(e?.message ?? e)), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Mode switch saves immediately; failure rolls the radio back. URL/token
   *  blur-saves reuse the same call in remote mode. */
  const switchMode = async (next: "local" | "remote") => {
    if (!llm) return;
    const prev = mode;
    setMode(next);
    try {
      await api.saveSettings(
        llm.baseUrl,
        null,
        llm.model,
        next,
        remoteUrl,
        null,
      );
      onNotify(
        next === "remote"
          ? t("settings.data.switchedRemote")
          : t("settings.data.switchedLocal"),
      );
    } catch (e) {
      setMode(prev);
      onNotify(t("err.save", String(e)), "error");
    }
  };

  /** Blur-save the service address (fire-and-persist). */
  const saveRemoteUrl = async () => {
    if (!llm) return;
    try {
      await api.saveSettings(
        llm.baseUrl,
        null,
        llm.model,
        "remote",
        remoteUrl,
        null,
      );
    } catch (e) {
      onNotify(t("err.save", String(e)), "error");
    }
  };

  const saveRemoteToken = async () => {
    if (!llm) return;
    const token = remoteToken.trim();
    // Untouched empty field = keep the stored token; typed text replaces; clearing
    // a previously-set token is an explicit clear (null = keep in the IPC contract).
    if (!token && !hasRemoteToken) return;
    try {
      await api.saveSettings(
        llm.baseUrl,
        null,
        llm.model,
        "remote",
        remoteUrl,
        token ? token : null,
      );
      if (token) {
        setHasRemoteToken(true);
        setRemoteToken("");
      }
    } catch (e) {
      onNotify(t("err.save", String(e)), "error");
    }
  };

  /** /health against the user-configured service (uses the typed token so the
   *  user can verify before saving). */
  const testConnection = async () => {
    const base = remoteUrl.trim().replace(/\/+$/, "");
    if (!base) {
      onNotify(t("settings.data.needUrl"), "error");
      return;
    }
    setTesting(true);
    try {
      const r = await api.testMemoryConnection(
        base,
        remoteToken.trim() || null,
      );
      if (!r.ok) {
        onNotify(r.error ?? t("settings.data.connectFailed"), "error");
        return;
      }
      onNotify(
        t(
          "settings.data.connectOk",
          r.embedModel ?? t("settings.data.localEmbed"),
        ),
      );
    } catch (e) {
      onNotify(t("settings.data.testFailed", String(e)), "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <SettingsSection>
      {/* 本地子进程（默认，数据在 userData）或用户自部署的 server/ 远程服务。两种模式
          共用同一套 HTTP 客户端，只是地址不同；切换即时保存，失败回滚。 */}
      <SettingRow
        title={t("settings.data.title")}
        desc={t("settings.data.desc")}
        control={
          <Radio.Group
            value={mode}
            onChange={(e) =>
              void switchMode(e.target.value as "local" | "remote")
            }
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: "local", label: t("settings.data.local") },
              { value: "remote", label: t("settings.data.remote") },
            ]}
          />
        }
      />
      {mode === "remote" && (
        <>
          <p className="m-0 px-1 text-xs leading-5 text-muted">
            {t("settings.data.remoteHelp")}
          </p>
          <SettingRow
            title={t("settings.data.url")}
            control={
              <Input
                value={remoteUrl}
                placeholder="http://127.0.0.1:27184"
                onChange={(e) => setRemoteUrl(e.target.value)}
                onBlur={() => void saveRemoteUrl()}
                allowClear
                className="w-60"
              />
            }
          />
          <SettingRow
            title={t("settings.data.token")}
            desc={
              hasRemoteToken
                ? t("settings.data.tokenSet")
                : t("settings.data.tokenUnset")
            }
            control={
              <Input.Password
                value={remoteToken}
                placeholder={
                  hasRemoteToken ? "••••••••" : t("settings.data.tokenOptional")
                }
                onChange={(e) => setRemoteToken(e.target.value)}
                onBlur={() => void saveRemoteToken()}
                className="w-50"
              />
            }
          />
          <SettingRow
            title={t("settings.data.testTitle")}
            desc={t("settings.data.testDesc")}
            control={
              <Button
                icon={<ApiOutlined />}
                loading={testing}
                onClick={() => void testConnection()}
              >
                {t("common.test")}
              </Button>
            }
          />
        </>
      )}
    </SettingsSection>
  );
}

/** "Manage memory" pane: watch cards. Builtin watch cards have
 *  locked paths with only a toggle; custom cards are added via a top-right button that
 *  opens a small form modal. Changes persist automatically (toggle / delete / add save
 *  immediately, text edits save on blur) — the main process hot-reloads watching on
 *  every save and one-time imports existing content for newly enabled cards. */
function WatchPane({ onNotify }: { onNotify: Notify }) {
  const { t, lang } = useI18n();
  const [rules, setRules] = useState<api.WatchRule[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draftAgent, setDraftAgent] = useState("");
  const [draftMatch, setDraftMatch] = useState("");

  useEffect(() => {
    api
      .getWatchRules()
      .then(setRules)
      .catch((e) =>
        onNotify(t("settings.watch.loadFailed", String(e?.message ?? e)), "error"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rules)
    return <p className="m-0 text-xs text-muted">{t("common.loading")}</p>;

  // Builtin cards render alphabetically by agent regardless of stored order;
  // custom cards keep the user's own ordering.
  const builtins = rules
    .filter((r) => r.builtin)
    .sort((a, b) => a.agent.localeCompare(b.agent));
  const customs = rules.filter((r) => !r.builtin);

  // Local-only state change (text inputs update on every keystroke; persisted on blur).
  const update = (id: string, patch: Partial<api.WatchRule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  // Persist immediately: hot-reloads watching in the main process (and imports existing
  // content for newly enabled cards), so it's reserved for discrete actions.
  // Rules with an empty match are sent as-is: filtering them here would silently
  // delete a card mid-edit (persist fires on blur), losing the user's input.
  const persist = async (next: api.WatchRule[]) => {
    setRules(next);
    try {
      await api.saveWatchRules(next);
    } catch (e: any) {
      onNotify(t("err.save", String(e?.message ?? e)), "error");
    }
  };

  // Default agent name for a custom card: the first directory segment of the first entry
  // (dot stripped), e.g. .cursor/memory/*.md → cursor
  const deriveAgent = (match: string) =>
    match
      .split(",")[0]!
      .split("/")
      .find((seg) => seg && !seg.startsWith(".") && !seg.includes("*")) ?? "";

  const addCard = () => {
    const match = draftMatch.trim();
    if (!match) return;
    const agent = draftAgent.trim() || deriveAgent(match) || "custom";
    void persist([
      ...rules,
      {
        id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agent,
        match,
        enabled: true,
      },
    ]);
    setAddOpen(false);
    setDraftAgent("");
    setDraftMatch("");
    onNotify(t("settings.watch.added", agent));
  };

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection>
        {/* 标题行：标题 + 描述在卡内，添加按钮在右侧 */}
        <SettingRow
          title={t("settings.watch.title")}
          desc={t("settings.watch.desc")}
          control={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="shrink-0"
              onClick={() => setAddOpen(true)}
            >
              {t("settings.watch.add")}
            </Button>
          }
        />

        {builtins.map((r) => (
          <div key={r.id} className={cx(CARD)}>
            <AgentIcon agent={r.agent} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-fg">
                  {agentLabel(lang, r.agent)}
                </span>
                <Tag bordered={false} className="m-0 shrink-0 text-muted">
                  {t("settings.watch.builtinTag")}
                </Tag>
              </div>
              <div
                className="mt-0.5 truncate font-mono text-xs text-muted"
                title={r.match}
              >
                {r.match}
              </div>
            </div>
            <Switch
              checked={r.enabled}
              onChange={(enabled) =>
                void persist(
                  rules.map((x) => (x.id === r.id ? { ...x, enabled } : x)),
                )
              }
            />
          </div>
        ))}

        {customs.length > 0 && (
          <>
            <div className="mt-2 px-1 text-xs font-medium text-muted">
              {t("settings.watch.custom")}
            </div>
            <div className="flex flex-col gap-3">
              {customs.map((r) => (
                <div key={r.id} className={cx(CARD)}>
                  <AgentIcon agent={r.agent.trim() || "custom"} size={32} />
                  <Input
                    value={r.agent}
                    onChange={(e) => update(r.id, { agent: e.target.value })}
                    onBlur={() => void persist(rules)}
                    placeholder={t("settings.watch.agentPlaceholder")}
                    variant="borderless"
                    className="!px-0 font-medium"
                    style={{ width: 120 }}
                  />
                  <Input
                    value={r.match}
                    onChange={(e) => update(r.id, { match: e.target.value })}
                    onBlur={() => void persist(rules)}
                    placeholder=".cursor/memory/*.md"
                    variant="borderless"
                    className="min-w-0 flex-1 !px-0 font-mono text-[13px]"
                  />
                  <Popconfirm
                    title={t("settings.watch.deleteConfirm")}
                    okText={t("common.delete")}
                    cancelText={t("common.cancel")}
                    okButtonProps={{ danger: true }}
                    onConfirm={() =>
                      void persist(rules.filter((x) => x.id !== r.id))
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      aria-label={t("settings.watch.deleteAria", r.agent)}
                    />
                  </Popconfirm>
                  <Switch
                    checked={r.enabled}
                    onChange={(enabled) =>
                      void persist(
                        rules.map((x) =>
                          x.id === r.id ? { ...x, enabled } : x,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </SettingsSection>

      {/* Add-card form modal: agent name is optional (derived from the match path when blank). */}
      <Modal
        open={addOpen}
        title={t("settings.watch.addTitle")}
        okText={t("common.add")}
        cancelText={t("common.cancel")}
        width={480}
        okButtonProps={{ disabled: !draftMatch.trim() }}
        onOk={addCard}
        onCancel={() => setAddOpen(false)}
        destroyOnHidden
      >
        <div className="flex flex-col gap-4 py-2">
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-fg">
              {t("settings.watch.agentLabel")}
              <span className="ml-1.5 text-xs font-normal text-muted">
                {t("settings.watch.agentHint")}
              </span>
            </div>
            <Input
              value={draftAgent}
              onChange={(e) => setDraftAgent(e.target.value)}
              onPressEnter={addCard}
              placeholder={t("settings.watch.agentEg")}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-fg">
              {t("settings.watch.matchLabel")}
            </div>
            <Input
              value={draftMatch}
              onChange={(e) => setDraftMatch(e.target.value)}
              onPressEnter={addCard}
              placeholder={t("settings.watch.matchPlaceholder")}
              autoFocus
            />
            <div className="mt-1.5 text-xs leading-5 text-muted">
              {t("settings.watch.matchHintPre")} <code>*</code> /{" "}
              <code>**</code> {t("settings.watch.matchHintMid")}{" "}
              <code>&lt;slug&gt;</code> {t("settings.watch.matchHintPost")}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Connectors supported by the pane: one card per agent, rendered from this list.
 *  Adding an upstream is: extend inject.ts's ConnectorAgent + spec, then append here
 *  (and add a settings.connector.desc.* entry to the shared i18n dictionary).
 *  `descKey` states where the toggle writes (keep in sync with inject.ts's agentSpec). */
const CONNECTORS: {
  agent: api.ConnectorAgent;
  name: string;
  descKey: I18nKey;
}[] = [
  {
    agent: "claude-code",
    name: "Claude Code",
    descKey: "settings.connector.desc.claude-code",
  },
  {
    agent: "codex",
    name: "Codex",
    descKey: "settings.connector.desc.codex",
  },
  {
    agent: "hermes",
    name: "Hermes",
    descKey: "settings.connector.desc.hermes",
  },
  {
    agent: "joycode",
    name: "JoyCode",
    descKey: "settings.connector.desc.joycode",
  },
  {
    agent: "workbuddy",
    name: "WorkBuddy",
    descKey: "settings.connector.desc.workbuddy",
  },
];

/** "Connectors" pane: registers Journal as an MCP server in each agent's user-level config,
 *  letting agent sessions read the current project's shared memories via MCP tools
 *  (recall_memories / list_projects). One card per connection: status + toggle. */
function ConnectorsPane({ onNotify }: { onNotify: Notify }) {
  const { t } = useI18n();
  /** Per-agent binding status; undefined = still loading. */
  const [bound, setBound] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    for (const c of CONNECTORS) {
      api
        .mcpStatus(c.agent)
        .then((b) => setBound((prev) => ({ ...prev, [c.agent]: b })))
        .catch((e) =>
          onNotify(t("settings.connector.statusFailed", String(e?.message ?? e)), "error"),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (c: (typeof CONNECTORS)[number], next: boolean) => {
    setBusy(c.agent);
    try {
      onNotify(
        next ? await api.injectMcp(c.agent) : await api.removeMcp(c.agent),
      );
      const boundNow = await api.mcpStatus(c.agent);
      setBound((prev) => ({ ...prev, [c.agent]: boundNow }));
    } catch (e: any) {
      onNotify(t("settings.connector.actionFailed", String(e?.message ?? e)), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {CONNECTORS.map((c) => (
        <div key={c.agent} className={cx(CARD)}>
          <AgentIcon agent={c.agent} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-fg">{c.name}</span>
              <Tag
                bordered={false}
                className="m-0 shrink-0"
                color={bound[c.agent] ? "green" : "default"}
              >
                {bound[c.agent] ? t("settings.connector.bound") : t("settings.connector.unbound")}
              </Tag>
            </div>
            <div className="mt-0.5 text-xs text-muted">{t(c.descKey)}</div>
          </div>
          <Switch
            checked={!!bound[c.agent]}
            loading={busy === c.agent}
            onChange={(v) => void toggle(c, v)}
          />
        </div>
      ))}
    </div>
  );
}

const GITHUB_URL = "https://github.com/marrviin/manta-journal";
const FEEDBACK_URL = `${GITHUB_URL}/issues/new`;

/** "About" pane: app icon, name and version, a feedback button, and a footer
 *  with the repo link + copyright (aligned with manta-compare's about page). */
function AboutPane() {
  const { t } = useI18n();
  return (
    // min-h-full + justify-center: the whole block (content + footer, original
    // spacing) centers vertically in the scroll area.
    <div className="flex min-h-full flex-col justify-center">
      <div className="flex flex-col items-center gap-3 py-14">
        <img
          src={appIcon}
          alt="Journal"
          className="h-20 w-20 rounded-xl object-contain select-none"
          draggable={false}
        />
        <div className="text-lg font-semibold text-fg">Journal</div>
        <div className="text-xs text-muted">v{pkg.version}</div>
        <Button
          icon={<MessageOutlined />}
          className="mt-2"
          onClick={() => void api.openExternal(FEEDBACK_URL)}
        >
          {t("settings.about.feedback")}
        </Button>
      </div>

      {/* Footer: repo link + copyright. */}
      <div className="flex flex-col items-center gap-1.5 pb-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[12px] text-muted bg-transparent border-0 cursor-pointer transition-colors hover:text-accent"
          onClick={() => void api.openExternal(GITHUB_URL)}
        >
          <GithubOutlined />
          <span>github.com/marrviin/manta-journal</span>
        </button>
        <span className="text-[11px] text-muted select-none">
          © {new Date().getFullYear()} marrviin
        </span>
      </div>
    </div>
  );
}
