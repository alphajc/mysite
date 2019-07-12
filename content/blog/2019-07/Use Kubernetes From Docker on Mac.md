+++

author = "Jerry Chan"
categories = ["信息技术"]
tags = ["Mac","Docker", "Kubernetes"]
date = "2019-07-12T20:23:13+08:00"
description = "由于 kubernetes 官方镜像仓库被墙，所以在国内想要直接使用 Docker 自带的 kubernetes 要费一番功夫，本文是方法"
featured = "docker-tutorial.png"
featuredalt = ""
featuredpath = "assets/blog/2019-07"
title = "在 Mac 上使用 Docker 自带的 Kubernetes"
type = "post"

+++

Mac 安装 Docker 的方法不再赘述，很简单，[官方下载](https://download.docker.com/mac/stable/Docker.dmg)安装即可。

安装完成后，`kubectl`的二进制文件就已经存在了。我们仅需要下载镜像，开启 kubernetes。

## 下载镜像

查看一下你的 Docker 和 Kubernetes 版本：

<!-- ![About Version](/assets/blog/2019-07/k8s_from_docker.png) -->
{{< fancybox "/assets/blog/2019-07/" "k8s_from_docker.png" "About Version" "gallery" >}}

使用{{< url-link "以下脚本" "https://gist.github.com/canovie/ad56aa01da685d665c856551c4d18baf">}}，记得将镜像版本改成你所需要的:maple_leaf:

```bash
#!/bin/bash

set -e 
KUBE_VERSION=v1.10.11
KUBE_PAUSE_VERSION=3.1
ETCD_VERSION=3.1.12
DNS_VERSION=1.14.8
DOCKER_TOOL_VERSION=v0.4.12

GCR_URL=k8s.gcr.io
ALIYUN_URL=registry.cn-hangzhou.aliyuncs.com/google_containers

images=(kube-proxy-amd64:${KUBE_VERSION}
kube-scheduler-amd64:${KUBE_VERSION}
kube-controller-manager-amd64:${KUBE_VERSION}
kube-apiserver-amd64:${KUBE_VERSION}
pause-amd64:${KUBE_PAUSE_VERSION}
etcd-amd64:${ETCD_VERSION}
k8s-dns-sidecar-amd64:${DNS_VERSION}
k8s-dns-kube-dns-amd64:${DNS_VERSION}
k8s-dns-dnsmasq-nanny-amd64:${DNS_VERSION})

for image in ${images[@]} ; do
  docker pull ${ALIYUN_URL}/${image}
  docker tag ${ALIYUN_URL}/${image} ${GCR_URL}/${image}
  docker rmi ${ALIYUN_URL}/${image}
done

# 拉取 Docker 相关镜像
docker pull docker/kube-compose-api-server:${DOCKER_TOOL_VERSION}
docker pull docker/kube-compose-controller:${DOCKER_TOOL_VERSION}
```

执行该脚本，将从阿里镜像库获得所需镜像。

## 启动 Kubernetes 功能

打开 Docker 配置面板，请至少勾选 Enable Kubernetes 以开启 Kubernetes 服务。

<!-- {{< img-post "/assets/blog/2019-07/" "start_k8s.png" "Start Kubenetes" "right" >}} -->
{{< fancybox "/assets/blog/2019-07/" "start_k8s.png" "Start Kubernetes" "gallery" >}}
<!-- ![Start Kubenetes](/assets/blog/2019-07/start_k8s.png) -->

开启片刻后，你将看到 Docker Engine 和 Kubernetes 同时处于`running`状态。

## 查看 Kubernetes 服务

输入`kubectl get pods --all-namespaces`，你将看到：
```bash
➜  ~ kubectl get pods --all-namespaces
NAMESPACE     NAME                                         READY     STATUS    RESTARTS   AGE
docker        compose-74649b4db6-bjw57                     1/1       Running   0          1m
docker        compose-api-597cc7786b-vpnnk                 1/1       Running   0          1m
kube-system   etcd-docker-for-desktop                      1/1       Running   0          2m
kube-system   kube-apiserver-docker-for-desktop            1/1       Running   0          2m
kube-system   kube-controller-manager-docker-for-desktop   1/1       Running   0          2m
kube-system   kube-dns-86f4d74b45-n55kv                    3/3       Running   0          2m
kube-system   kube-proxy-dgwfm                             1/1       Running   0          2m
kube-system   kube-scheduler-docker-for-desktop            1/1       Running   0          1m
```
至此，你就可以尽情享受 Kubernetes 带给你的乐趣了:tada::palm_tree::tada: