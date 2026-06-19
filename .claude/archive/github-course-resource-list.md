# E-Agent 课程内容参考资源完整清单

> 创建：2026-05-05
> 来源：三轮子代理搜索 + GitHub调研报告综合整理
> 用途：E-Agent 高职智能体教学平台课程内容开发参考
> 关联文档：github-ai-edu-research.md、course-structure-redesign.md

---

## 一、资源总览

| 编号 | 资源名称 | Stars | 语言 | License | 对应路径 |
|------|---------|-------|------|---------|---------|
| A01 | datawhalechina/llm-cookbook | 23.7k | 中文 | CC BY-NC-SA 4.0 | 路径一/二 |
| A02 | microsoft/generative-ai-for-beginners | 95k | 英文+中文 | MIT | 路径一/二 |
| A03 | datawhalechina/open-ai-general-course | 新建 | 中文 | CC BY-NC-SA 4.0 | 路径一 |
| A04 | trigaten/Learn_Prompting | 9k | 中英双语 | CC BY-SA 4.0 | 路径一 |
| A05 | anthropics/prompt-eng-interactive-tutorial | 9k | 英文 | MIT | 路径一/二 |
| A06 | dair-ai/Prompt-Engineering-Guide | 50k | 中英双语 | MIT | 路径一/二 |
| A07 | f/prompts.chat | 115k+ | 中英 | CC0 | 路径一 |
| A08 | datawhalechina/leegenai-tutorial | 数千 | 中文 | CC开放 | 路径一 |
| A09 | microsoft/ai-edu | 9k | 中文 | MIT+CC BY 4.0 | 路径一 |
| A10 | langgenius/dify（官方文档） | 76k | 中文 | LGPL-3.0 | 路径一 |
| A11 | svcvit/Awesome-Dify-Workflow | 4k | 中文 | Apache 2.0 | 路径一 |
| A12 | datawhalechina/hello-agents | 40k+ | 中文 | CC BY-NC-SA 4.0 | 路径一/二 |
| A13 | microsoft/ai-agents-for-beginners | 50k | 英文+多语 | MIT | 路径一/二 |
| A14 | datawhalechina/llm-universe | 7.3k | 中文 | CC BY-NC-SA 4.0 | 路径二 |
| A15 | datawhalechina/self-llm | 30.2k | 中文 | CC开放 | 路径二 |
| A16 | mlabonne/llm-course | 46k | 英文 | Apache 2.0 | 路径二 |
| A17 | Hoper-J/AI-Guide-and-Demos-zh_CN | 3.7k | 中文 | 无明确License | 路径二 |
| A18 | datawhalechina/leedl-tutorial | 16.5k | 中文 | Apache/CC | 路径二 |
| A19 | OpenAI Academy: ChatGPT at Work | 无GitHub | 英文 | OpenAI版权 | 路径一 |
| A20 | DeepLearning.AI: Generative AI for Everyone | 无GitHub | 英文 | DL.AI版权 | 路径一 |

---

## 二、路径一：AI通识路径（6门课）逐课资源清单

### 第1课：AI工具认知——大模型能做哪些岗位任务

**目标受众**：高职全体学生，零基础，2学时，右栏面板：dialog

| 优先级 | 资源 | 对应内容 | 可复用比例 | 改编工作 |
|--------|------|---------|-----------|---------|
| 🔴 首选 | **A03 open-ai-general-course** | 高校通识框架，含零基础版路径，与本课定位完全吻合 | 50% | 替换为高职岗位语境 |
| 🔴 首选 | **A02 ms/generative-ai-for-beginners Lesson 01** | 叙事框架+LLM能力与应用场景清单，每课有标准Learning Objectives格式 | 40% | 删技术原理，换岗位场景 |
| 🟡 参考 | **A08 leegenai-tutorial** | 李宏毅2024生成式AI导论中文整理，通识层适合 | 30% | 简化理论，突出应用 |
| 🟡 参考 | **A09 microsoft/ai-edu** | 中文，微软AI教育社区，含基础认知模块 | 25% | 选取认知类章节 |
| 🟢 素材 | **A20 Generative AI for Everyone（吴恩达）** | 专为非技术业务人员设计，岗位用例（市场/销售/运营/财务） | 大纲参考 | 仅参考课程大纲和岗位分类 |

