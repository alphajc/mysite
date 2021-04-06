---
title: 记一次 IPVS 引起的 kubernetes 服务异常
date: 2020-12-06T17:14:02+08:00
hero: /assets/images/posts/cloud-native/ipvs-p1.png
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- cloud-native
- kubernetes
tags:
- ipvs
- netfilter
- k8s
description: 围绕 ipvs 服务模式下 kubernetes 集群中 net.ipv4.vs.conn_reuse_mode 内核参数的正确使用方式展开
---

## 问题描述

在我们的环境中，业务 A 会访问业务 B（也即 B 是 A 的上游服务），当 B 发版时，A 的请求偶尔会出现 timeout。现象看起来是流量路由到了已经不能提供服务的老的 pod 中。

## 问题处理

### 排查点一

当 pod 下线时，endpoint controller 未及时将 pod 从 endpoint 中取出，导致流量进入了旧的 pod。

由于集群 master 是托管部署的，所以我们没有办法查看相关日志和负载，求助于腾讯云的同时，自己这边也在排查。排查分两步进行，监控服务 B endpoint 的变化，同时滚动重启该服务。

* _监控 ep 变化_

  ```shell
  watch -n 1 kubectl -n production describe ep wk-dispatcher
  ```

* _重启服务_

  ```shell
  kubectl -n production rollout restart deployment wk-dispatcher
  ```

通过排查发现，跟 endpoint controller 并没有关系，因为 ep 变化很及时，加上至少 30 秒的优雅终止时间，基本可以确定在服务结束前，pod 是从 ep 中移除了的。

那不是这个原因，又会是什么原因呢？既然 ep 已经及时卸载了 pod，那是不是 kube-proxy 没有及时将相关规则改掉呢？

### 排查点二

kube-proxy 没有及时将相关规则改掉

虽然按照我的理解，这么长的优雅终止时间，怎么着规则都应该同步了才对，那可能同步时间加上请求处理时间超过了优雅终止时间，如果这样也还是有可能的，无论如何观察一下总是好的。

* _查看 ipvs 规则变化_

  ```shell
  CLUSTERIP=`kubectl -n production get svc wk-dispatcher -o=jsonpath={.spec.clusterIP}`
  PORT=`kubectl -n production get svc wk-dispatcher -o=jsonpath={.spec.ports[0].port}`
  watch -n 1 ipvsadm -Ln -t $CLUSTERIP:$PORT
  ```

  同时也需要重启服务

  ```shell
  kubectl -n production rollout restart deployment wk-dispatcher
  ```

这时候发现 ipvs 规则变化也很快（随着一些新的 rs 加入，老的 rs 的权重会变为0），虽然权重很快变为 0，但是老的 rs 并不会立即消失，直到 `ActiveConn `＋ `InActConn` = 0，老的 rs 才会真正移除。

既然 endpoint 的变化和 ipvs 规则同步都很快，那问题极有可能出现在权重变为 0 到真正消失的之段时间。

### 排查点三

流量路由到了权重为 0 的 rs

带着这样的疑惑，我们找到了 TKE 团队。在 TKE 的指导下，我们查询了一下`net.ipv4.vs.conn_reuse_mode`，发现其值为 0。随后他们给了我们个[关键 issue](https://github.com/kubernetes/kubernetes/issues/81775)。

ipvs 相关内核参数的说明如下：

> conn_reuse_mode - INTEGER
>
>   1 - default
>
>   Controls how ipvs will deal with connections that are detected port reuse. It is a bitmap, with the values being:
>
>   0: disable any special handling on port reuse. The new connection will be delivered to the same real server that was servicing the previous connection. This will effectively disable expire_nodest_conn.  
>   禁用对端口重用的任何特殊处理。 新连接将被传递到为先前连接提供服务的同一台真实服务器。 这将有效地禁用expire_nodest_conn。
>
>   bit 1: enable rescheduling of new connections when it is safe. That is, whenever expire_nodest_conn and for TCP sockets, when the connection is in TIME_WAIT state (which is only possible if you use NAT mode).  
>   NAT 模式下，连接处于 TIME_WAIT 状态时，新的连接请求将会重新调度而不再复用。
>
>   bit 2: it is bit 1 plus, for TCP connections, when connections are in FIN_WAIT state, as this is the last state seen by load balancer in Direct Routing mode. This bit helps on adding new real servers to a very busy cluster.
>
> expire_nodest_conn - BOOLEAN
>
>   0 - disabled (default)  
>   not 0 - enabled
>
>   The default value is 0, the load balancer will silently drop packets when its destination server is not available. It may be useful, when user-space monitoring program deletes the destination server (because of server overload or wrong detection) and add back the server later, and the connections to the server can continue.
>
>   If this feature is enabled, the load balancer will expire the connection immediately when a packet arrives and its destination server is not available, then the client program will be notified that the connection is closed. This is equivalent to the feature some people requires to flush connections when its destination is not available.

有关 ipvs 超时时间的说明：

> ipvs default timeouts (900s for TCP, 120s for TCPFIN and 300s for UDP) are very high, especially in conjonction with conn_reuse_mode=0 (increased chances of bad port reuse). We can definitely decrease them but it's not perfect.  
> The better option would be to set weight to 0 on backend removal from endpoint and delete the realserver when the pod is completely deleted, but this would require modifying the endpoint controller and the associated API.

## 原因分析

我们 kubernetes 节点机`sys.net.ipv4.vs.conn_reuse_mode`值为 0，ipvs 中，系统使用`conntrack`跟踪连接，`conntrack`使用三元组（即源IP、源端口、协议）定位具体连接，当客户端产生大量短连接时，其本身可能与之前的端口复用，而 TCP 在`conntrack`中的超时时间达 900s，也就是说`conntrack`中记录的连接可能存在很长时间，客户端过来的新连接极有可能复用老连接，此时已经 TIME_WAIT
的老连接无法响应请求，从而导致超时。可通过设置`sys.net.ipv4.vs.conn_reuse_mode`的值为 1 来解决，但这有可能引入一个[一秒延时的问题](https://marc.info/?t=151683118100004&r=1&w=2)。

## 最终解决

> **一秒延时问题**:
>
> 当`sys.net.ipv4.vs.conn_reuse_mode`的值为 1 时，SYN 包到达`conntrack`时发现该连接处于 TIME_WAIT 状态，将会直接丢弃包，直至超时重发，这个时间大概一秒，打了补丁后包不会被丢弃而是在新进程中新建连接。

将节点的操作系统升级到打了[补丁](https://lkml.org/lkml/2020/6/16/254)（解决一秒延时问题）的版本，同时将`sys.net.ipv4.vs.conn_reuse_mode`的值调整为 1。
