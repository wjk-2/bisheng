# GitHub AI 教学平台调研报告

> 创建：2026-04-30
> 背景：为 E-Agent 高职智能体教学平台开发提供参考，结合 course-structure-redesign.md 中的课程体系设计进行对照分析

---

## 一、平台类项目

### 1. LearnHouse
- **链接**：https://github.com/learnhouse/learnhouse
- **Stars**：2k+
- **技术栈**：Next.js + FastAPI + PostgreSQL + Redis
- **核心功能**：课程管理、积木式编辑器、AI 互动练习场、代码自动评分（30+ 语言）、作业/讨论/证书、学习分析

#### 页面布局（三栏）
```
┌──────────────┬──────────────────────────┬──────────────────┐
│  左侧导航     │      主内容区（左栏）      │  右侧 Activity 面板│
│              │                          │                  │
│  章节列表     │  块内容（文字/图/代码）    │  测验题 / 视频    │
│  ✓完成标记   │                          │  / 作业 / 代码执行│
│  → 当前课    │                          │                  │
│              │  [上一课] [下一课]        │  [标记为完成]     │
└──────────────┴──────────────────────────┴──────────────────┘
```

#### Activity 类型（右侧面板）
| 类型标识 | 学生操作 |
|---------|---------|
| `type_video` | 播放/暂停/进度/全屏 |
| `type_pdf` | 翻页阅读（iframe 内嵌） |
| `type_classicquiz` | 选择→提交→查看评分反馈 |
| `type_assignment` | 上传文件/填文本→等批改 |
| `type_dynamic_code` | 写代码→运行→看输出/错误 |

#### 学生操作流程
阅读左中区内容 → 完成右侧 Activity → 点击"Mark as Complete" → 自动跳转下一 Lesson → 左侧导航更新进度

#### 内容编辑器块类型（BlockNote 扩展）
Paragraph / Heading1-3 / BulletList / NumberedList / Image / Video / Code / Quote / Divider / Callout / Embed（iframe）/ MathEquation / File / Activity（嵌入 Activity 引用）

#### AI 功能现状
- 有教师侧 AI 课程生成器（调用 OpenAI API 自动生成大纲和内容）
- **无学生侧 AI 对话 Activity**（截至 2025-01）
- Activity 类型系统是插件化设计，可扩展 `type_ai_chat`，但官方未内置

#### 与 E-Agent 的对比
LearnHouse 右栏是"内容消费+答题提交"的传统 LMS 模式，与 E-Agent 的 `dialog / prompt_debugger / agent_form` 等面板是完全不同的设计思路。E-Agent 的右栏让学生直接操作真实 AI 系统，LearnHouse 没有这个能力。

---

### 2. Frappe LMS
- **链接**：https://github.com/frappe/lms
- **Stars**：2.8k
- **技术栈**：Python（Frappe 框架）+ Vue.js
- **核心功能**：三级课程管理（课程/章节/课时）、学员分班/批次管理、Zoom 直播课、结业证书生成
- **参考价值**：轻量现代，代码结构清晰，适合参考批次管理和进度跟踪 API 设计

---

