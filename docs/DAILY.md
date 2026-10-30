# 日常数据协议

用户按README提问即可。本页供AI与维护者使用。先运行安装器返回的CLI的setup，读取browserWorkflowModule和stateDirectory；遵循宿主Browser技能连接浏览器，导入返回的模块，调用configure({stateDirectory})、start()，再分次执行step(browser)直到finished。

唯一外部句柄是本次宿主的Browser。每步自行寻找标签并执行一个阶段：SISN实际日期周及今日卡片展开 → Canvas All Courses表格 → 一门课网页作业与GET接口交叉检查 → 结束批次。不依赖仪表盘新旧模式、收藏卡片、旧聊天句柄、tab ID或学生填写课程ID。SISN工具超时可给300秒，其他阶段180秒；不要在一次宿主工具调用中循环全部课程，持续报告进度。

只读当前渲染DOM/JSON，立即白名单化；不保存描述、成绩、用户ID、secure_params或认证材料。最多12门，每课API首100项，单批次最大1MiB；超出或格式变化明确失败。

needs-attention时AI检查返回tabId对应的可见页面，给具体登录步骤；用户只在学校网页完成密码/MFA。失败不自动重试、不换认证通道、不回退旧数据。普通中断可status后继续step；单来源失败后也可继续其他pending来源，末尾结束为partial。整站网络故障时finishPartial()把未尝试来源标NOT_CAPTURED并结束；与实际尝试失败分开记录。恢复登录/网络后start新尝试，不要求用户改状态文件。

个人数据在setup目录下daily/runs/<runId>.json，daily/latest.json立即指向最近开始的尝试。旧版项目private/daily不自动导入，新安装不带维护者样本。临时文件+rename写入；每批次一个采集者顺序更新，不提供跨进程锁。

daily agenda默认上海今天与未来14天任务，另列近7天Canvas标unsubmitted的逾期项和无DDL项；保留每项课程、链接、状态与时间。最老来源超过60分钟或跨上海日期返回REFRESH_REQUIRED；采集中返回CAPTURE_IN_PROGRESS。--allow-stale仅作历史预览，daily plan拒绝旧数据。CLI查询本身不联网，liveChecked=false不否定此前Browser真实采集。

All Courses表格可包含未收藏课程；仅选与SISN学期相同且Enrolled as=Student的记录。记录发现来源、表格记录数及排除数。课程表若出现可见下一页则失败，仍不保证账号全部课程、未发布课程或其他平台覆盖。

每门API首100项与Assignments网页可见assignment链接ID比较，网页项缺失即失败。Assignments页面不可用或组折叠时uiCrossCheck=unavailable，继续尝试只读接口，不能声称已核对。Browser不暴露分页所需opaque Link头，paginationComplete始终false；网页匹配也不证明完整。规则见[Canvas官方分页说明](https://developerdocs.instructure.com/services/canvas/basics/file.pagination)。

SISN范围为实际日期周，仅今日卡片强制补齐时间；未知课表返回null，不能解释为没课。校历调课、教师通知及停课未自动协调；不推算ICS。

外部工具、线下活动、none和reminderOnly的Canvas状态不证明实际完成；不开始测验或打开ClassViva。daily plan按截止排序，默认每项估时90分钟、每日19:00–21:00，可调--minutes/--window；避开已知课时、工作块、开放/关闭时间和DDL。保留未安排、无日期、逾期项，说明未来课表、工时及空闲时间未知，不写日历。
