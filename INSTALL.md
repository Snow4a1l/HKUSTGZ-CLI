# 给 AI 的安装说明

本文件是仓库安装入口。唯一指定仓库：[HKUSTGZ-CLI](https://github.com/Snow4a1l/HKUSTGZ-CLI)，当前版本0.2.0-alpha.1为候选版。使用本仓库源码安装；不要执行来源不明的同名npm包。当前没有npm发布或GitHub Release。

## 支持的环境

已验证：Windows、Node.js >=20、支持本地命令和 in-app Browser 的 Codex。无 npm 运行依赖。其他 AI 可运行静态查询，但需要适配其受支持的浏览器才有个人数据刷新；不能承诺所有 AI 安装后都能使用全部功能。

当前自动安装器的目标是Codex技能目录。Claude等其他宿主尚无自动技能安装或Browser适配，不能因CLI能运行就宣称该宿主完整支持。

AI若无法打开GitHub页面，可直接读[本文件的原文入口](https://raw.githubusercontent.com/Snow4a1l/HKUSTGZ-CLI/main/INSTALL.md)。仓库公开，读取不需GitHub认证；打不开时报告实际地址和错误，不用搜索结果猜测仓库权限。

package.json中的private:true用于禁止误发布到npm，与GitHub仓库可见性无关。

AI先检查node --version。缺少Node或版本低于20时，应先完成受支持的Node安装并重新检查；安装器本身不会下载Node。若当前AI无本地命令或Browser能力，应明确指出环境缺口，不能宣称安装成功或要求用户复制私人快照补洞。

## 安装

从 [HKUSTGZ-CLI 仓库](https://github.com/Snow4a1l/HKUSTGZ-CLI) 取得源码（git clone或GitHub Download ZIP），已有工作副本则复用。阅读README、package.json和本文件，在解压/克隆目录运行：

```powershell
node scripts/install.mjs
```

安装器返回 `skillDirectory` 和 `cli` 的绝对路径。它将自带运行代码的技能安装到 `$CODEX_HOME/skills/hkustgz-cli`，未设置 CODEX_HOME 时用 `~/.codex/skills/hkustgz-cli`。也可用 `--codex-home <绝对目录>` 测试。重复运行会更新受管理安装；遇到不属于本安装器的同名目录则拒绝覆盖。安装和更新不迁移、不覆盖个人数据。

读取已安装 SKILL.md，执行 `node <返回的cli路径> setup`，再按技能完成日常查询。如果当前宿主尚未发现新技能，重新打开会话即可；也可在当前会话直接读取该 SKILL.md。无需全局 npm 安装或填写课程 ID。

登录由用户在正常学校网页完成。仅索取“已登录”的确认，不索取密码、MFA、Cookie 或令牌。没有 Browser 能力时明确指出个人数据刷新不可用，继续提供静态来源检索。

## 验证与更新

安装后从其他工作目录运行返回的 CLI 的 `setup`、`doctor --offline`、`document search 打印机驱动`。然后按 README 的五个问题验收。更新从同一可信仓库取得新版，再运行安装器；随后读取新技能并刷新数据。

个人状态默认在 `~/.hkustgz-cli`，可用绝对路径环境变量 `HKUSTGZ_HOME` 指定独立目录。此目录含私人课表与任务，不能提交到 GitHub。卸载时移除安装器返回的技能目录即可；个人状态保留，由用户自行决定是否删除。

维护者打包：`npm test` 后 `npm pack --pack-destination <仓库外目录>`。每次发布前审查包清单及敏感字段；不要推送含个人邮箱或原始验证记录的旧开发历史。当前许可证未指定；本地打包不代表已发布Release。
