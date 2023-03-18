---
title: 通过 kubeadm 安装 kubernetes 1.26
date: 2023-03-18T18:04:55+08:00
hero: /assets/images/default.jpeg
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- cloud-native
- kubernetes
tags:
- k8s
- kubeadm
- cri-o
- containerd
description: 通过 kubeadm 安装 kubernetes 1.26，其中 master 运行时为 cri-o，worker 为 containerd，帮你熟悉不同运行时的安装。
---

# 环境准备

master 节点使用 cri-o、worker 节点使用 containerd 作为运行时

## master 节点

- 操作系统：Ubuntu Server 22.04 LTS
- 规格：2c4g
- cloud-master1 10.67.3.9
- cloud-master2 10.67.3.13
- cloud-master3 10.67.3.15

## worker 节点

- 操作系统：Ubuntu Server 22.04 LTS
- 规格：2c2g
- VM-2-42-ubuntu 10.67.2.42

## 负载均衡

- 43.135.64.117

# 节点配置

所有节点都需要的初始化配置，含 master 和 worker 节点

## 安装 kubeadm、kubelet、kubectl

1. 更新 `apt` 包索引并安装使用 Kubernetes `apt` 仓库所需要的包：
    
    ```bash
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl
    ```
    
2. 下载 Google Cloud 公开签名秘钥：
    
    ```bash
    sudo curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg
    ```
    
3. 添加 Kubernetes `apt` 仓库：
    
    ```bash
    echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
    ```
    
4. 更新 `apt` 包索引，安装 kubelet、kubeadm 和 kubectl，并锁定其版本：
    
    ```bash
    sudo apt-get update
    sudo apt-get install -y kubelet kubeadm kubectl
    sudo apt-mark hold kubelet kubeadm kubectl
    ```
    

## 配置操作系统

### ****转发 IPv4 并让 iptables 看到桥接流量****

执行下述指令：

```bash
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

*# 设置所需的 sysctl 参数，参数在重新启动后保持不变*
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

*# 应用 sysctl 参数而不重新启动*
sudo sysctl --system
```

通过运行以下指令确认 `br_netfilter` 和 `overlay` 模块被加载：

```bash
lsmod | grep br_netfilter
lsmod | grep overlay
```

通过运行以下指令确认 `net.bridge.bridge-nf-call-iptables`、`net.bridge.bridge-nf-call-ip6tables` 和 `net.ipv4.ip_forward` 系统变量在你的 `sysctl` 配置中被设置为 1：

```bash
sysctl net.bridge.bridge-nf-call-iptables net.bridge.bridge-nf-call-ip6tables net.ipv4.ip_forward
```

# 创建高可用控制面

## 配置负载均衡器

43.135.64.117:443 → 10.67.3.9:6443、10.67.3.13:6443、10.67.3.15:6443

## 配置 master 运行时

### 查看默认 cgroup 驱动

```bash
stat -fc %T /sys/fs/cgroup/
```

### 安装 CRI-O

root 执行

```bash
export OS=xUbuntu_22.04
export VERSION=1.26

echo "deb [signed-by=/usr/share/keyrings/libcontainers-archive-keyring.gpg] https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/$OS/ /" > /etc/apt/sources.list.d/devel:kubic:libcontainers:stable.list
echo "deb [signed-by=/usr/share/keyrings/libcontainers-crio-archive-keyring.gpg] https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable:/cri-o:/$VERSION/$OS/ /" > /etc/apt/sources.list.d/devel:kubic:libcontainers:stable:cri-o:$VERSION.list

mkdir -p /usr/share/keyrings
curl -L https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/$OS/Release.key | gpg --dearmor -o /usr/share/keyrings/libcontainers-archive-keyring.gpg
curl -L https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable:/cri-o:/$VERSION/$OS/Release.key | gpg --dearmor -o /usr/share/keyrings/libcontainers-crio-archive-keyring.gpg

apt-get update
apt-get install cri-o cri-o-runc
```

CRI-O 默认也使用 systemd cgroup 驱动

### 启动 CRI-O

```bash
systemctl enable crio
systemctl start crio
```

## 配置控制面

### 初始化 master1

```bash
sudo kubeadm init --control-plane-endpoint "43.135.64.117:443" --upload-certs
```

