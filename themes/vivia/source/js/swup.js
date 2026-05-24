/**
 * Swup - 动态页面切换 & 丝滑过渡
 */
(function () {
  'use strict';

  // Giscus MutationObserver 引用，用于在页面切换时断开
  var _giscusObserver = null;

  function initSwup() {
    // Swup 已在全局通过 CDN 加载
    if (typeof Swup === 'undefined') {
      console.warn('Swup not loaded yet, retrying...');
      setTimeout(initSwup, 200);
      return;
    }

    const swup = new Swup({
      containers: ['#swup'],
      animateHistoryBrowsing: true,
      linkSelector:
        'a[href^="' +
        window.location.origin +
        '"]:not([data-no-swup]):not([target="_blank"]):not([href*=".pdf"]):not([href*=".zip"]):not([href^="#"]):not([href^="mailto:"]):not([href^="tencent:"]):not([href*="javascript:"]), ' +
        'a[href^="/"]:not([data-no-swup]):not([target="_blank"]):not([href*=".pdf"]):not([href*=".zip"]):not([href^="#"]):not([href^="mailto:"]):not([href^="tencent:"]):not([href*="javascript:"]), ' +
        'a[href^="' +
        window.location.pathname.replace(/\/[^/]*$/, '/') +
        '"]:not([data-no-swup]):not([target="_blank"])',
    });

    // --- 动画开始前，清理旧页面资源 ---
    swup.on('willReplaceContent', function () {
      var dropdown = document.getElementById('nav-dropdown');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
      }
      // 断开旧页面的 Giscus MutationObserver
      destroyGiscus();
    });

    // --- 页面内容替换后，重新绑定/初始化 ---
    swup.on('contentReplaced', function () {
      // 修复是/否首页时导航栏高度
      var nav = document.getElementById('nav');
      if (nav) {
        var path = window.location.pathname;
        var isRoot = path === '/' || path === '/index.html' || path === '';
        if (isRoot) {
          nav.classList.add('is_home');
        } else {
          nav.classList.remove('is_home');
        }
      }

      reInitPageContent();
    });

    // 初始加载：状态页数据获取（放 applyStagger 之前）
    if (typeof fetchStatus === 'function' && document.getElementById('status-container')) {
      fetchStatus();
    }

    // 初始加载也应用 stagger 入场，并初始化 Giscus
    applyStagger();
    initGiscus();
  }

  /**
   * 重新初始化页面中需要动态绑定的功能
   * 这些功能在 Swup 替换内容后需要重新执行
   */
  function reInitPageContent() {
    // 1. 重新绑定文章图片点击放大 (fancybox)
    initImageGallery();

    // 2. 重新执行文章内嵌的所有 <script> 标签
    reExecuteScripts();

    // 2.5 在入场动画前主动获取状态数据，避免加载状态抖动
    // 通过检查 #status-container 判断当前页面是否为状态页
    // 使用重试机制：status.js 可能通过 reExecuteScripts 异步加载还未就绪
    //（例如从主页跳转过来时，主页未加载 status.js，fetchStatus 尚未定义）
    if (document.getElementById('status-container')) {
      if (typeof fetchStatus === 'function') {
        fetchStatus();
      } else {
        var _statusRetry = setInterval(function() {
          if (typeof fetchStatus === 'function') {
            clearInterval(_statusRetry);
            fetchStatus();
          }
        }, 50);
        // 最长等待 3 秒，防止无限重试
        setTimeout(function() { clearInterval(_statusRetry); }, 3000);
      }
    }

    // 3. 子元素逐个入场 (stagger)
    applyStagger();

    // 4. 初始化 Giscus 评论（通过 data-* 配置）
    initGiscus();

    // 5. 重新为代码块添加复制按钮等 (如果存在)
    // (预留)
  }

  /** 获取当前亮/暗主题 */
  function getGiscusTheme() {
    return document.documentElement.getAttribute('theme') === 'dark' ? 'dark' : 'light';
  }

  /** 向 Giscus iframe 发送主题更新消息 */
  function sendGiscusTheme(theme) {
    var iframe = document.querySelector('iframe.giscus-frame');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        { giscus: { setConfig: { theme: theme } } },
        'https://giscus.app'
      );
    }
  }

  /**
   * 初始化 Giscus 评论
   * 从 #giscus-container 的 data-* 属性读取配置
   */
  function initGiscus() {
    var container = document.getElementById('giscus-container');
    if (!container) return;

    // 避免重复注入
    if (container.querySelector('script')) return;

    var theme = getGiscusTheme();

    var script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', container.getAttribute('data-repo'));
    script.setAttribute('data-repo-id', container.getAttribute('data-repo-id'));
    script.setAttribute('data-category', container.getAttribute('data-category'));
    script.setAttribute('data-category-id', container.getAttribute('data-category-id'));
    script.setAttribute('data-mapping', container.getAttribute('data-mapping'));
    script.setAttribute('data-strict', container.getAttribute('data-strict'));
    script.setAttribute('data-reactions-enabled', container.getAttribute('data-reactions-enabled'));
    script.setAttribute('data-emit-metadata', container.getAttribute('data-emit-metadata'));
    script.setAttribute('data-input-position', container.getAttribute('data-input-position'));
    script.setAttribute('data-theme', theme);
    script.setAttribute('data-lang', container.getAttribute('data-lang'));
    script.setAttribute('data-loading', container.getAttribute('data-loading'));
    script.crossOrigin = 'anonymous';
    script.async = true;
    container.appendChild(script);

    // 监听亮/暗主题切换，同步给 Giscus
    _giscusObserver = new MutationObserver(function () {
      var newTheme = getGiscusTheme();
      sendGiscusTheme(newTheme);
    });
    _giscusObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['theme'] });

    // 监听 Giscus iframe 加载，确保新创建的 iframe 获得当前主题
    var iframeObserver = new MutationObserver(function () {
      var iframe = container.querySelector('iframe.giscus-frame');
      if (iframe) {
        iframe.addEventListener('load', function () {
          sendGiscusTheme(getGiscusTheme());
        });
        iframeObserver.disconnect();
      }
    });
    iframeObserver.observe(container, { childList: true, subtree: true });
  }

  /** 断开 Giscus 的 MutationObserver */
  function destroyGiscus() {
    if (_giscusObserver) {
      _giscusObserver.disconnect();
      _giscusObserver = null;
    }
  }

  /**
   * 为 #swup 的直接子元素添加逐个入场动画
   * 每个子元素按索引延迟 0.06s
   */
  function applyStagger() {
    var container = document.getElementById('swup');
    if (!container) return;
    var children = container.children;
    for (var i = 0; i < children.length; i++) {
      children[i].style.setProperty('animation-delay', (i * 0.06).toFixed(3) + 's');
    }
    // 下一帧标记，触发 CSS stagger 动画
    requestAnimationFrame(function () {
      container.classList.add('stagger-ready');
    });
  }

  /**
   * 文章图片 fancybox 包装 (移植自 script.js)
   */
  function initImageGallery() {
    var entries = document.querySelectorAll('.article-entry');
    if (!entries.length) return;

    entries.forEach(function (entry, i) {
      var imgs = entry.querySelectorAll('img');
      imgs.forEach(function (img) {
        // 跳过已被 fancybox 包裹或已在 <a> 内的图片
        if (img.parentElement.classList.contains('fancybox') || img.parentElement.tagName === 'A') return;

        var alt = img.alt;
        if (alt) {
          var caption = document.createElement('span');
          caption.className = 'caption';
          caption.textContent = alt;
          img.parentNode.insertBefore(caption, img.nextSibling);
        }

        var link = document.createElement('a');
        link.href = img.src;
        link.setAttribute('data-fancybox', 'gallery');
        link.setAttribute('data-caption', alt || '');
        img.parentNode.insertBefore(link, img);
        link.appendChild(img);
      });

      // 为已有 fancybox 元素设置 rel 属性
      var fancyItems = entry.querySelectorAll('.fancybox');
      fancyItems.forEach(function (item) {
        item.setAttribute('rel', 'article' + i);
      });
    });

    // 如果 fancybox 已加载，重新绑定
    if (typeof jQuery !== 'undefined' && jQuery.fancybox) {
      if (typeof jQuery.fancybox === 'function') {
        // fancybox v2
      } else {
        // fancybox v3+
        try {
          jQuery('[data-fancybox]').fancybox();
        } catch (e) {
          // 静默处理
        }
      }
    }
  }

  /**
   * 重新执行 #swup 内的 <script> 标签
   * Swup 默认不会执行替换内容中的内联脚本
   */
  function reExecuteScripts() {
    var scripts = document.querySelectorAll('#swup script');
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement('script');
      // 复制所有属性
      Array.from(oldScript.attributes).forEach(function (attr) {
        newScript.setAttribute(attr.name, attr.value);
      });
      // 复制内联代码
      newScript.textContent = oldScript.textContent;
      // 替换旧脚本触发执行
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  /**
   * 拦截指向当前页面的链接，避免 Swup 重复播放动画
   * 使用 capture 阶段在 Swup 的 handler 之前拦截
   */
  function preventSamePageSwup(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;

    try {
      var linkUrl = new URL(link.getAttribute('href'), window.location.origin);
      var currentUrl = new URL(window.location.href);

      // 标准化路径：移除末尾斜杠再比较
      var linkPath = linkUrl.pathname.replace(/\/+$/, '');
      var currentPath = currentUrl.pathname.replace(/\/+$/, '');

      if (linkPath === currentPath && linkUrl.search === currentUrl.search) {
        e.stopPropagation();
        e.preventDefault();
      }
    } catch (err) {
      // URL 无效时静默忽略
    }
  }
  document.addEventListener('click', preventSamePageSwup, true);

  // DOM 就绪后初始化 Swup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSwup);
  } else {
    initSwup();
  }
})();
