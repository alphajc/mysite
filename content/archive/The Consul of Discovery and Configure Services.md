+++
author = "Deepzz"
date = "2019-07-07T11:24:33+08:00"
tags = ["Consul", "Gossip", "Service Discovery"]
categories = ["信息技术"]
description = "文章转载自互联网，供自己学习参考"
link = "https://deepzz.com/post/the-consul-of-discovery-and-configure-services.html"
linktitle = "原文链接"
featured = ""
featuredalt = ""
featuredpath = ""
format = "Deepzz"
title = "consul 支持多数据中心的服务发现与配置共享工具"
type = "archive"

+++

consul 是一个支持多数据中心分布式高可用，用于服务发现和配置共享的工具。那么，之前已经有了众多的用于服务发现和配置的工具，如：etcd、zookeeper 等，为什么还冒出来个 consul？阅读 [Consul vs. Other Software](https://www.consul.io/intro/vs/index.html) 或许你可以找到答案。

consul 关键特性
---

- 服务发现：支持服务发现。你可以通过 DNS 或 HTTP 的方式获取服务信息。
- 健康检查：支持健康检查。可以提供与给定服务相关联的任何数量的健康检查（如 web 状态码或 cpu 使用率）。
- K/V 存储：键/值对存储。你可用通过 consul 存储如动态配置之类的相关信息。
- 多数据中心：支持多数据中心，开箱即用。
- WEB UI：支持 WEB UI。点点点，你就能够了解你的服务现在的运行情况，一目了然，对开发运维是非常友好的。 

    ![consul_web_ui](https://images.weserv.nl/?url=https://st.deepzz.com/blog/img/consul_web_ui.png)

consul 相较与 etcd、zookeeper 最大的特点就是：它整合了用户普遍的需求，开箱即用，降低了使用的门槛。

# consul 术语

首先介绍下在 consul 中会经常见到的术语：

- `node`：节点，需要 consul 注册发现或配置管理的服务器。
- `agent`：consul 中的核心程序，它将以守护进程的方式在各个节点运行，有 client 和 server 启动模式。每个 agent 维护一套服务和注册发现以及健康信息。
- `client`：agent 以 client 模式启动的节点。在该模式下，该节点会采集相关信息，通过 RPC 的方式向 server 发送。
- `server`：agent 以 server 模式启动的节点。一个数据中心中至少包含 1 个 server 节点。不过官方建议使用 3 或 5 个 server 节点组建成集群，以保证高可用且不失效率。server 节点参与 Raft、维护会员信息、注册服务、健康检查等功能。
- `datacenter`：数据中心，私有的，低延迟的和高带宽的网络环境。一般的多个数据中心之间的数据是不会被复制的，但可用过 ACL replication 或使用外部工具 onsul-replicate。
- `Consensus`，共识协议，使用它来协商选出 leader。
- `Gossip`：consul 是建立在 Serf，它提供完整的 gossip protocol，维基百科。
- `LAN Gossip`，Lan gossip 池，包含位于同一局域网或数据中心上的节点。
- `WAN Gossip`，只包含 server 的 WAN Gossip 池，这些服务器主要位于不同的数据中心，通常通过互联网或广域网进行通信。
- `members`：成员，对 consul 成员的称呼。提供会员资格，故障检测和事件广播。有兴趣的朋友可以深入研究下。

# consul 架构

consul 的架构是什么，官方给出了一个很直观的图片： 

![consul-arch.png](https://images.weserv.nl/?url=https://st.deepzz.com/blog/img/consul-arch.png)

这里存在两个数据中心：DATACENTER1、DATACENTER2。每个数据中心有着 3 到 5 台 server（该数量使得在故障转移和性能之间达到平衡）。

单个数据中心的所有节点都参与`LAN Gossip`池，也就是说该池包含了这个数据中心的所有节点。这有几个目的：

1. 不需要给客户端配置服务器地址，发现自动完成。
2. 检测节点故障的工作不是放在服务器上，而是分布式的。这使得故障检测比心跳方案更具可扩展性。
3. 事件广播，以便在诸如领导选举等重要事件发生时通知。

所有 server 节点也单独加入`WAN Gossip`池，因为它针对互联网的高延迟进行了优化。这个池的目的是允许数据中心以低调的方式发现对方。在线启动新的数据中心与加入现有的`WAN Gossip`一样简单。因为这些服务器都在这个池中运行，所以它也支持跨数据中心的请求。当服务器收到对不同数据中心的请求时，它会将其转发到正确数据中心中的随机服务器。那个服务器可能会转发给当地的领导。

这导致数据中心之间的耦合非常低，但是由于故障检测，连接缓存和复用，跨数据中心请求相对快速可靠。

一般来说，数据不会在不同的领事数据中心之间复制。当对另一数据中心的资源进行请求时，本地 consul 服务器将 RPC 请求转发给该资源的远程 consul 服务器并返回结果。如果远程数据中心不可用，那么这些资源也将不可用，但这不会影响本地数据中心。有一些特殊情况可以复制有限的数据子集，例如使用 consul 内置的 [ACL replication](https://www.consul.io/docs/guides/acl.html#outages-and-acl-replication) 功能，或外部工具如 [consul-replicate](https://github.com/hashicorp/consul-replicate)。

> 更多协议详情，你可以 [Consensus Protocol](https://www.consul.io/docs/internals/consensus.html) 和 [Gossip Protocol](https://www.consul.io/docs/internals/gossip.html)。

# consul 端口说明

consul 内使用了很多端口，理解这些端口的用处对你理解 consul 架构很有帮助：

| 端口         | 说明                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TCP/8300     | 8300 端口用于服务器节点。客户端通过该端口 RPC 协议调用服务端节点。服务器节点之间相互调用                                                                           |
| TCP/UDP/8301 | 8301 端口用于单个数据中心所有节点之间的互相通信，即对 LAN 池信息的同步。它使得整个数据中心能够自动发现服务器地址，分布式检测节点故障，事件广播（如领导选举事件）。 |
| TCP/UDP/8302 | 8302 端口用于单个或多个数据中心之间的服务器节点的信息同步，即对 WAN 池信息的同步。它针对互联网的高延迟进行了优化，能够实现跨数据中心请求。                         |
| 8500         | 8500 端口基于 HTTP 协议，用于 API 接口或 WEB UI 访问。                                                                                                             |
| 8600         | 8600 端口作为 DNS 服务器，它使得我们可以通过节点名查询节点信息。                                                                                                   |

# consul 安全

consul 由于采用了 gossip 机制和 RPC 系统来提供功能。这两种系统各自采用了不同的安全机制。其中 gossip 使用对称密钥提供加密，RPC 则可以使用客户端认证的端到端 TLS。

## Gossip 加密

要使用 Gossip 加密需要在启动 agent 的时候设置加密密钥。可以通过配置文件中的 encrypt 参数进行设置。

密钥必须是 16 字节，Base64 编码。consul 为我们方便的提供了一键生成的命令：

    $ consul keygen
    cg8StVXbQJ0gPvMd9o7yrg==

如何使用？在启动 agent 的时候，我们需要指定一个配置文件，配置文件中填入上面生成好的加密参数：

    $ cat config.json
    {"encrypt": "cg8StVXbQJ0gPvMd9o7yrg=="}

    $ consul agent -data-dir=/tmp/consul -config-file=config.json
    ==> WARNING: LAN keyring exists but -encrypt given, using keyring
    ==> WARNING: WAN keyring exists but -encrypt given, using keyring
    ==> Starting Consul agent...
    ==> Starting Consul agent RPC...
    ==> Consul agent running!
            Node name: 'Armons-MacBook-Air.local'
            Datacenter: 'dc1'
                Server: false (bootstrap: false)
        Client Addr: 127.0.0.1 (HTTP: 8500, HTTPS: -1, DNS: 8600, RPC: 8400)
        Cluster Addr: 10.1.10.12 (LAN: 8301, WAN: 8302)
        Gossip encrypt: true, RPC-TLS: false, TLS-Incoming: false
    ...

我们看到`Gossip encrypt: true`的打印，说明加密成功。

> 注意，consul 集群中的所有节点必须共享相同的加密密钥才能发送和接收集群消息。

### 如何在已有的集群上配置 Gossip？

该功能需要在版本 0.8.4 之后才能够使用，请悉知。

生成加密密钥`consul keygen`。
操作集群中所有的节点，在配置中设置`encrypt`键和`encrypt_verify_incoming`，并将`encrypt_verify_outgoing`设置为`false`。如此，代理将能够解密`gossip`，但尚未发送加密流量。
操作集群中所有的节点，删除`encrypt_verify_outgoing`设置（恢复为`true`）。agent 将发送加密的 gossip 消息，但任然允许传入未加密的流量。
操作集群中所有的节点，删除`encrypt_verify_incoming`设置（恢复为`true`）。所有的 agent 将严格执行加密的 gossip。

## RPC 加密

consul 支持使用 TLS 来验证服务器和客户端的真实性。推荐使用私有 CA，仅在内部使用。CA 的建立与 SSL 证书的办法可以参考：[基于 OpenSSL 自建 CA 和颁发 SSL 证书](https://deepzz.com/post/based-on-openssl-privateCA-issuer-cert.html)。

> 客户端证书必须启用客户端和服务器鉴定的 [Extended Key Usage](https://www.openssl.org/docs/manmaster/man5/x509v3_config.html#Extended-Key-Usage)。

TLS 可用于验证服务器和客户端的真实性。这些模式由`verify_outgoing`，`verify_server_hostname`以及`verify_incoming`控制。

`verify_outgoing`，设置该参数，agent 会验证出口连接。服务器节点必须提供由所有代理上存在的公共证书颁发机构签名的证书，通过 ca_file 和 ca_path 选项尽心设置。所有服务器节点都必须使用 cert_file 和使用适当的密钥对集合 key_file。

`verify_server_hostname`，则会进行主机名验证。所有服务器必须具有有效的证书 server.<datacenter>.<domain>，否则客户端将拒绝握手。该配置在 0.5.1 后有效，可以有效杜绝中间人攻击，新部署推荐为 true，旧部署依旧为 false。

`verify_incoming`，服务器将验证传入连接的真实性。所有客户端必须使用 cert_file 和 key_file。服务器也将禁止任何非 TLS 连接。要枪支客户端使用 TLS，verify_outgoing 也必须设置。

TLS 用于保护 agent 之间的 RPC 调用，但节点与节点之间的通信通过 UDP 完成并使用对称密钥进行保护。具体请参阅上节。

### 如何在现有集群上配置 TLS？

1. 为每个 agent 生成必要的私钥和证书以配置 ca_file/ca_path，cert_file 和 key_file。确保 verify_outgoing 和 verify_incoming 选项设置为 false。此时可以通过设置 https 端口来启用 API 的 HTTPS。
2. 重新启动集群中的每个 agent。此时，TLS 应该在每个 agent 上配置，但尚为启用 TLS。
3. （可选，仅限 Enterprise）
4. 更改 verify_incoming 和 verify_outgoing （verify_server_hostname 如果启用）设置 true。
5. 重新启动集群中的每个 agent。

此时，RPC 通信均用过 TLS 加密。

# 初体验

本文的重点来了，让我们一起实际动手搭建多数据中心的 consul 集群。

我们先来看一下我们需要搭建的集群架构： 

![consul-self-arch](https://images.weserv.nl/?url=https://st.deepzz.com/blog/img/consul-self-arch.jpg)

首先准备 5 台相对独立的服务器。这里测试，我通过 docker-machine 创建了 5 台：

    $ docker-machine ls
    NAME             ACTIVE   DRIVER       STATE     URL                         SWARM   DOCKER        ERRORS
    consul-client1   -        virtualbox   Running   tcp://192.168.99.112:2376           v17.07.0-ce
    consul-client2   -        virtualbox   Running   tcp://192.168.99.113:2376           v17.07.0-ce
    consul-server1   -        virtualbox   Running   tcp://192.168.99.109:2376           v17.07.0-ce
    consul-server2   -        virtualbox   Running   tcp://192.168.99.110:2376           v17.07.0-ce
    consul-server3   -        virtualbox   Running   tcp://192.168.99.111:2376           v17.07.0-ce

可以看到创建的 5 台机器的名称与 IP。由于虚拟机内部少了很多动态链接库，因此采用运行 docker 容器的方式，我们分别在每台机器上 

    $ docker pull consul

> consul 相关命令指南请到：[Consul Commands (CLI)](https://www.consul.io/docs/commands/index.html)。

准备我们需要的证书和加密密钥并配置为配置文件：

```bash
# 来看看 server1 的目录结构：
$ tree certs
├── certs
│   ├── ca.pem
│   ├── server1.key
│   └── server1.pem
├── config
│   └── config.json
├── data
└── run.sh

# server1 配置文件内容
$ consul keygen
KizkyBSFh+Q03ATW0Nwcgg==
$ cat config/config.json
{
    "datacenter": "dc1",
    "data_dir": "/consul/data",
    "server": true,
    "node_name": "server1",
    "log_level": "INFO",
    "bind_addr": "192.168.99.109",
    "bootstrap_expect": 3,

    "addresses": {
        "https": "0.0.0.0"
    },
    "ports": {
        "https": 8080
    },
    "encrypt": "KizkyBSFh+Q03ATW0Nwcgg==",
    "verify_incoming": true,
    "verify_outgoing": true,
    "ca_file": "/consul/certs/ca.pem",
    "cert_file": "/consul/certs/server1.pem",
    "key_file": "/consul/certs/server1.key"
}
```

需要说明的是，在 config.json -> ports 中端口设置为`-1`即为禁用：

```json
"ports": {
    "https": 8080,
    "http": -1
}
```

这样我们就不能够访问 HTTP API 了。当然开启也是没有问题的，因为它默认监听的是 127.0.0.1:8500，只有本地能够连接使用。

首先，我们先来验证共识协议，看一看选举 leader 的过程。

```bash
# 进入服务器 server1
$ docker-machine ssh consul-server1
# 创建 server1
$ docker run -d --net=host \
    --name server1 \
    -v $PWD/data:/consul/data \
    -v $PWD/config:/consul/config \
    -v $PWD/certs:/consul/certs \
    consul \
    consul agent -config-file=/consul/config
```

这种方式，`-bootstrap-expect 3`期待三个 server 加入才能完成 consul 的引导。继续添加 server2、server3：

```bash
# server2
docker run -d --net=host \
    --name server2 \
    -v $PWD/data:/consul/data \
    -v $PWD/config:/consul/config \
    -v $PWD/certs:/consul/certs \
    consul \
    consul agent -config-file=/consul/config \
        -join=192.168.99.109
        
# server3
docker run -d --net=host \
    --name server3 \
    -v $PWD/data:/consul/data \
    -v $PWD/config:/consul/config \
    -v $PWD/certs:/consul/certs \
    consul \
    consul agent -config-file=/consul/config \
        -join=192.168.99.109
```

再次查看信息，发现 server1 成为了 leader。停掉 leader，server2 成为了 leader。通过`consul info`获取相关信息：

```bash
$ docker run consul info -http-addr=192.168.99.109
Error querying agent: Get https://192.168.252.135:8501/v1/agent/self: remote error: tls: bad certificate

# 看来需要指定证书才行
$ docker run --rm --net=host consul \
    consul info -http-addr=192.168.99.109 \
    -ca-file=/consul/certs/ca.pem \
    -client-cert=/consul/certs/server1.pem \
    -client-key=/consul/certs/server1.key
```

我们还看到所有节点信息加入到了 LAN 池和 WAN 池：

    2017/09/06 09:13:25 [INFO] consul: Adding LAN server server3 (Addr: tcp/192.168.99.111:8300) (DC: dc1)
    ...


    2017/09/06 09:13:25 [INFO] consul: Handled member-join event for server "server2.dc1" in area "wan"
    ...

现在我们有了 3 台服务器节点：

    $ docker run --rm --net=host consul \
        consul members \
        -ca-file=/consul/certs/ca.pem \
        -client-cert=/consul/certs/server1.pem \
        -client-key=/consul/certs/server1.key
    Node     Address              Status  Type    Build  Protocol  DC
    server1  192.168.99.109:8301  alive   server  0.9.2  2         dc1
    server2  192.168.99.110:8301  alive   server  0.9.2  2         dc1
    server3  192.168.99.111:8301  alive   server  0.9.2  2         dc1

## WEB UI

WEB UI 也是通过 consul agent 启动，只需要再启动的时候加上 -ui，所以我们可以直接 下载 二进制文件：

```bash
$ docker run -d --net=host \
    --name server1 \
    -v $PWD/data:/consul/data \
    -v $PWD/config:/consul/config \
    -v $PWD/certs:/consul/certs \
    consul \
    consul agent -ui -config-file=/consul/config
```

启动成功后，就可以通过 https://192.168.99.109:8500/ui 进行访问了： 

![consul-web-ui2](https://images.weserv.nl/?url=https://st.deepzz.com/blog/img/consul-web-ui2.jpg)

## 服务发现

consul 支持两种服务发现的方式：

1. 通过 HTTP API 方式，这种方式需要额外编程，适用于不安装 consul agent 的情况，文档地址。
2. 通过 consul agent 配置的方式，agent 启动的时候会读取一个配置文件目录，通过配置进行服务的发现，文档地址。

这里介绍第二种方式，通过配置文件来进行服务发现。这里就需要用到我们的 client 服务器啦。

首先，用 Go 写一个简单的 HTTP 服务器：

```go
package main

import (
    "fmt"
    "net/http"
)

func HandleExample(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("hello man"))
}

func HandleHealth(w http.ResponseWriter, r *http.Request) {
    fmt.Println("health check!")
}

func main() {
    http.HandleFunc("/", HandleExample)
    http.HandleFunc("/health", HandleHealth)

    fmt.Println("listen on :9000")
    http.ListenAndServe(":9000", nil)
}
```

然后编辑一个配置文件 $PWD/config/web.json：

```json
{
    "service":
    {
        "name": "web",
        "tags": ["primary"],
        "address": "192.168.99.112",
        "port": 9000,
        "checks": [
        {
            "http": "http://localhost:9000/health",
            "interval": "10s"
        }]
    }
}
```

checks 的文档在[这里](https://www.consul.io/docs/agent/checks.html)。

启动一个客户端 agent：

```bash
docker run -d --net=host \
    --name clent1 \
    -v $PWD/data:/consul/data \
    -v $PWD/config:/consul/config \
    -v $PWD/certs:/consul/certs \
    consul \
    consul agent -config-dir=/consul/config \
        -join=192.168.99.109
```

启动之后，我们可以在服务器 server 上查看是否进行同步了。有两种方式：

1. HTTP API 查看，可通过 [List Nodes for Service](https://www.consul.io/api/catalog.html#list-nodes-for-service)。
2. DNS 查询，每个 agent 都会启动一个 DNS 服务器，通过该 DNS 服务器我们可以查询到节点信息。如：

        $ dig @127.0.0.1 -p 8600 web3.service.consul SRV
        
        ...
        ;; ANSWER SECTION:
        web.service.consul.     0       IN      A       192.168.99.112
        ...

## 配置共享

由与有了 agent client 和 server 模式的提供，配置共享也变得异常的简单。

在任意节点更新配置数据：

    $ consul kv put redis/config 192.168.99.133
    Success! Data written to: redis/config

整个集群均会自动更新，在 server1 节点查看数据：

    $ consul kv get redis/config
    192.168.99.133

ok，没有问题。更多更好的应用场景等你发掘。