- 成功后得到如下输出：
    
    ```bash
    Your Kubernetes control-plane has initialized successfully!
    
    To start using your cluster, you need to run the following as a regular user:
    
      mkdir -p $HOME/.kube
      sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
      sudo chown $(id -u):$(id -g) $HOME/.kube/config
    
    Alternatively, if you are the root user, you can run:
    
      export KUBECONFIG=/etc/kubernetes/admin.conf
    
    You should now deploy a pod network to the cluster.
    Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
      https://kubernetes.io/docs/concepts/cluster-administration/addons/
    
    You can now join any number of the control-plane node running the following command on each as root:
    
      kubeadm join 43.135.64.117:443 --token 3639bw.3f5i3dooplnd982i \
    	--discovery-token-ca-cert-hash sha256:e66819320b79ccab1ca6f570db82fd67d1d17c2f59e8091779a4c99a3c0f37c6 \
    	--control-plane --certificate-key 30c003d1c1d480f0c4c6df6bdba9d097b2e771013e11430bec4a4151afd730fc
    
    Please note that the certificate-key gives access to cluster sensitive data, keep it secret!
    As a safeguard, uploaded-certs will be deleted in two hours; If necessary, you can use
    "kubeadm init phase upload-certs --upload-certs" to reload certs afterward.
    
    Then you can join any number of worker nodes by running the following on each as root:
    
    kubeadm join 43.135.64.117:443 --token 3639bw.3f5i3dooplnd982i \
    	--discovery-token-ca-cert-hash sha256:e66819320b79ccab1ca6f570db82fd67d1d17c2f59e8091779a4c99a3c0f37c6
    ```
    

- 要重新上传证书并生成新的解密密钥，请在已加入集群节点的控制平面上使用以下命令：
    
    ```bash
    kubeadm token create --print-join-command
    ```
    

### 初始化其它 master

命令来自于前面初始化得到的输出：

```bash
kubeadm join 43.135.64.117:443 --token 3639bw.3f5i3dooplnd982i \
	--discovery-token-ca-cert-hash sha256:e66819320b79ccab1ca6f570db82fd67d1d17c2f59e8091779a4c99a3c0f37c6 \
	--control-plane --certificate-key 30c003d1c1d480f0c4c6df6bdba9d097b2e771013e11430bec4a4151afd730fc
```

# 创建计算节点

## 配置 worker 运行时

### 查看默认 cgroup 驱动

```bash
stat -fc %T /sys/fs/cgroup/
```

### 安装 containerd

1. 安装 containerd
    
    ```bash
    sudo apt-get update
    sudo apt-get install \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    sudo mkdir -m 0755 -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    sudo apt-get update
    sudo apt-get install containerd.io
    ```
    
2. 安装 cni
    
    ```bash
    wget https://github.com/containernetworking/plugins/releases/download/v1.2.0/cni-plugins-linux-amd64-v1.2.0.tgz
    sudo mkdir -p /opt/cni/bin
    sudo tar Cxzvf /opt/cni/bin cni-plugins-linux-amd64-v1.2.0.tgz
    ```
    
3. 安装 containerd
    
    ```bash
    wget https://github.com/containerd/containerd/releases/download/v1.6.16/containerd-1.6.16-linux-amd64.tar.gz
    sudo tar Cxzvf /usr/local/ containerd-1.6.16-linux-amd64.tar.gz
    ```
    
4. 配置 containerd
    
    ```bash
    containerd config default > /etc/containerd/config.toml
    ```
    
    结合 `runc` 使用 `systemd` cgroup 驱动，在 `/etc/containerd/config.toml` 中设置：
    
    ```toml
    [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
      ...
      [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
        SystemdCgroup = true
    ```
    
5. 安装 CNI
    
    ```bash
    wget https://github.com/containernetworking/plugins/releases/download/v1.2.0/cni-plugins-linux-amd64-v1.2.0.tgz
    sudo mkdir -p /opt/cni/bin
    sudo tar Cxzvf /opt/cni/bin cni-plugins-linux-amd64-v1.2.0.tgz
    ```
    
6. 配置 CNI
    
    ```bash
    sudo mkdir /etc/cni/net.d/
    sudo cat << EOF > /etc/cni/net.d/100-containerd-bridge.conflist
    {
      "cniVersion": "1.0.0",
      "name": "containerd",
      "plugins": [
        {
          "type": "bridge",
          "bridge": "cni0",
          "isGateway": true,
          "ipMasq": true,
          "hairpinMode": true,
          "ipam": {
            "type": "host-local",
            "routes": [
                { "dst": "0.0.0.0/0" },
                { "dst": "::/0" }
            ],
            "ranges": [
                [{ "subnet": "10.85.0.0/16" }],
                [{ "subnet": "1100:200::/24" }]
            ]
          }
        }
      ]
    }
    EOF
    ```
    
7. systemd 启动
    
    ```bash
    systemctl enable containerd
    systemctl start containerd
    ```
    

### 加入集群

```bash
sudo kubeadm join 43.135.64.117:443 --token 3639bw.3f5i3dooplnd982i \
	--discovery-token-ca-cert-hash sha256:e66819320b79ccab1ca6f570db82fd67d1d17c2f59e8091779a4c99a3c0f37c6
```