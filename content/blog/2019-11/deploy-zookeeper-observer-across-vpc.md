+++

author = "Jerry Chan"
categories = ["技术"]
tags = ["zookeeper", "tke", "kubernetes"]
date = "2019-11-02T09:15:21+08:00"
description = "最近在 kubernetes 中部署高可用的 zookeeper，遇到了不少坑，遂将其记录下来。这是系列文章中的第二篇，主要讲如何跨 VPC 部署 zookeeper observer，并用集群中的 prometheus 对其进行监控"
featured = "zookeeper.png"
featuredalt = "zookeeper"
featuredpath = "assets/cover"
title = "跨 VPC 部署 zookeeper observer"
type = "post"

+++

## 场景说明
某云提供商网络技术更新迭代，遗留下了基础网络和 VPC 网络两种网络架构，我们公司目前的服务器还大多都在基础网络中。我在新环境中搭建了 kubernetes 集群，并在上面部署了高可用的 zookeeper 集群。配置中心方案是一个全局方案，公司大大小小的项目陆陆续续都会上，为了便于维护与迁移，我们采用一套环境统一管理。此时，集群内的 zookeeper 已经由 helm 部署完成。

## 需求
- 一台已经安装了 docker 和 docker-compose 的位于基础网络服务器（作为 zookeeper observer，为避免单点故障最好备两台及以上)
- 已经安装好三个结点的 zookeeper 的 kubernetes 的集群

## 操作流程
### 1. 基础网络互通
这个步骤具体怎么做我就不提了，每个云服务商可能不同，但并不是什么难点。达到的效果就是将 kubernetes 集群所在的 VPC 和 observer 服务器可以互联互通

### 2. 向内网暴露 zk 集群相关服务
利用 statefulSet 会为每个 pod 生成的一个特殊的 label，为每一个 zookeeper 的 pod 建立内网 LB 类型的 Service。  
这里有一个创建其中一个 svc 的例子：
```yaml
apiVersion: v1
kind: Service
metadata:
  annotations: # 这里边是与云服务商强相关的一些配置，不具备通用性但仍然具有参考价值，这里需要配置不然默认是公网 LB
    service.kubernetes.io/qcloud-loadbalancer-clusterid: cls-xxxxxx # 确定 tke 集群
    service.kubernetes.io/qcloud-loadbalancer-internal-subnetid: subnet-xxxxxx # 确定子网
  name: zk0
  namespace: kube-public # zk 所在的 ns
spec:
  ports:
  - name: tcp-2888-2888 # 数据同步端口
    port: 2888
    protocol: TCP
    targetPort: 2888
  - name: tcp-3888-3888 # 选举端口
    port: 3888
    protocol: TCP
    targetPort: 3888
  selector:
    app: zookeeper
    component: server
    release: xxx
    statefulset.kubernetes.io/pod-name: xxx-zookeeper-0 # 有了这个其实其它 label 可以省略
  type: LoadBalancer # service 类型
```
创建完成后，可以通过命令查看 LB 的 ip 地址：
```
[root@VM_64_11_centos zookeeper]# kubectl -n kube-public get svc
NAME                      TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)                         AGE
zk0                       LoadBalancer   172.16.255.8     10.1.0.12     2888:30734/TCP,3888:30513/TCP   2d15h
zk1                       LoadBalancer   172.16.255.66    10.1.0.13     2888:32569/TCP,3888:32718/TCP   2d14h
zk2                       LoadBalancer   172.16.255.105   10.1.0.6      2888:32189/TCP,3888:30692/TCP   2d14h
```
`EXTERNAL-IP` 即为 LB 的 ip 地址，我们可以通过这个地址访问到对应的 pod 在 2888 和 3888 两个端口上提供的服务。记录下这三个 IP 地址，在配置 observer 的时候会用到。

### 3. 创建 observer 所需环境
根据上一步得到的 ip，创建配置文件。
```bash
mkdir -p /data/zookeeper/
cd /data/zookeeper/
cat > zoo.cfg << EOF
clientPort=2181
dataDir=/var/lib/zookeeper/data
dataLogDir=/var/lib/zookeeper/log
tickTime=2000
initLimit=5
syncLimit=10
maxClientCnxns=60
minSessionTimeout=4000
maxSessionTimeout=40000
autopurge.snapRetainCount=3
autopurge.purgeInteval=0
peerType=observer
4lw.commands.whitelist=*
server.1=10.1.0.12:2888:3888
server.2=10.1.0.13:2888:3888
server.3=10.1.0.6:2888:3888
server.4=localhost:2888:3888:observer
EOF
```
创建存储
```bash
docker volume create zookeeper_data
mkdir -p /var/lib/docker/volumes/zookeeper_data/_data/data/version-2/ /var/lib/docker/volumes/zookeeper_data/_data/log/version-2/
echo 4 > /var/lib/docker/volumes/zookeeper_data/_data/data/myid
chown 1000:1000 /var/lib/docker/volumes/zookeeper_data/_data/data/version-2/ /var/lib/docker/volumes/zookeeper_data/_data/log/version-2/
```
创建 docker-compose.yaml
```bash
cat > docker-compose.yaml << EOF
version: "3"
services:
  zookeeper:
    image: zookeeper
    ports:
    - "2181:2181"
    volumes:
      - "./zoo.cfg:/conf/zoo.cfg"
      - "data:/var/lib/zookeeper"
  exporter:
    depends_on:
    - zookeeper
    image: josdotso/zookeeper-exporter:v1.1.2
    ports:
    - "9141:9141"
    command:
    - -bind-addr=:9141
    - -metrics-path=/metrics
    - -zookeeper=zookeeper:2181
    - -log-level=info
    - -reset-on-scrape=true

volumes:
  data:
EOF
```

### 4. 启动 observer
```bash
docker-compose up -d
```
至此 zookeeper observer 已经启动

### 5. 为 observer 配置监控

> 思路：将集群外的 observer 以无 selector 的 service 的形式挂到 kubernetes 集群中，打好 label 供 serviceMonitor 匹配即可

创建文件 zk-ob-external.yaml
```yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    app: zookeeper
    release: xxx
    position: external
  name: xxx-zookeeper-external
spec:
  ports:
  - name: zookeeperxp
    port: 9141
    protocol: TCP
    targetPort: zookeeperxp
---
apiVersion: v1
kind: Endpoints
metadata:
  labels:
    app: zookeeper
    release: xxx
    position: external
  name: xxx-zookeeper-external
subsets:
- addresses:
  - ip: 10.104.170.174
  - ip: 10.104.42.205
  ports:
  - name: zookeeperxp
    port: 9141
    protocol: TCP
```

> 注意 label 要与对应 serviceMonitor 中 selector.matchLabels 匹配，端口名要一致