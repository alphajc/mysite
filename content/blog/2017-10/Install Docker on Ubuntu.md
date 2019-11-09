+++
author = "Jerry 云原生"
categories = ["技术"]
tags = ["Ubuntu", "Docker"]
date = "2017-10-22T08:54:08+08:00"
description = "本文介绍了使用Ubuntu安装docker的方式，源自于docker官方网站"
featured = "docker.jpg"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "Ubuntu安装 Docker社区版"
type = "post"

+++

准备
--

# 系统要求

要安装Docker CE，我们需要这些64位版本的Ubuntu：

*   Artful 17.10 (Docker CE 17.11 Edge and higher only)
*   Zesty 17.04
*   Xenial 16.04 (LTS)
*   Trusty 14.04 (LTS)

在Ubuntu `x86_64`、`armhf`、`s390x`（IBM Z）和`ppc64le`（IBM Power）架构上支持Docker CE。

> `ppc64le`和`s390x`限制：IBM Z和Power体系结构的软件包仅在Ubuntu Xenial及更高版本上可用。

# 卸载旧版本

老版本的Docker被称为docker或者docker-engine。如果安装了这些，请将其卸载：

    sudo apt-get remove docker docker-engine docker.io


如果`apt-get`报告没有安装这些软件包，则可以直接跳过这一步。

`/var/lib/docker/`的内容（包括映像，容器，卷和网络）将被保留。 Docker CE包现在称为`docker-ce`。

安装Docker CE
-----------

您可以根据您的需要以不同的方式安装Docker CE：

*   大多数用户设置Docker的存储库并从中进行安装，以方便安装和升级任务。这是推荐的方法。
*   有些用户下载deb软件包手动安装，并完全手动管理升级。这很适合在诸如没有互联网访问的封闭系统上安装Docker。
*   在测试和开发环境中，有些用户选择使用自动便捷脚本来安装Docker。

# 使用软件仓库安装

首次在新的主机上安装Docker CE之前，需要设置Docker软件仓库。之后，您可以从该库安装和更新Docker。

## 设置软件仓库

1.  更新apt包索引：  

        sudo apt-get update


2.  安装软件包以允许apt通过HTTPS使用存储库：  

        sudo apt-get install \
            apt-transport-https \
            ca-certificates \
            curl \
            software-properties-common


3.  添加Docker的官方GPG密钥：  

        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -


    通过查看指纹的最后8个字符，确认您现在已经拥有指纹`9DC8 5822 9FC7 DD38 854A E2D8 8D81 803C 0EBF CD88`的密钥。

        sudo apt-key fingerprint 0EBFCD88


    > pub 4096R/0EBFCD88 2017-02-22  
    > Key fingerprint = 9DC8 5822 9FC7 DD38 854A E2D8 8D81 803C 0EBF CD88  
    > uid Docker Release (CE deb) [docker@docker.com](mailto:docker@docker.com)  
    > sub 4096R/F273FCD8 2017-02-22

4.  使用以下命令来设置`stable`存储库。即使您想从`edge`或`test`存储库安装构建，也总是需要`stable`存储库。要添加`edge`或`test`存储库，请在下面的命令中在单词`stable`之后添加`edge`或`test`（或两者）。  

    > **注意**：下面的`lsb_release -cs`子命令返回你的Ubuntu发行版的名字，比如`xenial`。有时候，在像Linux Mint这样的发行版中，您可能必须将`$(lsb_release -cs)`更改为您的父级Ubuntu发行版。例如，如果您使用Linux Mint Rafaela，则可以使用`trusty`。

    *   Duplicate Widget
    *   Remove Widget

    x86_64 / amd64

    armhf

    IBM Power (ppc64le)

    IBM Z (s390x)

    x86_64 / amd64

        sudo add-apt-repository \
           "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
           $(lsb_release -cs) \
           stable"


    armhf

        sudo add-apt-repository \
           "deb [arch=armhf] https://download.docker.com/linux/ubuntu \
           $(lsb_release -cs) \
           stable"


    IBM Power (ppc64le)

        sudo add-apt-repository \
           "deb [arch=ppc64le] https://download.docker.com/linux/ubuntu \
           $(lsb_release -cs) \
           stable"


    IBM Z (s390x)

        sudo add-apt-repository \
           "deb [arch=s390x] https://download.docker.com/linux/ubuntu \
           $(lsb_release -cs) \
           stable"
