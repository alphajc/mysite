+++
author = "Jerry Chan"
categories = ["技术"]
tags = ["docker", "vm"]
date = "2017-10-11T08:54:08+08:00"
description = "虚拟化与容器化的简单对比"
featured = "docker_vs_vm.jpg"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "docker与传统虚拟机对比"
type = "post"

+++

说起docker的使用，我还是比较有心得的，geekare.com就是使用docker搭建了，找到合适的镜像，从ECS到手至网站搭建成功不到5分钟。一直以来我都想弄个个人网站，可是出于各种原因觉得太麻烦了，都没有弄。熟练使用docker后，我立马搭了这么个网站，是真心方便啊。现在没时间打理，等有时间了，我可以再弄得好看点，嘿嘿！废话不多说了，进入主题。 讲到容器，按惯例一定要跟虚拟机作比较的，配个官网原图：

# 虚拟机堆栈

![虚拟机堆栈](/assets/blog/2017-10/VM@2x.png)

我们可以看到虚拟机运行着客户机操作系统。可以看出要管理的资源特别多，我们需要配置操作系统，打安全补丁，添加系统依赖环境，每次也还得配置一些其它容易丢失、难以拷贝的东西。

# 容器堆栈

![](/assets/blog/2017-10/Container@2x.png)

容器给了用户一个集装箱式的体验，它把执行文件和依赖关系从系统中剥离出来单独存放，还提供了跟虚机一样的隔离性。这样一来docker的镜像可以再任何地方运行，而且因为io栈变短，性能更好。 不过，相较于系统级容器（如BSD的Jail，Solaris的Zone，Linux的LXC），docker的性能可能没有那么高，但是灵活性更强，因为docker镜像的运行还不依赖于操作系统。
