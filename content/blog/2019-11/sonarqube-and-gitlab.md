+++

author = "Jerry Chan"
categories = ["DevOps"]
tags = ['sonarqube', 'gitlab']
date = "2019-11-09T08:32:31+08:00"
description = "sonarqube ，使用 helm 部署 sonarqube 其实比较简单，没啥坑，但是 sonar-gitlab-plugin 这个插件在使用上还是蛮多坑的，官方的文档不够详细，很多问题全网都搜不到，本文会确保有一个可用的例子."
featured = "sonarqube.png"
featuredalt = ""
featuredpath = "assets/cover"
title = "自动化运维之自动代码质量检测"
type = "post"

+++

## 版本说明

- gitlab: 11.4.5
- sonarqube: 8.0-community-beta
- helm: v3.0.0-rc.2
- [sonar-gitlab-plugin](https://github.com/gabrie-allaigre/sonar-gitlab-plugin): [4.1.0-SNAPSHOT](https://github.com/gabrie-allaigre/sonar-gitlab-plugin/releases/download/4.1.0-SNAPSHOT/sonar-gitlab-plugin-4.1.0-SNAPSHOT.jar)
- [chart](https://github.com/helm/charts/tree/master/stable/sonarqube): 3.2.2

## 预处理

- 可用的 ingress controller
- 域名：确保对应的域名`sonar.example.com` 能够访问到 ingress
- 已经有 gitlab，并且配置好了一个全局可用的 Kubernetes 环境的 runner

## 安装 sonarqube

没有已经存在的数据库用于相关数据存取，所以在安装 sonarqube 的同时，还将根据依赖安装 postgresql。

### 自定义变量

进入`stable/sonarqube`，创建 custom.yaml 文件：

```yaml
image:
  tag: 8.0-community-beta
ingress:
  enabled: true
  hosts:
    - name: sonar.example.com
  annotations:
    kubernetes.io/ingress.class: nginx # 选择指定的 ingress controller
    cert-manager.io/cluster-issuer: letsencrypt-stagging # 使用提前创建好的可用的 Issue/ClusterIssue
    acme.cert-manager.io/http01-edit-in-place: "true" # 颁发证书时依托原原有的 ingress 而不新建
  tls:
  - hosts:
    - sonar.example.com
    secretName: sonar-tls

persistence:
  enabled: true
  accessMode: ReadWriteOnce
  size: 10Gi

plugins:
  install: # 预装 sonar-gitlab-plugin 插件
  - "https://github.com/gabrie-allaigre/sonar-gitlab-plugin/releases/download/4.1.0-SNAPSHOT/sonar-gitlab-plugin-4.1.0-SNAPSHOT.jar"
postgresql:
  enabled: true
  postgresUser: "sonar" # 供 sonarqube 的 JDBC 使用
  postgresqlUsername: "sonar" # postgresql chart
  postgresPassword: "pg-pass" # 供 sonarqube 的 JDBC 使用
  postgresqlPassword: "pg-pass" # postgresql chart
  postgresDatabase: "sonar" # 供 sonarqube 的 JDBC 使用
  postgresqlDatabase: "sonar" # postgresql chart
```

> 注：如上配置，由于国内访问 https://kubernetes-charts.storage.googleapis.com/ 时会存在困难，此处我直接将 postgresql 的 chart 软链到了 sonarqube 的 charts 目录下，省去了依赖安装的步骤，但由此带来的问题是版本配置的不兼容。为了兼容，同一配置出现了两个配置项，为了能够正常使用，不得不确保相同配置项的一致性。

### 依赖软链

```bash
mkdir charts
cd charts
ln -s ../../postgresql ../../mysql . # 虽然 mysql 没用上，但由于在 requirements.yaml 中存在也一并处理了
cd ..
```

### helm 安装

```bash
helm install -g -n kube-public -f custom.yaml . # 此处使用的是 helm3
```

### 检测安装

1. 证书是否颁发成功
   ```
   kubectl -n kube-public get certificate sonar-tls
   ```
   READY 如果为 true 的话说明证书颁发成功

2. 检测服务是否可用

    这有两种方式，一个是看 pod 是否为 ready 状态；另一个是看 svc 是否有对应的 endpoint。具体要根据 helm 部署的 release 的名字来看。

3. 检测没有问题后，可以在浏览器中输入域名试一下。

## 配置

### gitlab 配置

登入 sonarqube 系统，依次点击 `Administration` -> `Configuration` -> `General Settings` -> `Gitlab`

#### 配置项

- GitLab url
  
    例如：gitlab.example.com

- GitLab User Token

  1. 登入 gitlab 系统，依次点击`右上角头像` -> `Settings` -> `Access Tokens`
  2. `Scopes` 勾选 `api`，`Name`随便填，点击`Create personal access tokens`即可创建。

        ![Get Access Token](/assets/blog/2019-11/get-access-token.png)
    
  3. 将复制好的 Token 填入。

- Global template
  
    对于 commit 的评论分为全局评论和行内评论，该配置项为全局评论设定模版，模板有多种方式，可参照[全局配置](https://github.com/gabrie-allaigre/sonar-gitlab-plugin/tree/master/templates/global)。

- Inline template

    这个配置项为行内评论设置模板，具体配置可参照[行内配置](https://github.com/gabrie-allaigre/sonar-gitlab-plugin/tree/master/templates/inline)。

### 中文配置（可选）

登入 sonarqube 系统，依次点击 `Administration` -> `Marketplace`，搜索`chinese`，可以找到一款名为`Chinese Pack`的插件，点击`install`安装。

![Reboot after intsll plugins](/assets/blog/2019-11/reboot-after-install-plugins.png)

插件下载完成后会进入 pending 状态，这时需要如图所示点击重启。

> 注：安装所有插件都需要重启生效，重启时，正在进行的分析会停止。

### 编程语言插件

这个必须正确安装才能进行代码分析，同样是在`Marketplace`中进行安装，但凡语言组件会有一个`LANGUAGES`的标签，这需要根据自己代码的实际情况酌情安装。常见的有：

- SonarJS
- SonarJava
- SonarPython
- SonarGo
- SonarHTML
- SonarCSS
- ...

部分语言社区版是不支持的，如：SQL、C 等等

## 使用

由于我们是非 Java 项目，所以使用 [SonarScanner](http://sonar.test.weike.fm/documentation/analysis/scan/sonarscanner/)。

`sonar-scanner`命令有三种配置方式：环境变量、命令行参数、配置文件。

- 环境变量——我所知道的环境变量有两个：`SONAR_TOKEN`的`SONAR_HOST_URL`，但在使用插件的时候，环境变量有坑，所以不建议使用，后面会提到；
- 命令行参数——可以定义和配置文件一样的配置，一些敏感或可变的配置项可以采用这种方式注入；
- 配置文件——分为全局配置文件和项目配置文件，容器环境中，一般不使用全局配置。推荐配置一些常规又繁琐基本不会改变的项。

### [示例](https://github.com/SonarSource/sonar-scanning-examples)：

1. 下载示例代码：

```bash
git clone https://github.com/SonarSource/sonar-scanning-examples
```

2. 在 gitlab 中创建 sonar-scanning-examples 项目:
   
   - 确保 runner 可用
   - 为 runner 配置好 values，也就是环境变量

        - `PRIVATE_TOKEN`，也就是`Gitlab User Token`
        - `SONAR_TOKEN`，需要在 sonarqube 控制台创建

            点击`Administration` -> `Security` -> `Users`，在此处为指定用户生成 Token

            ![Generate Token](/assets/blog/2019-11/generate-token.png)
        
        - `SONAR_HOST_URL`，sonarqube 的地址

3. 添加 .gitlab-ci.yml 文件

```bash
cd sonarqube-scanner
cat > .gitlab-ci.yml << EOF
stages:
  - quality

sast:
  image:
    name: sonarsource/sonar-scanner-cli:latest
    entrypoint: [""]
  stage: quality
  script:
    - sonar-scanner -Dsonar.gitlab.commit_sha=$CI_COMMIT_SHA -Dsonar.gitlab.ref_name=$CI_COMMIT_REF_NAME -Dsonar.gitlab.project_id=$CI_PROJECT_ID -Dsonar.login=$SONAR_TOKEN -Dsonar.gitlab.user_token=$PRIVATE_TOKEN
  only:
    - merge_requests
    - branches
EOF
```

4. 提交代码

```bash
git init
git remote add origin git@gitlab.example.com/examples/sonar-scanning-examples
git add .
git commit -m "Initial commit"
git push -u origin master
```

5. 查看效果

    __行内注释__

    ![行内注释](/assets/blog/2019-11/inline-comment.png)

    __全局注释__

    ![全局注释](/assets/blog/2019-11/global-comment.png)

    __sonarqube 控制台列表__

    ![sonarqube 控制台列表](/assets/blog/2019-11/sonarqube-items.png)

    __sonarqube 控制台详情__

    ![sonarqube 控制台详情](/assets/blog/2019-11/sonarqube-detail.png)

## 那些坑

1. `sonar-scanner`在使用环境变量`SONAR_TOKEN`的时候似乎存在问题，所以后来我是在命令行中使用的该变量
2. gitlab 的 token 在 sonarqube 控制台中的配置似乎并没有效果，我在实际使用`sonar-scanner`的过程中还需要再次配置
3. `sonar-gitlab-plugin`插件版本不对，起初用的`4.0.0`的版本，会报一个奇怪的错误，换了`4.1.0-SNAPSHOT`后，问题得到了解决