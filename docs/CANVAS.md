# Canvas作业与测验DDL

正式日常流程已支持重新发现当学期课程、多课程Browser刷新和DDL汇总，见 [DAILY.md](DAILY.md)。本页保留单课程样本格式和令牌HTTP客户端说明，不包含真实账号课程或任务。

## 实际验证

Browser正常登录路径曾真实验证，但最新完整刷新遇到连接关闭，结果为partial；详情与缺口见STATUS。实际账号课程、任务和数量不公开。

接口依据：[Instructure官方Assignments文档](https://developerdocs.instructure.com/services/canvas/resources/assignments)。已验证：

```text
GET https://hkust-gz.instructure.com/api/v1/courses/<页面已确认的课程ID>/assignments?per_page=20&include%5B%5D=submission
```

Browser使用既有会话成功读取，未提取Cookie或浏览器存储。Node HTTP客户端需要本机已有授权令牌，目前未配置，**令牌路径未做线上验证**。浏览器读接口成功不代表Node客户端登录或会话管理完成。

## 查询

以下42是合成示例ID，快照也需使用合成或自己授权的数据；正常日常查询请用DAILY流程，无需手填ID。

```powershell
node src/cli.js lms deadlines --source canvas --course 42 --snapshot private/example-assignments.json --upcoming --unsubmitted
node src/cli.js lms deadlines --source canvas --course 42 --snapshot private/example-assignments.json --type quiz
```

- `--type`：assignment、quiz、external-tool、discussion。
- `--upcoming`：仅保留当前时刻之后有明确DDL的任务，无DDL及已过期条目不在筛选结果中。
- `--unsubmitted`：只根据本人submission.workflow_state=unsubmitted，未知状态排除并警告。has_submitted_submissions表示“至少一名学生提交过”，不能判断本人状态。
- dueAt、unlockAt、lockAt分别为截止、开放、关闭时间；同时返回UTC和Asia/Shanghai的dueAtLocal。无DDL保留null。

本机若**已有**学校允许使用的授权令牌，可通过环境变量 `HKUSTGZ_CANVAS_TOKEN` 提供给进程，省略 `--snapshot` 走只读HTTP。不要把令牌放进命令行、项目或聊天。本工具不自动创建令牌、扩大授权或从浏览器导出会话；无凭据返回AUTH_REQUIRED（退出码3），不发出请求。

HTTP只使用固定学校域名、GET端点、同课程合法分页；最多3页，每页响应最大2 MiB，每请求15秒超时，不自动重试。拒绝重定向，分页链接跨域/跨课程/带未知查询参数时在发送凭据前拒绝。达到页数上限返回complete=false。

## Browser采集与样本格式

先遵循当前环境Browser技能，从课程UI确认course ID，再依据官方文档在同一Canvas域名正常打开GET URL。仅在页面显示接口JSON时运行：

```js
const { readCanvasAssignments } = await import(new URL('./read-canvas-assignments.mjs', setupResult.browserWorkflowModule).href);
const assignments = await canvasApi.playwright.evaluate(readCanvasAssignments);
```

canvasApi为工具连接的当前标签句柄。提取函数只解析页面正文，立即白名单化；不读隐藏应用状态，不调用页面fetch，不执行网站脚本。不要打印整页DOM或原始响应。白名单为id、course_id、name、due_at、unlock_at、lock_at、html_url、submission_types、is_quiz_assignment、locked_for_user及本人submission的workflow_state、submitted_at。不得保存secure_params、描述、成绩、用户标识或提交正文。

将结果与现场元数据写入被忽略的private目录：schemaVersion=1、source=canvas、kind=assignments-api、courseId、准确sourceUrl、capturedAt（UTC ISO时间）、pagination={page:1,perPage:20,complete:false}、assignments。当前Browser API不能读取响应Link头，不能根据不足20条断言分页结束；捕获模式必须complete=false。

快照结果标注retrieval=browser-api-snapshot、liveChecked=false、snapshotProvenance=caller-supplied、capturedAt、ageSeconds。CLI不证明输入来源或当前有效性。HTTP成功结果为retrieval=canvas-http-api、liveChecked=true，仅说明该次请求成功。检查pagination.complete，不完整单课程结果不能说成全部DDL。

尚未实现课程搜索、完成进度、测验题目/选项读取、作答或提交。quiz分类只有合成测试验证。external-tool条目不代表已接通外部答题网站。ClassViva已由用户要求跳过。

退出码：参数2、认证/权限3、快照/格式4、限流5、网络/其他上游错误1；错误不回显原始响应或凭据。
