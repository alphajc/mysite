---
title: Pyflink in Kubernetes
date: 2021-01-06T15:00:43+08:00
hero: /assets/images/posts/cloud-native/apache-flink.png
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- cloud-native
- kubernetes
tags:
- k8s
- flink
- python
description: 在 Kubernetes 环境下运行 Fink 的 python 应用程序
---

## pyFlink on kubernetes

> 在 TKE 环境下

### 准备工作

为 flink 创建专用的命名空间、ServiceAccount，并设置好资源配额

```shell
kubectl create ns flink
kubectl -n flink create sa flink
kubectl -n flink create role flink --verb=* --resource=*.*
kubectl -n flink create rolebinding flink --role=flink --serviceaccount=flink:flink
cat << EOF > apiserver.crt # base 集群 apiserver 证书
-----BEGIN CERTIFICATE-----
MIICyDCCAbCgAwIBAgIBADANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDEwprdWJl
cm5ldGVzMB4XDTIwMDMwNTA4MjYzOFoXDTMwMDMwMzA4MjYzOFowFTETMBEGA1UE
AxMKa3ViZXJuZXRlczCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMq/
6ae6qIZbchBK7b0AaP2714K+tuxtGnl7p3yNwlCgVEnZjfytAr8cvkIzxCBH8xBc
vqV2vtDOy0r6HecbIPTkd0bGn6BXjqPp6XZY0ffFgyBhGv6/DD7x7aJIG+A8uSVk
/yTGcahGQ9WOQ6CDWDjZvC+K9zkeNqhtj1wm9P/hQcECAQkQbkIqLUF/P8SF4b8N
QlodYsrZIg9MDqgQDq744AoFPm/F6G2GfHs1DfesYMoSYQs6ECec0+N/Nf5Kx7XX
KW+ARAGEZxC3X7bJmxWr5JSRmmS46rmrN/MUDpMBaWUwtxubVxtIwt1FIFlFqCYz
MR9UtvZkTaL6oSd6Q18CAwEAAaMjMCEwDgYDVR0PAQH/BAQDAgKUMA8GA1UdEwEB
/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBABXd9WbwOlhlqyFsr/2s9wgf86+/
oo05gZhybHtuKHYvSwzoxAeyaMFGn4b7S2okcLoo3EwjmAN2Pup/qhTtiqM9xNfa
+GuN+NX4zjkra+T2NEywIykwhodaFiYB+r6xM0LIHANlKKT7kRtgzkq/s8ui6Wkt
b94T8BpE5U3f6YGz/4NtbqpYS6XVjIIjfP5MxoHRCh8H2LXmWs9A2RlmuZAwo0M2
FJjxcfIgvHrgCerPogVcXYT23BavOhMFlx7Jck2GAbDg0HYTabZuLNkj9T1//raL
aknXJxuLYHbZe6I1cbsIdXJjav5c83YgqGDKetcJdkQqMgk8lVWW7RIdLb0=
-----END CERTIFICATE-----
EOF
kubectl config --kubeconfig=flink-kubeconfig set-cluster base --server=https://cls-xxxxxxx.ccs.tencent-cloud.com --certificate-authority=apiserver.crt --embed-certs=true
kubectl config --kubeconfig=flink-kubeconfig set-credentials flink --token=$(kubectl -n flink get sa flink -o=jsonpath={.secrets[0].name} | xargs kubectl -n flink get secrets -o=jsonpath={.data.token} | base64 -d)
kubectl config --kubeconfig=flink-kubeconfig set-context default --user=flink --cluster=base --namespace=flink
cat << EOF | kubectl create -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: flink-rq
  namespace: flink
spec:
  hard:
    limits.cpu: "20"
    limits.memory: 40Gi
    requests.cpu: "10"
    requests.memory: 20Gi
EOF
```

### 配置 flink 环境

1. 登录工作服务器，将上述生成的文件拷贝到`~/.kube/`目录下，并更名为`config`，此外还需要满足以下依赖条件：

    － 该服务器需与目标集群网络内网互通
    － 已安装`kubectl`工具
    － 已安装 Java 版本 8 或 11（官方推荐）

2. 修改`/etc/hosts`文件

    ```shell
    sudo sed -i '$a 10.1.192.48 cls-xxxxxxx.ccs.tencent-cloud.com' /etc/hosts
    ```

3. 安装 Flink 工具包

    ```shell
    wget https://www.apache.org/dyn/closer.lua/flink/flink-1.12.0/flink-1.12.0-bin-scala_2.12.tgz
    tar zxf flink-1.12.0-bin-scala_2.12.tgz
    export PATH=$PATH:`pwd`/flink-1.12.0/bin
    ```

