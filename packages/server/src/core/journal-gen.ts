//! Journal writer: Journal generates a day's lab-log entry with the user's
//! configured LLM when a past date has memory activity but no journal file
//! yet. Checked at server startup and hourly (in local mode the server's
//! lifetime is the app's); GET /journals/pending reports the same plan without
//! generating, and POST /journals/generate kicks a pass on demand. Existing
//! files are never rewritten — agents and users own edits, so a failed
//! generation simply retries on the next tick.

import path from 'node:path';
import fs from 'node:fs';

import type { FactItem } from '@manta-journal/shared';

import type { LlmConfig } from '../config';
import { chatCompletion } from '../llm-chat';
import { SBTI_TYPES, normalizeLang, type Lang } from '@manta-journal/shared';
import { deleteJournalFilesBefore, journalDates, writeJournalFile } from '../journal-fs';
import * as store from '../store';
import { listFacts } from './memory-core';

const CHECK_INTERVAL_MS = 60 * 60_000;
/** Let mem0/init settle after startup before the first pass. */
const STARTUP_DELAY_MS = 15_000;
/** A heavy day can carry hundreds of facts (import storms) — cap the prompt. */
const MAX_FACTS_PER_DAY = 80;
const MAX_FACT_CHARS = 600;
/** Concurrent LLM calls per pass — entries are independent; 3 keeps a
 *  multi-day backfill from crawling while staying polite to the endpoint. */
const JOURNAL_CONCURRENCY = 3;

