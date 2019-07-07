+++
author = "费良宏"
date = "2019-07-07T13:43:44+08:00"
tags = ["IaaS", "FaaS", "Serverless", "AWS", "AWS Lambda"]
categories = ["信息技术"]
description = "文章转载自互联网，供自己学习参考"
link = "https://aws.amazon.com/cn/blogs/china/iaas-faas-serverless/"
linktitle = "原文链接"
featured = ""
featuredalt = ""
featuredpath = ""
format = "Amazon"
title = "从IaaS到FaaS——Serverless架构的前世今生"
type = "archive"

+++

今天大多数公司在开发应用程序并将其部署在服务器上的时候，无论是选择公有云还是私有的数据中心，都需要提前了解究竟需要多少台服务器、多大容量的存储和数据库的功能等。并需要部署运行应用程序和依赖的软件到基础设施之上。假设我们不想在这些细节上花费精力，是否有一种简单的架构模型能够满足我们这种想法？这个答案已经存在，这就是今天软件架构世界中新鲜但是很热门的一个话题——Serverless（无服务器）架构。

## 什么是Serverless

如同许多新的概念一样，Serverless目前还没有一个普遍公认的权威的定义。最新的一个定义是这样描述的：“无服务器架构是基于互联网的系统，其中应用开发不使用常规的服务进程。相反，它们仅依赖于第三方服务（例如AWS Lambda服务），客户端逻辑和服务托管远程过程调用的组合。”

最开始，“无服务器”架构试图帮助开发者摆脱运行后端应用程序所需的服务器设备的设置和管理工作。这项技术的目标并不是为了实现真正意义上的“无服务器”，而是指由第三方云计算供应商负责后端基础结构的维护，以服务的方式为开发者提供所需功能，例如数据库、消息，以及身份验证等。简单地说，这个架构的就是要让开发人员关注代码的运行而不需要管理任何的基础设施。程序代码被部署在诸如AWS Lambda这样的平台之上，通过事件驱动的方法去触发对函数的调用。很明显，这是一种完全针对程序员的架构技术。其技术特点包括了事件驱动的调用方式，以及有一定限制的程序运行方式，例如AWS Lambda的函数的运行时间默认为3秒到5分钟。从这种架构技术出现的两年多时间来看，这个技术已经有了非常广泛的应用，例如移动应用的后端和物联网应用等。简而言之，无服务器架构的出现不是为了取代传统的应用。然而，从具有高度灵活性的使用模式及事件驱动的特点出发，开发人员／架构师应该重视这个新的计算范例，它可以帮助我们达到减少部署、提高扩展性并减少代码后面的基础设施的维护负担。

