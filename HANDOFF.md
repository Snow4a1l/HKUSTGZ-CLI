# hkustgz-cli 当前交接

更新：2026-10-30。以实际实现、测试和docs/STATUS.md证据为准；不将设计目标当作已实现功能。

## 当前任务

推进可日常使用的第一版，集中五个问题：近期DDL及时间安排、补卡、打印驱动、课程介绍、本科手册/校历。先完成端到端、消除手工快照/课程ID/旧聊天依赖，再扩模块。指定GitHub仓库为https://github.com/Snow4a1l/HKUSTGZ-CLI，公开源码安装，许可证未指定；不上传个人验证资料和旧本地开发历史。

## 运行入口

- 从仓库根目录开始，先读README、INSTALL、docs/STATUS、docs/V1_ACCEPTANCE。
- Node>=20，零第三方运行依赖。node scripts/install.mjs安装自带runtime的技能，默认~/.codex/skills/hkustgz-cli；--codex-home可隔离测试。重复安装更新受管理目录，不覆盖非受管理同名目录。
- 安装器返回cli绝对路径；从任意cwd运行该入口的setup，获取browserWorkflowModule及stateDirectory。遵循当前Browser技能连接，导入模块，configure({stateDirectory})，start，再分次step(browser)到finished。采集自己找标签和课程，不传旧tab ID。
- 日常daily agenda、daily plan；服务/文件search和show；course explain。详情见help。auth status只报告能力，不证明登录。私人数据现在默认~/.hkustgz-cli/daily，HKUSTGZ_HOME需绝对路径；旧private/daily不自动迁移，不随安装包分发。
- 过期60分钟或上海跨日要求刷新；最新尝试立即替代latest，失败不回退旧成功批次。中断可继续pending，已标失败则修复后新建。SISN步骤超时可给300秒，其他步骤180秒，持续报告进度。

## 当前范围

- 13项服务、7份文件摘要；部分Portal事项只有标题。补卡详情已读；Windows驱动指南PDF第4页已读，指向ITD登录下载中心。OSA当前文件是2025入学指南；Portal旧本科手册入口跳至CES首页。广州2026–27校历两页已读，2027假期仍标待调整。
- 课程目录11/266，仅2026–27 Fall；应用统计说明/先修完整，其余多为列表字段。course explain不编学生评价、难度或给分。专业目录2025–26/2026–27分别9/10项；AI培养要求4页PDF已有学分、OR组和来源页码。
- SISN学期概览与成绩快照适配，结构曾在正常页面核对；公开文件不含实际学期成绩记录。保留官方GPA/空值，不猜排名，不重算重修规则。当前未自动刷新成绩。
- Browser日常SISN日期周/今日展开；Canvas直接读All Courses可见表格，按SISN学期选Student记录，兼容新旧仪表盘与未收藏课程；逐课GET首100项，和网页可见assignment ID核对。Browser无opaque Link头，分页完整性仍为false。外部/none/reminder状态不能证明实际完成。
- daily plan是可调整估时草案，不写日历；避开已知具体课程、工作块、开放/关闭时间和DDL；缺未来课表/私人安排时明示假设。
- 校历虽已有文件来源，尚未与课程调停课规则自动协调；不生成ICS。Class Schedule & Quota已确认可读，CLI未接通；旧考试w5入口Not Found，不猜新URL。

## 完整功能目标保留

| 类别 | 完整目标（未全部完成） |
| --- | --- |
| 课程 | 今日、学期/周/星期课表、ICS、全校课程与班次 |
| 成绩 | 成绩单、学分加权GPA、官方排名、修读进度 |
| 考试 | 考试周、时间/地点、学校实际支持的语言考试分项 |
| 教务 | 空闲教室、通知、培养方案、毕业审核、开课搜索、学籍/预警 |
| 图书馆（暂缓） | 书名/作者/ISBN、馆藏、可借数、单册状态 |
| 体育 | 科大Go场馆、时段、费用、运动时/钱包、预约/候补/取消 |
| 服务 | Portal事项详情、搜索、个人待办/已办/办结 |
| 交费（暂缓） | 待缴账单 |
| 教学平台 | KLMS/Canvas课程、进度、DDL、链接、允许的题目/选项读取；ClassViva暂缓 |
| 工具 | 登录/状态、静默续期、退出、诊断、有界脱敏录制；办事/文件来源问答 |

## 证据与边界

自动测试与真实系统验证分别记录在STATUS。测试通过不代表所有功能完成。此前Browser批次因Canvas连接关闭而partial；连接恢复后从安装副本新建批次，完成全部已发现当学期课程采集，agenda与plan真实验证通过。未用旧数据补齐，分页和账号全量仍未保证。实际账号的记录、数量、时间和批次ID不公开。单账号验证不能替代其他学生/新机器登录验收。参考目录不进入分发；运行代码独立实现，package保持private和UNLICENSED。

本项目日常授权限于查询和只读采集。密码/MFA由用户在网页完成。申请、付款、预约/取消、选退课、测验开始/作答/提交必须具体授权；不得上传私人状态、姓名学号成绩、Cookie、令牌或含私人作者邮箱/验证记录的旧本地历史。
