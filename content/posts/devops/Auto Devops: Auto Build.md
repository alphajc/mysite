---
title: 自动化运维之自动构建
date: 2019-09-08T18:37:36+08:00
hero: /assets/images/posts/devops/GitLab-Kubernetes-Running-CI-Runners-in-Kubernetes.png
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- devops
tags:
- gitlab
- runner
- ci
- cd
- k8s
description: "gitlab 作为代码仓库，连接 kubernetes 中的 gitlab-runner 以实现自动化构建的基础环境。有关 gitlab-runner 的中文文档其实不多，本文将对 gitlab-runner 的使用进行简要介绍。"
---


本文供自己记录学习，我会尽量保证文章准确无误，但因本人水平有限，如果不幸产生任何错误，望读者不吝赐教。

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

配置一个 runner 有多种方式，包括启动参数、环境变量、配置文件等。这其中配置文件的功能最强，参数可配置项较环境变量稍多（或许它们具有相同的能力，只是我没有发现，如果你知道欢迎帮忙补充）。通过`gitlab-runner help register`命令我们可以找到所有的启动参数和环境变量，参数与环境变量之间的关系请参照[参数与环境变量对照表](https://gist.github.com/alphajc/e2c19fa624ccc29fb3af0803e9afcb22)。

### runner 的集群中权限

前面已经谈到 runner 服务端在注册成功监听到新的任务后，需要以 Pod 的形式创建 Worker 对新对任务进行处理。这里我们需要考虑几种权限：Pod 的操作权限、Worker 镜像的拉取权限以及在 Worker 中构建镜像时对私有镜像的拉取权限。

Pod 的操作权限通过 kubernetes 中的 ServiceAccount 来实现，我们需要赋予对应的 ServiceAccount 对指定命名空间的 Pod 的操作权限，相关的参数有`--kubernetes-namespace`和`--kubernetes-service-account`以及他们环境变量的开关参数`--kubernetes-namespace_overwrite_allowed`和`--kubernetes-service_account_overwrite_allowed`。这里指定的 ServiceAccount 一定要在指定的 Namespace 中有 Pod 的操作权限，否则 gitlab 在跑 pipeline 的时候会报权限错误。有关 ServiceAccount 的权限配置是通过 RBAC 实现的，详情参照[kubernetes 中 RBAC 认证的文档](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)。

对于 Worker 镜像的拉取权限，一般都是在集群创建时预先配置好的，此处无需另行配置。而 Worker 中构建镜像时对私有镜像的拉取和推送权限是在 `.gitlab-ci.yml`中进行配置的，这里不要搞混。

### runner 的持久化存储

runner 可以使用 hostPath 和 PVC 做持久化存储，跟 Kubernetes 中的概念完全一样。用法参照[使用卷](https://docs.gitlab.com/runner/executors/kubernetes.html#using-volumes)，参考配置如下：

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

使用 gitlab 官方 chart 库进行 gitlab-runner 的安装。因为官方的 chart 使用参数和环境变量注册 gitlab-runner，在使用上会有一定的局限性，可能需要一些修改才能进行高级配置。以下是使用官方 chart 部署 gitlab-runner 的步骤：

### 前提

1. 安装了 tiller 的 kubernetes 的集群
2. 初始化完成了的 helm 命令行工具

### 1. 添加 gitlab 官方 chart 仓库

```bash
helm repo add gitlab https://charts.gitlab.io/
helm repo update
```

### 2. 在 gitlab 代码仓库中找到 url 和 runner 的 token

![获取 Gitlab 的 URL 和 runner 的 token](/assets/images/posts/devops/find-url-and-token.png)

### 3. 安装 gitlab-runner

我们可以通过参数以及配置文件的形式为 helm 添加自定义配置。该 Chart 的可配置项可以查阅官方库[对于 `values.yaml` 文件的注释](https://gitlab.com/gitlab-org/charts/gitlab-runner/blob/master/values.yaml)，这里把关键配置提出来说明一下：

- `gitlabUrl`：gitlab 服务的地址，形如：https://gitlab.xxx.com；
- `runnerRegistrationToken`：上一步中得到的 token；
- `rbac.create`：我是没有遇到过没有 `rbac` 的 kubernetes 集群，所以记得一定填 `true`，否则创建出的 gitlab-runner 将无权对集群进行操作；
- `rbac.clusterWideAccess`：如果涉及到在不同的 namespace 跑 job，设置为 `true`，否则置为 `false`（这只能操作同一 namespace）；
- `rbac.serviceAccountName`：如果不设置默认使用 default，如果 sa 专用则建议另起一个名字，以避免 default 权限过大，其它用 default 的 pod 滥用；
- `runners.image`：默认镜像，在 gitlab-ci.yml 中的 job 未配置 `image` 时将自动选用；
- `runners.privileged`：一般在该 runner 需要跑 `docker:dind` 镜像时使用；
- `runners.namespace`: Job 运行的 namespace；
- `runners.imagePullSecrets`：在创建 job 时使用的镜像如果来自于私有仓库则需要配置该字段。注意使用前需要提前创建好对应的 secret；
- `runners.cache`：如果要使用 runner 的 cache 功能，需要对此选项进行配置，不同的持久化方式配置不同，有些方式甚至需要对 chart 进行改造。

> 注：该 Chart 的多 runner 注册功能受限，对 kubernetes 的高级功能配置支持也有限，后期我将对这个 Chart 进行改造，使其支持。

## 浅析 `.gitlab-ci.yml` 相关配置

有关 `.gitlab-ci.yml` 更详细的配置参照[官方文档](https://docs.gitlab.com/ee/ci/yaml/README.html)，在此仅挑部分有特点的东西记录一下。

1. image 将确定 job 运行的环境，script 将在该环境中运行；
2. service 是环境的依赖，如`docker:dind` 一般以这种方式注入，具体在 kubernetes 集群中会以 sidecar 的形式与主环境放在一个 pod 中，所以如果 service 提供的是 socket 服务，在主环境中使用 localhost 即可访问；
3. 注意 only/except 的[高级用法](https://docs.gitlab.com/ee/ci/yaml/README.html#onlyexcept-advanced)，可以服务于多种场景；
4. 使用 [rules](https://docs.gitlab.com/ee/ci/yaml/README.html#rules) 对 job 进行合理控制；
5. [environment](https://docs.gitlab.com/ee/ci/yaml/README.html#environment) 跟持续部署相关，主要用于前端项目；
6. [cache](https://docs.gitlab.com/ee/ci/yaml/README.html#cache) 用于在多个 job 间缓存数据；
7. [artifacts](https://docs.gitlab.com/ee/ci/yaml/README.html#artifacts) 将对指定文件（一般是编译产物）进行打包，并上传至 gitlab，供下载使用，这也会在界面进行展示，配合 [dependencies](https://docs.gitlab.com/ee/ci/yaml/README.html#dependencies) 使用，可以在不同 stage 的 job 间进行传递；
8. 使用 [coverage](https://docs.gitlab.com/ee/ci/yaml/README.html#coverage) 抓取测试覆盖率

## 配置 `.gitlab-ci.yml`

```yaml
stages:
  - build

.build-common: &build-common
  image: docker:latest
  variables:
    DOCKER_HOST: tcp://localhost:2375 # kubernetes 集群中使用 localhost 访问
    DOCKER_DRIVER: overlay2
  services:
    - name: docker:18-dind # 匹配环境中 docker 的版本
      command: ["--registry-mirror=https://mirror.ccs.tencentyun.com"] # 这是我找到的在编译镜像时，配置镜像加速器的最好办法
  before_script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" $CI_REGISTRY

build-master:
  <<: *build-common
  stage: build
  script:
    - docker build -t "$CI_REGISTRY_IMAGE" .
    - docker tag "$CI_REGISTRY_IMAGE" "$CI_REGISTRY/$CI_REGISTRY_IMAGE"
    - docker tag "$CI_REGISTRY_IMAGE" "$CI_REGISTRY/$CI_REGISTRY_IMAGE:${CI_COMMIT_SHA:0:9}"
    - docker push "$CI_REGISTRY/$CI_REGISTRY_IMAGE"
    - docker push "$CI_REGISTRY/$CI_REGISTRY_IMAGE:${CI_COMMIT_SHA:0:9}"
  only:
    - master

build:
  <<: *build-common
  stage: build
  script:
    - docker build -t "$CI_REGISTRY_IMAGE:${CI_COMMIT_SHA:0:9}" .
    - docker tag "$CI_REGISTRY_IMAGE:${CI_COMMIT_SHA:0:9}" "$CI_REGISTRY/$CI_REGISTRY_IMAGE:${CI_COMMIT_SHA:0:9}"
    - docker push "$CI_REGISTRY/$CI_REGISTRY_IMAGE:${CI_COMMIT_SHA:0:9}"
  except:
    - master
```