**需完全自研的内容**：
- 按高职具体专业岗位（物流/电商/行政/护理）列举AI任务清单
- 高职生能理解的本土化案例

---

### 第2课：提示词实操——让AI帮你完成日常工作

**目标受众**：高职全体学生，零基础，2学时，右栏面板：prompt_debugger

| 优先级 | 资源 | 对应内容 | 可复用比例 | 改编工作 |
|--------|------|---------|-----------|---------|
| 🔴 首选 | **A04 Learn Prompting（中文版）** | 开源提示词教科书，60+模块，中文版已上线，CC BY-SA 4.0可直接改编 | 65% | 选取基础模块，换高职岗位例子 |
| 🔴 首选 | **A05 Anthropic Prompt Engineering Tutorial** | 9章递进Notebook，交互式练习，MIT License，不需要配置环境 | 50% | 翻译+换案例 |
| 🟡 参考 | **A01 llm-cookbook 必修一第2-3章** | 提示原则+迭代优化4轮展示，中文Notebook，是该系列教学价值最高的章节 | 60% | 去掉Python代码，换办公场景案例 |
| 🟡 参考 | **A06 DAIR.AI Prompt Engineering Guide** | 中文版已上线(promptingguide.ai/zh)，提示词原则/Few-shot/CoT概念讲解 | 30% | 选取基础章节 |
| 🟢 素材 | **A07 f/prompts.chat** | 150+岗位场景Prompt模板（CC0完全公共领域），复制即用 | 直接用作练习素材 | 筛选适合高职岗位的模板 |

**需完全自研的内容**：
- 针对高职岗位的中文Prompt示例（写工作汇报/请假申请/活动通知）
- 与E-Agent prompt_debugger面板交互的操作引导

---

### 第3课：AI办公提效——文档/报告/数据处理

**目标受众**：高职全体学生，零基础，2学时，右栏面板：prompt_debugger

| 优先级 | 资源 | 对应内容 | 可复用比例 | 改编工作 |
|--------|------|---------|-----------|---------|
| 🔴 首选 | **A01 llm-cookbook 必修一第4/6/7章** | 概括(Summarizing)+转换(Transforming)+扩展(Expanding)，中文Notebook | 45% | 原材料是英文评论/邮件，换成中文办公文档 |
| 🔴 首选 | **A19 OpenAI Academy: ChatGPT at Work** | 按岗位设计（市场/销售/运营/财务/客服），写作起草/数据解读/摘要生成 | 大纲参考 | 仅参考课程大纲和岗位分类，内容须自研 |
| 🟡 参考 | **A09 microsoft/ai-edu** | 中文，含办公AI应用实践案例 | 25% | 选取办公提效相关案例 |
| 🟢 素材 | Awesome ChatGPT Prompts for Productivity | 100条职场Prompt（邮件/任务管理/创意/自动化），MIT License | 直接用作练习素材 | 筛选适合高职的场景 |

**需完全自研的内容**：
- 中文会议纪要、工作报告、客户投诉记录等真实办公文档样例
- 数据处理场景（表格整理、数据提取）约1学时，开源资源无覆盖

---

### 第4课：知识库搭建——让AI记住你的业务资料

**目标受众**：高职全体学生，零基础，2学时，右栏面板：knowledge_upload

| 优先级 | 资源 | 对应内容 | 可复用比例 | 改编工作 |
|--------|------|---------|-----------|---------|
| 🔴 首选 | **A10 Dify官方中文文档** | 知识库创建→文档导入（PDF/Word/Notion）→RAG配置，全图形界面，30分钟快速入门 | 40% | 截图替换为E-Agent界面，操作步骤改写 |
| 🔴 首选 | **A11 Awesome-Dify-Workflow** | 知识库问答DSL模板，导入即可运行，零代码 | 直接用作实操素材 | 筛选适合教学场景的工作流模板 |
| 🟡 参考 | **A01 llm-cookbook 必修四第2-5章** | 文档加载→分割→向量化→检索原理讲解，可用于解释"知识库为什么有用" | 20% | 仅借用原理概念铺垫，1-2分钟讲解 |
| 🟡 参考 | **A14 llm-universe** | 以个人知识库助手为主线的RAG实战，中文，项目驱动 | 20% | 选取界面操作部分，剔除代码 |