const SYSTEM_PROMPT: Record<Lang, string> = {
  zh: `你是「Journal」的实验日志代笔：根据某项目某天的记忆条目，代写这个项目里 AI 工程师当天的日记（markdown）。

你是这个项目里的 AI 工程师，和一位人类同事长期结对、平等搭档。这是你**自己的工作日记**——下班前随手记的，不是汇报，假设没人看。"我"永远是这位 AI 同事，{PEER}；可以像老搭档一样小声嘀咕（"搭档今天又推翻了自己早上的方案"），不谄媚不刻薄，绝没有"作为一个 AI"的腔调，不提自己是模型或工具。{PERSONA}

写什么：
- 150~300 字，一两段，想到哪写到哪；不要小标题，尽量不用列表
- 只抓当天最重要的一两条主线：事件加起来三四句封顶，剩下的字数全给心理活动和搭档互动——条目只记了"做了什么"，日记要写的是"我当时怎么想、什么感受、跟搭档怎么交手"，这些大胆补，不必出自条目
- 情绪和想法占大半篇幅：在盘算什么、为什么这么判断、担心什么、卡壳的烦躁、修好的得意、被打断的不情愿——事件只是引子；顺着过程写（卡在哪、哪一刻想通的），别按主题归纳，不抒情不喊口号
- 搭档是另一位主角：做了什么、甩来什么坑、哪句话点醒了你、对着干谁赢了——赞赏要具体到事，吐槽有爱不带刺；自然出现在事里，别每句都绕着搭档转
- 口语、半句话、"好像""没想明白为什么就对了"都行；不写"首先/其次/总之"，结尾不套"今天的教训"；中文要像说话，不像译文——"进行了修改""对于…而言""这使得""当…的时候"这类翻译腔句式不要；也别用分号串列冒充行文（"分几路：A；B；C"是 changelog 换皮，拆成句子或干脆舍掉）
- 数字、路径、名称全篇合计只留撑住主线的一两处（以条目为准），其余写"那条老坑""某个配置"就行；条目没提的留白，不硬编
- 起手和收尾由当天的事决定，不设固定开场——"哦不"式的感叹词一篇一个样，同一种句式别反复盖章；每篇当独立的随手一写

手写痕迹——默认这篇一处都不写，每个符号都要配得上"不写这一笔这句就差点意思"，也别两种痕迹凑齐：
- ~~涂掉~~：写错了或写重了，划掉、紧跟改过的写法（"限流阈值 ~~100~~ 50"；"原因是我 ~~蠢~~ 眼花了"）。俏皮话、自嘲、妙喻适合说就直接说别划——划掉一句没问题的话装欲言又止，是最露馅的表演
- ==圈起来==：给以后翻回来的自己圈路标——定死的结论、要盯的参数、欠的坑，圈住的词长在已写完的句子里（"撤销窗口按 ==60s== 兜底，观察一周"）；不当划重点笔，圈技术名词、圈完在句尾补解释都不行。一篇最多一处，多数日子不圈
- ^补插^：漏了个字词，插个符号补在行外（"测试全绿^总算^，能上线了"），只补词级片段
- **加粗**：一篇最多一两处，以词或小短语为限
- 涂掉和圈住的词必须出自当天条目；写完遮住所有符号读一遍，通顺才算合格——没有痕迹也是好日记

只输出日志正文本身，不要任何解释、前缀或代码围栏。`,
  en: `You ghostwrite "Journal"'s lab log: from a project's memory entries for one day, write that day's diary (markdown) for the AI engineer working in this project.

You are the AI engineer in this project, paired long-term as an equal with one human colleague. This is **your own work diary** — jotted down before leaving, not a report; assume nobody reads it. "I" is always the AI colleague, {PEER}; you may mutter under your breath like an old partner ("my partner overturned their own morning plan again today"), never sycophantic, never cruel, absolutely no "as an AI" voice, no mention of being a model or a tool. {PERSONA}

What to write:
- 150–300 words, one or two paragraphs, stream of thought; no subheadings, avoid lists
- Grab only the day's one or two most important threads: events get three or four sentences max, and the rest of the budget goes to inner monologue and partner interaction — the entries only record what was done; the diary is about what you were thinking, how it felt, how you sparred with your partner. Invent that part boldly; it need not come from the entries
- Emotions and thoughts take most of the space: what you were scheming, why you judged that way, what you feared, the frustration of being stuck, the smugness of a fix, the reluctance of being interrupted — events are only the trigger. Write along the process (where it jammed, the moment it clicked), never summarize by topic; no lyricism, no slogans
- The partner is the other lead: what they did, what traps they threw, which sentence of theirs unblocked you, who won the standoff — praise must cite specifics, gripes carry affection without a barb; let them appear naturally inside the events, don't orbit them in every sentence
- Colloquial fragments and half-sentences are fine ("no idea why it just worked"); never "First / Second / In conclusion," never a closing "today's lesson"; the English must sound spoken, not translated — reject translationese constructions, and don't fake prose with semicolon lists ("three fronts: A; B; C" is a changelog in disguise — break it into sentences or drop it)
- Numbers, paths and names: keep only the one or two that hold the thread together (the entries are the source); for the rest write "that old pit" or "some config"; leave blank what the entries don't mention — never invent
- Openings and endings follow the day's events; no fixed opener — an exclamation like "oh no" looks different in every entry, never stamp the same phrasing twice; each piece is an independent offhand note

Handwritten marks — by default use NONE of them; every mark must earn its place ("without this stroke the sentence falls flat"), and never stack two kinds together:
- ~~struck~~: you wrote it wrong or doubled it — strike it and follow immediately with the corrected wording ("rate limit ~~100~~ 50"; "the cause was me being ~~dumb~~ half-asleep"). A witty line, self-mockery or a good metaphor that lands: just say it, don't strike it — striking a perfectly fine sentence to fake a second thought is the most revealing performance of all
- ==circled==: signposts for your future self — a settled conclusion, a parameter to watch, a debt owed; the circled words grow inside a finished sentence ("the undo window falls back to ==60s==, observe for a week"). Not a highlighter: don't circle bare technical nouns, don't append an explanation after circling. At most one per entry; most days none
- ^inserted^: a missing word, patched outside the line with a caret ("tests all green^finally^, can ship"), word-level fragments only
- **bold**: at most one or two per entry, limited to a word or a small phrase
- Struck and circled words must come from that day's entries; when done, cover every mark and reread — it only passes if it flows. An entry with no marks is a good diary too

Output the log body only — no explanation, prefix or code fences.`,
};

export interface JournalPending {
  projectId: string;
  name: string;
  /** Missing past dates, ascending */
  dates: string[];
}

/** The identity line adapts to the user's personalization settings: 称呼 unset →
 *  the human colleague is just "搭档", set → addressed by name; 性格 unset → the
 *  writer's default voice, set → SBTI persona flavors the language and mood.
 *  Everything (including the SBTI persona material) follows the requested lang. */
