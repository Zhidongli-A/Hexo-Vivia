/**
 * 聊天页 - 走 easymodelapi.zhidongli.top
 * 协议: OpenAI Chat Completions 兼容
 * 会话内保留上下文（不持久化，刷新即清空）
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const API_URL = 'https://easymodelapi.zhidongli.top/v1/chat/completions';
  const MAX_TURNS = 1000;
  // 用于记录最近一次回答的耗时和 token 数
  let lastInfo = {duration: 0, tokens: 0};

  // 清理旧版 localStorage 缓存
  try { localStorage.removeItem('vivia-chat-history-v1'); } catch (e) {}

  const form   = document.getElementById('chat-form');
  const input  = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  // Ensure button does not触发表单提交
  sendBtn.setAttribute('type', 'button');
  sendBtn.addEventListener('click', e => {
    e.preventDefault();
    if (sendBtn.disabled) return;
    sendMessage();
  });

  const msgBox = document.getElementById('chat-messages');

  if (!form || !input || !sendBtn || !msgBox) return;

  const messages = [];

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function renderMarkdown(text) {
    if (typeof marked === 'undefined' || !marked || !marked.parse) return escapeHTML(text);
    const str = String(text);
    if (typeof katex === 'undefined' || !katex || !katex.renderToString) {
      try {
        if (typeof marked.setOptions === 'function') {
          marked.setOptions({ breaks: false, gfm: true, headerIds: false, mangle: false });
        }
        return marked.parse(str, { breaks: false, gfm: true });
      } catch (e) { return escapeHTML(str); }
    }
    const mathBlocks = [];
    const PH = '\u0000MATHBLOCK';
    let processed = str
      .replace(/<equation>([\s\S]*?)<\/equation>/gi, (m, body) => {
        const i = mathBlocks.length; mathBlocks.push({ display: true, body });
        return PH + i + '\u0000';
      })
      .replace(/```(?:math|latex|tex|katex)\s*([\s\S]*?)```/g, (m, body) => {
        const i = mathBlocks.length; mathBlocks.push({ display: true, body });
        return PH + i + '\u0000';
      })
      .replace(/(\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?)\}[\s\S]*?\\end\{(?:equation\*?|align\*?|gather\*?|multline\*?)\})/g, (m, body) => {
        const i = mathBlocks.length; mathBlocks.push({ display: true, body });
        return PH + i + '\u0000';
      })
      .replace(/\\\[([\s\S]*?)\\\]/g, (m, body) => {
        const i = mathBlocks.length; mathBlocks.push({ display: true, body });
        return PH + i + '\u0000';
      })
      .replace(/\$\$([\s\S]*?)\$\$/g, (m, body) => {
        const i = mathBlocks.length; mathBlocks.push({ display: true, body });
        return PH + i + '\u0000';
      })
      .replace(/\\\(([\s\S]*?)\\\)/g, (m, body) => {
        const i = mathBlocks.length; mathBlocks.push({ display: false, body });
        return PH + i + '\u0000';
      })
      .replace(/(^|[^\\$])\$[^\$\n]*[\\^_][^\$\n]*\$(?!\$)/g, (m, pre, body) => {
        const i = mathBlocks.length; mathBlocks.push({ display: false, body });
        return pre + PH + i + '\u0000';
      });
    let html;
    try {
      html = marked.parse(processed, { breaks: false, gfm: true });
    } catch (e) { return escapeHTML(str); }
    const re = new RegExp('\u0000MATHBLOCK(\\d+)\u0000', 'g');
    html = html.replace(re, (m, idx) => {
      const block = mathBlocks[parseInt(idx, 10)];
      try {
        return katex.renderToString(block.body, {
          displayMode: block.display,
          throwOnError: false
        });
      } catch (e) { return escapeHTML(block.body); }
    });
    return html;
  }
  const MAX_INPUT_HEIGHT = 66;

  function updateSize() {
    input.style.height = 'auto';
    const h = Math.min(MAX_INPUT_HEIGHT, Math.max(22, input.scrollHeight));
    input.style.height = h + 'px';
  }
  function scrollToBottom() {
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function appendUser(text) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg-user';
    wrap.innerHTML = '<div class="chat-bubble">' + escapeHTML(text) + '</div>';
    msgBox.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('chat-msg-in'));
    scrollToBottom();
    return wrap;
  }
  function renderMath(el) {
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
  }
  function appendBot(text) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg-bot';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-md';
    bubble.innerHTML = renderMarkdown(text);
    renderMath(bubble);
    // footer info directly appended after content
    const footer = document.createElement('div');
    footer.className = 'chat-footer';
    // small top margin for slight separation
    footer.style.cssText = 'color:#888;font-size:0.85em;margin-top:2px;';
    footer.textContent = `Gpt-Oss   回答耗时： ${lastInfo.duration}s   使用Token： ${(lastInfo.tokens/1000).toFixed(1)}K`;
    bubble.appendChild(footer);
    wrap.appendChild(bubble);
    msgBox.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('chat-msg-in'));
    scrollToBottom();
    return wrap;
  }
  function appendTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg-bot chat-msg-typing chat-msg-in';
    wrap.innerHTML = '<div class="chat-bubble chat-bubble-typing"><span class="chat-dot"></span><span class="chat-dot"></span><span class="chat-dot"></span></div>';
    msgBox.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  input.addEventListener('input', updateSize);
  // 按 Enter 直接发送，不触发表单提交
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

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
      // 计算耗时（秒）和 token 使用（K）
      const durationSec = ((Date.now() - fetchStart) / 1000).toFixed(2);
      const tokens = (data && data.usage && data.usage.total_tokens) ? data.usage.total_tokens : 0;
      lastInfo = {duration: durationSec, tokens: tokens};
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



  updateSize();
});