### 3. Open edX
- **链接**：https://github.com/openedx/openedx-platform
- **Stars**：8.1k
- **技术栈**：Django + React 前端微服务
- **核心功能**：课程管理、视频、测验、证书、xAPI/SCORM、LTI 集成
- **AI 扩展**：已有 [openedx-ai-extensions](https://github.com/openedx/openedx-ai-extensions) 插件
- **参考价值**：功能最完整，但 Django 重型架构与 E-Agent 的 FastAPI DDD 不匹配；主要参考功能边界定义和模块设计思路，不参考架构

---

### 4. Canvas LMS
- **链接**：https://github.com/instructure/canvas-lms
- **Stars**：6.5k
- **技术栈**：Ruby on Rails + React
- **核心功能**：课程、作业、讨论、评分、REST/GraphQL API
- **参考价值**：企业级 API 设计最成熟，REST/GraphQL 完整，便于集成 AI 模块

---

### 5. ClassroomIO
- **链接**：https://github.com/classroomio/classroomio
- **Stars**：1.5k
- **技术栈**：SvelteKit + Supabase + TailwindCSS
- **核心功能**：课程管理、作业批改、证书、多教师协作

---

## 二、AI 课程内容资源

### 英文系

#### microsoft/generative-ai-for-beginners
- **链接**：https://github.com/microsoft/generative-ai-for-beginners
- **Stars**：71k+
- **版本**：Version 3，21课
- **技术栈**：Python + TypeScript 双语，Azure OpenAI / GitHub Models / OpenAI API 三选一
- **叙事策略**：整个 21 课共用一个虚构教育科技创业公司作为叙事主线，所有知识点都与"这家公司会如何用这个技术"挂钩

##### 课程整体架构
| 阶段 | 课程 | 类型 |
|------|------|------|
| 基础概念 | Lesson 01-05 | Learn（理论） |
| 应用构建 | Lesson 06-11 | Build（动手） |
| 设计与安全 | Lesson 12-14 | Learn |
| 高级技术 | Lesson 15-21 | Learn + Build |

##### 每课统一结构（严格执行）
```
课程引言
  ↓
Learning Objectives（4条，"After this lesson you will be able to..."）
  ↓
正文内容（多个二级标题，图文并茂）
  ↓
Knowledge Check（固定3道单选题）
  ↓
Challenge（1个开放思考题）
  ↓
Assignment（完整作业任务）
  ↓
Further Reading（扩展链接）
```

##### Knowledge Check 出题模式（固定 3 题）
- 第1题：概念定义（What is X）
- 第2题：场景判断（When/Why to use X）
- 第3题：最佳实践辨析

##### Assignment 三种难度递进
- 初级（Lesson 04）：观察+记录型 — "试验3种技术，记录发现"
- 中级（Lesson 07）：完整应用构建型 — "做一个客服 Bot，支持5类问题，测试10个场景"
- 高级（Lesson 08）：构建+对比实验+Bonus扩展

##### Notebook 三种风格（难度递进）
- **Lesson 04**：填空引导式 — 给 `system_message`/`user_message` 框架，学生填值观察
- **Lesson 07**：骨架补全式 — 给函数骨架，学生实现函数体；有 `assignment.ipynb` + `aoai-solution.ipynb` 两个版本
- **Lesson 08**：完整代码+实验式 — 代码跑通，重点修改 query 对比结果

##### 在线运行方式
每课 README 顶部有统一的 **GitHub Codespaces** 启动 badge，零配置运行，是官方标配。

##### Lesson 01 详细分析（对应通识路径第1课）
- **媒介**：README 文字（主，约3000-4000字）+ 配图 + 短视频（辅）
- **无代码 Notebook**（纯 Learn 课）
- **叙事方式**：故事驱动+知识讲解混合，先建立虚构公司的业务场景，再引入技术概念
- **学习目标写法**（原文）：
  > "After completing this lesson, you will understand: What Generative AI is and how Large Language Models work. How you can leverage large language models for different use cases, with a focus on education scenarios."
- **作业设计**：写一篇300字"梦想AI创业"摘要（Problem / How I would use AI / Impact），并与 Microsoft for Startups 孵化器挂钩——"完成作业就能申请微软孵化器资源"，将学习行为锚定到现实世界
- **无 Knowledge Check**（认知层课程不设测验，从 Lesson 04 起才加）
- **局限性作为叙事出口**：课程末尾讲幻觉等局限，以"这些问题将在后续课程中解决"收尾，制造认知悬念

---

#### microsoft/ML-For-Beginners
- **链接**：https://github.com/microsoft/ML-For-Beginners
- **Stars**：70k+
- **范围**：12周26课，经典 ML，Scikit-learn 为主，Python/R 双语

#### mlabonne/llm-course
- **链接**：https://github.com/mlabonne/llm-course
- **Stars**：46k+
- **配套书籍**：LLM Engineer's Handbook

##### 三部分结构
```
第一部分：LLM Fundamentals（可选）
  1. 机器学习数学基础（线性代数、微积分、概率统计）
  2. Python for ML
  3. 神经网络
  4. NLP 基础

第二部分：The LLM Scientist（LLM 构建）
  1. LLM 架构（Transformer、Tokenization、Attention、采样）
  2. 预训练（数据准备、分布式训练）
  3. 后训练数据集（合成生成、质量过滤）
  4. SFT（LoRA/QLoRA、TRL/Unsloth/Axolotl）
  5. 偏好对齐（DPO、GRPO、PPO）
  6. 评估（自动化基准、人工评估）
  7. 量化（GGUF、GPTQ、AWQ）
  8. 新趋势（模型合并、多模态、测试时计算扩展）

第三部分：The LLM Engineer（LLM 应用）
  1. 运行 LLM（API、本地运行、Prompt Engineering）
  2. 向量存储（文档加载、切分、嵌入模型、向量数据库）
  3. RAG（编排框架、检索器、记忆、评估）
  4. 高级 RAG（查询构建、工具、后处理、DSPy）
  5. Agent（MCP/A2A 协议、LangGraph、CrewAI、AutoGen）
  6. 推理优化（Flash Attention、KV Cache、推测解码）
  7. 部署（TGI/vLLM/Ollama）
  8. 安全（Prompt Hacking、后门攻击、防御措施）
```

#### microsoft/ai-agents-for-beginners
- **链接**：https://github.com/microsoft/ai-agents-for-beginners
- **Stars**：5.2k+
- **范围**：12课，AI Agent，含多语言支持，涵盖 Agent 设计模式

---

### 中文系

#### d2l-ai/d2l-zh（动手学深度学习）
- **链接**：https://github.com/d2l-ai/d2l-zh
- **Stars**：65k+
- **定位**：中文经典深度学习教材，理论+实践，有配套实体书

#### datawhalechina/llm-cookbook
- **链接**：https://github.com/datawhalechina/llm-cookbook
- **Stars**：12k+
- **定位**：基于吴恩达 11 门 LLM 系列课程，翻译复现，针对国内学习者优化
- **前置要求**：基础 Python + LLM API + Jupyter Notebook

##### 课程结构
**必修（按顺序）：**
- 必修一：Prompt Engineering for Developers（9章）
- 必修二：Building Systems with the ChatGPT API（11章）
- 必修三：LangChain for LLM Application Development（8章）
- 必修四：LangChain Chat with Your Data — 完整 RAG 流程（8章）

**选修（按方向自选）：**
- 选修1：Prompt 高级技巧（CoT/Self-Consistency/ReAct/Step-Back）
- 选修2：大模型与语义检索
- 选修3：基于 Chroma 的高级检索
- 选修4：搭建和评估高级 RAG 应用（RAG Triad 三元评估指标）
- 选修5：LangChain Functions, Tools and Agents（LCEL/Function Calling）
- 选修6：微调大语言模型（指令微调/LoRA）
- 选修7：使用 Gradio 搭建生成式 AI 应用
- 选修8：评估和调试生成式 AI（W&B Tracing）

##### 教学实现方式详解（llm-cookbook 必修一）

**Notebook 核心叙事单元（三段式循环，反复出现）：**
```
[Markdown：概念讲解/原则说明]
  ↓
[Code Cell：定义 prompt + 调用 get_completion()]
  ↓
[Output：LLM 直接返回结果]
  ↓
[Markdown：对输出的解读，引出下一个变体]
```

**统一工具函数（每个 Notebook 都重复）：**
```python
def get_completion(prompt, model="gpt-3.5-turbo"):
    messages = [{"role": "user", "content": prompt}]
    response = openai.ChatCompletion.create(
        model=model, messages=messages, temperature=0,
    )
    return response.choices[0].message["content"]
```

**学生操作分布：**
- 80%：直接运行现成代码，观察输出
- 15%：修改 temperature、字数限制等参数
- 5%：自由修改 prompt（仅迭代优化章末尾）

**叙事逻辑：先理论、再实验**（不是先实验再归纳）

**第3章"迭代优化"的特色设计（最有教学价值的一章）：**
用一个椅子产品描述任务，展示四轮迭代：
1. 基础版 → 发现"太长了" → 加字数限制
2. 发现"受众不对" → 改受众描述
3. 发现"格式不对" → 加 HTML 格式要求
明确展示"Prompt 工程是迭代过程而非一次写对"，章末有开放练习。

**第8章 OrderBot（全书唯一真正的交互环节）：**
用 Panel 库在 Notebook 内构建聊天 UI，学生可直接打字与 Bot 对话。

**教学设计的根本局限：**
- 缺乏"检验理解"环节，学生可以完全不动脑只按 Shift+Enter
- 练习极少且无标准答案
- 输出结果已写在 Notebook 里，不需要真正调用 API 就能"学完"
- 定位更接近"可运行的参考文档"而非"结构化课程"

**在线版（Jupyter Book 静态页面）：**
- 左侧目录导航，Code 单元格保留语法高亮但不可运行
- 右上角有"在 Colab 中打开"按钮
- 阅读体验像文档而非教材，没有检查站和进度指示

##### Prompt 工程相关章节索引
| 课程 | 关键章节 |
|------|---------|
| 必修一 | 提示原则、迭代优化、概括/推断/转换/扩展/聊天机器人 |
| 必修二 | 思维链推理(CoT)、链式Prompt(Chaining) |
| 选修1 | CoT+Self-Consistency、ReAct、Step-Back、Skeleton-of-Thought、PAL |

##### RAG 知识库相关章节索引
| 课程 | 关键章节 |
|------|---------|
| 必修四 | 文档加载→分割→向量化→检索→QA→带记忆Chat 完整流程 |
| 选修2 | 关键词检索 vs 语义检索、Rerank 重排 |
| 选修3 | Query扩展、Cross-encoder精排、Embedding适配器 |
| 选修4 | 高级RAG Pipeline、句子滑窗/自动合并检索、RAG Triad评估指标 |

##### 工作流/Chain/Agent 相关章节索引
| 课程 | 关键章节 |
|------|---------|
| 必修二 | Prompt Chaining 多步骤流水线设计 |
| 必修三 | Chains（LLMChain/Sequential/Router）、Agent+Tool |
| 选修5 | LCEL 新语法、OpenAI Function Calling、Tools & Routing、Conversational Agent |

---

#### microsoft/ai-edu
- **链接**：https://github.com/microsoft/ai-edu
- **Stars**：13k+
- **出品**：微软亚洲研究院（MSRA）

##### 三模块结构
```
A - 基础教程（理论课程，含代码示例）
  A1 - Python 与基础知识
  A2 - 神经网络基本原理（9步学习法，有配套实体书，高等教育出版社）
  A3 - 经典机器学习算法
  A4 - 高级神经网络
  A5 - 现代软件工程
  A6 - 人工智能系统（独立子仓库，面向研究生/高年级本科生）

B - 实践案例（三级难度）
  初级：认知 AI、使用 API（C#，Azure 认知服务）
  中级：动手开发模型（Python，主流深度学习框架）
  高级：前沿研究级

C - 实践项目（学生创新项目，按年份归档）
```

##### 三模块对应关系（与 E-Agent 三条路径类比）
| ai-edu 模块 | E-Agent 路径 |
|------------|------------|
| A 基础教程（理论+代码） | 路径二 AI专业核心路径 |
| B 实践案例（初/中/高三级） | 路径三/四 项目实操路径 |
| C 实践项目（学生创新项目） | 路径三/四 综合实战课 |

---

#### datawhalechina/llm-action
- **链接**：https://github.com/liguodongiot/llm-action
- **Stars**：14.4k
- **范围**：LLM 训练→微调→部署，LoRA/P-Tuning/分布式训练工程化全流程

#### tangyudi/Ai-Learn
- **链接**：https://github.com/tangyudi/Ai-Learn
- **Stars**：8k+
- **范围**：Python→ML→DL→CV→NLP，近200个实战案例

---

## 三、课程内容对照 E-Agent 课程体系

### 路径一：AI 通识路径（6门）

| 课程 | 最佳参考来源 | 具体对应章节 | 改编工作量 |
|------|------------|------------|---------|
| 1. AI工具认知 | generative-ai-for-beginners Lesson 01 | Introduction 叙事框架 + LLM 能力与应用场景清单 | 中（需换岗位语境） |
| 2. 提示词实操 | llm-cookbook 必修一 第2-7章 | 提示原则+迭代优化+6类实用任务，全套中文 Notebook | 低（直接改编） |
| 3. AI办公提效 | llm-cookbook 必修一 第4-6章 | Summarizing/Transforming/Expanding 三章 | 低 |
| 4. 知识库搭建 | llm-cookbook 必修四 第2-5章 | 文档加载→分割→向量化→检索完整流程 | 低（技术内容降难度） |
| 5. 智能体配置 | generative-ai-for-beginners Lesson 07 | Building Chat Applications — 系统消息设计+多轮对话管理 | 中 |
| 6. 综合实战 | llm-cookbook 必修二 第8章 | 端到端问答系统，改编为通识实战模板 | 中 |

**结论**：通识路径内容与 llm-cookbook 必修一、二高度重叠，全部有中文 Notebook，可直接作为 EduUnit.content 底稿。

---

### 路径二：AI 专业核心路径（7门）

| 课程 | 最佳参考来源 | 具体对应章节 |
|------|------------|------------|
| 1. 大模型API调用与Prompt工程 | llm-cookbook 必修一+选修1 | 必修一全套+CoT/ReAct/Step-Back进阶 |
| 2. AI数据服务：采集、标注、清洗 | llm-course 第二部分第3节 | 后训练数据集：合成生成、增强、质量过滤 |
| 3. RAG知识库构建与检索调优 | llm-cookbook 必修四+选修2/3/4 | 完整RAG流程+Query扩展+Cross-encoder精排+句子滑窗，四个层次 |
| 4. 工作流设计与工具调用 | llm-cookbook 必修三第4章+选修5 | Chains（Sequential/Router）+LCEL+Function Calling+Tools & Routing |
| 5. Agent设计与多智能体协作 | llm-course 第三部分第5节 | MCP/A2A协议+LangGraph+CrewAI+AutoGen框架对比 |
| 6. AI系统部署与运维基础 | llm-course 第三部分第7节 | TGI/vLLM/Ollama部署+推理优化（Flash Attention/KV Cache）|
| 7. 综合项目 | llm-cookbook 必修二第8章+llm-course 第三部分第8节 | 端到端系统+LLM安全防护 |

**重点说明**：
- 课程3（RAG知识库）内容最丰富，llm-cookbook 有4个层次，按难度直接拆分为单元内容
- 路径二整体工程深度过高，需按"会用工具"而非"懂原理"的高职逻辑降难度重写

---

### 路径三/四：项目实操路径（物流+电商各8门）

| 右栏面板类型 | 参考来源 | 具体章节 |
|------------|---------|---------|
| `iframe（智能体编辑器）` | llm-course Agent 第5节 | LangGraph工作流+CrewAI角色Agent |
| `iframe（知识库+智能体）` | llm-cookbook 必修四第7章 | 带对话历史的RAG聊天机器人（完整Notebook）|
| `iframe（工作流编辑器）` | llm-cookbook 必修三第4章 | RouterChain+SequentialChain工作流设计 |
| 数据报表生成类 | generative-ai-for-beginners Lesson 06 | Text Generation+调参，改编为报告生成 |

**需完全自研（无现成参考）：**
- 业务场景分析课（第1课）— 物流/电商全链路与AI切入点
- 行业专项智能体的操作脚本和案例数据
- 多智能体系统联调课（第8课）的项目作品集要求文档

---

## 四、E-Agent 平台的核心差异化

所有参考项目都没有做到的一点：

**右栏面板让学生在课程页内直接操作真实 AI 系统**（不是 Notebook，不是模拟，而是平台内置的对话框/提示词调试器/智能体配置器）。

| E-Agent 右栏面板 | 参考项目最接近的实现 | 差距 |
|----------------|------------------|------|
| `dialog` — 直接对话大模型 | llm-cookbook OrderBot（Panel库在Notebook内） | E-Agent 更原生，无需切换环境 |
| `prompt_debugger` — 调试提示词 | generative-ai-for-beginners 的 playground 链接 | E-Agent 嵌入课程内，无需跳转 |
| `knowledge_upload` — 上传资料建知识库 | llm-cookbook 必修四（教步骤，无实操界面） | E-Agent 是真实操作，不是演示代码 |
| `agent_form` — 配置并部署智能体 | 无对应 | 完全自研方向 |

---

## 五、教学实现核心模式总结

### 最值得借鉴的设计

**来自 generative-ai-for-beginners：**
1. **虚构场景贯穿全课的叙事锚点** — 不抽象讲知识，而是通过持续演进的业务场景组织知识
2. **Learning Objectives 4条标准写法** — "After this lesson you will be able to: 动词+能力..."
3. **Knowledge Check 固定3题模式** — 概念定义/场景判断/最佳实践辨析
4. **Assignment 三种递进难度** — 观察记录→应用构建→构建+对比+Bonus
5. **认知层课程不设 Knowledge Check** — 从能力操作课起才加测验（对应 E-Agent 通识路径第2课开始加）
6. **局限性作为叙事出口** — 点出问题→引发悬念→驱动进入下一课

**来自 llm-cookbook：**
7. **三段式循环叙事单元** — 概念Markdown → 代码示例 → 输出展示 → 解读 → 下一变体
8. **迭代优化的展示方式** — 同一任务四轮迭代，直观展示"Prompt 工程是迭代过程"

---

## 六、E-Agent 左栏内容设计

### 现状（2026-04-30）
文件：`CourseLearningPage.tsx` 第145-209行
```tsx
<div className="prose prose-sm max-w-none text-[#565772]">
  <ReactMarkdown>{activeUnit.content}</ReactMarkdown>
</div>
```
`activeUnit.content` 是纯字符串，直接传入 ReactMarkdown，无块类型判断。

### 方案 A（第一期，最小改动）— Markdown 增强渲染

在现有 ReactMarkdown 上加自定义 components：

```tsx
<ReactMarkdown
  components={{
    h2: ({ children }) => <SectionTitle>{children}</SectionTitle>,
    blockquote: ({ children }) => <Callout>{children}</Callout>,
    code: ({ className, children }) =>
      className === 'language-quiz'
        ? <QuizBlock raw={children} />
        : <CodeBlock>{children}</CodeBlock>,
  }}
>
  {activeUnit.content}
</ReactMarkdown>
```

三个核心组件：
- `<Callout>`：高亮提示/重点框（对应 `>` 引用块）
- `<QuizBlock>`：内嵌选择题（对应 ` ```quiz ` 代码块，JSON格式定义题目）
- `<ActionTip>`：操作引导提示条（引导学生看右栏）

**改动范围**：`CourseLearningPage.tsx` 的 ReactMarkdown components 配置 + 2-3个小组件。L2级，不动数据库。

### 方案 B（第二期）— 结构化 JSON 内容字段

将 `EduUnit.content` 从字符串改为结构化 JSON：
```json
{
  "sections": [
    { "type": "text", "markdown": "..." },
    { "type": "callout", "level": "info", "text": "..." },
    { "type": "quiz", "question": "...", "options": [...], "answer": 0 },
    { "type": "action_tip", "text": "现在请在右侧面板中..." }
  ]
}
```
需改数据库字段类型、加迁移脚本、改 Schema，L2-L3 级，配合内容管理后台一起做。

### 方案 C（暂不做）— 完整块编辑器（LearnHouse/Notion 风格）

---

### 左栏内容统一结构规范

无论方案 A 或 B，内容本身遵循：

```
【学习目标】— 3条，动词开头（识别/操作/完成）

【导读】— 1段，150字内，引出本课要解决的问题

【正文】
  一、概念讲解（图文）
  二、典型案例或场景描述（高职岗位语境）
  三、操作引导语 ← 最后一节，衔接右栏
      "现在请在右侧[面板名称]中完成以下操作：..."

【知识检验】— 2-3道选择题（认知层课程不设）

【本课小结】— 3-5条要点
```

**"操作引导语"是 E-Agent 特有设计**，其他参考项目都没有——因为它们的操作在 Notebook 里，E-Agent 的操作在右栏里，需要一句话把学生注意力从左栏引到右栏。

---

## 七、右栏面板实现现状（2026-04-30）

文件：`CourseLearningPage.tsx` 第17-42行

```tsx
const PANEL_LABEL: Record<string, string> = {
  dialog: '对话练习',
  prompt_debugger: 'Prompt 调试',
  knowledge_upload: '知识库上传',
  agent_form: '智能体配置',
  knowledge_bind: '知识库绑定',
  text_submit: '提交作品',
};
```

| 面板类型 | 实现状态 |
|---------|---------|
| `dialog` | 已实现（DialogPanel.tsx）|
| `text_submit` | 已实现（TextSubmitPanel.tsx）|
| `prompt_debugger` | 仅占位，未实现 |
| `knowledge_upload` | 仅占位，未实现 |
| `agent_form` | 仅占位，未实现 |
| `knowledge_bind` | 仅占位，未实现 |