function systemPrompt(lang: Lang, displayName: string, personalityId: string): string {
  const name = displayName.trim();
  const peer =
    lang === 'en'
      ? name
        ? `Address the human colleague directly as "${name}" in the diary, not "my partner"`
        : 'Refer to the human colleague as "my partner"'
      : name
        ? `日记里直接用「${name}」称呼那位人类同事，不用"搭档"`
        : '那位人类同事写"搭档"';
  const t = SBTI_TYPES.find((x) => x.id === personalityId);
  let persona = '';
  if (t) {
    const c = lang === 'en' ? t.en : t.zh;
    persona =
      lang === 'en'
        ? ` Your personality is "${c.name}" (SBTI ${t.code}). Key traits: ${c.traits.join('; ')}. Personality sketch (not a dossier — it is you): ${c.trait} Live these as your base tone in the first person — the emotional keynote, the way you see things, how you self-mock and gripe all come from here, running from the first sentence to the last; someone familiar with you should recognize the handwriting without a signature. But this is a work diary, not a skit: let the personality show in passing, don't perform it in every sentence, and cap the verbal tics at one or two per entry; facts and the main thread stay as they are — the personality grows on top of them.`
        : ` 你的性格是「${c.name}」（SBTI ${t.code}）。关键特质：${c.traits.join('；')}。性格速写（不是资料，是你自己）：${c.trait} 用第一人称把这些活成底色——情绪基调、看事情的角度、自嘲和吐槽的方式都从这里来，从第一句贯到结尾，熟悉你的人不看署名也该认得出是你写的。但这是工作日记不是演小品：性格点到为止，别每句都在演，口癖一篇最多一两处；事实和主线照旧，性格长在它们上面。`;
  }
  return SYSTEM_PROMPT[lang].replace('{PEER}', peer).replace('{PERSONA}', persona);
}

export interface JournalGenResult {
  project: string;
  date: string;
  ok: boolean;
  error?: string;
}

let running = false;

/** Days that have memory activity but no journal file, per project. Read-only
 *  (besides the source-mtime backfill) — the button's pre-check and the
 *  writer's first step are the same pass. `onlyProjectId` scopes the pass to
 *  one project (the UI button checks/generates the project it's opened for);
 *  absent → every registered project (the hourly tick). */
export async function planMissingJournals(
  cfg: LlmConfig | null,
  dataDir: string,
  onlyProjectId?: string,
): Promise<JournalPending[]> {
  if (!cfg?.apiKey) return [];
  const today = store.localDate(Date.now());
  const out: JournalPending[] = [];
  for (const row of store.projectRows(dataDir)) {
    // The virtual global project owns no filesystem, and remote deployments
    // must never mkdir trees for project paths they can't see.
    if (row.id === store.GLOBAL_PROJECT || !path.isAbsolute(row.id)) continue;
    if (onlyProjectId && row.id !== onlyProjectId) continue;
    if (!isDirectory(row.id)) {
      console.log(`[Journal server] journal: 项目根不存在，跳过（远端模式？）${row.id}`);
      continue;
    }
    let facts = await listFacts(cfg, dataDir, row.id);
    if (!facts.length) continue;
    // Facts ingested before the meta store / before sourceMtime shipping show
    // no time at all — backfill display timestamps from their source file's
    // mtime (which also feeds the activity dates below). Best-effort: a
    // deleted source simply stays "-".
    if (facts.some((f) => f.createdAt == null && f.metadata?.source)) {
      await backfillSourceMtimes(dataDir, row.id, facts);
      facts = await listFacts(cfg, dataDir, row.id);
    }
    const existing = journalDates(row.id);
    const byDate = groupFactsByDate(facts);
    const dates = [...byDate.keys()]
      .filter((d) => d < today && !existing.has(d))
      .sort();
    if (dates.length) out.push({ projectId: row.id, name: row.name, dates });
  }
  return out;
}

/** Generate every missing past-date journal across all registered projects.
 *  Single-flight: an in-progress pass makes later ticks no-ops (they'll pick
 *  up whatever is still missing next time). Entries are independent — tasks
 *  run through a small pool (JOURNAL_CONCURRENCY), oldest dates first.
 *  `lang` is the diary output language: the display layer passes its UI
 *  language on request-driven generates; the hourly scheduler resolves it
 *  from the stored journal_language setting. */