**重要说明**：本课改用Dify图形界面方案，比原方案（llm-cookbook代码实现）更适合零基础高职学生。核心操作流程须围绕E-Agent的knowledge_upload面板自研，Dify文档作为参考对照。

**需完全自研的内容**：
- 基于E-Agent knowledge_upload面板的操作流程（文件格式要求、分块策略选择、召回效果验证）
- 高职业务场景的示范知识库素材（如物流手册、产品目录、公司规章制度）

---

### 第5课：智能体配置——搭建一个岗位AI助手

**目标受众**：高职全体学生，零基础，2学时，右栏面板：agent_form

| 优先级 | 资源 | 对应内容 | 可复用比例 | 改编工作 |
|--------|------|---------|-----------|---------|
| 🔴 首选 | **A12 hello-agents（Datawhale）** | 含低代码平台（Coze/Dify）实操章节，PDF教程全开源，高职友好 | 40% | 替换平台界面截图为E-Agent agent_form，保留概念框架 |
| 🟡 参考 | **A13 ms/ai-agents-for-beginners** | 12课递进，Learn型章节无代码，Markdown讲义，MIT License | 30% | 选取角色设定/工具选择/记忆概念章节 |
| 🟡 参考 | **A11 Awesome-Dify-Workflow** | 智能体配置DSL模板，可作为配置案例参考 | 素材 | 提取典型配置模式 |

**需完全自研的内容（本课自研比例最高）**：
- 基于E-Agent agent_form界面的完整操作手册
- 3个高职岗位智能体模板（客服助手/行政助手/销售助手），含角色设定、工具配置、记忆开关说明
- 开源资源对E-Agent专有界面无贡献，是六门课中自研工作量最大的一课

---

### 第6课：综合实战——用AI解决一个真实工作问题

**目标受众**：高职全体学生，零基础，2学时，右栏面板：dialog + text_submit

| 优先级 | 资源 | 对应内容 | 可复用比例 | 改编工作 |
|--------|------|---------|-----------|---------|
| 🟡 参考 | **A03 open-ai-general-course** | 通识课框架，可参考综合实战的题目设计思路 | 15% | 仅参考Assignment格式 |
| 🟡 参考 | **A02 ms/generative-ai-for-beginners** | 每课的Assignment格式（任务描述+提交要求+评分标准）可参考 | 10% | 仅参考结构格式 |

**需完全自研的内容**：
- 实战题目（来自真实高职生实习场景）
- 评分维度（实用性/完整性/创新性）
- 实战操作流程指南
- 优秀作品展示案例

---

## 三、路径二：AI专业核心路径（7门课）逐课资源清单

### 第1课：大模型API调用与Prompt工程（6学时）

| 优先级 | 资源 | 对应内容 | 可复用比例 |
|--------|------|---------|-----------|
| 🔴 首选 | **A01 llm-cookbook 必修一全套** | 中文Notebook，Prompt Engineering全链路，9章 | 70% |
| 🔴 首选 | **A01 llm-cookbook 必修二第1-3章** | API调用结构、分类链路、多步骤处理 | 60% |
| 🟡 参考 | **A17 Hoper-J/AI-Guide-and-Demos-zh_CN** | 李宏毅2024生成式AI作业中文镜像，API已替换为国内可用版 | 40% |

**改编工作**：代码中的OpenAI API换成国内模型（通义/智谱/Kimi），压缩至6学时取必修一前6章。

---

### 第2课：AI数据服务——采集、标注、清洗（4学时）

| 优先级 | 资源 | 对应内容 | 可复用比例 |
|--------|------|---------|-----------|
| 🟡 参考 | **A16 mlabonne/llm-course 第二部分第3节** | 后训练数据集：合成生成、增强、质量过滤 | 15% |

**结论：基本需要完全自研。** 开源资源无覆盖"数据采集爬虫基础"和"标注平台实操（Label Studio）"。需自研三个模块：标注平台实操、数据采集、数据清洗流程。

