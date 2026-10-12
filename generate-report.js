// 调用大模型API，按九万里口味生成选题推荐报告；内置"原题照抄"防幻觉校验，不通过自动重写一次
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function postJson(url, apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error('API HTTP ' + res.statusCode + ': ' + text.slice(0, 300)));
        resolve(text);
      });
    });
    req.on('timeout', () => req.destroy(new Error('API超时')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const norm = (s) => String(s).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');

// 校验报告中的【原题】有多少能在新闻列表中匹配
function verifyAgainstDigest(report, digest) {
  const digestNorm = norm(digest);
  const quoted = [...report.matchAll(/【原题[：:]([^】\n]+)】/g)].map((m) => m[1].trim());
  const usable = quoted.filter((q) => q.length >= 6);
  if (usable.length === 0) return { ok: false, matched: 0, total: 0 };
  let matched = 0;
  for (const q of usable) {
    const qn = norm(q);
    // 去掉可能带上的【来源 日期】前缀再比一次
    const qn2 = qn.replace(/^[^【\]]{2,40}?(?=20\d{6}|20\d{2}[\/-]\d)/, '');
    if ((qn.length >= 8 && digestNorm.includes(qn)) || (qn2.length >= 8 && digestNorm.includes(qn2))) matched++;
  }
  return { ok: matched / usable.length >= 0.6, matched, total: usable.length };
}

async function callOnce(cfg, prompt, extraUser) {
  const payload = {
    model: (cfg.api.model || 'deepseek-chat'),
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: extraUser || '请基于新闻列表输出今日选题推荐。' }
    ],
    temperature: 0.2,
    max_tokens: 4096
  };
  const resp = await postJson(cfg.api.baseUrl.replace(/\/+$/, '') + '/chat/completions', cfg.api.key, payload);
  let data;
  try { data = JSON.parse(resp); } catch (e) { throw new Error('API返回非JSON: ' + resp.slice(0, 200)); }
  if (!data.choices || !data.choices[0] || !data.choices[0].message) throw new Error('API返回结构异常: ' + resp.slice(0, 300));
  return data.choices[0].message.content.trim();
}

async function callOnceWithRetry(cfg, prompt, extraUser) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await callOnce(cfg, prompt, extraUser);
    } catch (e) {
      if (attempt === 2) throw e;
      console.log('[gen] API调用失败(' + e.message + ')，10秒后重试…');
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

async function generateReport(cfg, digest, dateStr) {
  if (!cfg.api || !cfg.api.key) throw new Error('未配置 api.key，请在 config.json 填入模型API密钥');
  let prompt = fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf8');
  prompt = prompt.replace(/\{\{DATE\}\}/g, dateStr).replace(/\{\{DIGEST\}\}/g, digest);

  let report = await callOnceWithRetry(cfg, prompt);
  let check = verifyAgainstDigest(report, digest);
  if (!check.ok) {
    console.log(`[gen] 原题校验不通过(${check.matched}/${check.total})，自动重写一次…`);
    const fix = '上一版输出中部分【原题】与新闻列表不一致，请重新生成：每条【原题】必须一字不差照抄新闻列表中某条的标题，找不到对应条目的选题直接删除，严禁使用列表之外的新闻。';
    report = await callOnceWithRetry(cfg, prompt, fix);
    check = verifyAgainstDigest(report, digest);
    if (!check.ok) {
      console.log(`[gen] 重写后仍不通过(${check.matched}/${check.total})，已加注人工核对提示`);
      report = '⚠ 本期部分条目未能通过"原题照抄"校验，请人工核对后再用。\n\n' + report;
    }
  } else {
    console.log(`[gen] 原题校验通过 (${check.matched}/${check.total})`);
  }
  return report;
}

module.exports = { generateReport, verifyAgainstDigest };