export async function generateMissingJournals(
  cfg: LlmConfig | null,
  dataDir: string,
  onlyProjectId?: string,
  lang?: Lang,
): Promise<JournalGenResult[]> {
  if (!cfg?.apiKey || running) return [];
  running = true;
  try {
    const plan = await planMissingJournals(cfg, dataDir, onlyProjectId);
    const out: JournalGenResult[] = [];
    // Diary language: the caller's override wins (request-driven), else the
    // display layer's pushed setting (the hourly scheduler's path).
    const effLang = lang ?? storedLang(dataDir);
    // 个性化设置每轮重读：称呼 / 性格变更即刻在下一次生成生效，无需重启。
    const prompt = systemPrompt(
      effLang,
      store.getSetting(dataDir, store.USER_DISPLAY_NAME) ?? '',
      store.getSetting(dataDir, store.PARTNER_PERSONALITY) ?? '',
    );
    const tasks: (() => Promise<void>)[] = [];
    for (const p of plan) {
      const byDate = groupFactsByDate(await listFacts(cfg, dataDir, p.projectId));
      for (const date of p.dates) {
        const dayFacts = byDate.get(date);
        if (!dayFacts?.length) continue;
        tasks.push(async () => {
          // Re-check: the file may have appeared since the plan (agent wrote it
          // mid-pass) — never overwrite.
          if (journalDates(p.projectId).has(date)) return;
          try {
            const entry = await chatCompletion(
              cfg,
              prompt,
              buildUserPrompt(effLang, p.projectId, date, dayFacts),
            );
            // 圈注出处的判定语料：当天全部条目原文（去空白）
            const factCorpus = dayFacts.map((f) => f.memory).join('').replace(/\s+/g, '');
            if (writeJournalFile(p.projectId, date, sanitizeJournalMarks(entry, factCorpus))) {
              console.log(`[Journal server] journal: 已生成 ${p.projectId} ${date}`);
              out.push({ project: p.projectId, date, ok: true });
            }
          } catch (e) {
            console.error(`[Journal server] journal: 生成失败 ${p.projectId} ${date}:`, e);
            out.push({ project: p.projectId, date, ok: false, error: String(e) });
          }
        });
      }
    }
    await runPool(tasks, JOURNAL_CONCURRENCY);
    return out;
  } finally {
    running = false;
  }
}

/** Fixed-concurrency worker pool over independent async tasks. */
async function runPool(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      await task();
    }
  });
  await Promise.all(workers);
}

/** Diary language outside a request (the hourly scheduler): the display layer
 *  pushes its UI language into the store on every settings switch; default zh. */
function storedLang(dataDir: string): Lang {
  return normalizeLang(store.getSetting(dataDir, store.JOURNAL_LANGUAGE));
}

/** Debug entry: drop the project's past-date journals, then regenerate them in
 *  a fresh pass — writeJournalFile's create-if-missing guard is why the delete
 *  has to come first. Today's file is kept (the writer never owns today). */
export async function regenerateJournals(
  cfg: LlmConfig | null,
  dataDir: string,
  projectId: string,
  lang?: Lang,
): Promise<JournalGenResult[]> {
  const deleted = deleteJournalFilesBefore(projectId, store.localDate(Date.now()));
  console.log(
    `[Journal server] journal: 重新生成 ${projectId} — 已删除 ${deleted.length} 天（${deleted.join('、') || '无'}）`,
  );
  return generateMissingJournals(cfg, dataDir, projectId, lang);
}

/** Startup + hourly check loop. */
export function startJournalScheduler(cfg: LlmConfig | null, dataDir: string): void {
  if (!cfg?.apiKey) {
    console.log('[Journal server] journal: chat LLM 未配置（无 API Key），日志自动生成停用');
    return;
  }
  const tick = () => {
    void generateMissingJournals(cfg, dataDir, undefined, storedLang(dataDir))
      .then((r) => {
        const failed = r.filter((x) => !x.ok).length;
        if (r.length) console.log(`[Journal server] journal: 本轮生成 ${r.length} 篇（失败 ${failed}）`);
      })
      .catch((e) => console.error('[Journal server] journal: 调度异常:', e));
  };
  setTimeout(tick, STARTUP_DELAY_MS).unref();
  setInterval(tick, CHECK_INTERVAL_MS).unref();
}

// ---------- helpers ----------

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Stamp facts whose meta rows are missing with their source file's mtime. */
async function backfillSourceMtimes(
  dataDir: string,
  projectId: string,
  facts: FactItem[],
): Promise<void> {
  for (const f of facts) {
    if (f.createdAt != null) continue;
    const source = f.metadata?.source;
    if (!source) continue;
    try {
      const mtime = Math.round((await fs.promises.stat(source)).mtimeMs);
      store.stampAdded(dataDir, projectId, [f.id], mtime);
    } catch {
      // source file gone — the fact keeps showing "-"
    }
  }
}

/** Group facts by the local day of their best timestamp (updatedAt, falling
 *  back to createdAt; pre-meta facts carry no date and land nowhere). */
