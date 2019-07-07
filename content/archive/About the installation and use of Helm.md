+++
author = "kozazyh"
date = "2019-07-07T08:42:53+08:00"
tags = ["Helm", "Kubernetes"]
categories = ["信息技术"]
description = "文章转载自互联网，供自己学习参考"
link = "https://blog.csdn.net/kozazyh/article/details/79537996"
linktitle = "原文链接"
featured = ""
featuredalt = ""
featuredpath = ""
format = "csdn"
title = "Helm的安装和使用"
type = "archive"

+++

Helm 可以理解为 Kubernetes 的包管理工具，可以方便地发现、共享和使用为Kubernetes构建的应用。

# 一、基本概念

1. Helm的三个基本概念

   - Chart：Helm应用（package），包括该应用的所有Kubernetes manifest模版，类似于YUM RPM或Apt dpkg文件
   - Repository：Helm package存储仓库
   - Release：chart的部署实例，每个chart可以部署一个或多个release

2. Helm工作原理

    Helm包括两个部分，helm客户端和tiller服务端。

    the client is responsible for managing charts, and the server is responsible for managing releases.

3. helm客户端

    helm客户端是一个命令行工具，负责管理charts、reprepository和release。它通过gPRC API（使用kubectl port-forward将tiller的端口映射到本地，然后再通过映射后的端口跟tiller通信）向tiller发送请求，并由tiller来管理对应的Kubernetes资源。

    Helm客户端的使用方法参见Helm命令。

4. tiller服务端

    tiller接收来自helm客户端的请求，并把相关资源的操作发送到Kubernetes，负责管理（安装、查询、升级或删除等）和跟踪Kubernetes资源。为了方便管理，tiller把release的相关信息保存在kubernetes的ConfigMap中。

    tiller对外暴露gRPC API，供helm客户端调用。

# 二、安装

环境：kubernetes 1.7 + helm 2.5.0

1. 客户端安装：

    下载相应的版本：https://github.com/kubernetes/helm/releases

    解压

    ```bash
    tar -zxvf helm-v2.5.0-linux-amd64.tgz
    ```

    把helm执行文件放置在： 

    ```bash
    mv linux-amd64/helm /usr/local/bin/helm
    ```

    From there, you should be able to run the client: helm help.

2. 服务器端安装：

        test@local:~/k8s/helm/test$ helm init
        Creating /home/test/.helm
        Creating /home/test/.helm/repository
        Creating /home/test/.helm/repository/cache
        Creating /home/test/.helm/repository/local
        Creating /home/test/.helm/plugins
        Creating /home/test/.helm/starters
        Creating /home/test/.helm/cache/archive
        Creating /home/test/.helm/repository/repositories.yaml
        $HELM_HOME has been configured at /home/test/.helm.

    Tiller (the helm server side component) has been installed into your Kubernetes Cluster.
    成功后，就在你的k8s集群安装Tiller服务。

