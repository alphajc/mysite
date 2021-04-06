+++
author = "孙健波"
date = "2019-07-27T21:56:03+08:00"
tags = ['Docker', 'cgroups', 'Linux']
categories = ["云原生"]
description = "文章转载自互联网，供自己学习参考"
link = "https://www.infoq.cn/article/docker-kernel-knowledge-cgroups-resource-isolation"
linktitle = "原文链接"
featured = ""
featuredalt = ""
featuredpath = ""
format = "InfoQ"
title = "Docker 背后的内核知识——cgroups 资源限制"
type = "archive"

+++

上一篇中，我们了解了 Docker 背后使用的资源隔离技术 namespace，通过系统调用构建一个相对隔离的 shell 环境，也可以称之为一个简单的“容器”。本文我们则要开始讲解另一个强大的内核工具——cgroups。他不仅可以限制被 namespace 隔离起来的资源，还可以为资源设置权重、计算使用量、操控进程启停等等。在介绍完基本概念后，我们将详细讲解 Docker 中使用到的 cgroups 内容。希望通过本文，让读者对 Docker 有更深入的了解。

## 1. cgroups 是什么

cgroups（Control Groups）最初叫 Process Container，由 Google 工程师（Paul Menage 和 Rohit Seth）于 2006 年提出，后来因为 Container 有多重含义容易引起误解，就在 2007 年更名为 Control Groups，并被整合进 Linux 内核。顾名思义就是把进程放到一个组里面统一加以控制。官方的定义如下 { 引自：https://www.kernel.org/doc/Documentation/cgroups/cgroups.txt }：

> cgroups 是 Linux 内核提供的一种机制，这种机制可以根据特定的行为，把一系列系统任务及其子任务整合（或分隔）到按资源划分等级的不同组内，从而为系统资源管理提供一个统一的框架。

通俗的来说，cgroups 可以限制、记录、隔离进程组所使用的物理资源（包括：CPU、memory、IO 等），为容器实现虚拟化提供了基本保证，是构建 Docker 等一系列虚拟化管理工具的基石。

对开发者来说，cgroups 有如下四个有趣的特点：

* cgroups 的 API 以一个伪文件系统的方式实现，即用户可以通过文件操作实现 cgroups 的组织管理。
* cgroups 的组织管理操作单元可以细粒度到线程级别，用户态代码也可以针对系统分配的资源创建和销毁 cgroups，从而实现资源再分配和管理。
* 所有资源管理的功能都以“subsystem（子系统）”的方式实现，接口统一。
* 子进程创建之初与其父进程处于同一个 cgroups 的控制组。

本质上来说，cgroups 是内核附加在程序上的一系列钩子（hooks），通过程序运行时对资源的调度触发相应的钩子以达到资源追踪和限制的目的。

## 2. cgroups 的作用

实现 cgroups 的主要目的是为不同用户层面的资源管理，提供一个统一化的接口。从单个进程的资源控制到操作系统层面的虚拟化。Cgroups 提供了以下四大功能 { 参照自：http://en.wikipedia.org/wiki/Cgroups }。

* 资源限制（Resource Limitation）：cgroups 可以对进程组使用的资源总额进行限制。如设定应用运行时使用内存的上限，一旦超过这个配额就发出 OOM（Out of Memory）。
* 优先级分配（Prioritization）：通过分配的 CPU 时间片数量及硬盘 IO 带宽大小，实际上就相当于控制了进程运行的优先级。
* 资源统计（Accounting）： cgroups 可以统计系统的资源使用量，如 CPU 使用时长、内存用量等等，这个功能非常适用于计费。
* 进程控制（Control）：cgroups 可以对进程组执行挂起、恢复等操作。

过去有一段时间，内核开发者甚至把 namespace 也作为一个 cgroups 的 subsystem 加入进来，也就是说 cgroups 曾经甚至还包含了资源隔离的能力。但是资源隔离会给 cgroups 带来许多问题，如 PID 在循环出现的时候 cgroup 却出现了命名冲突、cgroup 创建后进入新的 namespace 导致脱离了控制等等 { 详见：https://git.kernel.org/cgit/linux/kernel/git/torvalds/linux.git/commit/?id=a77aea92010acf54ad785047234418d5d68772e2 }，所以在 2011 年就被移除了。

## 3. 术语表

* **task（任务）**：cgroups 的术语中，task 就表示系统的一个进程。
* **cgroup（控制组）**：cgroups 中的资源控制都以 cgroup 为单位实现。cgroup 表示按某种资源控制标准划分而成的任务组，包含一个或多个子系统。一个任务可以加入某个 cgroup，也可以从某个 cgroup 迁移到另外一个 cgroup。
* **subsystem（子系统）**：cgroups 中的 subsystem 就是一个资源调度控制器（Resource Controller）。比如 CPU 子系统可以控制 CPU 时间分配，内存子系统可以限制 cgroup 内存使用量。
* **hierarchy（层级树）**：hierarchy 由一系列 cgroup 以一个树状结构排列而成，每个 hierarchy 通过绑定对应的 subsystem 进行资源调度。hierarchy 中的 cgroup 节点可以包含零或多个子节点，子节点继承父节点的属性。整个系统可以有多个 hierarchy。

## 4. 组织结构与基本规则

大家在 namespace 技术的讲解中已经了解到，传统的 Unix 进程管理，实际上是先启动`init`进程作为根节点，再由`init`节点创建子进程作为子节点，而每个子节点由可以创建新的子节点，如此往复，形成一个树状结构。而 cgroups 也是类似的树状结构，子节点都从父节点继承属性。

它们最大的不同在于，系统中 cgroup 构成的 hierarchy 可以允许存在多个。如果进程模型是由`init`作为根节点构成的一棵树的话，那么 cgroups 的模型则是由多个 hierarchy 构成的森林。这样做的目的也很好理解，如果只有一个 hierarchy，那么所有的 task 都要受到绑定其上的 subsystem 的限制，会给那些不需要这些限制的 task 造成麻烦。

了解了 cgroups 的组织结构，我们再来了解 cgroup、task、subsystem 以及 hierarchy 四者间的相互关系及其基本规则 { 参照自：https://access.redhat.com/documentation/en-US/Red*Hat*Enterprise*Linux/6/html/Resource*Management*Guide/sec-Relationships*Between*Subsystems*Hierarchies*Control*Groups*and*Tasks.html } 。

* **规则 1：** 同一个 hierarchy 可以附加一个或多个 subsystem。如下图 1，cpu 和 memory 的 subsystem 附加到了一个 hierarchy。

![](https://static001.infoq.cn/resource/image/a7/94/a78f86694a9a1796fd547323299f7a94.png)

<center>**图 1 同一个 hierarchy 可以附加一个或多个 subsystem**</center>

* **规则 2：** 一个 subsystem 可以附加到多个 hierarchy，当且仅当这些 hierarchy 只有这唯一一个 subsystem。如下图 2，小圈中的数字表示 subsystem 附加的时间顺序，CPU subsystem 附加到 hierarchy A 的同时不能再附加到 hierarchy B，因为 hierarchy B 已经附加了 memory subsystem。如果 hierarchy B 与 hierarchy A 状态相同，没有附加过 memory subsystem，那么 CPU subsystem 同时附加到两个 hierarchy 是可以的。

![](https://static001.infoq.cn/resource/image/33/61/33dcfe1b645a4c75f21b29f272544361.png)

<center>**图 2 一个已经附加在某个 hierarchy 上的 subsystem 不能附加到其他含有别的 subsystem 的 hierarchy 上**</center>

* **规则 3：** 系统每次新建一个 hierarchy 时，该系统上的所有 task 默认构成了这个新建的 hierarchy 的初始化 cgroup，这个 cgroup 也称为 root cgroup。对于你创建的每个 hierarchy，task 只能存在于其中一个 cgroup 中，即一个 task 不能存在于同一个 hierarchy 的不同 cgroup 中，但是一个 task 可以存在在不同 hierarchy 中的多个 cgroup 中。如果操作时把一个 task 添加到同一个 hierarchy 中的另一个 cgroup 中，则会从第一个 cgroup 中移除。在下图 3 中可以看到，`httpd`进程已经加入到 hierarchy A 中的`/cg1`而不能加入同一个 hierarchy 中的`/cg2`，但是可以加入 hierarchy B 中的`/cg3`。实际上不允许加入同一个 hierarchy 中的其他 cgroup 野生为了防止出现矛盾，如 CPU subsystem 为`/cg1`分配了 30%，而为`/cg2`分配了 50%，此时如果`httpd`在这两个 cgroup 中，就会出现矛盾。

![](https://static001.infoq.cn/resource/image/d6/ba/d683fd366cb8b7f0045e155aa0aa2eba.png)

<center>**图 3 一个 task 不能属于同一个 hierarchy 的不同 cgroup**</center>

* **规则 4：** 进程（task）在 fork 自身时创建的子任务（child task）默认与原 task 在同一个 cgroup 中，但是 child task 允许被移动到不同的 cgroup 中。即 fork 完成后，父子进程间是完全独立的。如下图 4 中，小圈中的数字表示 task 出现的时间顺序，当`httpd`刚 fork 出另一个`httpd`时，在同一个 hierarchy 中的同一个 cgroup 中。但是随后如果 PID 为 4840 的`httpd`需要移动到其他 cgroup 也是可以的，因为父子任务间已经独立。总结起来就是：初始化时子任务与父任务在同一个 cgroup，但是这种关系随后可以改变。

![](https://static001.infoq.cn/resource/image/fa/92/fab35a4d2f0ef0cca6b6b0ae79925d92.png)

<center>**图 4 刚 fork 出的子进程在初始状态与其父进程处于同一个 cgroup**</center>


## 5. subsystem 简介

subsystem 实际上就是 cgroups 的资源控制系统，每种 subsystem 独立地控制一种资源，目前 Docker 使用如下八种 subsystem，还有一种`net_cls` subsystem 在内核中已经广泛实现，但是 Docker 尚未使用。他们的用途分别如下。

* **blkio：** 这个 subsystem 可以为块设备设定输入 / 输出限制，比如物理驱动设备（包括磁盘、固态硬盘、USB 等）。
* **cpu：** 这个 subsystem 使用调度程序控制 task 对 CPU 的使用。
* **cpuacct：** 这个 subsystem 自动生成 cgroup 中 task 对 CPU 资源使用情况的报告。
* **cpuset：** 这个 subsystem 可以为 cgroup 中的 task 分配独立的 CPU（此处针对多处理器系统）和内存。
* **devices** 这个 subsystem 可以开启或关闭 cgroup 中 task 对设备的访问。
* **freezer** 这个 subsystem 可以挂起或恢复 cgroup 中的 task。
* **memory** 这个 subsystem 可以设定 cgroup 中 task 对内存使用量的限定，并且自动生成这些 task 对内存资源使用情况的报告。
* **perf*event****这个 subsystem 使用后使得 cgroup 中的 task 可以进行统一的性能测试。{perf: Linux CPU 性能探测器，详见 https://perf.wiki.kernel.org/index.php/Main*Page}
* ***net_cls** 这个 subsystem Docker 没有直接使用，它通过使用等级识别符 (classid) 标记网络数据包，从而允许 Linux 流量控制程序（TC：Traffic Controller）识别从具体 cgroup 中生成的数据包。

## 6. cgroups 实现方式及工作原理简介

### （1）cgroups 实现结构讲解

cgroups 的实现本质上是给系统进程挂上钩子（hooks），当 task 运行的过程中涉及到某个资源时就会触发钩子上所附带的 subsystem 进行检测，最终根据资源类别的不同使用对应的技术进行资源限制和优先级分配。那么这些钩子又是怎样附加到进程上的呢？下面我们将对照结构体的图表一步步分析，请放心，描述代码的内容并不多。

(点击放大图像)

[![](https://static001.infoq.cn/resource/image/b6/5b/b65fbf5f26c2d8067ecf0df386ac4b5b.png)](/mag4media/repositories/fs/articles//zh/resources/0329014.png)

<center>**图 5 cgroups 相关结构体一览**</center>

Linux 中管理 task 进程的数据结构为`task_struct`（包含所有进程管理的信息），其中与 cgroup 相关的字段主要有两个，一个是`css_set *cgroups`，表示指向`css_set`（包含进程相关的 cgroups 信息）的指针，一个 task 只对应一个`css_set`结构，但是一个`css_set`可以被多个 task 使用。另一个字段是`list_head cg_list`，是一个链表的头指针，这个链表包含了所有的链到同一个`css_set`的 task 进程（在图中使用的回环箭头，均表示可以通过该字段找到所有同类结构，获得信息）。

每个`css_set`结构中都包含了一个指向`cgroup_subsys_state`（包含进程与一个特定子系统相关的信息）的指针数组。`cgroup_subsys_state`则指向了`cgroup`结构（包含一个 cgroup 的所有信息），通过这种方式间接的把一个进程和 cgroup 联系了起来，如下图 6。

![](https://static001.infoq.cn/resource/image/40/9f/409e12557b213d4fac59dd764598429f.png)

<center>**图 6 从 task 结构开始找到 cgroup 结构**</center>

另一方面，`cgroup`结构体中有一个`list_head css_sets`字段，它是一个头指针，指向由`cg_cgroup_link`（包含 cgroup 与 task 之间多对多关系的信息，后文还会再解释）形成的链表。由此获得的每一个`cg_cgroup_link`都包含了一个指向`css_set *cg`字段，指向了每一个 task 的`css_set`。`css_set`结构中则包含`tasks`头指针，指向所有链到此`css_set`的 task 进程构成的链表。至此，我们就明白如何查看在同一个 cgroup 中的 task 有哪些了，如下图 7。

![](https://static001.infoq.cn/resource/image/a9/0a/a9716c169230fdc60851be4fca5f1c0a.png)

<center>**图 7 cglink 多对多双向查询**</center>

细心的读者可能已经发现，`css_set`中也有指向所有`cg_cgroup_link`构成链表的头指针，通过这种方式也能定位到所有的 cgroup，这种方式与图 1 中所示的方式得到的结果是相同的。

那么为什么要使用`cg_cgroup_link`结构体呢？因为 task 与 cgroup 之间是多对多的关系。熟悉数据库的读者很容易理解，在数据库中，如果两张表是多对多的关系，那么如果不加入第三张关系表，就必须为一个字段的不同添加许多行记录，导致大量冗余。通过从主表和副表各拿一个主键新建一张关系表，可以提高数据查询的灵活性和效率。

而一个 task 可能处于不同的 cgroup，只要这些 cgroup 在不同的 hierarchy 中，并且每个 hierarchy 挂载的子系统不同；另一方面，一个 cgroup 中可以有多个 task，这是显而易见的，但是这些 task 因为可能还存在在别的 cgroup 中，所以它们对应的`css_set`也不尽相同，所以一个 cgroup 也可以对应多个·`css_set`。

在系统运行之初，内核的主函数就会对`root cgroups`和`css_set`进行初始化，每次 task 进行 fork/exit 时，都会附加（attach）/ 分离（detach）对应的`css_set`。

综上所述，添加`cg_cgroup_link`主要是出于性能方面的考虑，一是节省了`task_struct`结构体占用的内存，二是提升了进程`fork()/exit()`的速度。

![](https://static001.infoq.cn/resource/image/24/62/245bd754c0aa1c1c7fde8cb789069d62.png)

<center>**图 8 css_set 与 hashtable 关系**</center>

当 task 从一个 cgroup 中移动到另一个时，它会得到一个新的`css_set`指针。如果所要加入的 cgroup 与现有的 cgroup 子系统相同，那么就重复使用现有的`css_set`，否则就分配一个新`css_set`。所有的`css_set`通过一个哈希表进行存放和查询，如上图 8 中所示，`hlist_node hlist`就指向了`css_set_table`这个 hash 表。

同时，为了让 cgroups 便于用户理解和使用，也为了用精简的内核代码为 cgroup 提供熟悉的权限和命名空间管理，内核开发者们按照 Linux 虚拟文件系统转换器（VFS：Virtual Filesystem Switch）的接口实现了一套名为`cgroup`的文件系统，非常巧妙地用来表示 cgroups 的 hierarchy 概念，把各个 subsystem 的实现都封装到文件系统的各项操作中。有兴趣的读者可以在网上搜索并阅读[VFS](http://en.wikipedia.org/wiki/Virtual_file_system)的相关内容，在此就不赘述了。

定义子系统的结构体是`cgroup_subsys`，在图 9 中可以看到，`cgroup_subsys`中定义了一组函数的接口，让各个子系统自己去实现，类似的思想还被用在了`cgroup_subsys_state`中，`cgroup_subsys_state`并没有定义控制信息，只是定义了各个子系统都需要用到的公共信息，由各个子系统各自按需去定义自己的控制信息结构体，最终在自定义的结构体中把`cgroup_subsys_state`包含进去，然后内核通过`container_of`（这个宏可以通过一个结构体的成员找到结构体自身）等宏定义来获取对应的结构体。

![](https://static001.infoq.cn/resource/image/1e/a5/1e1c0af0a064df755b4216650a2f48a5.png)

<center>**图 9 cgroup 子系统结构体**</center>

### （2）基于 cgroups 实现结构的用户层体现

了解了 cgroups 实现的代码结构以后，再来看用户层在使用 cgroups 时的限制，会更加清晰。

在实际的使用过程中，你需要通过挂载（mount）`cgroup`文件系统新建一个层级结构，挂载时指定要绑定的子系统，缺省情况下默认绑定系统所有子系统。把 cgroup 文件系统挂载（mount）上以后，你就可以像操作文件一样对 cgroups 的 hierarchy 层级进行浏览和操作管理（包括权限管理、子文件管理等等）。除了 cgroup 文件系统以外，内核没有为 cgroups 的访问和操作添加任何系统调用。

如果新建的层级结构要绑定的子系统与目前已经存在的层级结构完全相同，那么新的挂载会重用原来已经存在的那一套（指向相同的 css_set）。否则如果要绑定的子系统已经被别的层级绑定，就会返回挂载失败的错误。如果一切顺利，挂载完成后层级就被激活并与相应子系统关联起来，可以开始使用了。

目前无法将一个新的子系统绑定到激活的层级上，或者从一个激活的层级中解除某个子系统的绑定。

当一个顶层的 cgroup 文件系统被卸载（umount）时，如果其中创建后代 cgroup 目录，那么就算上层的 cgroup 被卸载了，层级也是激活状态，其后代 cgoup 中的配置依旧有效。只有递归式的卸载层级中的所有 cgoup，那个层级才会被真正删除。

层级激活后，`/proc`目录下的每个 task PID 文件夹下都会新添加一个名为`cgroup`的文件，列出 task 所在的层级，对其进行控制的子系统及对应 cgroup 文件系统的路径。

一个 cgroup 创建完成，不管绑定了何种子系统，其目录下都会生成以下几个文件，用来描述 cgroup 的相应信息。同样，把相应信息写入这些配置文件就可以生效，内容如下。

* `tasks`：这个文件中罗列了所有在该 cgroup 中 task 的 PID。该文件并不保证 task 的 PID 有序，把一个 task 的 PID 写到这个文件中就意味着把这个 task 加入这个 cgroup 中。
* `cgroup.procs`：这个文件罗列所有在该 cgroup 中的线程组 ID。该文件并不保证线程组 ID 有序和无重复。写一个线程组 ID 到这个文件就意味着把这个组中所有的线程加到这个 cgroup 中。
* `notify_on_release`：填 0 或 1，表示是否在 cgroup 中最后一个 task 退出时通知运行`release agent`，默认情况下是 0，表示不运行。
* `release_agent`：指定 release agent 执行脚本的文件路径（该文件在最顶层 cgroup 目录中存在），在这个脚本通常用于自动化`umount`无用的 cgroup。

除了上述几个通用的文件以外，绑定特定子系统的目录下也会有其他的文件进行子系统的参数配置。

在创建的 hierarchy 中创建文件夹，就类似于 fork 中一个后代 cgroup，后代 cgroup 中默认继承原有 cgroup 中的配置属性，但是你可以根据需求对配置参数进行调整。这样就把一个大的 cgroup 系统分割成一个个嵌套的、可动态变化的“软分区”。

## 7. cgroups 的使用方法简介

### （1）安装 cgroups 工具库

本节主要针对 Ubuntu14.04 版本系统进行介绍，其他 Linux 发行版命令略有不同，原理是一样的。不安装 cgroups 工具库也可以使用 cgroups，安装它只是为了更方便的在用户态对 cgroups 进行管理，同时也方便初学者理解和使用，本节对 cgroups 的操作和使用都基于这个工具库。

```
apt-get install cgroup-bin
```

安装的过程会自动创建`/cgroup`目录，如果没有自动创建也不用担心，使用 `mkdir /cgroup` 手动创建即可。在这个目录下你就可以挂载各类子系统。安装完成后，你就可以使用`lssubsys`（罗列所有的 subsystem 挂载情况）等命令。

说明：也许你在其他文章中看到的 cgroups 工具库教程，会在 /etc 目录下生成一些初始化脚本和配置文件，默认的 cgroup 配置文件为`/etc/cgconfig.conf`，但是因为存在使 LXC 无法运行的 bug，所以在新版本中把这个配置移除了，详见：https://bugs.launchpad.net/ubuntu/+source/libcgroup/+bug/1096771。

### （2）查询 cgroup 及子系统挂载状态

在挂载子系统之前，可能你要先检查下目前子系统的挂载状态，如果子系统已经挂载，根据第 4 节中讲的规则 2，你就无法把子系统挂载到新的 hierarchy，此时就需要先删除相应 hierarchy 或卸载对应子系统后再挂载。

* 查看所有的 cgroup：`lscgroup`
* 查看所有支持的子系统：`lssubsys -a`
* 查看所有子系统挂载的位置： `lssubsys –m`
* 查看单个子系统（如 memory）挂载位置：`lssubsys –m memory`

### （3）创建 hierarchy 层级并挂载子系统

在组织结构与规则一节中我们提到了 hierarchy 层级和 subsystem 子系统的关系，我们知道使用 cgroup 的最佳方式是：为想要管理的每个或每组资源创建单独的 cgroup 层级结构。而创建 hierarchy 并不神秘，实际上就是做一个标记，通过挂载一个 tmpfs{基于内存的临时文件系统，详见：http://en.wikipedia.org/wiki/Tmpfs}文件系统，并给一个好的名字就可以了，系统默认挂载的 cgroup 就会进行如下操作。

```
mount -t tmpfs cgroups /sys/fs/cgroup
```

其中`-t`即指定挂载的文件系统类型，其后的`cgroups`是会出现在`mount`展示的结果中用于标识，可以选择一个有用的名字命名，最后的目录则表示文件的挂载点位置。

挂载完成`tmpfs`后就可以通过`mkdir`命令创建相应的文件夹。

```
mkdir /sys/fs/cgroup/cg1
```

再把子系统挂载到相应层级上，挂载子系统也使用 mount 命令，语法如下。

```
mount -t cgroup -o subsystems name /cgroup/name
```

其​​​中​​​ subsystems 是​​​使​​​用​​​`,`（逗号）​​​分​​​开​​​的​​​子​​​系​​​统​​​列​​​表，name 是​​​层​​​级​​​名​​​称​​​。具体我们以挂载 cpu 和 memory 的子系统为例，命令如下。

```
mount –t cgroup –o cpu,memory cpu_and_mem /sys/fs/cgroup/cg1
```

从`mount`命令开始，`-t`后面跟的是挂载的文件系统类型，即`cgroup`文件系统。`-o`后面跟要挂载的子系统种类如`cpu`、`memory`，用逗号隔开，其后的`cpu_and_mem`不被 cgroup 代码的解释，但会出现在 /proc/mounts 里，可以使用任何有用的标识字符串。最后的参数则表示挂载点的目录位置。

说明：如果挂载时提示`mount: agent already mounted or /cgroup busy`，则表示子系统已经挂载，需要先卸载原先的挂载点，通过第二条中描述的命令可以定位挂载点。

### （4）卸载 cgroup

目前`cgroup`文件系统虽然支持重新挂载，但是官方不建议使用，重新挂载虽然可以改变绑定的子系统和`release agent`，但是它要求对应的 hierarchy 是空的并且 release_agent 会被传统的`fsnotify`（内核默认的文件系统通知）代替，这就导致重新挂载很难生效，未来重新挂载的功能可能会移除。你可以通过卸载，再挂载的方式处理这样的需求。

卸载 cgroup 非常简单，你可以通过`cgdelete`命令，也可以通过`rmdir`，以刚挂载的 cg1 为例，命令如下。

```
rmdir /sys/fs/cgroup/cg1
```

rmdir 执行成功的必要条件是 cg1 下层没有创建其它 cgroup，cg1 中没有添加任何 task，并且它也没有被别的 cgroup 所引用。

cgdelete cpu,memory:/ 使用`cgdelete`命令可以递归的删除 cgroup 及其命令下的后代 cgroup，并且如果 cgroup 中有 task，那么 task 会自动移到上一层没有被删除的 cgroup 中，如果所有的 cgroup 都被删除了，那 task 就不被 cgroups 控制。但是一旦再次创建一个新的 cgroup，所有进程都会被放进新的 cgroup 中。

### （5）设置 cgroups 参数

设置 cgroups 参数非常简单，直接对之前创建的 cgroup 对应文件夹下的文件写入即可，举例如下。

* 设置 task 允许使用的 cpu 为 0 和 1. `echo 0-1 > /sys/fs/cgroup/cg1/cpuset.cpus`

使用`cgset`命令也可以进行参数设置，对应上述允许使用 0 和 1cpu 的命令为：

```
cgset -r cpuset.cpus=0-1 cpu,memory:/
```

### （6）添加 task 到 cgroup

* 通过文件操作进行添加 `echo [PID] > /path/to/cgroup/tasks` 上述命令就是把进程 ID 打印到 tasks 中，如果 tasks 文件中已经有进程，需要使用`">>"`向后添加。

* 通过`cgclassify`将进程添加到 cgroup `cgclassify -g subsystems:path_to_cgroup pidlist` 这个命令中，`subsystems`指的就是子系统（如果使用 man 命令查看，可能也会使用 controllers 表示）​​​，如果 mount 了多个，就是用`","`隔开的子系统名字作为名称，类似`cgset`命令。

* 通过`cgexec`直接在 cgroup 中启动并执行进程 `cgexec -g subsystems:path_to_cgroup command arguments` `command`和`arguments`就表示要在 cgroup 中执行的命令和参数。`cgexec`常用于执行临时的任务。


### （7）权限管理

与文件的权限管理类似，通过`chown`就可以对 cgroup 文件系统进行权限管理。

```
chown uid:gid /path/to/cgroup
```

uid 和 gid 分别表示所属的用户和用户组。

## 8. subsystem 配置参数用法

### （1）blkio - BLOCK IO 资源控制

* **限额类** 限额类是主要有两种策略，一种是基于完全公平队列调度（CFQ：Completely Fair Queuing ）的按权重分配各个 cgroup 所能占用总体资源的百分比，好处是当资源空闲时可以充分利用，但只能用于最底层节点 cgroup 的配置；另一种则是设定资源使用上限，这种限额在各个层次的 cgroup 都可以配置，但这种限制较为生硬，并且容器之间依然会出现资源的竞争。

    * **按比例分配块设备 IO 资源**
    * **blkio.weight**：填写 100-1000 的一个整数值，作为相对权重比率，作为通用的设备分配比。
    * **blkio.weight_device**： 针对特定设备的权重比，写入格式为`device_types:node_numbers weight`，空格前的参数段指定设备，`weight`参数与`blkio.weight`相同并覆盖原有的通用分配比。{查看一个设备的`device_types:node_numbers`可以使用：`ls -l /dev/DEV`，看到的用逗号分隔的两个数字就是。有的文章也称之为`major_number:minor_number`。}
    * **控制 IO 读写速度上限**
        1. **blkio.throttle.read_bps_device**：按每秒读取块设备的数据量设定上限，格式`device_types:node_numbers bytes_per_second`。
        2. **blkio.throttle.write_bps_device**：按每秒写入块设备的数据量设定上限，格式`device_types:node_numbers bytes_per_second`。
        3. **blkio.throttle.read_iops_device**：按每秒读操作次数设定上限，格式`device_types:node_numbers operations_per_second`。
        4. **blkio.throttle.write_iops_device**：按每秒写操作次数设定上限，格式`device_types:node_numbers operations_per_second`

    * **针对特定操作 (read, write, sync, 或 async) 设定读写速度上限**
        1. **blkio.throttle.io_serviced**：针对特定操作按每秒操作次数设定上限，格式`device_types:node_numbers operation operations_per_second`
        2. **blkio.throttle.io_service_bytes**：针对特定操作按每秒数据量设定上限，格式`device_types:node_numbers operation bytes_per_second`


* **统计与监控** 以下内容都是只读的状态报告，通过这些统计项更好地统计、监控进程的 io 情况。

    1. **blkio.reset_stats**：重置统计信息，写入一个 int 值即可。
    2. **blkio.time**：统计 cgroup 对设备的访问时间，按格式`device_types:node_numbers milliseconds`读取信息即可，以下类似。
    3. **blkio.io_serviced**：统计 cgroup 对特定设备的 IO 操作（包括 read、write、sync 及 async）次数，格式`device_types:node_numbers operation number`
    4. **blkio.sectors**：统计 cgroup 对设备扇区访问次数，格式 `device_types:node_numbers sector_count`
    5. **blkio.io_service_bytes**：统计 cgroup 对特定设备 IO 操作（包括 read、write、sync 及 async）的数据量，格式`device_types:node_numbers operation bytes`
    6. **blkio.io_queued**：统计 cgroup 的队列中对 IO 操作（包括 read、write、sync 及 async）的请求次数，格式`number operation`
    7. **blkio.io_service_time**：统计 cgroup 对特定设备的 IO 操作（包括 read、write、sync 及 async）时间 (单位为 ns)，格式`device_types:node_numbers operation time`
    8. **blkio.io_merged**：统计 cgroup 将 BIOS 请求合并到 IO 操作（包括 read、write、sync 及 async）请求的次数，格式`number operation`
    9. **blkio.io_wait_time**：统计 cgroup 在各设​​​备​​​中各类型​​​IO 操作（包括 read、write、sync 及 async）在队列中的等待时间​(单位 ns)，格式`device_types:node_numbers operation time`
    10. **blkio.**recursive_*：各类型的统计都有一个递归版本，Docker 中使用的都是这个版本。获取的数据与非递归版本是一样的，但是包括 cgroup 所有层级的监控数据。


### （2） cpu - CPU 资源控制

CPU 资源的控制也有两种策略，一种是完全公平调度 （CFS：Completely Fair Scheduler）策略，提供了限额和按比例分配两种方式进行资源控制；另一种是实时调度（Real-Time Scheduler）策略，针对实时进程按周期分配固定的运行时间。配置时间都以微秒（µs）为单位，文件名中用`us`表示。

* **CFS 调度策略下的配置**

    * 设定 CPU 使用周期使用时间上限
    * **cpu.cfs_period_us**：设定周期时间，必须与`cfs_quota_us`配合使用。
    * **cpu.cfs_quota_us** ：设定周期内最多可使用的时间。这里的配置指 task 对单个 cpu 的使用上限，若`cfs_quota_us`是`cfs_period_us`的两倍，就表示在两个核上完全使用。数值范围为 1000 - 1000,000（微秒）。
    * **cpu.stat**：统计信息，包含`nr_periods`（表示经历了几个`cfs_period_us`周期）、`nr_throttled`（表示 task 被限制的次数）及`throttled_time`（表示 task 被限制的总时长）。
    * **按权重比例设定 CPU 的分配**
    * **cpu.shares**：设定一个整数（必须大于等于 2）表示相对权重，最后除以权重总和算出相对比例，按比例分配 CPU 时间。（如 cgroup A 设置 100，cgroup B 设置 300，那么 cgroup A 中的 task 运行 25% 的 CPU 时间。对于一个 4 核 CPU 的系统来说，cgroup A 中的 task 可以 100% 占有某一个 CPU，这个比例是相对整体的一个值。）

* **RT 调度策略下的配置** 实时调度策略与公平调度策略中的按周期分配时间的方法类似，也是在周期内分配一个固定的运行时间。

    1. **cpu.rt_period_us** ：设定周期时间。
    2. **cpu.rt_runtime_us**：设定周期中的运行时间。


### （3） cpuacct - CPU 资源报告

这个子系统的配置是`cpu`子系统的补充，提供 CPU 资源用量的统计，时间单位都是纳秒。

1. **cpuacct.usage**：统计 cgroup 中所有 task 的 cpu 使用时长
2. **cpuacct.stat**：统计 cgroup 中所有 task 的用户态和内核态分别使用 cpu 的时长
3. **cpuacct.usage_percpu**：统计 cgroup 中所有 task 使用每个 cpu 的时长

### （4）cpuset - CPU 绑定

为 task 分配独立 CPU 资源的子系统，参数较多，这里只选讲两个必须配置的参数，同时 Docker 中目前也只用到这两个。

1. **cpuset.cpus**：在这个文件中填写 cgroup 可使用的 CPU 编号，如`0-2,16`代表 0、1、2 和 16 这 4 个 CPU。
2. **cpuset.mems**：与 CPU 类似，表示 cgroup 可使用的`memory node`，格式同上

### （5） device - 限制 task 对 device 的使用

* ** 设备黑 / 白名单过滤 **

    1. **devices.allow**：允许名单，语法`type device_types:node_numbers access type` ；`type`有三种类型：b（块设备）、c（字符设备）、a（全部设备）；`access`也有三种方式：r（读）、w（写）、m（创建）。
    2. **devices.deny**：禁止名单，语法格式同上。

* **统计报告**
    1. **devices.list**：报​​​告​​​为​​​这​​​个​​​ cgroup 中​​​的​task 设​​​定​​​访​​​问​​​控​​​制​​​的​​​设​​​备


### （6） freezer - 暂停 / 恢复 cgroup 中的 task

只有一个属性，表示进程的状态，把 task 放到 freezer 所在的 cgroup，再把 state 改为 FROZEN，就可以暂停进程。不允许在 cgroup 处于 FROZEN 状态时加入进程。 * **freezer.state **，包括如下三种状态： - FROZEN 停止 - FREEZING 正在停止，这个是只读状态，不能写入这个值。 - THAWED 恢复

### （7） memory - 内存资源管理

* **限额类**

    1. **memory.limit_bytes**：强制限制最大内存使用量，单位有`k`、`m`、`g`三种，填`-1`则代表无限制。
    2. **memory.soft_limit_bytes**：软限制，只有比强制限制设置的值小时才有意义。填写格式同上。当整体内存紧张的情况下，task 获取的内存就被限制在软限制额度之内，以保证不会有太多进程因内存挨饿。可以看到，加入了内存的资源限制并不代表没有资源竞争。
    3. **memory.memsw.limit_bytes**：设定最大内存与 swap 区内存之和的用量限制。填写格式同上。

* **报警与自动控制**

    1. **memory.oom_control**：改参数填 0 或 1， `0`表示开启，当 cgroup 中的进程使用资源超过界限时立即杀死进程，`1`表示不启用。默认情况下，包含 memory 子系统的 cgroup 都启用。当`oom_control`不启用时，实际使用内存超过界限时进程会被暂停直到有空闲的内存资源。

* **统计与监控类**

    1. **memory.usage_bytes**：报​​​告​​​该​​​ cgroup 中​​​进​​​程​​​使​​​用​​​的​​​当​​​前​​​总​​​内​​​存​​​用​​​量（以字节为单位）
    2. **memory.max_usage_bytes**：报​​​告​​​该​​​ cgroup 中​​​进​​​程​​​使​​​用​​​的​​​最​​​大​​​内​​​存​​​用​​​量
    3. **memory.failcnt**：报​​​告​​​内​​​存​​​达​​​到​​​在​​`​ memory.limit_in_bytes`设​​​定​​​的​​​限​​​制​​​值​​​的​​​次​​​数​​​
    4. **memory.stat**：包含大量的内存统计数据。
    5. cache：页​​​缓​​​存​​​，包​​​括​​​ tmpfs（shmem），单位为字节。
    6. rss：匿​​​名​​​和​​​ swap 缓​​​存​​​，不​​​包​​​括​​​ tmpfs（shmem），单位为字节。
    7. mapped_file：memory-mapped 映​​​射​​​的​​​文​​​件​​​大​​​小​​​，包​​​括​​​ tmpfs（shmem），单​​​位​​​为​​​字​​​节​​​
    8. pgpgin：存​​​入​​​内​​​存​​​中​​​的​​​页​​​数​​​
    9. pgpgout：从​​​内​​​存​​​中​​​读​​​出​​​的​​​页​​​数
    10. swap：swap 用​​​量​​​，单​​​位​​​为​​​字​​​节​​​
    11. active_anon：在​​​活​​​跃​​​的​​​最​​​近​​​最​​​少​​​使​​​用​​​（least-recently-used，LRU）列​​​表​​​中​​​的​​​匿​​​名​​​和​​​ swap 缓​​​存​​​，包​​​括​​​ tmpfs（shmem），单​​​位​​​为​​​字​​​节​​​
    12. inactive_anon：不​​​活​​​跃​​​的​​​ LRU 列​​​表​​​中​​​的​​​匿​​​名​​​和​​​ swap 缓​​​存​​​，包​​​括​​​ tmpfs（shmem），单​​​位​​​为​​​字​​​节
    13. active_file：活​​​跃​​​ LRU 列​​​表​​​中​​​的​​​ file-backed 内​​​存​​​，以​​​字​​​节​​​为​​​单​​​位
    14. inactive_file：不​​​活​​​跃​​​ LRU 列​​​表​​​中​​​的​​​ file-backed 内​​​存​​​，以​​​字​​​节​​​为​​​单​​​位
    15. unevictable：无​​​法​​​再​​​生​​​的​​​内​​​存​​​，以​​​字​​​节​​​为​​​单​​​位​​​
    16. hierarchical_memory_limit：包​​​含​​​ memory cgroup 的​​​层​​​级​​​的​​​内​​​存​​​限​​​制​​​，单​​​位​​​为​​​字​​​节​​​
    17. hierarchical_memsw_limit：包​​​含​​​ memory cgroup 的​​​层​​​级​​​的​​​内​​​存​​​加​​​ swap 限​​​制​​​，单​​​位​​​为​​​字​​​节​​​


## 8. 总结

本文由浅入深的讲解了 cgroups 的方方面面，从 cgroups 是什么，到 cgroups 该怎么用，最后对大量的 cgroup 子系统配置参数进行了梳理。可以看到，内核对 cgroups 的支持已经较为完善，但是依旧有许多工作需要完善。如网络方面目前是通过 TC（Traffic Controller）来控制，未来需要统一整合；资源限制并没有解决资源竞争，在各自限制之内的进程依旧存在资源竞争，优先级调度方面依旧有很大的改进空间。希望通过本文帮助大家了解 cgroups，让更多人参与到社区的贡献中。

## 9. 作者简介

孙健波，[浙江大学 SEL 实验室](http://www.sel.zju.edu.cn)硕士研究生，目前在云平台团队从事科研和开发工作。浙大团队对 PaaS、Docker、大数据和主流开源云计算技术有深入的研究和二次开发经验，团队现将部分技术文章贡献出来，希望能对读者有所帮助。

## 参考资料

* https://sysadmincasts.com/episodes/14-introduction-to-linux-control-groups-cgroups
* https://access.redhat.com/documentation/en-US/Red*Hat*Enterprise_Linux/6/html/Resource*Management*Guide/index.html
* http://www.cnblogs.com/lisperl/archive/2013/01/14/2860353.html
* https://www.kernel.org/doc/Documentation/cgroups


---

感谢[郭蕾](http://www.infoq.com/cn/author/%E9%83%AD%E8%95%BE)对本文的策划和审校。

给 InfoQ 中文站投稿或者参与内容翻译工作，请邮件至[editors@cn.infoq.com](mailto:editors@cn.infoq.com)。也欢迎大家通过新浪微博（[@InfoQ](http://www.weibo.com/infoqchina)，[@丁晓昀](http://weibo.com/u/1451714913)），微信（微信号：[InfoQChina](http://weixin.sogou.com/gzh?openid=oIWsFt0HnZ93MfLi3pW2ggVJFRxY)）关注我们，并与我们的编辑和其他读者朋友交流。