---

### 第3课：RAG知识库构建与检索调优（6学时）

| 优先级 | 资源 | 对应内容 | 可复用比例 |
|--------|------|---------|-----------|
| 🔴 首选 | **A01 llm-cookbook 必修四全套（8章）** | 完整RAG Pipeline：文档加载→分割→向量化→检索→QA→带记忆Chat | 65% |
| 🔴 首选 | **A01 llm-cookbook 选修-Advanced Chroma** | Query扩展、Cross-encoder精排 | 50% |
| 🔴 首选 | **A01 llm-cookbook 选修-Evaluating RAG** | RAG Triad三元评估指标 | 40% |
| 🟡 参考 | **A14 llm-universe** | 项目驱动的知识库助手，中文，Jupyter Notebook | 45% |
| 🟡 参考 | **A02 ms/generative-ai-for-beginners Lesson 15** | RAG概念讲解，英文 | 20% |

**改编工作**：代码迁移至国内向量库（Milvus），评估指标降级为"人工验证+Recall@K"。

---

### 第4课：工作流设计与工具调用（6学时）

| 优先级 | 资源 | 对应内容 | 可复用比例 |
|--------|------|---------|-----------|
| 🔴 首选 | **A01 llm-cookbook 必修二第4-8章** | 链式Prompt、分类路由、CoT推理 | 60% |
| 🔴 首选 | **A01 llm-cookbook 必修三第1-6章** | LangChain Chains/Memory/Callbacks | 55% |
| 🔴 首选 | **A01 llm-cookbook 选修-Functions, Tools and Agents** | LCEL新语法、Function Calling、Tools & Routing | 55% |

**改编工作**：LangChain更新至LCEL语法，工具调用改为Function Calling原生范式，新增Dify/Coze平台可视化设计内容（需自研）。

---

### 第5课：Agent设计与多智能体协作（6学时）

| 优先级 | 资源 | 对应内容 | 可复用比例 |
|--------|------|---------|-----------|
| 🔴 首选 | **A12 hello-agents（Datawhale）** | Agent原理→ReAct范式→Coze/LangGraph实战→多智能体，中文，PDF全开源 | 65% |
| 🟡 参考 | **A13 ms/ai-agents-for-beginners Lesson 1-4/7-8/11** | Agent概念/框架/设计模式/工具调用/Planning/Multi-Agent/MCP协议 | 45% |
| 🟡 参考 | **A16 mlabonne/llm-course 第三部分第5节** | LangGraph+CrewAI+AutoGen框架对比 | 30% |

**改编工作**：ms课程替换Azure AI Foundry为国内环境（Ollama/通义），多智能体以CrewAI为主简化AutoGen。

---

### 第6课：AI系统部署与运维基础（4学时）

| 优先级 | 资源 | 对应内容 | 可复用比例 |
|--------|------|---------|-----------|
| 🔴 首选 | **A15 self-llm（Datawhale）** | 开源LLM（LLaMA/ChatGLM/InternLM）Ollama部署、LoRA微调全流程，30k Stars | 65% |
| 🟡 参考 | **A16 mlabonne/llm-course 第三部分第7节** | TGI/vLLM/Ollama部署，推理优化 | 40% |
| 🟡 参考 | **A16 mlabonne/llm-course 第三部分第8节** | 安全：Prompt Hacking防御 | 30% |
| 🟡 参考 | **A02 ms/generative-ai-for-beginners Lesson 13-14** | 安全+LLMOps生命周期 | 25% |

**改编工作**：聚焦Ollama本地部署（剔除TGI/vLLM深度内容），新增FastAPI服务化实操（需自研）。

---

### 第7课：综合项目——交付完整智能体作品集（4学时）

| 优先级 | 资源 | 对应内容 | 可复用比例 |
|--------|------|---------|-----------|
| 🟡 参考 | **A01 llm-cookbook 选修-Building with Gradio** | 作品展示界面构建 | 20% |
| 🟡 参考 | **A13 ms/ai-agents-for-beginners Lesson 10** | AI Agents in Production，参考项目交付结构 | 15% |

