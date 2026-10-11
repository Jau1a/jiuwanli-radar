// 配置加载：本地读 config.json，云端(GitHub Actions)用环境变量(Secrets)覆盖
const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCES = [
  { name: '联合早报即时世界', url: 'https://www.zaobao.com/realtime/world', type: 'html', charset: 'utf8', dateRe: 'story(\\d{8})' },
  { name: '联合早报即时中国', url: 'https://www.zaobao.com/realtime/china', type: 'html', charset: 'utf8', dateRe: 'story(\\d{8})' },
  { name: '国际在线国际', url: 'https://news.cri.cn/world', type: 'html', charset: 'utf8', dateRe: '(\\d{8})' },
  { name: '卫星社中文网', url: 'https://sputniknews.cn/', type: 'html', charset: 'utf8', dateRe: '(\\d{8})' },
  { name: 'GoogleNews国际(仅云端可用)', url: 'https://news.google.com/rss/search?q=%E5%9B%BD%E9%99%85&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', type: 'rss' }
];

function loadConfig() {
  let cfg = {
    smtp: { host: '', port: 465, secure: true, user: '', pass: '' },
    from: '',
    to: '',
    api: { baseUrl: 'https://api.deepseek.com', key: '', model: 'deepseek-chat' },
    sources: DEFAULT_SOURCES,
    maxItemsPerSource: 18
  };
  const p = path.join(__dirname, 'config.json');
  if (fs.existsSync(p)) {
    try {
      const local = JSON.parse(fs.readFileSync(p, 'utf8'));
      cfg = { ...cfg, ...local };
    } catch (e) { /* 忽略本地配置损坏 */ }
  }
  const env = process.env;
  if (env.SMTP_HOST) cfg.smtp.host = env.SMTP_HOST;
  if (env.SMTP_PORT) cfg.smtp.port = parseInt(env.SMTP_PORT, 10) || 465;
  if (env.SMTP_USER) cfg.smtp.user = env.SMTP_USER;
  if (env.SMTP_PASS) cfg.smtp.pass = env.SMTP_PASS;
  if (env.SMTP_TO) cfg.to = env.SMTP_TO;
  if (env.SMTP_FROM) cfg.from = env.SMTP_FROM;
  if (env.API_KEY) cfg.api.key = env.API_KEY;
  if (env.API_BASE_URL) cfg.api.baseUrl = env.API_BASE_URL;
  if (env.API_MODEL) cfg.api.model = env.API_MODEL;
  return cfg;
}

module.exports = { loadConfig, DEFAULT_SOURCES };
