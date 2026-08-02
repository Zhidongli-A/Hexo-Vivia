---
layout: post
title: 用Github Actions构建并推送Docker镜像
date: 2026-08-02 14:30:00
categories: 傻瓜教程
description: 让你的GitHub项目一push代码，便自动构建多架构Docker镜像并发布到Docker Hub，全程无需人工干预。
---
>危险:本期教程并非新手向教程，适合有一定项目开发基础的读者。

### 1. 编写 Dockerfile

需要根据您的项目类型（Python、Node.js、Go、Java 等）编写对应的 `Dockerfile`。

同时创建 `.dockerignore` 文件，排除不需要打入镜像的内容。

下面是 `Dockerfile` 中常用指令的含义，您可以根据自己的项目类型替换示例中的内容：

1. `FROM 镜像`：指定基础镜像。Python 项目常用 `python:3.11-slim`，Node.js 项目常用 `node:20-alpine`，Go 项目常用 `golang:1.22-alpine`。
2. `ARG 名称=默认值`：声明构建参数，常用于在构建时传入版本号、构建时间等标签信息。
3. `ENV 名称=值`：设置环境变量，容器启动后依然生效，可供应用读取。
4. `WORKDIR 路径`：指定容器内的工作目录，相当于进入该目录。
5. `COPY 源 目标`：将宿主机上的文件或目录复制进镜像中。
6. `RUN 命令`：在镜像构建过程中执行命令，常用于安装依赖、编译代码等。
7. `EXPOSE 端口`：声明容器运行时需要监听的端口，便于使用者参考。
8. `CMD ["..."]`：指定容器启动时默认执行的命令，通常是运行启动脚本或主程序。

>将以上命令按顺序编写在 `Dockerfile` 中，并根据实际情况修改参数、增加命令，即可得到一个完整可用的文件。
---

### 2. 创建 Docker Hub Access Token

为了避免在 GitHub Actions 中明文存放 Docker Hub 密码，建议使用 **Access Token**。

操作步骤：

1. 登录 [Docker Hub](https://hub.docker.com/)
2. 点击右上角头像 → **Account Settings**
3. 切换到 **Security** 选项卡
4. 点击 **New Access Token**，输入描述（如 `github-actions`），权限选择 **Read & Write**
5. 点击 **Generate**，**立即复制并妥善保存**该 Token（页面关闭后无法再次查看）

---

### 3. 在 GitHub 仓库中配置 Secrets

进入目标仓库页面，依次点击 **Settings → Secrets and variables → Actions → New repository secret**，依次添加以下两个密钥：

* **DOCKERHUB_USERNAME**：您的 Docker Hub 用户名
* **DOCKERHUB_TOKEN**：上一步生成的 Access Token

> Secrets 一旦保存将无法再次查看其明文内容，请妥善保存。

---

### 4. 编写 GitHub Actions 工作流

在项目根目录下创建 `.github/workflows/docker-push.yml`：

下载[GitHub Actions 工作流配置文件](/Resource/docker-push.yml)并根据您的项目和个人信息进行修改。

> 下载后请**务必**将配置中的 `UserName` 替换为您的 Docker Hub 用户名，`ImageName` 替换为您要发布的镜像名称（例如 `myapp/api-server`）。

下面对工作流中的关键部分做简要说明：

- **触发条件**：push 到 `main` / `master` 分支、推送 `v*` 形式的 Tag、PR、以及手动触发，均会启动构建。其中 PR 只会构建镜像，**不会推送**，可用于验证 Dockerfile 是否正确。
- **多架构构建**：`platforms: linux/amd64,linux/arm64` 表示同时构建 Intel/AMD 和 ARM 架构镜像。
- **自动 Tag**：`docker/metadata-action` 会根据触发条件自动生成合理的 Tag，包括分支名、PR 号、SemVer 版本号以及默认分支的 `latest`。
- **构建缓存**：使用 `cache-from: type=gha` 与 `cache-to: type=gha,mode=max` 将构建缓存存储在 GitHub 内部，后续构建速度可提升数倍。


> 当您熟悉这套流程后，可以将其复用到其他任意项目，无论是什么类型的项目，配置文件几乎无需修改即可直接使用。