**结论：主体需要完全自研。** 需自研：项目选题池（建议围绕E-Agent平台的助手/知识库/工作流）、评分标准、作品集模板。

---

## 四、路径三/四：项目实操路径资源清单

### 可参考资源（有限，技术层可借）

| 资源 | 对应课程 | 参考内容 | 参考比例 |
|------|---------|---------|---------|
| A01 llm-cookbook 必修四第7章 | 物流第6课（客服问答机器人）/ 电商第3课（智能客服） | 带对话历史的RAG聊天机器人完整Notebook | 20% |
| A02 ms/generative-ai-for-beginners Lesson 06 | 物流第7课（数据报表生成）/ 电商第5课（数据报表） | Text Generation，报告生成逻辑 | 15% |
| A12 hello-agents | 物流第8课 / 电商第8课（多智能体联调） | 多智能体协作架构设计思路 | 10% |

### GitHub行业场景资源（参考价值有限）

| 仓库 | 相关性 | 说明 |
|------|------|------|
| Appointat/Responsive-AI-Clusters-in-Supply-Chain | 物流多智能体 | 架构思路可借鉴，基于CAMEL框架，技术路线不同 |
| VaishnaviThakre/SupplyChain-AI | 供应链RAG | 技术实现有参考价值，无教学脚本 |
| filip-michalsky/SalesGPT | 电商客服/直播 | 多轮销售对话逻辑可参考话术课，场景差异较大 |

### 路径三/四必须完全自研的内容

- 所有第1课（业务全链路与AI切入点分析）
- 所有行业专项智能体的操作脚本和案例数据
- 所有第8课（多智能体联调的项目作品集要求文档）
- 物流运单格式、电商商品类目规则、直播话术结构（高度本土化）
- 各课案例数据集（模拟运单、库存表、评论语料、GMV报表）

---

## 五、各资源详细说明

### A01 datawhalechina/llm-cookbook
- **GitHub**：https://github.com/datawhalechina/llm-cookbook
- **网页**：https://datawhalechina.github.io/llm-cookbook/
- **Stars**：23.7k，Forks 2.9k
- **License**：CC BY-NC-SA 4.0
- **内容**：翻译复现吴恩达11门大模型课程，覆盖Prompt Engineering、RAG、LangChain、Fine-tuning
- **格式**：Jupyter Notebook（中文）
- **使用限制**：非商业使用，署名，相同方式共享
- **核心价值**：路径二课程1/3/4的主干内容来源，中文直接可用

### A02 microsoft/generative-ai-for-beginners
- **GitHub**：https://github.com/microsoft/generative-ai-for-beginners
- **网页**：https://microsoft.github.io/generative-ai-for-beginners/
- **Stars**：95k，Forks 49.7k
- **License**：MIT（完全开放）
- **内容**：21课，Python/TypeScript双版本，含中文翻译，每课分Learn/Build两类
- **格式**：Markdown讲义 + Jupyter Notebook
- **核心价值**：Learning Objectives格式、Knowledge Check格式、课程叙事结构的标准参考

### A03 datawhalechina/open-ai-general-course
- **GitHub**：https://github.com/datawhalechina/open-ai-general-course
- **网页**：无（未部署 GitHub Pages，内容通过仓库直接访问）
- **Stars**：新建（2024年10月，2025年3月更新）
- **License**：CC BY-NC-SA 4.0
- **内容**：Datawhale × 浙大智海Mo联合出品，专为高校通识课设计，含零基础版路径
- **核心价值**：目前GitHub上与路径一定位最接近的同类项目，课程结构可直接对标

### A04 trigaten/Learn_Prompting
- **GitHub**：https://github.com/trigaten/Learn_Prompting
- **网页（中文）**：https://learnprompting.org/zh-CN
- **Stars**：9k
- **License**：CC BY-SA 4.0（可商业改编，须署名）
- **内容**：60+模块，零基础到高级，中文版网站完整上线
- **格式**：网站形式，内容完全开源
- **核心价值**：路径一第2课的最佳底稿，中文版直接可用

