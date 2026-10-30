# 课程目录、专业要求和SISN成绩

## 来源与范围

- 港科广教务官网 [Programs & Courses](https://ars.hkust-gz.edu.cn/programs-courses/) 将本科专业和课程指向 [广州校区PCC](https://pcc.hkust-gz.edu.cn/)。不使用清水湾目录替代。
- PCC当前课程目录显示2026-27 Fall共266门。当前本地只收录首页10门及UFUG2104单课查询，共11门；UFUG2104已展开核实3学分、开课单位CES及原始先修条件UFUG 1102 OR UFUG 1105。目录不是班次/考试安排，也不代表本人符合选课资格。
- 已分别切换并读取2025-26与2026-27入学目录，项目数为9与10（包括主修、延伸主修和辅修）。学年间确有项目差异，查询必须明确intake，不能跨年替代。
- 本科总体要求来自PCC目录总则；AI专业细则另来自官方4页培养方案PDF，不把所有本科专业均视为AI要求。其他专业附件尚未读取。

## 命令

```powershell
node src/cli.js program list --intake 2025-26
node src/cli.js program show beng-ai --intake 2025-26
node src/cli.js program list --intake 2026-27 --search 人工智能
node src/cli.js catalog search 应用统计 --term "2026-27 Fall"
node src/cli.js catalog show AIAA2110 --term "2026-27 Fall"
node src/cli.js grade list --source sisn --snapshot private/example-grades.json
node src/cli.js grade summary --source sisn --snapshot private/example-grades.json
```

目录与规则来自本地核实索引，liveChecked=false；结果带verifiedAt、范围和来源。未收录学期/入学年份返回NOT_INDEXED，不用其他年份顶替。目录搜索无结果不代表学校没有该课程；部分课程为0学分，不能视作缺失。

## AI培养要求的原文依据

来源：[Curriculum Requirements - AI - 2025 cohort and onwards](https://document.hkust-gz.edu.cn/office/viewer?key=972)。PDF适用2025-26及以后四年制AI本科生。2026-10-30成功通过Browser支持的embed下载工具取得原文；先前预览空白及下载超时已被此次成功取件取代。

已用pypdf提取并用Poppler渲染、视觉核对四页；原文留在被忽略的 `private/official/ai-curriculum-2025-onwards.pdf`。机器摘要保存于 `data/ai-requirements-2025-onwards.json`，带SHA256、核实日期和逐项页码；文号不冒充发布日期。

| 规则 | 原文位置 |
| --- | --- |
| 总120学分；共同核心30；专业85；自由选修补总学分差额 | PDF第1页 |
| 基础21学分，保留7个3学分组和OR替代关系 | 第1–2页 |
| 专业必修40学分，包括13门课程及各自学分 | 第2–3页 |
| 专业选修24学分，并从指定名单选择8门；名单23门 | 第3–4页 |

OR组不是所有备选课均必修；8门和24学分都保留，不能只算学分忽略门数。课程归属不是GPA纳入规则。PCC总则中的共同核心、英语、适用Hub/主修、公民教育及体育等大学条件仍需满足；本工具尚不进行个人毕业审核或重修替代判断。建议修读路径key=840及其他条例正文尚未读取。

## SISN成绩采集及解释

通过当前环境Browser技能，进入SISN → My Academics → My Term Information，选择实际学期并读取页面状态，核对Class Grades与Term Statistics标题。身份区不进入快照：

```js
const {readSisnTermTables}=await import(new URL('./read-sisn-term-grades.mjs', setupResult.browserWorkflowModule).href);
const tables=await sisn.playwright.getByRole('tabpanel',{name:'My Term Information',exact:true}).evaluate(readSisnTermTables);
```

保存最小JSON到private目录：schemaVersion=1、source=sisn、view=term-information、sourceUrl=`https://sisn.hkust-gz.edu.cn/student-record/my-academics`、term（与现场标题一致）、capturedAt（UTC ISO时间）、tables。不要保存面板外姓名/学号或把个人成绩写进公共索引/测试。CLI仅验证形状，无法认证调用者给出的来源或学期真实性。

解析结构曾在正常登录页面核对；个人学期和成绩记录不随仓库发布。输出课程、学分、评分方式、原始等级和Grade Points，以及官方term/cumulative统计。空白学分不推断为0或目录学分，**保留为未公布等级；缺少In Progress行表示未显示，不自动当0。GPA照录官方显示，不由字母等级重算，也不按学分表推断重修规则。官方排名返回null（未读取），不伪造名次。

grade summary仅隐藏逐课行，保留官方统计。结果liveChecked=false，带采集时间和数据年龄。页面提示统计可能延迟一至两日；它不是已导出的正式成绩单或毕业审核。SISN直接HTTP成绩客户端、全历史成绩单导出、本地加权GPA及官方排名均未完成。

## 课程时间、考试及Portal边界

- [Class Schedule & Quota](https://sisn.hkust-gz.edu.cn/cq)已通过Browser读取，可查班次、时间、教室、教师与名额，页面说明通常15至20分钟更新；未确认考试字段，尚无CLI班次适配器。
- Portal的Final Examination Schedule指向w5的/wex/cgi-bin，当前Not Found；教务官网的旧/wex/cgi-bin/2310/也404。两者都不能当作有效考试表，当前只记录不可用状态，不猜新地址。
- Portal学生服务台只收录了本轮可见的6个事项标题及导航，详情/表单均未核实；个人待办/已办/办结未实现。
- Portal搜索“场馆”只返回资讯，未找到预约应用；不能据此断言Portal不支持预约。科大Go是用户确认的预约线索，移动端能力仍待核实。
- 图书馆、缴费和ClassViva按用户当前要求跳过。