3. 检查：

        test@local:~$ kubectl get all -n kube-system
        NAME                                           READY     STATUS    RESTARTS   AGE
        po/tiller-deploy-1713990561-0h04s              1/1       Running   0          2h

        NAME                       CLUSTER-IP       EXTERNAL-IP   PORT(S)         AGE
        svc/tiller-deploy          10.254.100.69    <none>        44134/TCP       3h

        NAME                              DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
        deploy/tiller-deploy              1         1         1            1           3h

        NAME                                     DESIRED   CURRENT   READY     AGE
        rs/tiller-deploy-1713990561              1         1         1         2h

        test@local:~$ helm version
        Client: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}
        Server: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}

    在k8s节点机器上：

        [root@k8s-node ~]# ps ax |grep socat
        1709 pts/1    S+     0:00 grep --color=auto socat
        2630 ?        S      0:00 /usr/bin/socat - TCP4:localhost:44134
        7287 ?        S      0:00 /usr/bin/socat - TCP4:localhost:44134
        15182 ?        S      0:00 /usr/bin/socat - TCP4:localhost:44134
        20016 ?        S      0:00 /usr/bin/socat - TCP4:localhost:44134

    到此，客户端和服务器已经安装成功.

    tiller 安装的命名空间问题:

    默认安装在namespace:kube-system,如果你安装在其他namespace,请使用 --tiller-namespace

        test@local:~/puppet/projects/test2/chart$ helm version
        Client: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}
        Error: cannot connect to Tiller
        test@local:~/puppet/projects/test2/chart$ helm version --tiller-namespace default
        Client: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}
        Server: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}

    安装问题：

    1. 缺少socat

            test@local:~/k8s/helm/test$ helm version
            Client: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}
            E0718 11:46:10.132102    7023 portforward.go:332] an error occurred forwarding 41458 -> 44134: error forwarding port 44134 to pod d566b78f997eea6c4b1c0322b34ce8052c6c2001e8edff243647748464cd7919, uid : unable to do port forwarding: socat not found.
            Error: cannot connect to Tiller

        解决方法：在k8s的节点安装socat
        
            [root@k8s-node ~]#  yum install socat
            test@local:~/k8s/helm/test$ helm version
            Client: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}
            Server: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}

    2. helm 跟kubectl 一样，从.kube/config 读取配置证书跟k8s通讯，先确保kubectl能够可用，否则出现一下错误：

            test@local:~/k8s/helm/test$ helm version
            Client: &version.Version{SemVer:"v2.5.0", GitCommit:"012cb0ac1a1b2f888144ef5a67b8dab6c2d45be6", GitTreeState:"clean"}
            Error: cannot connect to Tiller
    
    3. RBAC权限问题，如果集群启用RBAC,会出现下面的问题：
        
            test@local:~/k8s/helm/test$ helm list
            Error: User "system:serviceaccount:kube-system:default" cannot list configmaps in the namespace "kube-system". (get configmaps)

        解决方法：给tiller增加权限：

        1. 创建sa

            kubectl create serviceaccount --namespace kube-system tiller
        
        2. 给sa绑定cluster-admin规则
        
            kubectl create clusterrolebinding tiller-cluster-rule --clusterrole=cluster-admin --serviceaccount=kube-system:tiller
        
        3. 编辑 Tiller Deployment 名称为： tiller-deploy.
        
            kubectl edit deploy --namespace kube-system tiller-deploy
        
        插入一行 （serviceAccount: tiller） in the spec: template: spec section of the file:
        
            ...
            spec:
            replicas: 1
            selector:
                matchLabels:
                app: helm
                name: tiller
            strategy:
                rollingUpdate:
                maxSurge: 1
                maxUnavailable: 1
                type: RollingUpdate
            template:
                metadata:
                creationTimestamp: null
                labels:
                    app: helm
                    name: tiller
                spec:
                serviceAccount: tiller
                containers:
                - env:
                    - name: TILLER_NAMESPACE
                    value: kube-system
            ...

# 三、删除服务端

    test@local:~/k8s/helm/test$ helm reset
    Tiller (the helm server side component) has been uninstalled from your Kubernetes Cluster.

# 四、使用

1. 创建chart目录：

        test@local:~/k8s/helm/test$ helm create mycharts
        Creating myNginx
        test@local:~/k8s/helm/test$ ls -l
        drwxr-xr-x 4 test test 4096  7月 18 14:19 mycharts

    创建后的目录结构：

        test@local:~/k8s/helm/test$ tree mycharts
        myNginx
        ├── charts
        ├── Chart.yaml
        ├── templates
        │   ├── deployment.yaml
        │   ├── _helpers.tpl
        │   ├── ingress.yaml
        │   ├── NOTES.txt
        │   └── service.yaml
        └── values.yaml

2. 发布到k8s集群：

        test@local:~/k8s/helm/test$ helm install --set name=mycharts ./mycharts/
        NAME:   brown-poodle
        LAST DEPLOYED: Tue Jul 18 14:38:50 2017
        NAMESPACE: default
        STATUS: DEPLOYED

        RESOURCES:
        ==> v1/Service
        NAME                   CLUSTER-IP     EXTERNAL-IP  PORT(S)  AGE
        brown-poodle-mycharts  10.254.59.125  <none>       80/TCP   1s

        ==> v1beta1/Deployment
        NAME                   DESIRED  CURRENT  UP-TO-DATE  AVAILABLE  AGE
        brown-poodle-mycharts  1        1        1           0          1s

        NOTES:
        1. Get the application URL by running these commands:
        export POD_NAME=$(kubectl get pods --namespace default -l "app=mycharts,release=brown-poodle" -o jsonpath="{.items[0].metadata.name}")
        echo "Visit http://127.0.0.1:8080 to use your application"
        kubectl port-forward $POD_NAME 8080:80

