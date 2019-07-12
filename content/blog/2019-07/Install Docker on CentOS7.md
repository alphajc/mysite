+++

author = "Jerry Chan"
categories = ["信息技术"]
tags = ["Container", "Docker", "CentOS7"]
date = "2019-07-12T10:46:25+08:00"
description = "使用国内源在 CentOS 7 上安装和删除最新版 Docker CE 的简单教程。"
featured = "docker-tutorial.png"
featuredalt = "docker-tutorial"
featuredpath = "assets/blog/2019-07"
title = "在 CentOS7 上安装新版 Docker CE（使用国内源）"
type = "post"

+++

## 卸载老版本

```bash
$ sudo yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine
```
如果曾经安装过，`/var/lib/docker/`中会有原来的镜像、容器、卷以及网络残留，如果不需要可将之一并删除。

## 安装 Docker CE
### 安装 Docker 国内源
1. 安装 yum 配置管理工具
    
    ```bash
    $ sudo yum install -y yum-utils \
    device-mapper-persistent-data \
    lvm2
    ```
2. 安装清华大学的 Docker 安装源（本网站有效，该命令就有效）

    ```bash
    $ sudo yum-config-manager \
    --add-repo \
    https://mydream.ink/utils/container/docker-ce.repo
    ```
    你可能会遇到如下问题：

        adding repo from: https://mydream.ink/utils/container/docker-ce.repo
        grabbing file https://mydream.ink/utils/container/docker-ce.repo to /etc/yum.repos.d/docker-ce.repo
        Could not fetch/save url https://mydream.ink/utils/container/docker-ce.repo to file /etc/yum.repos.d/docker-ce.repo: [Errno 14] curl#60 - "Peer's Certificate has expired."

    出现该问题一般是由于本地时间不正确（经常挂起的虚拟机很容易出现），使用`date`命令核对一下时间即可，若确认是这个问题，则：
    ```bash
    $ sudo ntpdate pool.ntp.org # ntpdate 可使用 yum install ntpdate 进行安装
    ```

## 安装 Docker CE

1. 安装最新版的 Docker CE
    
    ```bash
    $ sudo yum install docker-ce docker-ce-cli containerd.io
    ```
    如果弹出导入 Key 的问题，请接受

2. 镜像加速

    新建或修改`/etc/docker/daemon.json`，加入：
    ```json
    {
        "registry-mirrors": [
            "https://dockerhub.azk8s.cn",
            "https://reg-mirror.qiniu.com"
        ]
    }
    ```
    一定要确保格式没有问题，否则 docker 无法启动，修改完成后执行以下命令：
    ```bash
    $ sudo systemctl daemon-reload
    ```
    

3. 启动 Docker

    ```bash
    $ sudo systemctl start docker
    ```

## 卸载 Docker CE

1. 卸载安装包

    ```bash
    $ sudo yum remove docker-ce
    ```

2. 如果你觉得曾经的数据没用了，就一并删除吧

    ```bash
    $ sudo rm -rf /var/lib/docker
    ```