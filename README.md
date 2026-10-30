<div align="center">

# hkustgz-cli

**问 AI：今天有什么课？最近有什么 DDL？校园卡丢了去哪补？**

[![Version](docs/assets/badges/version.svg)](docs/STATUS.md)
[![Node.js](docs/assets/badges/node.svg)](INSTALL.md)
[![Runtime dependencies](docs/assets/badges/deps.svg)](package.json)
[![Verified environment](docs/assets/badges/platform.svg)](INSTALL.md)
[![License](docs/assets/badges/license.svg)](package.json)

[快速开始](#快速开始) · [常用问题](#常用问题) · [目前做到哪了](#目前做到哪了) · [遇到问题](#遇到问题) · [开发与命令](#开发与命令)

</div>

hkustgz-cli 把港科广常用的查询整理成 CLI 和配套 Skill，让 AI 帮你查课表、汇总作业、找办事入口和学校文件。你直接提问，AI 负责调用工具，再把查到的内容和来源告诉你。

目前是 **0.2.0-alpha.1 测试版**，在 **Windows + Codex** 上跑通过安装和日常查询。它还没有覆盖学校的全部系统，也没有适配所有 AI，具体范围见下文。

## 快速开始

把这句话发给 AI：

```text
请安装 https://github.com/Snow4a1l/HKUSTGZ-CLI 中的 hkustgz-cli，按 INSTALL.md 完成安装和自检。
```

安装好后，直接问：

```text
刷新最近两周的 DDL，帮我安排一下时间。
```

第一次查个人数据时，AI 会打开 SISN 和 Canvas。如果网页要求登录，你在学校页面正常登录，完成后说一声“已登录”即可。不需要把密码发给 AI，也不用自己填课程 ID、复制快照或改代码。

查补卡、打印驱动和已收录的文件入口，可以先不登录；打开某些学校下载页面时，仍可能需要登录。

### 用之前需要什么

- Node.js 20 或以上。项目没有第三方运行依赖。
- AI 能在本机执行命令。只有文字聊天能力的环境无法替你安装工具。
- 自动刷新个人课表和 DDL，还需要受支持的 Browser。目前这条完整流程只在 Codex 上验证过，安装器也默认安装到 Codex 的技能目录。

**Claude 等其他 AI 的自动安装和浏览器适配还没做好。** 能读仓库、能运行 CLI、能自动刷新学校数据，是三个不同的条件。其他操作系统和其他同学的新账号，也还需要继续验证。

目前从 GitHub 源码安装，没有发布同名 npm 包或 GitHub Release。详细步骤见 [INSTALL.md](INSTALL.md)。

## 常用问题

### “最近有什么 DDL，帮我排一下”

工具会刷新 SISN 课表和 Canvas 任务，按截止时间整理近期作业，同时列出没有日期的任务。回答里会注明查了哪些课程、数据是什么时候采集的，以及哪些地方没查到。

你也可以给出自己的时间：

```text
我每天晚上 20:00–22:00 有空。刷新 DDL，先按每项 60 分钟排一份计划。
```

不提供时间时，默认按每天 **19:00–21:00、每项90分钟**试排。这只是草案，工时是估计的，未来课表和你的私人安排也没有完整获取。排不下的任务会单独列出，计划不会写进外部日历。

外部答题网站、线下展示和“仅作提醒”的任务，需要你确认是否已经完成，不能只看 Canvas 的提交状态。

### “校园卡丢了，哪里补办？”

可以查学生补卡事项、办理入口、费用和已知材料说明。如果来源里的中英文说法有冲突，会把冲突告诉你；实际办理以学校页面为准。

目前只查信息、给入口，不代交申请或付款。

### “打印机驱动在哪？我用 Mac”

可以找到 ITD 官方下载中心，以及 Windows、Mac、Linux 的相关指南入口。回答会说明下载是否需要登录，并给出已读指南的出处。驱动需要你按自己的系统选择，工具不会替你运行安装程序。

### “应用统计这门课怎么样？”

目前能根据已收录的官方资料，介绍课程内容、学分和先修要求，并注明学期。

还没有学生评课数据，所以暂时回答不了“老师给分松不松”“这门课水不水”这类体验问题。没收录的课程会给出官方 PCC 入口，不能把“没搜到”当成“学校没开”。

### “给我本科手册、校历和专业要求”

会给官方原文链接，说明文件是哪一版、读过哪些章节或页码。

当前收录的是 OSA 入口链接的 **2025本科入学指南**和 **2026–27广州校历**。入学指南与正式学业规章需要分别看；如果你要找更新的版本，当前索引未必已经收录。

查专业要求时，请说明入学年份，例如：

```text
按2026–27入学要求，解释一下AI专业需要修哪些学分。
```

AI 培养要求已有官方 PDF 摘要，但还不能拿你的个人修读记录做完整毕业审核。

## 目前做到哪了

| 内容 | 当前进展 |
| --- | --- |
| 今日课表 | 能刷新 SISN 实际日期周，读取当天课程；尚未独立核对临时调停课，不生成 ICS |
| Canvas DDL | 能自动发现当学期学生课程，汇总近期、逾期和无日期任务；每课接口读取前100项 |
| 时间安排 | 能按空闲时段和估时生成草案，避开已知课程、工作块及任务开放/关闭时间 |
| 办事入口 | 收录13项服务或导航；补卡已有详情，部分其他事项只有标题或入口 |
| 学校文件 | 收录7份摘要或入口，部分读过 PDF 正文；还不是完整文件库 |
| 课程介绍 | 收录2026–27 Fall目录中的11/266门，部分有详细说明；暂无学生评价 |
| 专业要求 | 有两个入学年份的目录和AI培养要求摘要，其他专业附件尚未全部读取 |
| 成绩 | 能解析SISN成绩快照和官方统计，但还不能自动刷新，也没有排名或毕业审核 |

已经完成真实登录会话下的日常刷新、查询和安排验证，也验证了从 GitHub 下载后的独立安装。其他功能有些只通过本地测试，不能据此说成已经接通真实系统。细节见[当前状态](docs/STATUS.md)和[验收记录](docs/V1_ACCEPTANCE.md)。

接下来还要补完整课程目录、Class Schedule & Quota 查询、更多服务详情和文件正文，以及成绩自动刷新、修读进度和调停课处理。场馆仍在待办中；图书馆、缴费和 ClassViva 暂缓。完整清单在 [HANDOFF.md](HANDOFF.md)。

### 查到的数据有多新

个人数据来自 Browser 的一次实际采集，随后保存在本机供 CLI 查询。默认超过 **60分钟**或跨上海日期，就需要重新刷新；你明确要求刷新时，也会重新采集。

完整刷新在当前环境中可能需要十多分钟，取决于课程数和 Browser 响应。中途可以继续进度，失败时会说明缺了哪些来源，不会偷偷换回旧批次。

Canvas 会比较网页可见作业和接口结果，但 Browser 无法读取官方分页 Link 头，因此仍不保证全账号、全分页完整。未发布课程、其他平台和课程通知正文里的 DDL，也可能不在结果中。

办事、文件和课程介绍主要来自随包索引，显示的是资料核实日期，不是每次提问都重新访问了学校网站。采集规则见 [DAILY.md](docs/DAILY.md)。

## 遇到问题

| 情况 | 可以怎么处理 |
| --- | --- |
| 学校网页要求登录 | 在网页正常登录后告诉AI“已登录”，不要发送密码或验证码 |
| 提示数据过期 | 说“重新刷新”；错误码为 `REFRESH_REQUIRED` |
| 聊天中断、采集没结束 | 说“继续刚才的刷新”；`CAPTURE_IN_PROGRESS` 表示还在采集中 |
| 只拿到部分结果 | 让AI说明哪些来源失败、哪些还没查，继续能查的部分；网络恢复后可开始新批次 |
| 服务或文件搜不到 | 让AI补查官方来源；索引没收录不代表学校没有 |
| 安装目录冲突 | 保留原目录，让AI检查报错；安装器不会覆盖非本项目管理的同名目录 |

按 README 操作遇到卡点，可以到 [Issues](https://github.com/Snow4a1l/HKUSTGZ-CLI/issues) 留下操作步骤、错误码和预期结果。不要附上个人成绩、课表快照、身份区截图或认证材料。

<details>
<summary>AI说找不到仓库，或者猜它是私有的</summary>

这是[公开仓库](https://github.com/Snow4a1l/HKUSTGZ-CLI)。搜索没结果或工具没打开页面，都不能证明仓库是私有的。可以让它直接读[安装说明原文](https://raw.githubusercontent.com/Snow4a1l/HKUSTGZ-CLI/main/INSTALL.md)，并报告实际访问地址和错误。

`package.json` 中的 `private: true` 只是防止误发布到 npm，与 GitHub 是否公开无关。如果 AI 的环境本身不能访问 GitHub，需要解决它的访问条件，或下载源码供它读取。

</details>

## 数据放在哪里

Skill 默认安装到 `~/.codex/skills/hkustgz-cli`，设置 `CODEX_HOME` 时跟随该位置。个人课表和任务批次另外放在 `~/.hkustgz-cli`；也可以用环境变量 `HKUSTGZ_HOME` 指定另一个绝对路径。

更新工具会保留个人数据。共用操作系统账户时，不同同学不要共用同一个状态目录。卸载默认只移除 Skill，个人状态是否删除由你另行决定。

公开仓库和安装包不包含个人课表、成绩、DDL或认证材料。采集不会导出浏览器 Cookie 或令牌，接口响应会先提取所需字段再保存。

## 开发与命令

项目采用原生 Node.js ESM，没有额外模型后端。AI 负责理解问题和组织回答，CLI 负责数据校验、检索和安排；Browser 负责正常学校页面的只读采集。

<details>
<summary>手动安装、运行和测试</summary>

```powershell
git clone https://github.com/Snow4a1l/HKUSTGZ-CLI.git hkustgz-cli
cd hkustgz-cli
node --version             # 需要20或以上
node scripts/install.mjs
```

已有源码副本时，直接在该目录运行安装器。它返回安装后的 CLI 绝对路径，之后可从其他目录调用；`--codex-home <绝对目录>` 可指定独立安装位置。安装器本身不下载 Node.js。

在源码目录运行：

```powershell
node src/cli.js setup
node src/cli.js doctor --offline
node src/cli.js daily status
node src/cli.js daily agenda --days 14
node src/cli.js daily plan --minutes 60 --window 20:00-22:00
node src/cli.js service search "哪里能补办校园卡"
node src/cli.js document search "打印机驱动"
node src/cli.js course explain "应用统计这门课怎么样"
node src/cli.js program show beng-ai --intake 2026-27
node src/cli.js --help
npm test
npm pack
```

`daily agenda` 和 `daily plan` 查询的是已采集批次，单独执行不会自动登录或启动 Browser。需要先由 AI 按已安装的 Skill 完成采集。`doctor --offline` 检查本地环境，`auth status` 只报告适配能力，都不能用来证明学校登录有效。

命令统一输出单行 JSON：成功为 `ok: true`，失败为 `ok: false` 并附错误码。`--json` 为兼容选项。退出码：0成功，2参数，3认证/权限，4格式/覆盖/过期/未实现，5限流，其余为1。

更新时从同一仓库取得新版，重新运行安装器，再读取新 Skill。安装、更新和卸载的完整说明见 [INSTALL.md](INSTALL.md)。

</details>

```text
hkustgz-cli/
├── data/       官方资料索引
├── docs/       状态、验收和各模块说明
├── scripts/    安装器与Browser采集流程
├── skills/     配套AI Skill
├── src/        CLI、客户端、解析和查询模块
└── tests/      合成数据测试
```

## 更多文档

- [安装、更新与卸载](INSTALL.md)
- [日常采集与失败恢复](docs/DAILY.md)
- [当前状态和验证证据](docs/STATUS.md)
- [普通用户验收场景](docs/V1_ACCEPTANCE.md)
- [专业要求与成绩](docs/ACADEMICS.md)
- [Canvas只读接口](docs/CANVAS.md)
- [SISN概览快照](docs/BROWSER_COURSES.md)
- [完整功能目标与交接](HANDOFF.md)

这是社区项目，不是学校官方客户端。运行代码独立实现，许可证尚未指定；当前 `package.json` 保留 `private` 和 `UNLICENSED`。
