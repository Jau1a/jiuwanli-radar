// 本地检查配置加载（掩码显示密钥）
const { loadConfig } = require('./load-config');
const cfg = loadConfig();
console.log('smtp.host :', cfg.smtp.host);
console.log('smtp.user :', cfg.smtp.user);
console.log('smtp.pass :', cfg.smtp.pass ? '(已设置)' : '(空)');
console.log('to        :', cfg.to);
console.log('api.key   :', cfg.api.key ? '已设置(' + cfg.api.key.slice(0, 6) + '…)' : '(空)');
console.log('sources   :', cfg.sources.length, '个');