3. 查看以及安装的releases:

        test@local:~/k8s/helm/test$ helm list
        NAME        	REVISION	UPDATED                 	STATUS  	CHART         	NAMESPACE
        brown-poodle	1       	Tue Jul 18 14:38:50 2017	DEPLOYED	mycharts-0.1.0	default

4. 删除releases

        test@local:~/k8s/helm/test$ helm delete brown-poodle
        release "brown-poodle" deleted

5. configmap ,可以配置configmap 读取文件：

    参考：https://docs.helm.sh/chart_template_guide/#basic-example

6. 恢复之前的版本

        mac-temp:test test$ helm list
        NAME      	REVISION	UPDATED                 	STATUS  	CHART           	NAMESPACE
        inky-eagle	1       	Thu Sep  7 20:45:34 2017	DEPLOYED	prometheus-4.5.0	default  
        test      	5       	Tue Sep 12 18:43:19 2017	DEPLOYED	test-0.1.0      	default  

        mac-temp:test test$ helm history test
        REVISION	UPDATED                 	STATUS    	CHART     	DESCRIPTION      
        1       	Thu Aug 24 19:50:32 2017	SUPERSEDED	test-0.1.0	Deletion complete
        2       	Tue Sep 12 18:31:11 2017	SUPERSEDED	test-0.1.0	Upgrade complete
        3       	Tue Sep 12 18:37:31 2017	SUPERSEDED	test-0.1.0	Upgrade complete
        4       	Tue Sep 12 18:40:25 2017	SUPERSEDED	test-0.1.0	Rollback to 2    
        5       	Tue Sep 12 18:43:19 2017	SUPERSEDED	test-0.1.0	Rollback to 2    
        6       	Tue Sep 12 18:43:25 2017	DEPLOYED  	test-0.1.0	Rollback to 2    

        mac-temp:test test$ helm rollback test 2
        Rollback was a success! Happy Helming!

# 五、技巧
1. 可以增加多个values文件，使用-f 参数选择指定的values文件。这样可以达到使用一样的配置文件，输入不同的参数运行不同的服务：

    例如我们要发布多个版本的apache，各个apachep配置文件只有几个参数不一样，这样可以配置多个values文件，启动不同的apache；

        helm install -f ./mycharts/values-apache.yaml --set name=mycharts ./mycharts/
        test@local:~/k8s/helm/test$ ls mycharts/ -l
        总用量 20
        drwxr-xr-x 2 test test 4096  7月 18 14:37 charts
        -rw-r--r-- 1 test test   86  7月 18 14:37 Chart.yaml
        drwxr-xr-x 2 test test 4096  7月 18 14:37 templates
        -rw-r--r-- 1 test test 1134  7月 18 16:13 values-apache.yaml
        -rw-r--r-- 1 test test 1134  7月 18 14:37 values.yaml

2. 使用 upgrade ,会自动判读如果没安装，会先安装(建议使用此方法)。

        helm upgrade --install mycharts .
        helm upgrade --install --set name=mycharts --tiller-namespace=default  mycharts ./mycharts/

3. 下载charts到本地：

        helm search prometheus
        helm fetch stable/prometheus

# 六、各种名词变量解析

1. 模板格式 : 模版文件deployment.yaml
2. Release.Name – 发行版名称
3. fullname :Release.Name+Chart.Name – 避免名字冲突
4. svc.yaml : 服务描述文件，声明如何访问服务
5. secrets.yaml : 存储密钥
6. Label : 通过release和app标签可以查找到 所有相关的资源


# 其他：

- HOOKS

    参考：https://github.com/kubernetes/helm/blob/master/docs/charts_hooks.md ，允许图表开发人员在发布的生命周期中的某些点进行干预。例如，您可以使用钩子：

    - 在加载任何其他图表之前，请先安装ConfigMap或Secret。
    - 在安装新图表之前执行作业来备份数据库，然后在升级后执行第二个作业以恢复数据。
    - 在删除发行版之前运行作业以在删除之前优雅地将服务取消旋转。

    钩子像常规模板一样工作，但它们具有特殊的注释，使Helm能够不同地使用它们。在本节中，我们将介绍钩子的基本使用模式。