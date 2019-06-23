+++
author = "Jerry Chan"
categories = ["技术"]
tags = ["vmware"]
date = "2018-01-23T08:52:19+08:00"
description = "该篇介绍了vSphere 和 vCenter Server"
featured = ""
featuredalt = ""
featuredpath = ""
linktitle = ""
title = "vSphere 和 vCenter Server"
type = "post"

+++

VMware vSphere 是一套虚拟化应用程序，包括 ESXi 和 vCenter Server。 vSphere 使用虚拟化执行以下任务：

*   在一台物理机上同时运行多个操作系统。
*   回收闲置资源并在多台物理机之间平衡工作负载。
*   处理硬件故障和预定维护。

熟悉构成 vSphere 环境的组件有助于理解设置过程，并最终理解使用 VMware vCenter Server 管理主机和运行虚拟机的过程。 除了 ESXi 主机和 vSphere Client 之外，vSphere 还包括以下组件：

**vSphere Web Client** vSphere Web Client 是连接到 vCenter Server 和多主机环境的接口。另外，它还提供对虚拟机的控制台访问。借助 vSphere Web Client，您可以使用浏览器内界面执行所有管理任务。

**VMware vCenter Server** vCenter Server 将各台主机中的资源统一在一起，使这些资源可以在整个数据中心的虚拟机之间共享。其实现原理是：根据系统管理员设定的策略，管理主机的虚拟机分配，以及给定主机内虚拟机的资源分配。 vCenter Server 允许使用 vSphere 的高级功能，如 vSphere Distributed Resource Scheduler (DRS)、vSphere High Availability (HA)、vSphere vMotion 和 vSphere Storage vMotion。

**数据中心** 数据中心是一种结构，在该结构中，可以向清单中添加主机及其相关虚拟机。

**主机** 主机是使用 ESXi 虚拟化软件来运行虚拟机的计算机。主机为驻留在其上的虚拟机提供 CPU 和内存资源、对存储器的访问以及网络连接。

**虚拟机** 与物理机一样，虚拟机是运行操作系统和应用程序的软件计算机。多个虚拟机可在同一主机上同时运行。由 vCenter Server 管理的虚拟机也可在主机群集上运行。 下图显示了 vSphere 基本组件之间的关系，以及如何使用 vCenter Server 管理主机和运行虚拟机。

 **vSphere 组件**

 ![](/assets/blog/2018-01/GUID-38835A7F-4823-4D92-A689-0B827A5A3DD1-high.png)
