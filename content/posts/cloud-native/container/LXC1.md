---
title: "LXC介绍"
date: 2017-11-11T08:56:06+08:00
hero: /assets/images/posts/cloud-native/linux_containers.jpg
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- cloud-native
- container
tags:
- container
- lxc
description: "LXC 的第二篇文章，本文介绍了什么是 LXC"
---

什么是LXC？
-------

LXC是Linux内核中拥有容器功能的用户空间接口。 通过强大的API和简单的工具，它可以让Linux用户轻松创建并管理系统或应用程序容器。

特征
--

当前的LXC使用以下的内核特性来封装进程

*   Kernel namespaces (ipc, uts, mount, pid, network and user)
*   Apparmor and SELinux profiles
*   Seccomp policies
*   Chroots (using pivot_root)
*   Kernel capabilities
*   CGroups (control groups)

LXC容器通常被认为是chroot和一个完整的虚拟机。 LXC的目标是尽可能创造一个环境 到一个标准的Linux安装，但不需要单独的内核。

组件
--

LXC目前由几个单独的组件组成：

*   liblxc库
*   API的几种语言绑定
    *   python3 (in-tree, long term support in 1.0.x and 2.0.x)
    *   lua (in tree, long term support in 1.0.x and 2.0.x)
    *   Go
    *   ruby
    *   python2
    *   Haskell
*   一套控制容器的标准工具
*   分发容器模板
