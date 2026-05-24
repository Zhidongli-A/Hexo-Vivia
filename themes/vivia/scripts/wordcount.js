hexo.extend.helper.register('symbolsCount', function (post) {
    let content = post.content;
    if (!content) return 0;
    // 去除 HTML 标签，保留纯文本
    let text = content.replace(/<[^>]*>/g, '');
    // 去除空格和换行
    text = text.replace(/\s+/g, '');
    return text.length;
});