### 部署应用

1. 构建 docker base 镜像

    > 不依赖 flink 环境

    ```shell
    git clone https://github.com/apache/flink-docker.git
    cd flink-docker/1.12/scala_2.12-java11-debian
    docker build -t alphajc/flink:1.12-scala_2.12-java11 .
    docker tag alphajc/flink:1.12-scala_2.12-java11 alphajc/flink:1.12-scala_2.12
    docker tag alphajc/flink:1.12-scala_2.12-java11 alphajc/flink:1.12-java11
    docker tag alphajc/flink:1.12-scala_2.12-java11 alphajc/flink:1.12
    docker push -a alphajc/flink # 需要先使用 docker login 登录 docker hub，alphajc 为我的账号
    ```

    上述镜像现在可直接使用

2. 制作 pyFlink 1.12 的 docker 镜像

    > 不依赖 flink 环境

    创建下述 Dockerfile 文件：

    ```dockerfile
    FROM alphajc/flink:1.12
    
    # install python3 and pip3
    RUN apt-get update -y && \
    apt-get install -y python3.7 python3-pip python3.7-dev && rm -rf /var/lib/apt/lists/*
    RUN ln -s /usr/bin/python3 /usr/bin/python
    
    # install Python Flink
    
    RUN pip3 config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
        && pip3 install apache-flink==1.12.0
    ```

    构建并提交：

    ```shell
    docker build -t alphajc/pyflink:1.12 .
    docker push alphajc/pyflink:1.12
    ```

3. 运行一个 python 的批处理程序`word_count`

    > 依赖 flink 环境

    ```shell
    flink run-application \
      --target kubernetes-application \
      --parallelism 8 \
      -Dkubernetes.cluster-id=word-count \
      -Dtaskmanager.memory.process.size=4096m \
      -Dkubernetes.namespace=flink \
      -Dkubernetes.jobmanager.service-account=flink \
      -Dkubernetes.taskmanager.cpu=2 \
      -Dtaskmanager.numberOfTaskSlots=4 \
      -Dkubernetes.container.image=alphajc/pyflink:1.12 \
      --pyModule word_count \
      --pyFiles /opt/flink/examples/python/table/batch/word_count.py
    ```

    这是一个批处理程序，运行完就没了，可以使用`kubectl get po -w`持续观察 Pod 的变化：

    ![](/assets/images/word_count_pods_watch.png)

4. 自定义镜像创建一个需要连接 mysql 和 kafka 的流处理应用(test)

    > 不依赖 flink 环境

    ```shell
    git clone ssh://git@github.com:xxxx/flink_test.git # 克隆 flink 测试库
    cd flink_test
    ```

    创建下述的 Dockerfile 文件：

    ```dockerfile
    FROM alphajc/pyflink:1.12

    ADD --chown=9999:9999 https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka_2.11/1.12.0/flink-sql-connector-kafka_2.11-1.12.0.jar /opt/flink/lib/
    ADD --chown=9999:9999 https://repo.maven.apache.org/maven2/org/apache/flink/flink-connector-jdbc_2.11/1.12.0/flink-connector-jdbc_2.11-1.12.0.jar /opt/flink/lib/
    ADD --chown=9999:9999 https://repo.maven.apache.org/maven2/mysql/mysql-connector-java/8.0.22/mysql-connector-java-8.0.22.jar /opt/flink/lib/
    
    ADD --chown=9999:9999 examples_112 /app/flink_test
    ```

    构建发布镜像：

    ```shell
    docker build -t alphajc/flink_test .
    docker push alphajc/flink_test
    ```

5. 运行 test 应用

    > 依赖 flink 环境

    ```shell
    flink run-application  \
    --target kubernetes-application \
    --parallelism 8 \
    -Dkubernetes.cluster-id=test \
    -Dkubernetes.container.image=alphajc/flink_test \
    -Dkubernetes.namespace=flink \
    -Dkubernetes.jobmanager.service-account=flink \
    -Dtaskmanager.memory.process.size=4096m \
    -Dkubernetes.taskmanager.cpu=2 \
    -Dtaskmanager.numberOfTaskSlots=4 \
    -Dkubernetes.container.image.pull-secrets=qcloudregistrykey \
    -Dexecution.attached=true \
    -Dkubernetes.container.image.pull-policy=Always \
    --pyModule test \
    --pyFiles /app/flink_test/test.py
    ```

