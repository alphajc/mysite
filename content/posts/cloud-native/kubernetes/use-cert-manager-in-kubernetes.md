---
title: 使用 cert-manager 自动管理 tls 证书
date: 2019-11-09T08:49:39+08:00
hero: /assets/images/posts/cloud-native/lets-encrypt-ssl.png
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- cloud-native
- kubernetes
tags:
- k8s
- tls
- cert-manager
description: "Let's Encrypt 是免费、开放和自动化的证书颁发机构，我们可以利用 ACME 协议从 Let's Encrypt 免费获取 tls 证书。在一般的环境中我们可以使用 certbot，在 kubernetes/openshif 中，有个叫 cert-manager 的工具可以提供类似功能，本文主要阐述该工具的使用。"
---


http 协议是一个全明文传输的协议，不加任何处理的 http 报文将在因特网中裸奔，只要有人对监听你的报文，你所有隐私将被人一览无余。Let’s Encrypt 是一家免费、开放、自动化的证书颁发机构（CA），为公众的利益而运行。它是一项由 [Internet Security Research Group（ISRG）](https://www.abetterinternet.org/)提供的服务。本着想要创建一个更安全，更尊重隐私的 Web 环境的初衷，Let’s Encrypt 以尽可能对用户友好的方式免费提供为网站启用 HTTPS（SSL/TLS）所需的数字证书。

![http_to_https](/assets/images/posts/cloud-native/http_to_https-1.jpg)

但是 Let’s Encrypt 颁发的证书有个特点，有效期只有三个月。这意味着我们需要频繁续期证书，倘若手动续期，无疑会增加运维成本。有什么方式可以为我们自动颁发证书吗？当然有！[ACME](https://tools.ietf.org/html/rfc8555) 无疑就是我们的最佳选择。

有一款很好用的 ACME 客户端叫 [Certbot](https://certbot.eff.org/about/)，可以帮助自动颁发、续期证书。在 kubernetes 的生态中有没有什么好的工具能帮助我们非常方便地使用证书么？当然有，那就是本期主题——[**cert-manager**](https://docs.cert-manager.io/en/latest/)。

cert-manager 是本地 Kubernetes 证书管理控制器。它可以帮助从各种来源颁发证书，例如 Let's Encrypt，HashiCorp Vault，Venafi，简单的签名密钥对或自签名。它将确保证书有效并且是最新的，并在到期前尝试在配置的时间续订证书。

原理比较简单，本文就不讲了，主要谈谈来安装和使用。

## 安装

### YAML 安装

1. 创建 namespace

    ```bash
    kubectl create namespace cert-manager
    ```

2. 安装 crd 和 cert-manager

    ```bash
    kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v0.11.0/cert-manager.yaml
    ```

    > 值得说明的是：在 kubernetes 1.15 以前的版本需要在执行`kubectl apply`时添加一个参数`--validate=false`，否则在创建 CustomResourceDefinition 资源时会收到与 x-kubernetes-preserve-unknown-fields 字段有关的验证错误。

### helm 安装

依次执行下述命令：

```bash
# Install the CustomResourceDefinition resources separately
kubectl apply --validate=false -f https://raw.githubusercontent.com/jetstack/cert-manager/release-0.11/deploy/manifests/00-crds.yaml

# Create the namespace for cert-manager
kubectl create namespace cert-manager

# Add the Jetstack Helm repository
helm repo add jetstack https://charts.jetstack.io

# Update your local Helm chart repository cache
helm repo update

# Install the cert-manager Helm chart
helm install \
  --name cert-manager \
  --namespace cert-manager \
  --version v0.11.0 \
  jetstack/cert-manager
```

### 确认安装

```
kubectl get pods --namespace cert-manager

NAME                                       READY   STATUS    RESTARTS   AGE
cert-manager-5c6866597-zw7kh               1/1     Running   0          2m
cert-manager-cainjector-577f6d9fd7-tr77l   1/1     Running   0          2m
cert-manager-webhook-787858fcdb-nlzsq      1/1     Running   0          2m
```

## 使用

### 创建 issuer

在建好 cert-manager 后，我们需要继续创建 issuer 才能颁发证书。有两种 issuer 可供我们选择：ClusterIssuer 和 Issuer，两都配置方式都是一样的，所不同的是作用域。ClusterIssuer，顾名思义是在集群中使用，作用域为所有命名空间，相对应的 Issuer 只作用于所在的命名空间。一般用 ClusterIssuer 比较方便。这里也通过 ClusterIssuer 举例。

证书的验证方式也有两种，一个是 http-01，另一个是 dns-01，由于 dns-01 需要域名解析服务商的支持，所以，在这里就没有使用了。有关这两种方式的详细说明参照 https://letsencrypt.org/zh-cn/docs/challenge-types/。

1. 创建一个名叫`letsencrypt-staging.yaml`的文件，内容是：

    ```yaml
    apiVersion: cert-manager.io/v1alpha2
    kind: ClusterIssuer
    metadata:
        name: letsencrypt-staging
    spec:
        acme:
            # You must replace this email address with your own.
            # Let's Encrypt will use this to contact you about expiring
            # certificates, and issues related to your account.
            email: user@example.com
            server: https://acme-staging-v02.api.letsencrypt.org/directory
            privateKeySecretRef:
            # Secret resource used to store the account's private key.
                name: example-issuer-account-key
            # Add a single challenge solver, HTTP01 using nginx
            solvers:
            - http01:
                ingress:
                    class: nginx
    ```

2. 通过`kubectl`安装：

    ```bash
    kubectl apply -f letsencrypt-staging.yaml
    ```

3. 确保创建成功

    ```
    kubectl describe clusterissuer letsencrypt-staging
    ...
    Status:
    Acme:
        Uri:  https://acme-staging-v02.api.letsencrypt.org/acme/acct/7571319
    Conditions:
        Last Transition Time:  2019-01-30T14:52:03Z
        Message:               The ACME account was registered with the ACME server
        Reason:                ACMEAccountRegistered
        Status:                True
        Type:                  Ready
    ```

> Let's Encrypt 不支持通过 HTTP-01 的方式颁发通配符证书。要颁发通配符证书，必须使用DNS-01。

### 单独颁发

单独颁发证书，其实是一种手动的方式，一般不这么使用，但这却能加深我们对这整套流程的理解。颁发证书即创建并处理 Certificate 资源的过程。

1. 有如下`certificate-example.yaml`文件：

    ```yaml
    apiVersion: cert-manager.io/v1alpha2
    kind: Certificate
    metadata:
        name: acme-crt
    spec:
        secretName: acme-crt-secret
        dnsNames:
        - foo.example.com
        issuerRef:
            name: letsencrypt-stagging
            kind: ClusterIssuer
    ```

2. 使用`kubectl`创建 Certificate：

    ```bash
    kubectl apply -f certificate-example.yaml
    ```

    > 注：这前提是域名得配置好了

3. 静待 1-2 分钟：

    执行下述命令，静待`READY`值变成`True`
    ```bash
    kubectl get certificate acme-crt -w
    ```

4. 错误排查：

    如果整个颁发过程出现问题导致证书颁发失败，可以利用`kubectl describe`查看对应的 order 进行排查。`order`是一个订单，记录了这笔交易（虽然我们并未花钱），这可以告诉我们失败的原因。

    ```bash
    kubcectl describe order acme-crt
    ```

### 指定 issuer 颁发

更多的时候我们不需要手动创建 Certificate，只需要在创建 Ingress 时作好对应的注释，cert-manager 就将自动为我们创建。对应的 yaml 文件大致是长这样的：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    acme.cert-manager.io/http01-edit-in-place: "true"
    cert-manager.io/cluster-issuer: letsencrypt-stagging
    kubernetes.io/ingress.class: nginx
  name: example
spec:
  rules:
  - host: foo.example.com
    http:
      paths:
      - backend:
          serviceName: example
          servicePort: 9000
        path: /
  tls:
  - hosts:
    - foo.example.com
    secretName: acme-crt-secret
```

这将自动创建一个与上一步骤中相同的 Certificate。

> 注：`acme.cert-manager.io/http01-edit-in-place: "true"`这明 http-01 验证将就在这个 Ingress 中进行而不会另行创建。

### 配置默认 issuer

在 cert-manager 的启动命令中加上这么两句：

```
--set ingressShim.defaultIssuerName=letsencrypt-stagging \
--set ingressShim.defaultIssuerKind=ClusterIssuer
```

这就为 cert-manager 设置了一个默认的 Issuer 了，设置成功后，我们就可以把 Ingress 资源中的`cert-manager.io/cluster-issuer: letsencrypt-stagging`改成`kubernetes.io/tls-acme: "true"`效果是完全一样的。
