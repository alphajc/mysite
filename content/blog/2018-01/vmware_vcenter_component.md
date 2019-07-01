+++
author = "Jerry Chan"
categories = ["信息技术"]
tags = ["vmware"]
date = "2018-01-21T08:52:19+08:00"
description = "该篇介绍了vCenter Server 组件和服务"
featured = "vmware_horizon.jpg"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "vCenter Server 组件和服务"
type = "post"

+++

摘自于VMware官方文档，移至自己博客方便阅读，如有侵权，请联系我删除

vCenter Server 为虚拟机和主机的管理、操作、资源置备和性能评估提供了一个集中式平台。 安装具有嵌入式 Platform Services Controller 的 vCenter Server 或部署具有嵌入式 Platform Services Controller 的 vCenter Server Appliance 时，vCenter Server、vCenter Server 组件以及 Platform Services Controller 中包含的服务将部署在同一个系统上。 安装具有外部 Platform Services Controller 的 vCenter Server 或部署具有外部 Platform Services Controller 的 vCenter Server Appliance 时，vCenter Server 和 vCenter Server 组件将部署在一个系统上，而 Platform Services Controller 中包含的服务将部署在另一个系统上。 以下组件包含在 vCenter Server 和 vCenter Server Appliance 安装中：

1.  VMware Platform Services Controller 基础架构服务组包含 vCenter Single Sign-On、License Service、Lookup Service 和 VMware Certificate Authority。
2.  vCenter Server 服务组包含 vCenter Server、vSphere Web Client、vSphere Auto Deploy 和 vSphere ESXi Dump Collector。适用于 Windows 的 vCenter Server 还包含 VMware vSphere Syslog Collector。vCenter Server Appliance 还包含 VMware vSphere Update Manager 扩展服务。

> 注：从 vSphere 6.5 开始，所有 vCenter Server 服务和部分 Platform Services Controller 服务作为 VMware Service Lifecycle Manager 服务的子进程运行。

# 随 VMware Platform Services Controller 一起安装的服务

**vCenter Single Sign-On**

vCenter Single Sign-On 身份验证服务为 vSphere 软件组件提供了安全身份验证服务。使用 vCenter Single Sign-On，vSphere 组件可通过安全的令牌交换机制相互通信，而无需每个组件使用目录服务（如 Active Directory）分别对用户进行身份验证。vCenter Single Sign-On 可构建内部安全域（如 vsphere.local），vSphere 解决方案和组件将在安装或升级期间在该域中进行注册，从而提供基础架构资源。vCenter Single Sign-On 可以通过其自己的内部用户和组对用户进行身份验证，或者可以连接到受信任的外部目录服务（如 Microsoft Active Directory）。然后，可以在 vSphere 环境中为经过身份验证的用户分配基于注册的解决方案的权限或角色。 vCenter Server 需要 vCenter Single Sign-On。

**vSphere License Service**

vSphere License Service 为连接到单个 Platform Services Controller 或多个链接的 Platform Services Controller 的所有 vCenter Server 系统提供公共许可证清单和管理功能。

**VMware Certificate Authority**

默认情况下，VMware Certificate Authority (VMCA) 将使用以 VMCA 作为 root 证书颁发机构的签名证书置备每个 ESXi 主机。以显式方式将 ESXi 主机添加到 vCenter Server 时进行置备，或在 ESXi 主机安装过程中进行置备。所有 ESXi 证书都存储在本地主机上。 有关所有 Platform Services Controller 服务和功能的信息，请参见Platform Services Controller 管理。

# 随 vCenter Server 一起安装的服务

安装 vCenter Server 时，将以静默方式安装这些附加组件。这些组件不能单独安装，因为它们没有其自己的安装程序。 PostgreSQL VMware 分发的用于 vSphere 和 vCloud Hybrid Service 的 PostgreSQL 数据库捆绑版本。 vSphere Web Client 通过 vSphere Web Client，可以使用 Web 浏览器连接到 vCenter Server 实例，以便管理 vSphere 基础架构。 vSphere Client 通过新用户界面，可以使用 Web 浏览器连接到 vCenter Server 实例。术语、拓扑及工作流与 vSphere Web Client 用户界面的相同方面和元素保持高度一致。

> 注：在 vSphere 6.5 版本中，并未针对 vSphere Client 实现 vSphere Web Client 中的所有功能。有关不受支持的功能的最新列表，请参见《vSphere Client 功能更新指南》，网址为 https://www.vmware.com/info?id=1413。

**vSphere ESXi Dump Collector**

vCenter Server 支持工具。可以将 ESXi 配置为在系统发生严重故障时将 VMkernel 内存保存到网络服务器而非磁盘。vSphere ESXi Dump Collector 将通过网络收集这些内存转储。

**VMware vSphere Syslog Collector**

 Windows 上的 vCenter Server 支持工具，支持网络日志记录，并可将多台主机的日志合并。您可以使用 vSphere Syslog Collector 将 ESXi 系统日志定向到网络服务器而非本地磁盘。对于支持的从中收集日志的主机，建议的最大数目为 30 个。有关配置 vSphere Syslog Collector 的信息，请参见 https://kb.vmware.com/kb/2021652。 vCenter Server Appliance 使用 Linux OS 内置的 Rsyslog 服务。有关如何通过设备管理界面将日志文件重定向到其他计算机的信息，请参见vCenter Server Appliance 配置。

**vSphere Auto Deploy**

vCenter Server 支持工具，能够使用 ESXi 软件置备大量物理主机。可以指定要部署的映像以及要使用此映像置备的主机。也可以指定应用到主机的主机配置文件，并且为每个主机指定 vCenter Server 位置（文件夹或群集）。  

**VMware vSphere Update Manager 扩展**

Update Manager 可让 VMware vSphere 执行集中式自动修补程序和版本管理，并提供对 VMware ESXi 主机、虚拟机和虚拟设备的支持。VMware vSphere Update Manager 扩展是单独使用的 vCenter Server Appliance 6.5 的可选服务。