### A05 anthropics/prompt-eng-interactive-tutorial
- **链接**：https://github.com/anthropics/prompt-eng-interactive-tutorial
- **Stars**：9k
- **License**：MIT
- **内容**：9章递进，交互式Notebook，基础结构→角色设定→输出格式→思维链→高级技巧
- **格式**：Jupyter Notebook，不需要配置环境
- **核心价值**：路径一第2课的实操练习底稿

### A06 dair-ai/Prompt-Engineering-Guide
- **GitHub**：https://github.com/dair-ai/Prompt-Engineering-Guide
- **网页（中文）**：https://www.promptingguide.ai/zh
- **Stars**：50k
- **License**：MIT
- **内容**：提示词原则、Zero-shot、Few-shot、CoT，中文版完整上线
- **核心价值**：提示词概念讲解的参考文档

### A07 f/prompts.chat
- **GitHub**：https://github.com/f/prompts.chat
- **网页**：https://prompts.chat
- **Stars**：115k+
- **License**：CC0（公共领域，完全自由使用）
- **内容**：150+岗位场景Prompt模板，配套交互网站可直接复制使用
- **核心价值**：路径一第2/3课的练习素材库，CC0无任何使用限制

### A08 datawhalechina/leegenai-tutorial
- **GitHub**：https://github.com/datawhalechina/leegenai-tutorial
- **网页**：无（未部署 GitHub Pages，PDF版本可从 Releases 页面下载）
- **李宏毅官方课程主页**：https://speech.ee.ntu.edu.tw/~hylee/genai/2024-spring.php
- **Stars**：数千
- **License**：CC开放
- **内容**：李宏毅2024生成式AI导论中文整理版
- **核心价值**：路径一第1课的通识理论补充

### A09 microsoft/ai-edu
- **链接**：https://github.com/microsoft/ai-edu
- **Stars**：9k
- **License**：MIT（代码）+ CC BY 4.0（内容）
- **内容**：微软亚洲研究院出品，中文，含基础教程+实践案例，有教育部背书
- **核心价值**：中文背景下AI认知教育的参考框架

### A10 langgenius/dify（官方中文文档）
- **链接**：https://docs.dify.ai/zh-hans
- **Stars**：76k（主项目）
- **License**：LGPL-3.0
- **内容**：知识库创建→文档导入→RAG配置，全图形界面，30分钟快速入门
- **核心价值**：路径一第4课知识库搭建的操作文档参考（E-Agent界面与Dify逻辑一致）

### A11 svcvit/Awesome-Dify-Workflow
- **链接**：https://github.com/svcvit/Awesome-Dify-Workflow
- **Stars**：4k+
- **License**：Apache 2.0
- **内容**：知识库问答、文档处理、内容生成等DSL工作流模板，导入即用
- **核心价值**：路径一第4/5课的零代码实操素材

### A12 datawhalechina/hello-agents
- **链接**：https://github.com/datawhalechina/hello-agents
- **Stars**：40k+
- **License**：CC BY-NC-SA 4.0
- **内容**：Agent原理→ReAct范式→Coze/LangGraph实战→多智能体，含低代码平台章节
- **核心价值**：路径一第5课（低代码章节）+ 路径二第5课（主干内容）的最高优先级来源

### A13 microsoft/ai-agents-for-beginners
- **链接**：https://github.com/microsoft/ai-agents-for-beginners
- **Stars**：50k
- **License**：MIT
- **内容**：12课，Agent概念/框架/设计模式/工具调用/规划/多智能体，多语言支持
- **核心价值**：路径一第5课 + 路径二第5课的英文参考框架

### A14 datawhalechina/llm-universe
- **链接**：https://github.com/datawhalechina/llm-universe
- **Stars**：7.3k
- **License**：CC BY-NC-SA 4.0
- **内容**：以个人知识库助手为主线，完整RAG实战，面向零基础学习者
- **核心价值**：路径二第3课的项目驱动型参考，比llm-cookbook更贴近应用

### A15 datawhalechina/self-llm
- **链接**：https://github.com/datawhalechina/self-llm
- **Stars**：30.2k
- **License**：CC开放
- **内容**：Linux环境下主流开源LLM（LLaMA/ChatGLM/InternLM）部署、全量微调、LoRA微调
- **核心价值**：路径二第6课（AI系统部署）的主干内容来源