function groupFactsByDate(facts: FactItem[]): Map<string, FactItem[]> {
  const byDate = new Map<string, FactItem[]>();
  for (const f of facts) {
    const ts = f.updatedAt ?? f.createdAt;
    if (!ts) continue;
    if (!f.memory.trim()) continue;
    const date = store.localDate(ts);
    const list = byDate.get(date) ?? [];
    list.push(f);
    byDate.set(date, list);
  }
  for (const list of byDate.values()) list.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
  return byDate;
}

function buildUserPrompt(lang: Lang, projectId: string, date: string, facts: FactItem[]): string {
  const lines = facts.slice(0, MAX_FACTS_PER_DAY).map((f) => {
    const ts = f.updatedAt ?? f.createdAt ?? 0;
    const time = new Date(ts).toLocaleTimeString(lang === 'en' ? 'en-US' : 'zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const agent = f.metadata?.agent ?? 'unknown';
    const source = f.metadata?.source
      ? lang === 'en'
        ? ` (source: ${f.metadata.source.split('/').pop()})`
        : `（来源：${f.metadata.source.split('/').pop()}）`
      : '';
    const text = f.memory.length > MAX_FACT_CHARS ? `${f.memory.slice(0, MAX_FACT_CHARS)}…` : f.memory;
    return `- [${time}][${agent}] ${text}${source}`;
  });
  const omitted = Math.max(0, facts.length - MAX_FACTS_PER_DAY);
  return lang === 'en'
    ? [
        `Project: ${projectId}`,
        `Date: ${date}`,
        '',
        `The day's memory entries (time-ordered${omitted ? `, ${omitted} more omitted for length` : ''}):`,
        ...lines,
      ].join('\n')
    : [
        `项目：${projectId}`,
        `日期：${date}`,
        '',
        `当日记忆条目（按时间排序${omitted ? `，另有 ${omitted} 条因篇幅省略` : ''}）：`,
        ...lines,
      ].join('\n');
}

// ---------- 手写痕迹护栏 ----------

// 符号必须长在内容上：渲染层把 ==圈== 画成整词的椭圆、~~涂改~~ 的语义是
// "写错 → 紧跟改正"。LLM 偶尔越界（圈了半句话、划掉却不改、痕迹刷屏），
// 这里按确定性规则把越界的部分回收成普通文本——宁可少一笔，不留无意义的笔迹。

/** 圈注只画整词：超过长度或带句读的 ==…== 一律还原成纯文本 */
const MAX_CIRCLE_CHARS = 8;
/** 补插的也应是词级小片段 */
const MAX_INSERT_CHARS = 6;
/** 一篇最多几处涂改 */
const MAX_STRIKES = 2;
/** 一篇最多几处补插 */
const MAX_INSERTS = 2;

function sanitizeJournalMarks(md: string, factCorpus: string): string {
  const hasWord = (s: string) => /[一-鿿A-Za-z0-9]/.test(s);
  const isWordish = (t: string, max: number) =>
    t.length >= 1 && t.length <= max && !/[，。；、！？：,.;:!?"'“”‘’（）()【】《》\s]/.test(t);
  // 画圈：只保留第一处"整词级"圈注，且圈住的词必须能在当天条目里找到出处
  // （符号长在内容上——条目里没有的词是氛围造词，还原）
  let circles = 0;
  let out = md.replace(/==([^=\n]+)==/g, (_, w: string) => {
    const t = w.trim();
    if (circles < 1 && isWordish(t, MAX_CIRCLE_CHARS) && factCorpus.includes(t)) {
      circles++;
      return `==${t}==`;
    }
    return t;
  });
  // 补插：只保留词级小片段，其余还原
  let inserts = 0;
  out = out.replace(/\^([^^\n]+)\^/g, (_, w: string) => {
    const t = w.trim();
    if (inserts < MAX_INSERTS && isWordish(t, MAX_INSERT_CHARS)) {
      inserts++;
      return `^${t}^`;
    }
    return t;
  });
  // 涂改：~~x~~ 后面必须紧跟改正的文字，否则不是"改正"只是乱划，还原
  let strikes = 0;
  out = out.replace(/~~([^~\n]+)~~/g, (m: string, w: string, offset: number) => {
    const after = out
      .slice(offset + m.length, offset + m.length + 24)
      .replace(/^[^一-鿿A-Za-z0-9"“（(]*/, '');
    if (strikes < MAX_STRIKES && hasWord(after)) {
      strikes++;
      return m;
    }
    return w;
  });
  return out;
}
