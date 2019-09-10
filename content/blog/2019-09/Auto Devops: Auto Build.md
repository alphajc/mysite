+++

author = "Jerry Chan"
categories = ["技术"]
tags = ["kubernetes", "gitlab"]
date = "2019-09-08T18:37:36+08:00"
description = "gitlab 作为代码仓库，连接 kubernetes 中的 gitlab-runner 以实现自动化构建的基础环境。有关 gitlab-runner 的中文文档其实不多，本文将对 gitlab-runner 的使用进行简要介绍。"
featured = "GitLab-Kubernetes-Running-CI-Runners-in-Kubernetes.png"
featuredalt = ""
featuredpath = "assets/blog/2019-09"
title = "自动化运维之自动构建"
type = "post"

+++

按例需要说明的是本人水平有限，我会尽量保证文章准确无误，但如果不幸产生任何错误，望不吝赐教。

## 浅析 gitlab-runner 相关配置

在 gitlab-runner 中每个 runner 都需要指定 [executor](https://docs.gitlab.com/runner/executors/)，executor 有以下几种类型：

- SSH
- Shell
- Parallels
- VirtualBox
- Docker
- Docker Machine (auto-scaling)
- Kubernetes
- Custom

我们会将 gitlab-runner 部署在 kubernetes 集群中，所以此处选用 kubernetes 作为 executor。有关该 executor 的配置方式，在[官方文档](https://docs.gitlab.com/runner/executors/kubernetes.html)中有详细说明，此处就此次配置所需要的进行简单说明，其它的再视情况进行补充。

与其它类型的 executor 一样，kubernetes 也需要根据 gitlab 仓库的 url 和 token 对 runner 进行注册方可使用。注册后会有一个常驻的 pod （我姑且叫它 runner 服务端）对来自于 gitlab 的 pipeline 任务进行监听，当监听到有新的任务需要执行时，就会创建新的 pipeline 跑 `.gitlab-ci.yml` 上对应的job。所以 runner 服务端相关联的 ServieAccount 一定需要具备对应的 namespace 的 pod 的创建的权限。

配置一个 runner 有多种方式，包括启动参数、环境变量、配置文件等。这其中配置文件的功能最强，参数可配置项较环境变量稍多（或许它们具有相同的能力，只是我没有发现，如果你知道欢迎帮忙补充）。通过`gitlab-runner help register`命令我们可以找到所有的启动参数和环境变量，参数与环境变量之间的关系请参照 {{< url-link "参数与环境变量对照表" "https://gist.github.com/canovie/e2c19fa624ccc29fb3af0803e9afcb22" "_blank">}}。

### runner 的集群中权限

前面已经谈到 runner 服务端在注册成功监听到新的任务后，需要以 Pod 的形式创建 Worker 对新对任务进行处理。这里我们需要考虑几种权限：Pod 的操作权限、Worker 镜像的拉取权限以及在 Worker 中构建镜像时对私有镜像的拉取权限。

Pod 的操作权限通过 kubernetes 中的 ServiceAccount 来实现，我们需要赋予对应的 ServiceAccount 对指定命名空间的 Pod 的操作权限，相关的参数有`--kubernetes-namespace`和`--kubernetes-service-account`以及他们环境变量的开关参数`--kubernetes-namespace_overwrite_allowed`和`--kubernetes-service_account_overwrite_allowed`。这里指定的 ServiceAccount 一定要在指定的 Namespace 中有 Pod 的操作权限，否则 gitlab 在跑 pipeline 的时候会报权限错误。有关 ServiceAccount 的权限配置是通过 RBAC 实现的，详情参照{{< url-link "kubernetes 中 RBAC 认证的文档" "https://kubernetes.io/docs/reference/access-authn-authz/rbac/" "_blank" >}}。

对于 Worker 镜像的拉取权限，一般都是在集群创建时预先配置好的，此处无需另行配置。而 Worker 中构建镜像时对私有镜像的拉取和推送权限是在 `.gitlab-ci.yml`中进行配置的，这里不要搞混。

### runner 的持久化存储

runner 可以使用 hostPath 和 PVC 做持久化存储，跟 Kubernetes 中的概念完全一样。用法参照{{< url-link "使用卷" "https://docs.gitlab.com/runner/executors/kubernetes.html#using-volumes" "_blank" >}}，参考配置如下：

```toml
concurrent = 4

[[runners]]
  # usual configuration
  executor = "kubernetes"
  [runners.kubernetes]
    [[runners.kubernetes.volumes.host_path]]
      name = "hostpath-1"
      mount_path = "/path/to/mount/point"
      read_only = true
      host_path = "/path/on/host"
    [[runners.kubernetes.volumes.host_path]]
      name = "hostpath-2"
      mount_path = "/path/to/mount/point_2"
      read_only = true
    [[runners.kubernetes.volumes.pvc]]
      name = "pvc-1"
      mount_path = "/path/to/mount/point1"
    [[runners.kubernetes.volumes.config_map]]
      name = "config-map-1"
      mount_path = "/path/to/directory"
      [runners.kubernetes.volumes.config_map.items]
        "key_1" = "relative/path/to/key_1_file"
        "key_2" = "key_2"
    [[runners.kubernetes.volumes.secret]]
      name = "secrets"
      mount_path = "/path/to/directory1"
      read_only = true
      [runners.kubernetes.volumes.secret.items]
        "secret_1" = "relative/path/to/secret_1_file"
    [[runners.kubernetes.volumes.empty_dir]]
      name = "empty_dir"
      mount_path = "/path/to/empty_dir"
      medium = "Memory"
```

### 在 runner 中构建镜像

在 runner 中构建 Docker 镜像有两种方式，最常见的是使用`docker build`命令，另一种是使用谷歌推出的[`kaniko`](https://github.com/GoogleContainerTools/kaniko)。相较于`docker build`，`kaniko`无需 Docker Daemon 即可工作，因此 Worker 无需在特权模式下工作，这种方式不会挑战 Kubernetes 集群的安全性。下面将具体谈谈两种方式：

#### docker build

使用这种方式构建 Docker 镜像我们不得不为执行该 Job 的 Worker 开启特权模式，这会带来安全性问题。如果你对此不以为然的话，就可以进行接下来的步骤了。

尽管这种方式本身就是不安全的，但是如果做好以下几点，依然可以有效降低安全风险：

1. 将特权模式的 runner 打上专用标签，仅供使用对应标签的 job 调用；
2. 创建这种类型的 runner 服务端时，使用 Taint 标记 Node，告诉其它应用这个结点的污点，在部署 runner 或其它可以容忍这个安全问题的应用时设置对应的 Toleration。

这可以确保特权模式不被滥用，亦可对应用的安全性负责。

以特权模式运行的`docker: dind`容器会在`2375/tcp`端口上进行监听，我们可以通过 TCP 协议对 Docker 进行操作。

```yaml
image: docker:latest

variables:
    DOCKER_HOST: tcp://localhost:2375 # 在 Kubernetes 中 service 会以 sidecar 的形式插到 Pod 中，同一 Pod 中的网络使用 localhost 访问即可
    DOCKER_DRIVER: overlay2

services:
  - docker:18-dind

before_script:
  - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" $CI_REGISTRY

build-master:
  stage: build
  script:
    - docker build --pull -t "$CI_REGISTRY_IMAGE" .
    - docker push "$CI_REGISTRY_IMAGE"
```

> 注：docker 宿主机的版本与`dind`的版本最好一致。比如我宿主机使用的`18.03`的版本，那么镜像就应该使用`docker:18-dind`，如果直接使用`docker:dind`会使用最新版本的 docker。我当时遇到的一个问题是在 dind 容器中只监听了`2376`端口，没有`2375`。`2376`端口是做了加密的，至少需要配置证书都能使用，`2375`端口不能正常使用，不知道是因为版本不一致，还是本来就只会监听`2376`，我看 Dockerfile 中，两个端口都有暴露，时间关系我就没有进一步细研了。当我换作`docker:18-dind`后，问题都解决了。

#### [kaniko](https://docs.gitlab.com/ee/ci/docker/using_kaniko.html)

用法如下：

```yaml
build:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:debug
    entrypoint: [""]
  script:
    - echo "{\"auths\":{\"$CI_REGISTRY\":{\"username\":\"$CI_REGISTRY_USER\",\"password\":\"$CI_REGISTRY_PASSWORD\"}}}" > /kaniko/.docker/config.json
    - /kaniko/executor --context $CI_PROJECT_DIR --dockerfile $CI_PROJECT_DIR/Dockerfile --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_TAG
```

## 使用 helm 安装 gitlab-runner

## 浅析 `.gitlab-ci.yml` 相关配置

## 配置 `.gitlab-ci.yml`

## 最终效果