#### 一些提示＆一些坑

1. jobmanager 的日志中可以看到 jar 包有没使用成功

```
2021-01-05 02:00:00,510 INFO  org.apache.flink.runtime.entrypoint.ClusterEntrypoint        [] -  Classpath: /opt/flink/lib/flink-csv-1.12.0.jar:/opt/flink/lib/flink-json-1.12.0.jar:/opt/flink/lib/flink-shaded-zookeeper-3.4.14.jar:/opt/flink/lib/flink-table-blink_2.12-1.12.0.jar:/opt/flink/lib/flink-table_2.12-1.12.0.jar:/opt/flink/lib/log4j-1.2-api-2.12.1.jar:/opt/flink/lib/log4j-api-2.12.1.jar:/opt/flink/lib/log4j-core-2.12.1.jar:/opt/flink/lib/log4j-slf4j-impl-2.12.1.jar:/opt/flink/lib/flink-dist_2.12-1.12.0.jar:::
```

2. 缺少 kafka connector 插件

```
Caused by: org.apache.flink.table.api.ValidationException: Could not find any factory for identifier 'kafka' that implements 'org.apache.flink.table.factories.DynamicTableFactory' in the classpath.
```

3. 缺少 jdbc 插件

```
Caused by: org.apache.flink.table.api.ValidationException: Could not find any factory for identifier 'jdbc' that implements 'org.apache.flink.table.factories.DynamicTableFactory' in the classpath.
```

4. 缺少 mysql 插件

```
java.io.IOException: unable to open JDBC writer
	at org.apache.flink.connector.jdbc.internal.AbstractJdbcOutputFormat.open(AbstractJdbcOutputFormat.java:61) ~[flink-connector-jdbc_2.11-1.12.0.jar:1.12.0]
	at org.apache.flink.connector.jdbc.internal.JdbcBatchingOutputFormat.open(JdbcBatchingOutputFormat.java:114) ~[flink-connector-jdbc_2.11-1.12.0.jar:1.12.0]
	at org.apache.flink.streaming.api.functions.sink.OutputFormatSinkFunction.open(OutputFormatSinkFunction.java:65) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.api.common.functions.util.FunctionUtils.openFunction(FunctionUtils.java:36) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.streaming.api.operators.AbstractUdfStreamOperator.open(AbstractUdfStreamOperator.java:102) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.table.runtime.operators.sink.SinkOperator.open(SinkOperator.java:63) ~[flink-table-blink_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.streaming.runtime.tasks.OperatorChain.initializeStateAndOpenOperators(OperatorChain.java:401) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.streaming.runtime.tasks.StreamTask.lambda$beforeInvoke$2(StreamTask.java:507) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.streaming.runtime.tasks.StreamTaskActionExecutor$1.runThrowing(StreamTaskActionExecutor.java:47) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.streaming.runtime.tasks.StreamTask.beforeInvoke(StreamTask.java:501) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.streaming.runtime.tasks.StreamTask.invoke(StreamTask.java:531) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.runtime.taskmanager.Task.doRun(Task.java:722) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at org.apache.flink.runtime.taskmanager.Task.run(Task.java:547) ~[flink-dist_2.12-1.12.0.jar:1.12.0]
	at java.lang.Thread.run(Unknown Source) ~[?:?]
Caused by: java.lang.ClassNotFoundException: com.mysql.jdbc.Driver
	at jdk.internal.loader.BuiltinClassLoader.loadClass(Unknown Source) ~[?:?]
	at jdk.internal.loader.ClassLoaders$AppClassLoader.loadClass(Unknown Source) ~[?:?]
	at java.lang.ClassLoader.loadClass(Unknown Source) ~[?:?]
	at java.lang.Class.forName0(Native Method) ~[?:?]
	at java.lang.Class.forName(Unknown Source) ~[?:?]
	at org.apache.flink.connector.jdbc.internal.connection.SimpleJdbcConnectionProvider.getConnection(SimpleJdbcConnectionProvider.java:52) ~[flink-connector-jdbc_2.11-1.12.0.jar:1.12.0]
	at org.apache.flink.connector.jdbc.internal.AbstractJdbcOutputFormat.establishConnection(AbstractJdbcOutputFormat.java:66) ~[flink-connector-jdbc_2.11-1.12.0.jar:1.12.0]
	at org.apache.flink.connector.jdbc.internal.AbstractJdbcOutputFormat.open(AbstractJdbcOutputFormat.java:59) ~[flink-connector-jdbc_2.11-1.12.0.jar:1.12.0]
	... 13 more
```
