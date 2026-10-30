# hkustgz-cli 初版设计

状态：已有本地来源/课程/专业目录、AI培养要求和SISN课表/成绩快照解析，以及Canvas DDL。个人浏览器会话管理及SISN/KLMS直接HTTP未实现，Canvas令牌路径未线上验证。详见docs/STATUS.md与docs/ACADEMICS.md；图书馆、缴费和ClassViva当前跳过。

## 目标

1. 从 KLMS、SISN 查询个人课程相关数据；具体字段和各系统职责以实际页面为准。
   Canvas用于课程、进度、作业/测验DDL及任务链接等实际支持的教学能力；ClassViva按用户后续要求跳过。各平台独立核实认证、接口和课程标识，不把KLMS视为全部LMS。
2. 根据自然语言问题查找校园办事入口、指南、表格和文件，返回可核查来源。
3. CLI 提供结构化数据，配套 Agent Skill 负责理解问题、选择命令和组织回答。

## 首批命令

- `hkustgz auth login/status`：用户在浏览器登录，验证对应系统的会话。
- `hkustgz service search <关键词>`：查询服务名称、别名、说明与入口。
- `hkustgz service show <id>`：查看办理步骤、负责部门、来源与验证日期。
- `hkustgz document search <关键词>`：检索文件标题和已提取正文，返回原文件链接及出处。
- `hkustgz course list --source sisn|klms`：各系统独立返回课程，确认标识对应关系后再做合并。

service/document search/show 已实现；auth status 仅报告适配能力，auth login 未实现。course list 支持 `--source sisn --snapshot <private-file.json> [--day 1..7]` 解析Browser读取的课表快照，无快照仍返回NOT_IMPLEMENTED。快照并非实时HTTP查询，也不证明学期内每次实际开课。

Canvas支持 `lms deadlines --source canvas --course <id>`，可用--snapshot解析Browser白名单化GET接口样本，或使用本机已有授权令牌查询。真实样本流程已验证，Node令牌HTTP路径仅离线测试通过，完整浏览器登录管理未实现；详见docs/CANVAS.md。

## 数据与回答

服务记录：id、title、aliases、description、department、entryUrl、sourceUrl、steps、loginRequired、verifiedAt。
文件记录：id、title、sourceUrl、downloadUrl、所属部门、发布日期（如来源提供）、fetchedAt、正文及页码或章节定位。
个人课程数据与服务/文件索引分开保存。没有核实的入口不写入索引；检索无结果时明确说明，不猜网址。

初版采用本地关键词与中英文别名检索。收集真实问法后，再决定是否需要语义检索；暂不引入向量数据库和独立模型后端。

## 接入顺序

1. 登录 Portal，只读检查应用目录、搜索、服务详情及文件入口。
2. 以“补办校园卡”为首条验收问题，记录真实服务名称、路径、步骤和来源。
3. 检查 KLMS、SISN 的实际地址、登录跳转及只读数据接口；不预设它们共享 Cookie 或认证机制。
4. 实现已确认的客户端、统一 JSON 输出和来源字段，添加脱敏离线契约测试。

## 验收

- “补办校园卡去哪里？”能给出已核实入口与来源；未核实则明确回答未找到。
- 文件检索能返回原始文件链接及匹配依据；标题匹配和正文匹配分别标明。
- 课程查询明确数据来源；不将模拟测试成功表述为真实接入成功。
- 登录失效返回结构化错误；不把账号密码或会话令牌写进日志、索引或 Git。

## 当前状态

本页保留模块设计；安装及Browser日常刷新以README和docs/DAILY.md为准，最新验证与缺口见docs/STATUS.md。未实现项不能由设计文档推断为已实现。
