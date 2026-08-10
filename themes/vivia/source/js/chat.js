/**
 * 聊天页 - 走 easymodelapi.zhidongli.top
 * 协议: OpenAI Chat Completions 兼容
 * 会话内保留上下文（不持久化，刷新即清空）
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const API_URL = 'https://easymodelapi.zhidongli.top/v1/chat/completions';
  const MAX_TURNS = 1000;

  // 清理旧版 localStorage 缓存
  try { localStorage.removeItem('vivia-chat-history-v1'); } catch (e) {}

  const form   = document.getElementById('chat-form');
  const input  = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  // 为按钮添加直接点击监听，直接调用发送逻辑
  sendBtn.addEventListener('click', e => {
  e.preventDefault(); // 阻止表单默认提交导致页面刷新
  console.log('send button clicked');
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
      if (typeof marked.setOptions === 'function') {
        marked.setOptions({ breaks: false, gfm: true, headerIds: false, mangle: false });
      }
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
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit', { cancelable: true }));
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

// 仍保留表单的 submit 监听以兼容回车，直接调用 sendMessage
form.addEventListener('submit', e => {
  console.log('Chat form submitted');
  e.preventDefault();
  sendMessage();
});

  updateSize();
});