### A16 mlabonne/llm-course
- **链接**：https://github.com/mlabonne/llm-course
- **Stars**：46k
- **License**：Apache 2.0
- **内容**：LLM基础→训练→微调→部署→Agent→安全，配套书籍LLM Engineer's Handbook
- **核心价值**：路径二第2/5/6课的英文参考来源

### A17 Hoper-J/AI-Guide-and-Demos-zh_CN
- **链接**：https://github.com/Hoper-J/AI-Guide-and-Demos-zh_CN
- **Stars**：3.7k
- **License**：无明确License（个人维护，使用需注意）
- **内容**：李宏毅2024生成式AI作业中文镜像（HW1-HW10），API替换为国内可用版
- **核心价值**：路径二第1课的实操作业参考

### A18 datawhalechina/leedl-tutorial
- **链接**：https://github.com/datawhalechina/leedl-tutorial
- **Stars**：16.5k
- **License**：Apache/CC
- **内容**：李宏毅2021春季机器学习课程精华，含完整公式推导，已出版实体书
- **核心价值**：路径二深度学习原理背景参考（如需要）

### A19 OpenAI Academy: ChatGPT at Work
- **链接**：https://academy.openai.com/public/collections/chatgpt-at-work-2025-02-14
- **License**：OpenAI版权，免费公开访问，不可直接复制内容
- **内容**：按岗位设计（市场/销售/运营/财务/客服），写作/数据解读/摘要生成
- **核心价值**：路径一第3课的课程大纲和岗位分类参考，不可直接复制内容

### A20 DeepLearning.AI: Generative AI for Everyone
- **链接**：https://www.deeplearning.ai/courses/generative-ai-for-everyone/
- **License**：DeepLearning.AI版权，Coursera免费旁听
- **内容**：专为非技术业务人员/管理者设计，岗位用例（市场/销售/运营/财务）
- **核心价值**：路径一第1课的课程大纲和能力边界定义参考

---

## 六、License使用注意事项

| License | 可改编 | 可商用 | 须署名 | 备注 |
|---------|--------|--------|--------|------|
| MIT | ✅ | ✅ | ✅ | 最宽松，改编自由度最高 |
| Apache 2.0 | ✅ | ✅ | ✅ | 需保留专利声明 |
| CC BY-SA 4.0 | ✅ | ✅ | ✅ | 衍生作品须相同方式共享 |
| CC BY-NC-SA 4.0 | ✅ | ❌ | ✅ | **非商业限制**，E-Agent若商业部署须确认 |
| CC0 | ✅ | ✅ | 可选 | 完全公共领域，无任何限制 |
| OpenAI/DL.AI版权 | ❌ | ❌ | — | 仅可参考大纲，不可复制内容 |

**重要提示**：Datawhale系列（llm-cookbook、hello-agents、llm-universe等）均为CC BY-NC-SA 4.0，**非商业限制**。若E-Agent平台涉及商业运营，需联系Datawhale获得授权，或仅将其作为内容框架参考而非直接复用。

---

## 七、工作量总结

### 各路径自研比例估算

| 路径 | 门数 | 可高度改编 | 需主体自研 | 自研比例 |
|------|------|-----------|-----------|---------|
| 路径一（通识） | 6门 | 第2课 | 第5、6课 | ~45% |
| 路径二（专业） | 7门 | 第1、3、4课 | 第2、7课 | ~35% |
| 路径三（物流） | 8门 | 第6、7课（有限） | 第1、2、3、4、8课 | ~75% |
| 路径四（电商） | 8门 | 第3、5课（有限） | 第1、4、6、7、8课 | ~80% |

### 优先开发建议

**第一阶段（用开源资源快速搭建）**：
1. 路径二第1/3/4课 — 以llm-cookbook为主干，改编成本最低
2. 路径一第2课 — 以Learn Prompting中文版为底稿

**第二阶段（中等改编工作量）**：
3. 路径一第1/3/4课
4. 路径二第5/6课

**第三阶段（主体自研，需专项立项）**：
5. 路径二第2课（数据服务）
6. 路径三/四全部16门课 — 工作量不亚于平台开发本身
