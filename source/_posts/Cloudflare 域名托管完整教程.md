---
layout: post
title: Cloudflare 域名托管完整教程
date: 2026-02-24 21:00:00
categories: 傻瓜教程
description: 教你把域名托管至Cloudflare。
---

Cloudflare 是全球领先的 CDN 和 DNS 服务提供商，提供免费的域名解析、SSL 证书、DDoS 防护等功能。本文将手把手教你完成域名托管的全流程。

---

### 注册 Cloudflare 账号

访问 [Cloudflare 官网](https://www.cloudflare.com)，点击右上角 **Sign Up** 按钮。

填写注册信息：
- **Email**: 输入你的邮箱地址
- **Password**: 设置强密码

点击 **Create Account** 完成注册，然后登录邮箱点击验证链接激活账号。

---

### 添加域名到 Cloudflare

登录 Cloudflare 后，点击 **Add a Site** 按钮。

在输入框中输入你的域名（例如 `example.com`），点击 **Continue**。

选择 **Free** 套餐即可，点击 **Continue with Free**。

Cloudflare 会自动扫描你域名的现有 DNS 记录，请检查并确认记录是否正确。

---

### 修改域名 NameServer 服务器

在 DNS 记录确认页面，Cloudflare 会分配两个 NameServer 服务器地址


记录下这两个地址，然后登录你的域名注册商，将域名的  NameServer 服务器修改为 Cloudflare 提供的地址。

NameServer 回到 Cloudflare，点击 **Done, check nameservers**，Cloudflare 会自动检测 NameServer 是否修改成功。

---

### 开启内容分发网络

在 Cloudflare 的 **DNS** 设置页面，找到 **Proxy status** 列。

确保显示为 **Proxied**，这表示 Cdn 已启用。如果显示 **DNS only**（灰色云朵），点击切换到 **Proxied**。


---

### 开启 SSL 证书

点击顶部菜单 **SSL/TLS**，进入 SSL 设置页面。

然后选择 **Flexible**。

进入 **SSL/TLS** → **Edge Certificates**：
- 开启 **Always Use HTTPS**: 强制所有 HTTP 请求重定向到 HTTPS
- 开启 **Automatic HTTPS Rewrites**: 自动将页面中的 HTTP 链接重写为 HTTPS

---