![](https://s3.cn-north-1.amazonaws.com.cn/images-bjs/0118-faas-01.jpg)

## Serverless的历史

Serverless这个概念并不容易理解。乍见之下，很容易让人混淆硬件服务器及软件上的服务与其所谓的“服务器”差别。在这里强调的所谓“无服务器”指的是我们的代码不会明确地部署在某些特定的软件或者硬件的服务器上。运行代码托管的环境是由例如AWS这样的云计算厂商所提供的。

Serverless这个词第一次被使用大约是2012年由Ken Form所写的一篇名为《Why The Future of Software and Apps is Serverless》的文章。这篇文章谈到的内容是关于持续集成及源代码控制等内容，并不是我们今天所特指的这一种架构模式。但Amazon在2014年发布的AWS Lambda让“Serverless”这一范式提高到一个全新的层面，为云中运行的应用程序提供了一种全新的系统体系结构。至此再也不需要在服务器上持续运行进程以等待HTTP请求或API调用，而是可以通过某种事件机制触发代码的执行，通常这只需要在AWS的某台服务器上配置一个简单的功能。此后Ant Stanley 在2015年7月的名为《Server are Dead…》的文章中更是围绕着AWS Lambda及刚刚发布的AWS API Gateway这两个服务解释了他心目中的Serverless，“Server are dead…they just don’t know it yet”。到了2015年10月份，在那一年的AWS re:Invent大会上，Serverless的这个概念更是反复出现在了很多场合。印象中就包括了“（ARC308）The Serverless Company Using AWS Lambda”及“（DVO209）JAWS: The Monstrously Scalable Serverless Framework”这些演讲当中。随着这个概念的进一步发酵，2016年10月在伦敦举办了第一届的Serverlessvconf。在两天时间里面，来自全世界40多位演讲嘉宾为开发者分享了关于这个领域进展。

在Serverless的世界里面，AWS扮演了一个非常重要的角色。但是AWS并不是唯一的Serverless架构服务的供应商。其他厂商，例如Google Cloud Functions、Microsoft Azure Functions、IBM OpenWhisk、Iron.io和Webtask等各种开源平台都提供了类似的服务。

## Serverless与FaaS

微服务（MicroService）是软件架构领域业另一个热门的话题。如果说微服务是以专注于单一责任与功能的小型功能块为基础，利用模组化的方式组合出复杂的大型应用程序，那么我们还可以进一步认为Serverless架构可以提供一种更加“代码碎片化”的软件架构范式，我们称之为Function as a Services（FaaS）。而所谓的“函数”（Function）提供的是相比微服务更加细小的程序单元。例如，可以通过微服务代表为某个客户执行所有CRUD操作所需的代码，而FaaS中的“函数”可以代表客户所要执行的每个操作：创建、读取、更新，以及删除。当触发“创建账户”事件后，将通过AWS Lambda函数的方式执行相应的“函数”。从这一层意思来说，我们可以简单地将Serverless架构与FaaS概念等同起来。

## FaaS与PaaS的比较

乍看起来，FaaS与PaaS的概念在某些方面有许多相似的地方。人们甚至认为FaaS就是另一种形式的PaaS。但是Intent Media的工程副总裁Mike Roberts有自己的不同看法：“大部分PaaS应用无法针对每个请求启动和停止整个应用程序，而FaaS平台生来就是为了实现这样的目的。”

FaaS和PaaS在运维方面最大的差异在于缩放能力。对于大部分PaaS平台，用户依然需要考虑缩放。但是对于FaaS应用，这种问题完全是透明的。就算将PaaS应用设置为自动缩放，依然无法在具体请求的层面上进行缩放，而FaaS应用在成本方面效益就高多了。AWS云架构战略副总裁Adrian Cockcroft曾经针对两者的界定给出了一个简单的方法：“如果你的PaaS能够有效地在20毫秒内启动实例并运行半秒,那么就可以称之为Serverless”。

## Serverless架构的优点

- 降低运营成本：

    Serverless是非常简单的外包解决方案。它可以让您委托服务提供商管理服务器、数据库和应用程序甚至逻辑，否则您就不得不自己来维护。由于这个服务使用者的数量会非常庞大，于是就会产生规模经济效应。在降低成本上包含了两个方面，即基础设施的成本和人员（运营/开发）的成本。

- 降低开发成本：

    IaaS和PaaS存在的前提是，服务器和操作系统管理可以商品化。Serverless作为另一种服务的结果是整个应用程序组件被商品化。

- 扩展能力：

    Serverless架构一个显而易见的优点即“横向扩展是完全自动的、有弹性的、且由服务提供者所管理”。从基本的基础设施方面受益最大的好处是，您只需支付您所需要的计算能力。

- 更简单的管理：

    Serverless架构明显比其他架构更简单。更少的组件，就意味着您的管理开销会更少。

- “绿色”的计算：

    按照《福布斯》杂志的统计，在商业和企业数据中心的典型服务器仅提供5%～15%的平均最大处理能力的输出。这无疑是一种资源的巨大浪费。随着Serverless架构的出现，让服务提供商提供我们的计算能力最大限度满足实时需求。这将使我们更有效地利用计算资源。

## Serverless的架构范式

移动应用后台Serverless参考架构

![](https://s3.cn-north-1.amazonaws.com.cn/images-bjs/0118-faas-02.png)

实时文件处理Serverless参考架构

![](https://s3.cn-north-1.amazonaws.com.cn/images-bjs/0118-faas-03.png)

Web应用Serverless参考架构

![](https://s3.cn-north-1.amazonaws.com.cn/images-bjs/0118-faas-04.png)

物联网应用后台参考架构

![](https://s3.cn-north-1.amazonaws.com.cn/images-bjs/0118-faas-05.png)

实时流处理Serverless参考架构

![](https://s3.cn-north-1.amazonaws.com.cn/images-bjs/0118-faas-06.png)

## 美丽新世界

技术上不可能有应用程序可以不依赖于服务器，必须要有某种硬件来支持应用程序。但是以AWS Lambda为代表的Serverless架构可以使得开发人员专注于程序功能本身，而让AWS处理与服务器部署、存储和数据库相关的所有复杂性工作。这听起来很简单，但是实现起来却并不简单。这种新的架构打破了人们的习惯思维，它让服务器不可见，并提供了一个极具成本效益的服务。Serverless架构仅有两年的历史，仍处于起步阶段。未来，这个领域还会有更大的进步，这将是非常有趣的。它给所有开发人员带来的是软件架构和应用程序部署的美丽新世界。