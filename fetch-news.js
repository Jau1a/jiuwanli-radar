// 抓取新闻源，输出最近24-72小时国际新闻标题摘要（供AI生成选题）
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

let iconv = null;
try { iconv = require('iconv-lite'); } catch (e) { iconv = null; }

function get(url, charset, depth) {
  return new Promise((resolve, reject) => {
    if (depth > 3) return reject(new Error('重定向过多'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': '*/*'
      },
      timeout: 30000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return resolve(get(next, charset, (depth || 0) + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let text;
        try {
          text = (charset === 'gbk' && iconv) ? iconv.decode(buf, 'gbk') : buf.toString('utf8');
        } catch (e) {
          text = buf.toString('utf8');
        }
        resolve(text);
      });
    });
    req.on('timeout', () => req.destroy(new Error('超时')));
    req.on('error', reject);
  });
}

function normalizeTitle(t) {
  return t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseRssItems(text) {
  const items = [];
  const blocks = text.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
  for (const b of blocks) {
    const tm = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const dm = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || b.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
    const lm = b.match(/<link>([\s\S]*?)<\/link>/i);
    if (!tm) continue;
    let title = normalizeTitle(tm[1]);
    if (title.length < 8 || title.length > 80) continue;
    title = title.replace(/\s+-\s+[^-]{1,40}$/, '');
    items.push({
      title,
      link: lm ? normalizeTitle(lm[1]) : '',
      date: dm ? dm[1].trim() : ''
    });
  }
  return items;
}

function parseHtmlItems(text, src) {
  const items = [];
  // 优先按链接中的日期匹配（如 /gj/2026/10-11/123.shtml）
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const href = m[1];
    const title = normalizeTitle(m[2]);
    if (!title || title.length < 10 || title.length > 90) continue;
    if (!/[\u4e00-\u9fa5]/.test(title)) continue; // 必须含中文
    if (/首页|登录|注册|更多|导航|邮箱|广告|关于|APP|客户端|微博|微信|RSS|English|订阅|专题|图片|视频|评论|排行|热榜|推荐|精选|猜你|免责|举报|版权所有|京ICP|广播电视|['+]data\.|[\$\{]\s*data\.|javascript:|分享到|扫码|扫一扫|查看详情|全文|相关/.test(title)) continue;
    let date = '';
    if (src.dateRe) {
      try {
        const dm = href.match(new RegExp(src.dateRe));
        if (dm) date = dm[1] || dm[0];
      } catch (e) { /* 忽略无效正则 */ }
    }
    items.push({ title, link: href.startsWith('http') ? href : new URL(href, src.url).href, date });
  }
  return items;
}

function withinDays(dateStr, days) {
  if (!dateStr) return true; // 无日期信息则保留，交给AI判断
  const now = new Date();
  const isNew = (d) => (now - d) <= days * 86400000 && d <= now;
  // 紧凑形式 20261011
  const cm = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (cm) return isNew(new Date(+cm[1], +cm[2] - 1, +cm[3]));
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return isNew(d);
  // 支持 2026/10-11 或 2026-10-11 形式
  const mm = dateStr.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (!mm) return true;
  return isNew(new Date(+mm[1], +mm[2] - 1, +mm[3]));
}

async function getWithRetry(src, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await get(src.url, src.charset);
    } catch (e) {
      if (i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function fetchDigest(cfg) {
  const all = [];
  for (const src of cfg.sources) {
    try {
      const text = await getWithRetry(src);
      const items = src.type === 'rss' ? parseRssItems(text) : parseHtmlItems(text, src);
      for (const it of items.slice(0, cfg.maxItemsPerSource || 20)) {
        if (withinDays(it.date, 3)) all.push({ source: src.name, ...it });
      }
      console.log(`[fetch] ${src.name}: ${items.length} 条`);
    } catch (e) {
      console.log(`[fetch] ${src.name} 失败: ${e.message}`);
    }
  }
  // 去重（标题归一）
  const seen = new Set();
  const uniq = [];
  for (const it of all) {
    const key = it.title.replace(/[：:，,。\s]/g, '').slice(0, 20);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(it);
  }
  if (uniq.length === 0) return '';
  const lines = uniq.map((it) => `【${it.source}${it.date ? ' ' + it.date : ''}】${it.title}`);
  return lines.join('\n');
}

module.exports = { fetchDigest, get };
