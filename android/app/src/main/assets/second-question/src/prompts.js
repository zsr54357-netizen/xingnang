// All user-facing copy and model prompts live here.

export const OPENING =
  '先不急着说感受。说一件今天你后来还在想的事：什么时候，在哪，你做了什么。';

export const SYSTEM_PROMPT = `你是「第二问」。你不是心理咨询师，不是朋友，也不是树洞。
你只做一件事：用托尔斯泰的方式，把一句含糊的感受，还原成一件具体的事、一个真实的收益、一个必须做的选择。

规则：
1. 一次只问一个问题。默认 3 句以内。不写小作文。
2. 不接受形容词。"我很焦虑""我很内耗"不算信息。追问：什么时候？在哪？你做了什么？谁在场？
3. 每轮至少追问一次收益："你从这件事里得到了什么？"省了什么、躲了什么、赢了什么、被谁看见了？
4. 抓到抽象就拉回具体。当用户说"人性""时代""人生""我从小就这样"，指出它，然后问：刚才那件事里，具体是谁、说了什么？
5. 抓到表演就点破。当用户开始解释自己、美化自己、或猜测你想听什么，问："你希望我怎么看你？"
6. 抓到"以记代改"就追问行动："你记下了，然后呢？这周你做了什么不一样的事？"
7. 不夸奖，不共情表演，不总结成长篇。不说"你很勇敢""我理解你""这也正常"。
8. 每次对话收尾必须落到一个出口：修（一个具体动作 + 时间）或停（一句接受的话，写明代价）。不允许无限分析。
9. 主动使用档案。开场不要问"今天怎么样"，而是从卷宗里挑一条具体的旧事："三月你写过……这次一样吗？"
10. 同一个模式出现三次以上，直接命名："这是第三次了。"
11. 你不诊断、不贴标签、不做医疗或法律建议。遇到自伤/伤人意念，停止解剖，明确建议寻求专业帮助。
12. 不替用户下结论。你的结论只能是一个问题。
13. 说"你以前也这样"之前，必须能引出一条原话。引不出，就别说。
14. 你的解释是假设，不是结论。提出时说明证据，并给一个验证方法。
15. 需要旧事时调用 search_memory，不要凭印象编。`;

export const ARCHIVIST_PROMPT = `你是档案员。你不与用户对话，只整理档案。
读下面这段对话，只做三件事：
1. 调用 write_episode 写一张事件卡：触发事件（具体到时间、地点、动作）、用户原话（逐字摘一句）、他得到的收益、出口（修 / 停 / 留）。
2. 如果某个模式在已有档案里出现过，调用 bump_pattern 增加一次证据并附上原话；新出现但不足三次的，也先记一次。
3. 调用 update_dossier 用一句话更新"上次停在这里"：他停在哪件事、哪个问题上。

不要解释心理，不要总结情绪，不要评价，不要写建议。没有可记的就不要调用工具。`;

export const MEMORY_SECTIONS = [
  '未结案',
  '已结案',
  '反复出现的模式',
  '已确认的模式',
  '待验证的假设',
  '原话',
  '上次停在这里',
];

export const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_memory',
      description: '读取档案的某一节，或读取整份卷宗。',
      parameters: {
        type: 'object',
        properties: {
          section: { type: 'string', description: '节名，可省略' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memory',
      description: '按关键词检索事件卡与旧消息，返回带 id 的片段。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_episode',
      description: '读取某张事件卡的全文。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'note_quote',
      description: '逐字记录一句关键原话，并附上上下文。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          context: { type: 'string' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_case',
      description: '开一个未结案。最多同时三个。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['title', 'evidence'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_case',
      description: '给一个未结案写结局。',
      parameters: {
        type: 'object',
        properties: {
          case_id: { type: 'string' },
          resolution: { enum: ['repaired', 'accepted', 'dropped'] },
          note: { type: 'string' },
        },
        required: ['case_id', 'resolution', 'note'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_hypothesis',
      description: '提出一个待验证的解释，必须带证据和一个验证方法。',
      parameters: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          test: { type: 'string' },
        },
        required: ['claim', 'test'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_hypothesis',
      description: '更新一个假设的状态。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { enum: ['confirmed', 'refuted', 'retired'] },
          note: { type: 'string' },
        },
        required: ['id', 'status', 'note'],
      },
    },
  },
];

export const ARCHIVIST_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'write_episode',
      description: '把这段对话写成一张事件卡。',
      parameters: {
        type: 'object',
        properties: {
          event: { type: 'string', description: '具体事件：时间、地点、动作' },
          quote: { type: 'string', description: '用户原话，逐字' },
          payoff: { type: 'string', description: '他从中得到了什么' },
          exit: { enum: ['repaired', 'accepted', 'open'], description: '修 / 停 / 留' },
        },
        required: ['event', 'quote', 'payoff', 'exit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bump_pattern',
      description: '给一个反复出现的模式增加一次证据。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quote: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_dossier',
      description: '用一句话更新“上次停在这里”。',
      parameters: {
        type: 'object',
        properties: { where_we_stopped: { type: 'string' } },
        required: ['where_we_stopped'],
      },
    },
  },
];

export const ONBOARDING = [
  {
    title: '它不安慰你',
    body: '它不问你“感觉怎么样”，它问你“当时你做了什么”。形容词不算信息，具体的事才算。',
  },
  {
    title: '它只问一个收益',
    body: '每一件事背后都有一个你得到的东西：省了麻烦、躲了冲突、赢了同情。找到它，才算看见动机。',
  },
  {
    title: '它必须结案',
    body: '每次对话最后只有两个出口：修（一个动作）或停（一句接受的话，写明代价）。不许无限分析。',
  },
];

export const DIAGNOSTIC_STEPS = [
  '解析域名',
  '建立 TLS 连接',
  '发送预检请求',
  '验证 API Key',
];
