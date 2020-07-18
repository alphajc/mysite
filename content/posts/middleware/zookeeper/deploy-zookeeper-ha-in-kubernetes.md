---
title: Kubernetes 中部署高可用的 Zookeeper
date: 2019-11-02T08:01:06+08:00
hero: /assets/images/posts/middleware/zookeeper.png
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- middleware
- zookeeper
tags:
- k8s
- zookeeper
- tke
description: 最近在 kubernetes 中部署高可用的 zookeeper，遇到了不少坑，遂将其记录下来。这是系列文章中的第一篇，主要阐述在 k8s 中 zookeeper 的部署
---


本文主要使用 [helm chart](https://github.com/helm/charts/tree/master/incubator/zookeeper) 进行 zookeeper 的高可用部署。

## 环境说明

本文使用的是 TKE 托管环境，在该环境中安中了 cbs-csi 的 operator，为了方便持久卷备份，后文中的持久化存储会统一采用。CSI的解决方案在各种环境中都会有，我仅描述 cbs。

- kubernetes 版本：`v1.14.3-tke.4`
- helm 版本：`v2.10.0`（TKE控制台支持的版本）
- 按步骤安装好的 [cbs-csi](https://github.com/TencentCloud/kubernetes-csi-tencentcloud)

    > 值得说明的是 cbs 存储不可跨可用区挂载，默认情况下先建存储再建 pod 的方式无法满足生产需要，所以才引入的 cbs-csi。但在建立 storageClass 时要注意加入 `volumeBindingMode: WaitForFirstConsumer` 以保证 pod 完成调度之后再创建卷，从而使得存储不用影响 pod 的调度。sc 参考如下：
    ```yaml
    apiVersion: storage.k8s.io/v1
    kind: StorageClass
    metadata:
    annotations:
        storageclass.beta.kubernetes.io/is-default-class: "true"
    name: cbs-csi-topo
    parameters:
        diskType: CLOUD_PREMIUM
    provisioner: com.tencent.cloud.csi.cbs
    reclaimPolicy: Delete
    volumeBindingMode: WaitForFirstConsumer
    ```
- 已经部署好了的 prometheus 的监控方案，包括 `serviceMonitor` 这样的 CRD

## 部署

1. 下载 chart：
    
    ```bash
    git clone git@github.com:helm/charts.git
    ```

2. 确定部署参数：
    
    部署时传参有命令行和文件两种方式，这里创建一个 `custom.yaml` 的文件，填入想要修改的变量
    ```yaml
    exporters:
    jmx:
        enabled: true # jmx 监控
    zookeeper:
        enabled: true # zookeeper 应用级监控
    prometheus:
        serviceMonitor:
            enabled: true # 使用 serviceMonitor 作为 prometheus 的配置方案
            selector:
                release: monitor # 这需要与 promethus 的 serviceMonitorSelector.matchLabels 匹配，否则 promethus 无法获取该配置
    persistence:
        storageClass: cbs-csi-topo # 符合需求的 sc
        size: 10Gi # zookeeper 持久卷的大小，视数据大小而定
    image:
        tag: 3.5.6 # zookeepr 的镜像版本，从 https://hub.docker.com/_/zookeeper 选择自己需要的
    # 如果以上这些参数还满足不也自己的需求，就在 values.yaml 中找
    ```
3. 安装
    
    ```bash
    helm install --namespace <NS> -f custom.yaml incubator/zookeeper
    ```
    这会生成一个名字随机的 Release，解决了取名字的烦恼，也可以通过 `--name` 指定名字，如果是二次安装，环境对原来的名字形成了依赖，则需要指定原来的名字。
