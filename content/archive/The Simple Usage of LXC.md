+++
author = "Like Ma"
date = "2019-07-07T08:02:31+08:00"
tags = ["LXC", "Linux", "Container", "Ubuntu", "Ubuntu12.04"]
categories = ["云原生"]
description = "LXC (Linux Containters) 是一种基于内核容器属性的用户空间接口。 它被认为介于chroot和完全虚拟化之间，其目标为创建一个不需要独立内核，但近可能接近标准Linux安装的环境。"
link = "https://www.malike.net.cn/blog/2013/11/10/lxc-tutorial/"
linktitle = "原文链接"
featured = ""
featuredalt = ""
featuredpath = ""
format = "Like的世界"
title = "LXC的简单用法"
type = "archive"

+++

# LXC简介

LXC (Linux Containters) 是一种基于内核容器属性的用户空间接口。 它被认为介于chroot和完全虚拟化之间，其目标为创建一个不需要独立内核，但近可能接近标准Linux安装的环境。

其特性如下：

- 内核空间（ipc, uts, mount, pid, network和user)
- 支持Apparmor和SELinux
- seccomp策略
- chroots (使用pivot_root)
- Kernel capabilities
- 支持cgroups (Control groups)
- 由于没有完全虚拟化CPU，也没有虚拟化硬盘，其性能是与物理机接近的。实际经验，我发现在LXC中编译C/C++源码（如构建基于C/C++源码的RPM或DEB）的性能是VirtualBox的3倍。强烈建议使用LXC代替KVM和VirtualBox作为RPM或DEB的构建环境。

以下操作基于Ubuntu 12.04，那么需要安装LXC包：

    sudo apt-get install -y lxc

# 创建LXC

以创建一个名为precise的Ubuntu 12.04容器为例。

需要创建一个基础的配置文件。由于创建LXC完成后，不再需要该配置文件（可以删除），故该文件的名字和路径没有特殊要求。这里命名为precise.conf，放在当前路径下：

    lxc.network.type = veth
    lxc.network.flags = up
    lxc.network.name = eth0
    lxc.network.link = lxcbr0

lxcbr0为由LXC包创建的虚拟网桥，通过ifconfig可以知道其IP地址10.0.3.1，网段10.0.3.1/24，容器将通过lxcbr0与外界通信。

如此，可以开始创建容器了：

    sudo lxc-create -n precise -f precise.conf -t ubuntu -- -r precise

> -n 指定容器名，这里为precise。
> 
> -f 指定基础配置文件，即上一步骤创建的precise.conf。
> 
> -t 指定模板名，这里必须为ubuntu（创建Ubuntu 12.04)。每个模板名，对应一个脚本，它们存放在/usr/lib/lxc/templates目录（文件名形如lxc-<模板名>）中。
> 
> – 以后的参数被传递给模板脚本；
> 
> -r 为ubuntu模板脚本的参数，表示Ubuntu发行版代号，这里必须为precise（它是12.04的发行代号）。

创建过程可能会比较漫长。通过阅读/usr/lib/lxc/templates/lxc-ubuntu，不难发现创建ubuntu容器主要依靠deboostrap来完成。另一方面，变量MIRROR和SECURITY_MIRROR决定了镜像的设置，它们默认为：

    MIRROR=http://archive.ubuntu.com/ubuntu
    SECURITY_MIRROR=http://security.ubuntu.com/ubuntu

在大陆地区，使用默认镜像的网速较慢。为了加快创建过程，可以将它们都换成大陆或香港的镜像，如http://ftp.cuhk.edu.hk/pub/Linux/ubuntu

具体问题是lxc-ubuntu并没有提供命令行参数来设置MIRROR和SECURITY_MIRROR。在不修改lxc-ubuntu代码的情况下，唯一的办法就是通过设置相关环境变量来达到这个目的，如：

    sudo MIRROR="http://ftp.cuhk.edu.hk/pub/Linux/ubuntu" \
        SECURITY_MIRROR="http://ftp.cuhk.edu.hk/pub/Linux/ubuntu" \
        lxc-create -n precise -f precise.conf -t ubuntu -- -r precise

我司为了加快内部开发和测试人员安装Ubuntu，部署了apt-cacher-ng——一种deb包HTTP缓存代理。由于lxc-ubuntu基于deboostrap，可以通过设置环境变量http_proxy来设置deboostrap的缓存代理（请见Global cache config of debootstrap）:

    sudo http_proxy="http://192.168.88.10:3142/" \
    MIRROR="http://ftp.cuhk.edu.hk/pub/Linux/ubuntu" \
        SECURITY_MIRROR="http://ftp.cuhk.edu.hk/pub/Linux/ubuntu" \
        lxc-create -n precise -f precise.conf -t ubuntu -- -r precise

如此，在尽可能节约外部带宽的同时，最大限度的加快了创建过程。

上述创建方法，容器的架构将与host os的相同（如amd64）。若需要在amd64的host os上创建i386或i686架构的容器，则需要通过模板脚本的-a参数指定i686，如：

    sudo lxc-create -n precise -f precise.conf -t ubuntu -- -r precise -a i686

# 启动LXC

若需立即启动LXC，则：

    sudo lxc-start -n precise

若需以daemon方式运行，则:

    sudo lxc-start -n precise -d

若需随host os启动而自动启动，则:

    sudo ln -s /var/lib/lxc/precise/config /etc/lxc/auto/precise.conf

# 打开LXC控制台

在没有给容器设置IP时，打开其控制台

    sudo lxc-console -n precise

将看到文本登录界面。 通过按热键ctrl-a和q，可以退出容器控制台。

更多的时候，通过ssh登录将更方便，特别是key认证方式登录。

# 停止LXC

多数情况下，可以通过在guest os（容器）内执行poweroff或shutdown -h now来关闭容器。但有些时候却需要在host os上强行关闭容器，如：

    sudo lxc-stop -n precise

# 删除LXC

容器创建后，配置和数据存放在/var/lib/lxc/precise目录中。执行

    sudo lxc-destroy -n precise

与手动删除该目录效果一样。

# 其他模板

- ubuntu-cloud：从Ubuntu云上下载根文件系统镜像。
- fedora: 它依赖于yum包，通过模板脚本参数-R指定版本号，如19和20都无法创建成功。默认版本号为14，可以继续安装。
- opensuse：它依赖于zypper，Ubuntu 12.04默认没有zypper包。虽然ppa:thopiekar/zypper提供了zypper，但是创建失败。
- busybox：仅有busybox的容器，默认不能远程登录，可以用于练习简单的命令行操作。
- sshd：将host os中各个系统目录（/bin, /sbin/和/lib等）以只读方式绑定到容器中，仅运行ssh服务器，支持ssh登录，可用于练习复杂的命令行操作。