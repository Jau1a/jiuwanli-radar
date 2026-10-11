# 九万里选题雷达

每日定时（11:30）抓取国际新闻 → 调用大模型按"九万里"公众号口味生成选题推荐 → 存本地并邮件推送。

## 文件说明
- `run-daily.js` 每日入口：抓取 → 生成 → 存报告 → 发邮件
- `fetch-news.js` 新闻抓取（RSS/频道页，零依赖，自动按日期过滤3天内新闻）
- `generate-report.js` 调用 DeepSeek API 生成选题，内置"原题照抄"防幻觉校验，不通过自动重写一次
- `prompt.md` 生成提示词（栏目口味、格式、文风约束）
- `send-email.js` nodemailer 邮件推送（HTML）
- `config.json` 配置：SMTP、API密钥、新闻源（**含密钥，勿外传**）
- `register-task.ps1` 注册 Windows 定时任务（每日 11:30）
- `reports/` 每日报告与新闻摘要
- `probe-sources*.js` / `test-fetch.js` 信源探测与抓取层调试工具

## 配置
1. 复制 `config.example.json` 为 `config.json`
2. 填 SMTP（QQ邮箱授权码、收件人）与 `api.key`（DeepSeek 平台密钥）
3. 信源失效时，用 `node probe-sources3.js` 探测新源，把带日期链接的源加进 `sources`

## 运行
- 手动跑一期：`node run-daily.js`
- 注册每日任务：`pwsh -File register-task.ps1`
- 手动触发任务：`schtasks /run /tn JiuwanliRadar`
- 查看任务：`schtasks /query /tn JiuwanliRadar`
