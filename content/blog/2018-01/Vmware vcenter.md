+++
author = "Jerry Chan"
categories = ["虚拟化"]
tags = ["vmware"]
date = "2018-01-25T08:52:19+08:00"
description = "该篇介绍了vCenter Server的集中部署类型"
featured = "vmware_horizon.jpg"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "详解VMware vCenter Server"
type = "post"

+++

作为vSphere的核心主键之一的 vCenter Server 可以部署在Linux上或者是Windows上，在Linux上被称为 vCenter Server Appliance。
根据 Platform Services Controller 所部署的位置的不同，有以下几种部署类型：

<table>
<thead>
<tr>
  <th align="left">部署类型</th>
  <th align="left">描述</th>
</tr>
</thead>
<tbody>
<tr>
  <td align="left">具有嵌入式 Platform Services Controller 部署的 vCenter Server</td>
  <td align="left">与 Platform Services Controller 捆绑在一起的所有服务与 vCenter Server 服务一起部署在同一虚拟机或物理服务器上。</td>
</tr>
<tr>
  <td align="left">Platform Services Controller</td>
  <td align="left">只有与 Platform Services Controller 捆绑在一起的服务会部署在虚拟机或物理服务器上。</td>
</tr>
<tr>
  <td align="left">具有外部 Platform Services Controller 的 vCenter Server （需要外部 Platform Services Controller）</td>
  <td align="left">只有 vCenter Server 服务会部署在虚拟机或物理服务器上。必须向之前部署或安装的 Platform Services Controller 实例注册此类 vCenter Server 实例。</td>
</tr>
</tbody>
</table>
