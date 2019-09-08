+++

author = "Jerry Chan"
categories = ["技术"]
tags = ["kubernetes", "gitlab"]
date = "2019-09-08T18:37:36+08:00"
description = "gitlab 作为代码仓库，连接 kubernetes 中的 gitlab-runner 以实现自动化构建的基础环境。有关 gitlab-runner 的中文文档其实不多，本文将对 gitlab-runner 的使用进行简要介绍。"
featured = "GitLab-Kubernetes-Running-CI-Runners-in-Kubernetes.png"
featuredalt = ""
featuredpath = "assets/blog/2019-09"
title = "自动化运维之自动构建"
type = "post"

+++

按例需要说明的是本人水平有限，我会尽量保证文章准确无误，但如果不幸产生任何错误，望不吝赐教。

## 浅析 gitlab-runner 相关配置

在 gitlab-runner 中每个 runner 都需要指定 [executor](https://docs.gitlab.com/runner/executors/)，executor 有以下几种类型：

- SSH
- Shell
- Parallels
- VirtualBox
- Docker
- Docker Machine (auto-scaling)
- Kubernetes
- Custom

我们会将 gitlab-runner 部署在 kubernetes 集群中，所以此处选用 kubernetes 作为 executor。有关该 executor 的配置方式，在[官方文档](https://docs.gitlab.com/runner/executors/kubernetes.html)中有详细说明，此处就此次配置所需要的进行简单说明，其它的再视情况进行补充。

与其它类型的 executor 一样，kubernetes 也需要根据 gitlab 仓库的 url 和 token 对 runner 进行注册方可使用。注册后会有一个常驻的 pod （我姑且叫它 runner 服务器）对来自于 gitlab 的 pipeline 任务进行监听，当监听到有新的任务需要执行时，就会创建新的 pipeline 跑 `.gitlab-ci.yml` 上对应的job。所以 runner 服务器相关联的 ServieAccount 一定需要具备对应的 namespace 的 pod 的创建的权限。

配置一个 runner 有多种方式，包括启动参数、环境变量、配置文件等。

## 使用 helm 安装 gitlab-runner

## 浅析 `.gitlab-ci.yml` 相关配置

## 配置 `.gitlab-ci.yml`

## 最终效果
