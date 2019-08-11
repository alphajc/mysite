+++
author = "Jerry Chan"
categories = ["技术"]
tags = ["SDN", "Openflow"]
date = "2017-10-11T08:54:08+08:00"
description = "本文源于维基百科对openflow的介绍"
featured = "openflow.png"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "OpenFlow简介"
type = "post"

+++

OpenFlow
========

来源于维基百科——自由百科全书 **OpenFlow** 是一种通信协议，可以通过网络访问网络交换机或路由器的转发平面。

描述
--

OpenFlow允许网络控制器确定网络交换机网络的路径。控制器与交换机不同。 控制与转发的分离允许使用可行的比[访问控制列表](https://en.wikipedia.org/wiki/Access_control_list)（ACL）和路由协议更复杂的流量管理。 此外，OpenFlow允许使用单一的开放协议远程管理来自不同供应商的交换机（通常每个都有自己的专有接口和脚本语言）。 协议的发明人认为OpenFlow是[软件定义网络](https://en.wikipedia.org/wiki/Software_defined_networking)（SDN）的推动者。 OpenFlow允许通过添加，修改和删除数据包匹配规则和操作来远程管理[第3层](https://en.wikipedia.org/wiki/Layer_3)交换机的数据包转发表。 这样，路由决策可以由控制器定期或临时进行，并转换成具有可配置寿命的规则和动作， 然后将其部署到交换机的流表中，以匹配的速度将匹配的分组实际转发到交换机这些规则的持续时间。 由交换机无法匹配的数据包可以转发给控制器。 然后，控制器可以决定修改一个或多个交换机上的现有流表规则，或者部署新的规则，以防止交换机与控制器之间的流量结构性流动。 它甚至可以决定转发流量本身，只要它告诉交换机转发整个数据包，而不是只是他们的header。 OpenFlow协议分层在[传输控制协议](https://en.wikipedia.org/wiki/Transport_Layer_Security)（TCP）之上，并规定了传输层安全性（TLS）的使用。 控制器应该在TCP端口6653上侦听想要建立连接的交换机。 早期版本的OpenFlow协议非官方使用端口6633.

历史
--

[开放网络基金会](https://en.wikipedia.org/wiki/Open_Networking_Foundation)（ONF） 是一个致力于促进和采用[软件定义网络](https://en.wikipedia.org/wiki/Software-defined_networking)（SDN） 的用户主导的组织， ONF将OpenFlow定义为在SDN架构的控制层和转发层之间定义的第一个标准通信接口。 OpenFlow允许直接访问和操纵诸如交换机和路由器的网络设备的转发平面，包括物理设备和虚拟设备（基于虚拟机管理程序）。 没有一个开放接口的转发平台，导致了如今的网络设备的现状，如单一，封闭和专用。 需要像OpenFlow这样的协议，将网络控制从专有网络交换机转移到开源和本地管理的控制软件。 许多网络交换机和路由器供应商已经宣布意图支持或正在运送支持OpenFlow的交换机， 包括[阿尔卡特朗讯](https://en.wikipedia.org/wiki/Alcatel-Lucent "Alcatel-Lucent"), [大交换机网络](https://en.wikipedia.org/wiki/Big_Switch_Networks "Big Switch Networks")， [博科通信](https://en.wikipedia.org/wiki/Brocade_Communications "Brocade Communications")， [Radisys](https://en.wikipedia.org/wiki/Radisys)， [Arista Networks](https://en.wikipedia.org/wiki/Arista_Networks)， [Pica8](https://en.wikipedia.org/wiki/Pica8)，[NoviFlow](https://en.wikipedia.org/w/index.php?title=NoviFlow&action=edit&redlink=1)， [华为](https://en.wikipedia.org/wiki/Huawei)，[思科](https://en.wikipedia.org/wiki/Cisco "Cisco")， [戴尔EMC](https://en.wikipedia.org/wiki/Dell_EMC)，[Extreme Networks](https://en.wikipedia.org/wiki/Extreme_Networks)， [IBM](https://en.wikipedia.org/wiki/IBM)，[瞻博网络](https://en.wikipedia.org/wiki/Juniper_Networks "Juniper Networks")， [Digisol](https://en.wikipedia.org/w/index.php?title=Digisol&action=edit&redlink=1)， [Larch Networks](https://en.wikipedia.org/wiki/Larch_Networks)，[Hewlett-Packard](https://en.wikipedia.org/wiki/Hewlett-Packard)， [NEC](https://en.wikipedia.org/wiki/NEC)和[MikroTik](https://en.wikipedia.org/wiki/MikroTik)。 一些网络控制平面实现使用协议来管理网络转发元素。OpenFlow主要用于安全通道上的交换机和控制器之间。 有关OpenFlow相关产品的相当全面的列表可以在ONF网站和SDNCentral网站上找到。
