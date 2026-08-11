/**
 * 重构聊天页面脚本 - 保持原有功能与样式
 * 兼容 OpenAI Chat Completions 接口
 * 功能：发送、接收、渲染 Markdown 与 LaTeX、显示耗时/Token 信息
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ---------- 配置 ----------
  const API_URL = 'https://easymodelapi.zhidongli.top/v1/chat/completions';
  const MAX_TURNS = 1000; // 对话最大轮数（每轮包含用户+AI）
  const MAX_INPUT_HEIGHT = 66; // 输入框最大高度(px)

  // ---------- 状态 ----------
  let lastInfo = { duration: 0, tokens: 0 };
  const messages = [];

  // ---------- DOM 元素 ----------
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const msgBox = document.getElementById('chat-messages');

  // 防止表单实际提交导致页面刷新
if (form) {
  form.removeAttribute('action'); // remove any action attribute
  form.addEventListener('submit', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { capture: true });
}
// 按钮必须是普通 button，防止默认提交
if (sendBtn) {
  sendBtn.type = 'button'; // directly set type property
}

  // ---------- 工具函数 ----------
  const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]));

  const renderMarkdown = text => {
    if (typeof marked === 'undefined' || !marked || !marked.parse) return escapeHTML(text);
    const raw = String(text);
    // 如果 KaTeX 不可用，仅使用 marked
    if (typeof katex === 'undefined' || !katex || !katex.renderToString) {
      try {
        if (typeof marked.setOptions === 'function') {
          marked.setOptions({ breaks: false, gfm: true, headerIds: false, mangle: false });
        }
        return marked.parse(raw, { breaks: false, gfm: true });
      } catch (e) { return escapeHTML(raw); }
    }
    // KaTeX 可用时，先抽取数学块再交给 marked
    const mathBlocks = [];
    const PH = '\u0000MATHBLOCK';
    const processed = raw
      .replace(/<equation>([\s\S]*?)<\/equation>/gi, (m, b) => { mathBlocks.push({ display: true, body: b }); return PH + (mathBlocks.length - 1) + '\u0000'; })
      .replace(/```(?:math|latex|tex|katex)\s*([\s\S]*?)```/g, (m, b) => { mathBlocks.push({ display: true, body: b }); return PH + (mathBlocks.length - 1) + '\u0000'; })
      .replace(/(\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?)\}[\s\S]*?\\end\{(?:equation\*?|align\*?|gather\*?|multline\*?)\})/g, (m, b) => { mathBlocks.push({ display: true, body: b }); return PH + (mathBlocks.length - 1) + '\u0000'; })
      .replace(/\\\[([\s\S]*?)\\\]/g, (m, b) => { mathBlocks.push({ display: true, body: b }); return PH + (mathBlocks.length - 1) + '\u0000'; })
      .replace(/\$\$([\s\S]*?)\$\$/g, (m, b) => { mathBlocks.push({ display: true, body: b }); return PH + (mathBlocks.length - 1) + '\u0000'; })
      .replace(/\\\(([\s\S]*?)\\\)/g, (m, b) => { mathBlocks.push({ display: false, body: b }); return PH + (mathBlocks.length - 1) + '\u0000'; })
      .replace(/(^|[^\\$])\$([^\$\n]*?)[\^_][^\$\n]*\$(?!\$)/g, (m, pre, b) => { mathBlocks.push({ display: false, body: b }); return pre + PH + (mathBlocks.length - 1) + '\u0000'; });
    let html;
    try {
      html = marked.parse(processed, { breaks: false, gfm: true });
    } catch (e) { return escapeHTML(raw); }
    const re = new RegExp('\u0000MATHBLOCK(\\d+)\u0000', 'g');
    return html.replace(re, (m, idx) => {
      const blk = mathBlocks[parseInt(idx, 10)];
      try {
        return katex.renderToString(blk.body, { displayMode: blk.display, throwOnError: false });
      } catch (e) { return escapeHTML(blk.body); }
    });
  };

  const updateSize = () => {
    input.style.height = 'auto';
    const h = Math.min(MAX_INPUT_HEIGHT, Math.max(22, input.scrollHeight));
    input.style.height = h + 'px';
  };

  const scrollToBottom = () => {
    msgBox.scrollTop = msgBox.scrollHeight;
  };

  const renderMath = el => {
    if (typeof renderMathInElement === 'undefined' || !el) return;
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      });
    } catch (e) {}
  };

  const appendUser = text => {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg-user';
    wrap.innerHTML = '<div class="chat-bubble">' + escapeHTML(text) + '</div>';
    msgBox.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('chat-msg-in'));
    scrollToBottom();
    return wrap;
  };

  const appendBot = text => {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg-bot';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-md';
    bubble.innerHTML = renderMarkdown(text);
    renderMath(bubble);
    const footer = document.createElement('div');
    footer.className = 'chat-footer';
    footer.style.cssText = 'color:#888;font-size:0.85em;margin-top:2px;';
    footer.textContent = `Gpt-Oss 回答耗时:${lastInfo.duration}s 使用Token:${(lastInfo.tokens/1000).toFixed(1)}K`;
    bubble.appendChild(footer);
    wrap.appendChild(bubble);
    msgBox.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('chat-msg-in'));
    scrollToBottom();
    return wrap;
  };

  const appendTyping = () => {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg-bot chat-msg-typing chat-msg-in';
    wrap.innerHTML = '<div class="chat-bubble chat-bubble-typing"><span class="chat-dot"></span><span class="chat-dot"></span><span class="chat-dot"></span></div>';
    msgBox.appendChild(wrap);
    scrollToBottom();
    return wrap;
  };

  // ---------- 事件绑定 ----------
  input.addEventListener('input', updateSize);
  input.addEventListener('keydown', e => {
    const isImeComposing = e.isComposing || e.keyCode === 229;
    const isEnter = e.key === 'Enter' || e.keyCode === 13;
    if (isEnter && !e.shiftKey && !isImeComposing) {
      e.preventDefault();
      sendMessage();
    }
  });
  // 防止在 textarea 中 Enter 仍产生换行（兼容部分浏览器）
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
    }
  });
  if (sendBtn) {
  sendBtn.addEventListener('click', e => {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    });
  }

    // ---------- 消息发送 ----------
  function sendMessage() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;

    input.value = '';
    input.scrollTop = 0;
    updateSize();

    const stale = msgBox.querySelector('.chat-msg-typing');
    if (stale) stale.remove();

    messages.push({ role: 'user', content: text });
    if (messages.length > MAX_TURNS * 2) {
      messages.splice(0, messages.length - MAX_TURNS * 2);
    }

    appendUser(text);
    sendBtn.disabled = true;
    const typing = appendTyping();

    const fetchStart = Date.now();
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice() })
    })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        const reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '（无回复）';
        const durationSec = ((Date.now() - fetchStart) / 1000).toFixed(2);
        const tokens = (data && data.usage && data.usage.total_tokens) ? data.usage.total_tokens : 0;
        lastInfo = { duration: durationSec, tokens: tokens };
        messages.push({ role: 'assistant', content: reply });
        typing.remove();
        appendBot(reply);
      })
      .catch(err => {
        console.error('Chat fetch error:', err);
        if (typing && typing.remove) typing.remove();
      })
      .finally(() => {
        sendBtn.disabled = false;
        input.focus();
        updateSize();
      });
  }

  // 初始化输入框高度
  updateSize();
});