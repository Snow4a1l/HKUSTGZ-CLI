# SISN 可见课表 → CLI

日常获取与更新已正式支持，优先使用 [DAILY.md](DAILY.md) 的带日期Weekly Calendar刷新与统一查询。本页保留Time Slots Overview离线解析方式，不用其星期规则推算今日课表。

当前支持由受支持 Browser 工具读取 SISN My Calendar 的 **Time Slots Overview**，再让 CLI 解析本地快照。CLI 不控制浏览器、不读浏览器存储、不导出凭据，也不自动调用 SISN HTTP API。

## 浏览器采集

使用当前环境的 Browser 技能连接浏览器，进入 `https://sisn.hkust-gz.edu.cn/`，按正常 Login 流程进入 My Calendar。用户自行完成必要的密码/MFA。

先读取当前可见页面，确认：

- 页面为 My Calendar，选中 Time Slots Overview；不要把 Weekly Calendar 输入本解析器。
- 记录实际显示的学期与 Include Waitlisted Class 勾选状态，不能使用下例值代替现场核实。
- 可见 DOM 仍为七个 `.table-list-main` 星期列，列标题为 `.table-title`，卡片为 `.table-data-item`。结构变化时先修复和验证采集器，不读取隐藏应用状态替代。

在已连接的 Browser JavaScript 控制会话中，复用当前 `sisn` 标签句柄。可导入本项目只读 DOM 提取函数，并传给工具提供的 `evaluate`：

```js
const { readSisnOverview } = await import(new URL('./read-sisn-overview.mjs', setupResult.browserWorkflowModule).href);
const snapshot = {
  schemaVersion: 1,
  source: 'sisn',
  view: 'time-slots-overview',
  sourceUrl: 'https://sisn.hkust-gz.edu.cn/system/my-calendar',
  term: '2026-27 Fall', // 改为页面实际选中的值
  includeWaitlisted: false, // 改为页面实际勾选状态
  capturedAt: new Date().toISOString(),
  days: await sisn.playwright.evaluate(readSisnOverview)
};
```

仅代码/班别可见的卡片会产生缺失字段。点击一张卡片可在当前 UI 中展开名称、日期、时间、地点和教师，再用相同函数读取；展开其他卡片会收起上一张的详情。若合并这些分次读取，只能按 **同一学期、同一模式、同一候补设置、同一星期及同一卡片代码/班别** 更新该张记录，不用其他星期/课程补值；最后写入本次采集完成时间。未读完则保留 null 和警告。

只把最小化的课表对象保存至项目 `private/` 等被忽略目录。不要保存整页身份区、学号、邮箱、Cookie、Token、临时 URL 查询串或私人原始响应到测试/索引。快照仍是私人课表，不上传或提交 Git。保存文件可使用本地文件工具，不通过页面脚本写文件。

## CLI

```powershell
node src/cli.js course list --source sisn --snapshot private/sisn-overview.json
node src/cli.js course list --source sisn --snapshot private/sisn-overview.json --day 4
```

`--day` 为1（周一）至7（周日）。输出每张卡片的 courseCode、section、title（页面可能缩写或缺失）、day、日期范围、时间、location、instructors 和 missingFields。不合并班别，不把两天的同名课程去重；候补范围原样注明。

输出 `retrieval=browser-dom-snapshot`、`snapshotProvenance=caller-supplied`、`liveChecked=false`、capturedAt、ageSeconds，明确 CLI 只解析输入文件。CLI 无法证明输入来自真实网页，也无法验证当前登录、数据是否仍有效或已退选。日期范围和星期仅表示所见概览，尚未核实节假日、单次调课和取消，不据此生成整学期实际日期/ICS。

文件必须为本地 JSON，最大1 MiB；不支持 HTTP URL。源、模式、日期或卡片形状不符返回 `SNAPSHOT_INVALID`（退出码4），不回显原始内容。空卡片集不能证明未选课。无 `--snapshot` 的课程命令仍返回 `NOT_IMPLEMENTED`；KLMS 快照适配尚未实现。
