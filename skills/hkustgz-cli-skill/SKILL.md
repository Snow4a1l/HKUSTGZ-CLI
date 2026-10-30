---
name: hkustgz-cli
description: 港科广同学日常助手：自动刷新近期DDL和课表并安排时间，查补卡、打印驱动、课程介绍、本科手册和校历。适用于支持本地Node及Browser的AI。
---

先从本Skill目录定位scripts/run.mjs，使用绝对路径运行，不依赖项目cwd、旧聊天、旧tab ID或学生手填课程ID。所有输出为单行JSON，先检查ok和错误码。不要宣称尚未实现的完整模块已完成。

## 首次使用与日常DDL

1. 运行node <本Skill目录>/scripts/run.mjs setup，读取返回的browserWorkflowModule及用户状态目录。状态按操作系统用户隔离，不在共享安装目录存私人数据。
2. 运行同一入口daily agenda。用户要求刷新、缺数据、过期或跨日时，遵循当前宿主Browser技能正常建立浏览器连接。不得自行用独立自动化、读Cookie/存储或索取令牌替代。
3. 动态导入setup返回的browserWorkflowModule，先调用configure({stateDirectory: setup返回的stateDirectory})。调用start()建立新批次，然后分次调用step(browser)。采集器会自己查找/创建SISN、Canvas标签并发现课程；每次step只执行一个有界阶段，不手写课程ID，不把代码填给用户。SISN阶段可用300秒工具超时；其余步骤可用180秒，分步报告进度。
4. action=needs-attention时先检查返回tabId的可见页面。若需学校登录，请用户在该Browser页完成密码/MFA并告知就绪，不索取密码/令牌；恢复后start()新尝试。若是单来源权限/格式失败，明确缺口，可继续step采集其余pending来源，最后得到partial；不会重试已失败来源。普通中断也可status后继续step。
5. 整站网络故障时可finishPartial()终止其余pending阶段，标NOT_CAPTURED；不要反复访问同一失败站点。action=finished后重新daily agenda（可带--days 7等）。刷新失败、partial或过期必须说明，不能用旧批次冒充成功。用户只需正常登录，不复制快照、不改代码。
6. 回答注明上海时间、每个来源更新时间、覆盖课程和分页/遗漏限制。提醒/外部工具/线下活动的Canvas状态不能证明实际完成，不开始答题或提交。

API页面只使用随包白名单提取器，不打印整页DOM或原始JSON；失败日志不包含响应正文、secure_params、成绩、用户标识或认证材料。

日程安排用daily plan，默认每项估计90分钟、每天19:00–21:00。可带--minutes 60 --window 18:00-22:00等。必须说明工时与空闲时段是假设，保留排不下、无DDL和逾期项目，询问用户确认外部活动是否已完成。不编造估时为官方事实，不写入外部日历。

## 办事、文件、课程

- 补卡等：service search原问法，必要时以ID调用service show；给实际入口、导航及核实日期。availability=not-found必须说明失效，navigationVerified=false只能说标题级导航。
- 驱动/手册/校历：document search再show。区分指南、下载入口、已读正文和适用版本。source-summary不是全文；缺失/旧版不能冒充最新。只提供官方驱动来源，不擅自安装打印机驱动。
- 课程：course explain接受原问法，默认仅用随包目录的学期并明确标注，不暗示是用户所选学期；catalog search/show需明确学期；program list/show需入学年份。给官方说明、学分、先修及来源。没有学生评价时明确缺少评价，不编难度、教师风格、评分松紧或工作量。
- 索引无结果只代表未收录。先补查官方来源内容，不把缺内容归因于需要语义模型。不上传学校或个人材料到额外模型。

私人数据只在setup返回目录；不混入公共索引/测试/Git。不推断官方排名或毕业资格。预约、取消、付款、申请/选退课提交、测验开始及答题提交均不属于本Skill的泛化授权。图书馆、缴费和ClassViva接入继续暂缓；Canvas中已有外部提醒可以如实展示。
