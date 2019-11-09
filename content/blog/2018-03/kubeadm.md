+++
author = "Jerry Chan"
categories = ["云原生"]
tags = ["K8S", "Container", "Docker"]
date = "2018-03-09"
description = "使用kubeadm安装kubernetes集群的方式"
featured = "kubernetes.jpg"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "使用kubeadm安装Kubernetes1.10.0"
type = "post"

+++

kubernetes可以使用多种容器`runtime`，此处使用当前最常见的`docker`。

安装docker
--------

在各种机器上安装docker的方式不同，我曾翻译过一篇ubuntu安装docker的文章，还有一些没来的及翻译的，可以参考官方文档。推荐的docker版本为v1.12，v1.11, v1.13 和 17.03 也行，其它的官方就没测试过了，不过我使用当前最新的v18.03也行。

# docker官方

1.  [使用Ubuntu安装docker-ce](https://www.geekare.com/2018/01/07/ubuntu%E5%AE%89%E8%A3%85-docker%E7%A4%BE%E5%8C%BA%E7%89%88/)
2.  Mac和Windows桌面安装docker-ce
    *   下载[Mac版本](https://download.docker.com/mac/stable/Docker.dmg)的docker-ce，执行即安装
    *   下载[Windows版本](https://download.docker.com/win/stable/Docker%20for%20Windows%20Installer.exe)的docker-ce，执行即可安装
3.  [CentOS安装docker-ce](https://docs.docker.com/install/linux/docker-ce/centos/)
4.  [Fedora安装docker-ce](https://docs.docker.com/install/linux/docker-ce/fedora/)
5.  [二进制安装方式](https://docs.docker.com/install/linux/docker-ce/binaries/)

# **kubernetes推荐**

*   Ubuntu/Debian/HypriotOS 从Ubuntu的库安装

    ```bash
    apt-get update
    apt-get install -y docker.io
    ```

    使用docker库安装v17.03

    ```bash
    apt-get update
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository \
        "deb https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") \
        $(lsb_release -cs) \
        stable"
    apt-get update && apt-get install -y docker-ce=$(apt-cache madison docker-ce | grep 17.03 | head -1 | awk '{print $3}')
    ```

*   CentOS/RHEL/Fedora

    ```bash
    yum install -y docker
    systemctl enable docker && systemctl start docker
    ```

*   Container Linux

    ```bash
    systemctl enable docker && systemctl start docker
    ```


如果安装速度太慢建议翻墙先把安装包下载回来。 文末附了红帽离线包供下载。

安装kubeadm、kubectl和kubelet
-------------------------

*   Ubuntu/Debian/HypriotOS

    ```bash
    apt-get update && apt-get install -y apt-transport-https curl
    curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
    cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
    deb http://apt.kubernetes.io/ kubernetes-xenial main
    EOF
    apt-get update
    apt-get install -y kubelet kubeadm kubectl
    ```

*   CentOS/RHEL/Fedora

    ```bash
    cat <<EOF > /etc/yum.repos.d/kubernetes.repo
    [kubernetes]
    name=Kubernetes
    baseurl=https://packages.cloud.google.com/yum/repos/kubernetes-el7-\$basearch
    enabled=1
    gpgcheck=1
    repo_gpgcheck=1
    gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
    EOF
    setenforce 0
    yum install -y kubelet kubeadm kubectl
    systemctl enable kubelet && systemctl start kubelet
    ```

    确保net.bridge.bridge-nf-call-iptables值为1

    ```bash
    cat <<EOF >  /etc/sysctl.d/k8s.conf
    net.bridge.bridge-nf-call-ip6tables = 1
    net.bridge.bridge-nf-call-iptables = 1
    EOF
    sysctl --system
    ```

*   Container Linux 先安装CNI插件

    ```bash
    CNI_VERSION="v0.6.0"
    mkdir -p /opt/cni/bin
    curl -L "https://github.com/containernetworking/plugins/releases/download/${CNI_VERSION}/cni-plugins-amd64-${CNI_VERSION}.tgz" | tar -C /opt/cni/bin -xz
    ```

    安装 kubeadm, kubelet, kubectl 并添加kubelet systemd服务：

    ```bash
    RELEASE="$(curl -sSL https://dl.k8s.io/release/stable.txt)"

    mkdir -p /opt/bin
    cd /opt/bin
    curl -L --remote-name-all https://storage.googleapis.com/kubernetes-release/release/${RELEASE}/bin/linux/amd64/{kubeadm,kubelet,kubectl}
    chmod +x {kubeadm,kubelet,kubectl}

    curl -sSL "https://raw.githubusercontent.com/kubernetes/kubernetes/${RELEASE}/build/debs/kubelet.service" | sed "s:/usr/bin:/opt/bin:g" > /etc/systemd/system/kubelet.service
    mkdir -p /etc/systemd/system/kubelet.service.d
    curl -sSL "https://raw.githubusercontent.com/kubernetes/kubernetes/${RELEASE}/build/debs/10-kubeadm.conf" | sed "s:/usr/bin:/opt/bin:g" > /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
    ```

    enable并启动kubelet

    ```bash
    systemctl enable kubelet && systemctl start kubelet
    ```


在主节点上配置kubelet使用的cgroup驱动程序
---------------------------

确保docker使用的cgroup驱动和kubelet一样

```bash
docker info | grep -i cgroup
cat /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
```

如果不同则，使kubelet与docker的cgroup驱动相同

```bash
sed -i "s/cgroup-driver=systemd/cgroup-driver=cgroupfs/g" /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
```

重启kubelet

```bash
systemctl daemon-reload
systemctl restart kubelet
```

文末附了红帽离线包供下载。

[创建集群](https://kubernetes.io/docs/setup/independent/create-cluster-kubeadm/)
----------------------------------------------------------------------------

离线安装
----

> yum安装离线资源 docker load 装载离线的docker镜像

# 资源

- CentOS安装kubeadm需要的相关资源：（链接: https://pan.baidu.com/s/1r7-LqH1Ju-5YTAIvRTcIUg 密码: c2nf）
- 安装kubernetes需要的Docker镜像：（链接: https://pan.baidu.com/s/1fGQtWnuvxJ7pXK5attP8Jw 密码: mty5）
