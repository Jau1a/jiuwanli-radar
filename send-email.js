// 用 nodemailer 发送选题报告邮件
const nodemailer = require('nodemailer');

function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = esc(md);
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

async function sendEmail(cfg, dateStr, report) {
  if (!cfg.smtp || !cfg.smtp.host || !cfg.smtp.user) throw new Error('未配置 smtp，跳过发邮件');
  const transporter = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port || 465,
    secure: cfg.smtp.secure !== false,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass }
  });
  const mail = {
    from: cfg.from || cfg.smtp.user,
    to: cfg.to,
    subject: `【九万里选题雷达】${dateStr}`,
    html: `<div style="font-family:Microsoft YaHei,SimSun,sans-serif;max-width:720px;margin:0 auto;line-height:1.8;color:#222;">
      <h2 style="color:#b03a2e;border-bottom:2px solid #b03a2e;padding-bottom:6px;">九万里选题雷达 · ${dateStr}</h2>
      ${mdToHtml(report)}
      <hr style="border:none;border-top:1px solid #ddd;">
      <p style="color:#888;font-size:12px;">本报告由「九万里选题雷达」自动生成，仅供选题参考；动笔前请核实事实细节。</p>
    </div>`
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await transporter.sendMail(mail);
    } catch (e) {
      if (attempt === 2) throw e;
      console.log('[mail] 第' + attempt + '次发送失败(' + e.message + ')，10秒后重试…');
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

module.exports = { sendEmail };
