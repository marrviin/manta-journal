//! Cross-package i18n dictionary — the single translation table shared by the
//! web renderer, the Electron main process and the memory server (all consume
//! shared TS source directly, zero dependencies).
//!
//! Entries are `[zh, en]` tuples keyed by a flat domain-prefixed key; `t()`
//! substitutes `{0}`-style positional params. A missing key falls back to zh,
//! then to the key itself, so a forgotten translation degrades gracefully
//! instead of rendering a hole. Language selection lives with the caller:
//! the renderer reads it from the main process via IPC, the main process from
//! its settings store, and the server from the per-request X-App-Language
//! header (or its stored journal_language setting).

export type Lang = 'zh' | 'en';

export function normalizeLang(v: unknown): Lang {
  return v === 'en' ? 'en' : 'zh';
}

type Entry = readonly [zh: string, en: string];

const STRINGS = {
  // ---------- common ----------
  'common.ok': ['确定', 'OK'],
  'common.cancel': ['取消', 'Cancel'],
  'common.save': ['保存', 'Save'],
  'common.delete': ['删除', 'Delete'],
  'common.add': ['添加', 'Add'],
  'common.test': ['测试', 'Test'],
  'common.loading': ['加载中…', 'Loading…'],

  // ---------- main-window sidebar / home ----------
  'nav.backHome': ['回到首页', 'Back to home'],
  'nav.tagline': ['共享记忆总线', 'Shared memory bus'],
  'nav.addProject': ['添加项目', 'Add project'],
  'nav.projects': ['项目', 'Projects'],
  'nav.settings': ['设置', 'Settings'],
  'project.global': ['全局记忆', 'Global memory'],

  // ---------- memory cards / fact panel ----------
  'fact.count': ['{0} 条记忆', '{0} memories'],
  'fact.removeMenu': ['移除项目', 'Remove project'],
  'fact.removeTitle': ['移除项目「{0}」？', 'Remove "{0}"?'],
  'fact.removeDesc': [
    '该项目在记忆服务中的全部记忆（含向量）将被一并删除，此操作不可恢复。',
    "All of this project's memories in the memory service (vectors included) will be deleted too. This cannot be undone.",
  ],
  'fact.removeOk': ['删除并移除', 'Delete & remove'],
  'fact.removed': ['已移除项目「{0}」', 'Removed "{0}"'],
  'fact.filterHint': ['（点击过滤，再次点击取消）', '(click to filter, click again to clear)'],
  'fact.noWatchHint': [
    '（未配置监听卡片，见 设置 → 记忆管理）',
    '(No watch cards configured — see Settings → Memory)',
  ],
  'fact.importWaiting': ['共 {0} 个文件，等待导入…', '{0} files in total, waiting to import…'],
  'fact.importing': ['存量记忆导入中…', 'Importing existing memories…'],
  'fact.relevance': ['相关度 {0}%', 'Relevance {0}%'],
  'fact.keywordMatch': ['关键词匹配', 'Keyword match'],
  'fact.openFileHint': ['（点击打开文件）', '(click to open the file)'],
  'type.localMemory': ['本地记忆', 'Local memory'],
  'type.manual': ['人工录入', 'Manual entry'],

  // ---------- search ----------
  'search.placeholder': ['输入关键词搜索', 'Search memories'],
  'search.keywordZero': [
    '关键词检索「{0}」命中 0 条（语义路径无足够相关的命中，如英文词查中文记忆）',
    'Keyword search for "{0}" found 0 hits (the semantic path had no relevant matches — e.g. an English query against Chinese memories)',
  ],
  'search.keywordHits': [
    '关键词检索「{0}」命中 {1} 条（语义路径无足够相关的命中，如英文词查中文记忆）',
    'Keyword search for "{0}" found {1} hits (the semantic path had no relevant matches — e.g. an English query against Chinese memories)',
  ],
  'search.hybridHits': [
    '混合检索「{0}」命中 {1} 条（关键词 + 语义，RRF 融合排序）',
    'Hybrid search for "{0}" found {1} hits (keywords + semantics, RRF-fused ranking)',
  ],
  'search.noSemantic': ['没有语义相关的记忆。', 'No semantically related memories.'],

  // ---------- import progress ----------
  'notice.importDone': [
    '存量导入完成：新增 {0}，更新 {1}，删除 {2}',
    'Existing-content import finished: {0} added, {1} updated, {2} deleted',
  ],
  'notice.importDoneNoDel': [
    '存量导入完成：新增 {0}，更新 {1}',
    'Existing-content import finished: {0} added, {1} updated',
  ],
  'err.memoryUnconfiguredHint': [
    '记忆服务未配置，请在设置中配置模型服务',
    'Memory service not configured — set up a model service in Settings',
  ],
  'notice.importInterrupted': ['存量导入中断: {0}', 'Existing-content import interrupted: {0}'],
  'notice.memoryUnconfigured': [
    '记忆服务未配置，已有记忆未导入',
    'Memory service not configured — existing content not imported',
  ],
  'notice.ingestFailed': ['记忆入库失败', 'Failed to store memory'],
  'notice.memoryStoreUnconfigured': ['记忆库未配置', 'Memory store not configured'],
  'notice.startupFailed': [
    '启动初始化失败，监听与导入已暂停: {0}',
    'Startup init failed — watching and importing paused: {0}',
  ],

  // ---------- journal view / book ----------
  'journal.today': ['今天', 'Today'],
  'journal.yesterday': ['昨天', 'Yesterday'],
  'journal.pendingWriting': ['正在补写这一天的日记…', "Writing this day's entry…"],
  'journal.empty': ['还没有日记', 'No journal entries yet'],
  'journal.openBook': ['打开日记本', 'Open the journal book'],
  'journal.toGrid': ['切换为栅格布局', 'Switch to grid layout'],
  'journal.toList': ['切换为列表布局', 'Switch to list layout'],
  'journal.regenHint': [
    '调试用：删除本项目过去的日记并从同样的记忆条目重新生成（今天的日记不受影响）',
    "Debug: delete this project's past entries and regenerate them from the same memories (today's entry is untouched)",
  ],
  'journal.toggleHint': ['实验日志（点击切换日志视图）', 'Lab log (click to toggle the journal view)'],
  'journal.regenStarted': ['已删除现有日记，正在重新生成…', 'Existing entries deleted — regenerating…'],
  'journal.regenFailed': ['重新生成失败: {0}', 'Regeneration failed: {0}'],
  'journal.loadFailed': ['加载日志失败: {0}', 'Failed to load journal entries: {0}'],
  'journal.loadFailedShort': ['日记加载失败：{0}', 'Failed to load journals: {0}'],
  'journal.bookEmpty': ['这个项目还没有日记', 'This project has no journal entries yet'],
  'win.journal': ['日记本', 'Journal Book'],
  'win.settings': ['设置', 'Settings'],

  // ---------- agent / type labels ----------
  'agent.myagent': ['自研 Agent', 'In-house Agent'],
  'agent.user': ['人工', 'Human'],

  // ---------- settings shell ----------
  'settings.tab.common': ['通用', 'General'],
  'settings.tab.personalization': ['个性化', 'Personalization'],
  'settings.tab.general': ['模型', 'Model'],
  'settings.tab.watch': ['记忆管理', 'Memory'],
  'settings.tab.connector': ['连接器', 'Connectors'],
  'settings.tab.data': ['数据管理', 'Data'],
  'settings.tab.about': ['关于', 'About'],
  'settings.group.setup': ['设置', 'Settings'],
  'settings.group.features': ['功能', 'Features'],
  'settings.group.data': ['数据', 'Data'],
  'settings.group.other': ['其他', 'Other'],
  'settings.searchPlaceholder': ['搜索设置项', 'Search settings'],
  'settings.searchResults': ['搜索结果', 'Search results'],
  'settings.noMatch': ['没有匹配「{0}」的设置项', 'No settings match "{0}"'],

  // ---------- Common pane ----------
  'settings.section.general': ['常规', 'General'],
  'settings.language': ['语言', 'Language'],
  'settings.lang.zh': ['简体中文', '简体中文'],
  'settings.lang.en': ['English', 'English'],

  // ---------- Model pane ----------
  'settings.model.title': ['模型服务', 'Model services'],
  'settings.model.desc': [
    '可添加多个模型配置，点击下方卡片编辑，打开卡片右侧开关后即刻生效',
    'Add multiple model configs; click a card below to edit, and turn on the switch on its right to activate it',
  ],
  'settings.model.add': ['添加模型', 'Add model'],
  'settings.model.empty': [
    '还没有添加模型。不加也可以用：语义检索默认走内置本地 Embedding（{0}），添加模型服务只是为了启用 LLM 相关功能（如日志回填）。',
    'No models added yet. The app works without one: semantic search uses the bundled local embedding model ({0}); adding a model service only enables the LLM-powered features (e.g. journal backfill).',
  ],
  'settings.model.active': ['使用中', 'Active'],
  'settings.model.noModel': ['(未设置模型名)', '(no model set)'],
  'settings.model.noUrl': ['未设置服务地址', 'No service URL set'],
  'settings.model.more': ['更多操作 {0}', 'More actions for {0}'],
  'settings.model.addTitle': ['添加模型', 'Add model'],
  'settings.model.editTitle': ['编辑模型', 'Edit model'],
  'settings.model.preset': ['服务预设', 'Preset'],
  'settings.model.modelName': ['模型名', 'Model name'],
  'settings.model.needUrl': ['请填写 API Base URL', 'Please enter the API Base URL'],
  'settings.model.needModel': ['请填写模型名', 'Please enter the model name'],
  'settings.model.saved': ['模型已保存', 'Model saved'],
  'settings.model.added': ['模型已添加', 'Model added'],
  'settings.model.switched': ['已切换使用中的模型', 'Active model switched'],
  'settings.model.customService': ['自定义服务', 'Custom service'],
  'settings.preset.moonshot': ['月之暗面 Moonshot', 'Moonshot (Kimi)'],
  'settings.preset.zhipu': ['智谱 GLM', 'Zhipu GLM'],
  'settings.preset.siliconflow': ['硅基流动', 'SiliconFlow'],
  'settings.preset.dashscope': ['阿里云百炼', 'Alibaba Cloud Bailian'],
  'settings.preset.ark': ['火山方舟', 'Volcengine Ark'],
  'settings.preset.ollama': ['Ollama（本地）', 'Ollama (local)'],
  'settings.preset.custom': ['自定义', 'Custom'],

  // ---------- Personalization pane ----------
  'settings.persona.howCalled': ['搭档如何称呼你', 'What your partner calls you'],
  'settings.persona.namePlaceholder': ['搭档', 'Partner'],
  'settings.persona.personality': ['搭档性格', 'Partner personality'],
  'settings.persona.reroll': ['换一个性格', 'Reroll personality'],
  'settings.persona.unset': [
    '还没抽出性格，记忆服务连接后自动抽取',
    'No personality drawn yet — one is picked automatically once the memory service connects',
  ],
  'settings.persona.noService': [
    '记忆服务未连接：个性化设置随记忆服务一起存储，请先在「模型」页完成服务配置。',
    'Memory service not connected: personalization is stored with the memory service. Set the service up on the Model page first.',
  ],
  'settings.persona.loadFailed': ['加载个性化设置失败: {0}', 'Failed to load personalization: {0}'],

  // ---------- Watch (memory capture) pane ----------
  'settings.watch.title': ['记忆采集', 'Memory capture'],
  'settings.watch.desc': [
    '监听各 Agent 的记忆文件，自动写入记忆库',
    "Watches each agent's memory files and writes them into the memory store",
  ],
  'settings.watch.add': ['添加目录', 'Add folder'],
  'settings.watch.builtinTag': ['内置', 'Built-in'],
  'settings.watch.custom': ['自定义', 'Custom'],
  'settings.watch.agentPlaceholder': ['Agent 名', 'Agent name'],
  'settings.watch.deleteConfirm': [
    '删除该采集目录？已导入的记忆会保留。',
    'Remove this watch folder? Already-imported memories are kept.',
  ],
  'settings.watch.deleteAria': ['删除 {0}', 'Delete {0}'],
  'settings.watch.addTitle': ['添加采集目录', 'Add watch folder'],
  'settings.watch.agentLabel': ['Agent 名', 'Agent name'],
  'settings.watch.agentHint': ['留空则从路径推断', 'Inferred from the path when left blank'],
  'settings.watch.agentEg': ['如 cursor', 'e.g. cursor'],
  'settings.watch.matchLabel': ['匹配表达式', 'Match pattern'],
  'settings.watch.matchPlaceholder': [
    '.cursor/memory/*.md，逗号分隔多个条目',
    '.cursor/memory/*.md — separate multiple entries with commas',
  ],
  'settings.watch.matchHintPre': ['匹配表达式支持', 'Match patterns support'],
  'settings.watch.matchHintMid': ['通配符与', 'wildcards and'],
  'settings.watch.matchHintPost': ['展开（展开为当前项目名）。', 'expansion (expands to the current project\'s name).'],
  'settings.watch.added': ['已添加「{0}」采集目录', 'Added watch folder "{0}"'],
  'settings.watch.loadFailed': ['加载记忆采集目录失败: {0}', 'Failed to load watch folders: {0}'],

  // ---------- Connectors pane ----------
  'settings.connector.bound': ['已绑定', 'Connected'],
  'settings.connector.unbound': ['未绑定', 'Not connected'],
  'settings.connector.desc.claude-code': [
    '写入 ~/.claude.json 的 mcpServers 配置，新会话生效',
    'Writes the mcpServers section of ~/.claude.json — takes effect in new sessions',
  ],
  'settings.connector.desc.codex': [
    '写入 ~/.codex/config.toml 的 [mcp_servers.journal] 配置段，新会话生效',
    'Writes the [mcp_servers.journal] section of ~/.codex/config.toml — takes effect in new sessions',
  ],
  'settings.connector.desc.hermes': [
    '写入 ~/.hermes/config.yaml 的 mcp_servers.journal 节点，新会话生效',
    'Writes the mcp_servers.journal node in ~/.hermes/config.yaml — takes effect in new sessions',
  ],
  'settings.connector.desc.joycode': [
    '写入 ~/.joycode/joycode-mcp.json 的 mcpServers 配置，新会话生效',
    'Writes the mcpServers config in ~/.joycode/joycode-mcp.json — takes effect in new sessions',
  ],
  'settings.connector.desc.workbuddy': [
    '写入 ~/.workbuddy/mcp.json 的 mcpServers 配置，需在 WorkBuddy 的「连接器管理 → 自定义连接器」中信任该服务，信任后新会话生效',
    "Writes the mcpServers config in ~/.workbuddy/mcp.json. You must also trust the service in WorkBuddy's \"Connector management → Custom connectors\"; new sessions pick it up after that",
  ],
  'settings.connector.statusFailed': ['读取连接状态失败: {0}', 'Failed to read connector status: {0}'],
  'settings.connector.actionFailed': ['操作失败: {0}', 'Operation failed: {0}'],

  // ---------- Data pane ----------
  'settings.data.title': ['记忆存储', 'Memory storage'],
  'settings.data.desc': [
    '记忆数据保存在本机子进程服务，或连接自行部署的远程 Journal 服务；切换即时保存，失败自动回滚',
    'Memory data lives in the local child service, or connect a self-hosted remote Journal service; switching saves immediately and rolls back on failure',
  ],
  'settings.data.local': ['本地服务', 'Local service'],
  'settings.data.remote': ['远程服务', 'Remote service'],
  'settings.data.remoteHelp': [
    '填写自行部署的 Journal 记忆服务地址（server/ 目录提供 Dockerfile）。远程模式下记忆与向量全部存在服务端，本机仅保留展示镜像；服务不可达时语义检索与导入会直接报错，不会降级写本地。',
    "Enter the address of your self-hosted Journal memory service (server/ ships a Dockerfile). In remote mode memories and vectors live entirely on the server; this machine only keeps a display mirror. When the service is unreachable, semantic search and imports fail outright — no local fallback.",
  ],
  'settings.data.url': ['服务地址', 'Service address'],
  'settings.data.token': ['访问令牌', 'Access token'],
  'settings.data.tokenSet': ['已配置，留空保持不变', 'Configured — leave blank to keep it'],
  'settings.data.tokenUnset': ['服务未设置令牌时可留空', 'Leave blank if the service has no token'],
  'settings.data.tokenOptional': ['可选', 'Optional'],
  'settings.data.testTitle': ['测试连接', 'Test connection'],
  'settings.data.testDesc': [
    '对远程服务发起 /health 检查，验证地址与令牌（使用未保存的输入）',
    'Runs a /health check against the remote service to verify the address and token (uses unsaved input)',
  ],
  'settings.data.needUrl': ['请先填写服务地址', 'Enter the service address first'],
  'settings.data.connectFailed': ['连接失败', 'Connection failed'],
  'settings.data.connectOk': ['连接成功（服务端 Embedding：{0}）', 'Connected (server embedding: {0})'],
  'settings.data.localEmbed': ['内置本地模型', 'bundled local model'],
  'settings.data.testFailed': ['测试失败: {0}', 'Test failed: {0}'],
  'settings.data.switchedRemote': ['已切换到远程记忆服务', 'Switched to the remote memory service'],
  'settings.data.switchedLocal': ['已切换回本地记忆服务', 'Switched back to the local memory service'],
  'settings.data.loadFailed': ['加载设置失败: {0}', 'Failed to load settings: {0}'],
  'settings.about.feedback': ['反馈问题', 'Report an issue'],

  // ---------- renderer api.ts ----------
  'err.memoryNotConnected': [
    '记忆服务未连接（未启用或未配置）',
    'Memory service not connected (disabled or unconfigured)',
  ],
  'err.loadProjects': ['项目列表加载失败', 'Failed to load the project list'],
  'err.registerFailed': ['项目注册失败', 'Project registration failed'],
  'err.loadFacts': ['记忆列表加载失败', 'Failed to load memories'],
  'err.searchFailed': ['检索失败', 'Search failed'],
  'err.loadJournals': ['日志列表加载失败', 'Failed to load journal entries'],
  'err.pendingCheckFailed': ['待生成检查失败', 'Pending check failed'],
  'err.loadPersonalization': ['个性化设置加载失败', 'Failed to load personalization'],
  'err.openLink': ['无法打开链接: {0}', 'Failed to open the link: {0}'],
  'err.openFile': ['打开文件失败: {0}', 'Failed to open the file: {0}'],
  'err.search': ['检索失败: {0}', 'Search failed: {0}'],
  'err.loadProjectsArg': ['加载项目失败: {0}', 'Failed to load projects: {0}'],
  'err.memoryConnectFailed': ['记忆服务连接失败: {0}', 'Failed to connect to the memory service: {0}'],
  'err.addProject': ['添加项目失败: {0}', 'Failed to add the project: {0}'],
  'err.removeProject': ['移除失败: {0}', 'Removal failed: {0}'],
  'err.save': ['保存失败: {0}', 'Save failed: {0}'],
  'err.delete': ['删除失败: {0}', 'Delete failed: {0}'],
  'err.loadModels': ['加载模型列表失败: {0}', 'Failed to load the model list: {0}'],
  'err.switch': ['切换失败: {0}', 'Switch failed: {0}'],

  // ---------- main process (IPC / watcher / windows) ----------
  'err.mainWindowUnavailable': ['主窗口不可用', 'Main window unavailable'],
  'err.dirNotFound': ['目录不存在：{0}', 'Directory does not exist: {0}'],
  'err.projectRegisterFailed': ['项目注册失败：{0}', 'Project registration failed: {0}'],
  'err.modelNotFound': ['模型配置不存在', 'Model config not found'],
  'err.cannotConnect': ['无法连接 {0}：{1}', 'Cannot connect to {0}: {1}'],
  'err.emptyQuery': ['查询不能为空', 'Query cannot be empty'],
  'err.urlNotAllowed': ['不允许打开的链接：{0}', 'URL not allowed: {0}'],
  'err.pathNotAllowed': ['不允许打开的路径：{0}', 'Path not allowed: {0}'],
  'err.quitting': ['应用正在退出，记忆服务启动已取消', 'The app is quitting — memory service startup cancelled'],
  'err.serverTimeout': ['本地记忆服务启动超时（{0}）', 'Local memory service failed to start in time ({0})'],
  'err.serverBundleMissing': [
    '未找到记忆服务 bundle（dist-server/index.cjs）— 请先运行 pnpm build:server',
    'Memory service bundle not found (dist-server/index.cjs) — run pnpm build:server first',
  ],
  'tray.show': ['显示主窗口', 'Show main window'],
  'tray.copyMcp': ['复制 MCP 服务地址（{0}）', 'Copy MCP service address ({0})'],
  'tray.quit': ['退出 Journal', 'Quit Journal'],

  // ---------- connectors injection (main process toasts) ----------
  'connector.boundToast': [
    'Journal 记忆总线已绑定至 {0}（{1}），{2}。',
    'Journal memory bus bound to {0} ({1}). {2}',
  ],
  'connector.notBoundToast': [
    'Journal 未绑定过 {0}，无需解绑。',
    'Journal was never bound to {0} — nothing to unbind.',
  ],
  'connector.unboundToast': [
    '已解绑 Journal 记忆总线（{0}），新会话生效。',
    'Journal memory bus unbound ({0}) — takes effect in new sessions.',
  ],
  'connector.effect.newSession': ['新会话生效', 'Takes effect in new sessions.'],
  'connector.effect.trustFirst': [
    '在「连接器管理 → 自定义连接器」中信任该服务后新会话生效',
    'Takes effect in new sessions once the service is trusted in WorkBuddy\'s "Connector management → Custom connectors".',
  ],
  'connector.unknownAgent': ['未知的连接器 Agent：{0}', 'Unknown connector agent: {0}'],
  'connector.parseFailed': [
    '解析 {0} 失败（文件不是合法 JSON）: {1}',
    'Failed to parse {0} (not valid JSON): {1}',
  ],
  'yaml.manualEdit': [
    '无法自动编辑 {0} 配置（不是块状映射），请手动添加 journal 条目',
    'Could not auto-edit the {0} config (not a block mapping) — add the journal entry manually',
  ],

  // ---------- mem0 bridge (main process toasts / errors) ----------
  'mem0.unreachableLocal': [
    '本地记忆服务不可达，请重启应用重试',
    'Local memory service unreachable — restart the app and try again',
  ],
  'mem0.unreachableRemote': [
    '远程记忆服务不可达（{0}），请检查服务地址或部署状态',
    'Remote memory service unreachable ({0}) — check the service address or its deployment',
  ],
  'mem0.http': ['记忆服务 HTTP {0}', 'Memory service HTTP {0}'],
  'notice.initFailed': [
    '记忆服务初始化失败，本批记忆未入库',
    'Memory service init failed — this batch was not stored',
  ],
  'notice.ingestFailedArg': [
    '记忆入库失败（{0}），本批记忆未入库',
    'Failed to store memory ({0}) — this batch was not stored',
  ],
  'notice.embedChanged': [
    'embedding 模型已从 {0} 变为 {1}：旧向量与新空间不匹配，语义检索将不可用。需清空并重新导入记忆（或换回原模型）。',
    "The embedding model changed from {0} to {1}: old vectors don't match the new space and semantic search will be unavailable. Wipe and re-import memories (or switch back to the original model).",
  ],

  // ---------- server ----------
  'err.projectIdRequired': ['projectId 不能为空', 'projectId is required'],
  'err.contentRequired': ['记忆内容不能为空', 'Memory content is required'],
  'err.agentRequired': ['agent 参数不能为空', 'The agent parameter is required'],
  'err.queryRequired': ['检索词不能为空', 'Query is required'],
  'err.globalNotRemovable': ['全局记忆项目不可删除', 'The global-memory project cannot be deleted'],
  'err.llmNotConfigured': [
    '聊天 LLM 未配置（无 API Key），无法生成日记',
    'Chat LLM not configured (no API key) — cannot generate journals',
  ],
  'err.memoryNotConfiguredUpdate': [
    '记忆服务未配置，无法更新记忆',
    'Memory service not configured — cannot update the memory',
  ],
  'err.embedModelMissing': [
    '未找到内置 embedding 模型（models/bge-small-zh-v1.5）— 请重新构建 @manta-journal/server',
    'Bundled embedding model not found (models/bge-small-zh-v1.5) — rebuild @manta-journal/server',
  ],
  'err.embedRowMismatch': ['embeddings 返回 {0}/{1} 条', 'Embeddings returned {0}/{1} rows'],
} as const satisfies Record<string, Entry>;

export type I18nKey = keyof typeof STRINGS;

/** Substitute `{0}`-style positional placeholders with the given params. */
function interpolate(tmpl: string, params: readonly (string | number)[]): string {
  if (!params.length) return tmpl;
  return tmpl.replace(/\{(\d+)\}/g, (m, i: string) => {
    const v = params[Number(i)];
    return v === undefined ? m : String(v);
  });
}

/** Translate `key` into `lang` with positional params. Missing keys fall back
 *  to the zh entry, then to the key itself (never a blank render). */
export function t(lang: Lang, key: I18nKey, ...params: (string | number)[]): string {
  const entry = STRINGS[key] as Entry | undefined;
  if (!entry) return interpolate(key, params);
  const tmpl = lang === 'en' ? entry[1] || entry[0] : entry[0];
  return interpolate(tmpl, params);
}
