// 每日入口：抓新闻 -> AI生成选题 -> 存本地 + 发邮件
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./load-config');
const { fetchDigest } = require('./fetch-news');
const { generateReport } = require('./generate-report');
const { sendEmail } = require('./send-email');

(async () => {
  const cfg = loadConfig();
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  console.log(`[radar] ${dateStr} 开始`);

  console.log('[radar] 1/3 抓取新闻…');
  const digest = await fetchDigest(cfg);
  if (!digest || digest.length < 200) throw new Error('新闻抓取结果过少，终止（可能信源失效，请检查 config.sources）');
  const outDir = path.join(__dirname, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${dateStr}-新闻摘要.txt`), digest, 'utf8');

  console.log('[radar] 2/3 AI生成选题…');
  const report = await generateReport(cfg, digest, dateStr);
  fs.writeFileSync(path.join(outDir, `${dateStr}-选题推荐.md`), report, 'utf8');
  console.log(`[radar] 报告已保存 reports/${dateStr}-选题推荐.md`);

  console.log('[radar] 3/3 发送邮件…');
  if (cfg.smtp && cfg.smtp.host && cfg.smtp.user && cfg.smtp.pass && cfg.to) {
    await sendEmail(cfg, dateStr, report);
    console.log(`[radar] 已发送至 ${cfg.to}`);
  } else {
    console.log('[radar] SMTP 未配置，跳过发邮件（仅存本地）');
  }
  console.log('[radar] 完成');
})().catch((e) => {
  console.error('[radar] 失败:', e && e.message);
  process.exit(1);
});
