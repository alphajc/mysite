---
title: Ironic裸机服务——OpenStack
date: 2017-12-11T08:54:08+08:00
hero: /assets/images/posts/virtualization/openstack.png
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- virtualization
- openstack
tags:
- openstack
- ironic
---


OpenStack为用户提供裸机服务（区别于虚拟机），该服务在OpenStack项目中被称作ironic。它可以独立使用或者作为OpenStack Cloud的一部分使用，并与OpenStack认证（keystone），计算（nova），网络（neutron），图像（glance）和对象存储（swift）服务集成。 当裸机服务适当配置了计算和网络服务时，可以使用计算服务的API来配置裸机。不过，由于物理服务器和交换机硬件的特性不同，对于裸机实例的操作很有限。例如，实时迁移不能在裸机实例上执行。 为了涵盖广泛的硬件，OpenStack社区利用开源技术（例如，PXE和IPMI）的参考驱动程序。 Ironic的可插拔驱动架构还允许硬件供应商编写和提供驱动程序来提高性能或补充社区驱动程序未提供的功能。

# 为何提供裸机？

以下是在云上裸机（物理服务器）的一些案例，当然有许多其它更有趣的：

*   高性能计算集群
*   使用无法虚拟化的设备
*   数据库托管（某些数据库在hypervisor中效果不好）
*   单租户，专用硬件的性能，安全性，可靠性和其他监管要求
*   快速部署云基础架构

# 概念架构

下图显示了配置物理服务器期间的关系以及所有服务如何发挥作用。 （注：Ceilometer和Swift也可以和Ironic一起使用，此处未标出） 

![Conceptual Architecture](/assets/images/posts/virtualization/conceptual_architecture.png)

# 逻辑架构

下图显示了逻辑体系结构。它显示了构成Ironic服务的基本组件，Ironic服务与其他OpenStack服务的关系以及引导实例请求导致物理服务器供应的逻辑流程。 

![](/assets/images/posts/devops/logical_architecture.png) 

Ironic由以下组件构成：

1.  一个RESTful API服务，管理员或者其他服务可以通过这个服务与被管理的裸机进行交互。
2.  一个Conductor服务，主导大部分工作。通过API服务暴露功能，Conductor和API通过RPC通信。
3.  各种支持异构硬件的驱动。
4.  一个消息队列。
5.  用于存储包括Conductor状态，节点（物理服务器）和驱动程序等资源信息的数据库。

如Figure 1.2所示，用户请求通Nova API和Nova  Scheduler启动Nova 计算服务的一个实例。计算服务将此请求移交给Ironic服务，在Ironic服务中，请求从Ironic API传递到Conductor，再传递给驱动程序，为用户成功配置物理服务器。 就像Nova计算服务通知诸如Glance、Neutron、Swift等不同的OpenStack服务去创建一个虚拟机实例一样，此处Ironic服务也通知相同的网络、镜像以及其他的一些服务去创建一个裸机实例。

# Ironic的关键技术

## 预启动执行环境（PXE）

PXE是由英特尔和微软开发的Wired for Management（WfM）规范的一部分。PXE使系统的BIOS和网络接口卡（NIC）从网络而非磁盘引导计算机。Bootstrapping是系统将OS加载到本地内存以便处理器执行的过程。该功能简化了管理员的服务器部署和管理。

## 动态主机配置协议（DHCP）

DHCP是在IP网络上使用的标准化网络协议，用于动态分配网络配置参数，例如接口或者服务的IP地址。使用PXE，BIOS使用DHCP获取网络接口的IP地址，并找到存储网络引导程序（NBP）的服务器。

## 网络引导程序（NBP）

NBP相当于GRUB（GRand Unified Bootloader）或LILO（LInux LOader）—— 用于本地启动的传统加载器。像硬盘环境中的引导程序一样，NBP负责将OS内核加载到内存中，以便可以通过网络引导操作系统。

## 简单文件传输协议（TFTP）

TFTP是一种简单的文件传输协议，通常用于在本地环境中的机器之间自动传输配置或启动文件。在PXE环境中，TFTP使用来自DHCP服务器的信息通过网络下载NBP。

## 智能平台管理接口（IPMI）

IPMI是系统管理员用于计算机系统的带外管理和操作监控的标准化计算机系统接口。这是一种通过仅使用硬件的网络连接而不是操作系统来管理可能无响应或断电的系统的方法。

# Ironic部署架构

Ironic RESTful API服务用于注册Ironic将管理的硬件。云管理员通常会注册硬件，指定其属性（如MAC地址和IPMI凭证）。可以有多个API服务实例。 在Ironic中Conductor负责大部分的工作。出于安全原因，建议将Conductor服务放置在隔离的主机上，因为这是唯一需要访问数据平面和IPMI控制平面的服务。 可以有多个Conductor服务实例来支持各种类型的驱动程序，也可以管理故障转移。Conductor服务的实例应该位于不同的节点上。每个Conductor本身可以运行多个驱动器来操作异构硬件。如下图所示。 该API公开了支持的驱动程序的列表以及为其服务的指挥主机的名称。 

![](/assets/images/posts/devops/deployment_architecture_2.png)

# 了解裸机部署

启动实例请求进来时会发生什么？下图说明了配置裸机实例过程中涉及的步骤。 在部署过程之前必须满足这些条件：

*   在裸机服务节点上配置从属软件包，其中的Ironic的Conductor正在运行，如tftp-server，ipmi，syslinux等，用于裸机配置。
*   Nova必须配置为使用裸机服务端点，并且应将在Nova计算节点上为计算驱动程序配置使用Ironic驱动程序。
*   为可用的硬件创建flavor，Nova必须知道从哪个flavor启动。
*   要在Glance中提供的可用镜像。下面列出的是成功部署裸机所需的一些镜像类型：
    *   bm-deploy-kernel
    *   bm-deploy-ramdisk
    *   user-image
    *   user-image-vmlinuz
    *   user-image-initrd
*   要通过Ironic RESTful API服务注册的硬件。
