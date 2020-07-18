---
title: Node使用RabbitMQ：入门篇
date: 2018-02-11T08:52:19+08:00
hero: /assets/images/posts/middleware/rabbitmq_node.jpg
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- middleware
- rabbitmq
tags:
- node.js
- rabbitmq
- mq
description: node使用rabbitmq系列文章第一遍，本文介绍了rabbitmq客户端的简单使用
---


# 前提条件

本教程假定RabbitMQ已安装并在本地主机的标准端口（5672）上运行。如果您使用不同的主机，端口或凭据，连接设置将需要调整。

# 简介

RabbitMQ是一个消息broker：它接受和转发消息。你可以把它想象成一个邮局：当你把邮件放在邮箱里时，你可以确定邮差先生最终会把邮件发送给你的收件人。在这个比喻中，RabbitMQ是整个邮政系统即信箱、邮局和邮递员。 RabbitMQ与邮局的主要区别是它不处理纸张，而是接受，存储和转发数据的二进制数据块——消息。 RabbitMQ和一般的消息传递使用了一些术语。

> 生产（_producing_）只不过是发送而已。一个发送消息的程序是一个生产者（_producer_）：  
> 
> ![](/assets/images/posts/middleware/producer.png) 
> 
> 队列（_queue_）是RabbitMQ内部的邮箱名称。尽管消息流经RabbitMQ和您的应用程序，但它们只能存储在队列（_queue_）中。队列（_queue_）只受主机的内存和磁盘限制，实质上是一个大的消息缓冲区。许多生产者（_producer_）可以发送消息到一个队列（_queue_），许多消费者（_consumers_）可以尝试从一个队列（_queue_）接收数据。这就是我们代表队列（_queue_）的方式：  
> 
> ![](/assets/images/posts/middleware/queue.png) 
> 
> 消费（_consuming_）与接受有类似的意义。消费者（_consumer_）是主要等待接收消息的程序：  
> 
> ![](/assets/images/posts/middleware/consumer.png)

请注意，producer，consumer和broker不必在同一主机上；事实上在大多数应用程序中都不会。

# (使用amqp.node客户端)

在本教程的这一部分，我们将用Node编写两个小程序；发送单个消息的生产者，以及接收消息并将其打印出来的消费者。我们将详细介绍[amqp.node](https://www.squaremobius.net/amqp.node/) API中的一些细节，将注意力集中在这个非常简单的事情上，以便开始。这是一个消息传递的“Hello World”。 在下图中，“P”是我们的生产者，“C”是我们的消费者。中间的盒子是一个队列——RabbitMQ消费者的消息缓冲区。 ![](/assets/images/posts/middleware/python-one.png)

> **amqp.node客户端库** RabbitMQ提供多种协议。本教程使用AMQP 0-9-1，这是一个开放，通用的消息传递协议。 RabbitMQ有许多不同的语言客户端。我们将在本教程中使用amqp.node客户端。 首先，使用[npm](https://www.npmjs.com/)安装amqp.node：

```bash
npm install amqplib
```

现在我们安装了amqp.node，我们可以写一些代码。

## 发送端

![](/assets/images/posts/middleware/sending.png) 

我们将调用我们的消息发布者（发送者）`send.js`和我们的消息使用者（接收者）`receive.js`。发布者将连接到RabbitMQ，发送一条消息，然后退出。 在send.js中，我们需要首先需要库：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
```


然后连接到RabbitMQ服务器

```js
amqp.connect('amqp://localhost', function(err, conn) {});
```

接下来我们创建一个频道（channel），这是大部分API所需要做的：

```js
amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {});
});
```


发送，我们必须申报队列给我们发送；然后我们可以发布消息到队列中：

```js
amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'hello';

    ch.assertQueue(q, {durable: false});
    // Note: on Node 6 Buffer.from(msg) should be used
    ch.sendToQueue(q, new Buffer('Hello World!'));
    console.log(" [x] Sent 'Hello World!'");
  });
});
```


声明一个队列是幂等的——只有当它不存在时才会被创建。消息内容是一个字节数组，所以你可以使用任何编码。 最后，我们关闭连接并退出：

```js
setTimeout(function() { conn.close(); process.exit(0) }, 500);
```

所以，整个代码如下：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'hello';
    var msg = 'Hello World!';

    ch.assertQueue(q, {durable: false});
    // Note: on Node 6 Buffer.from(msg) should be used
    ch.sendToQueue(q, new Buffer(msg));
    console.log(" [x] Sent %s", msg);
  });
  setTimeout(function() { conn.close(); process.exit(0) }, 500);
});
```

> **发送端故障** 如果这是您第一次使用RabbitMQ，并且您没有看到“已发送”消息，那么您可能会不知所措。也许broker启动没有足够的可用磁盘空间（默认情况下，它至少需要200 MB空闲空间），因此拒绝接受消息。检查代理日志文件以确认并在必要时减少限制。[配置文件文档](https://www.rabbitmq.com/configure.html#config-items)将告诉你如何设置`disk_free_limit`。

## 接收端

这是我们的接收方。消费者获取从RabbitMQ推送的消息，因此与发布单个消息的发布者不同，我们将持续运行以监听消息并将其打印出来。 

![](/assets/images/posts/middleware/receiving.webp) 

代码（在`receive.js`中）和send有相同的要求：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
```

设置与发布者相同；我们打开一个连接和一个通道，并声明我们将要使用的队列。注意这与`sendToQueue`发布到的队列相匹配。

```js
amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'hello';

    ch.assertQueue(q, {durable: false});
  });
});
```

请注意，我们在这里也声明队列。因为我们可能会在发布者之前启动消费者，所以我们希望确保队列存在，然后再试图使用消息。 我们即将告诉服务器将队列中的消息传递给我们。由于它会异步推送消息，因此我们提供了一个回调函数，当RabbitMQ向消费者推送消息时，将执行回调函数。这是`Channel.consume`所做的。

```js
console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q);
ch.consume(q, function(msg) {
  console.log(" [x] Received %s", msg.content.toString());
}, {noAck: true});
```

完整`receive.js`如下：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'hello';

    ch.assertQueue(q, {durable: false});
    console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q);
    ch.consume(q, function(msg) {
      console.log(" [x] Received %s", msg.content.toString());
    }, {noAck: true});
  });
});
```

## 执行

现在我们可以运行这两个脚本。在终端中，运行发布者：

```bash
./send.js
```

然后运行接收者：

```bash
./receive.js
```

消费者将通过RabbitMQ打印从发布者处获得的消息。消费者将继续运行，等待消息（使用Ctrl-C停止它），所以尝试从另一个终端运行发布者。

> **列出队列** 你可能想看看RabbitMQ有什么队列，有多少条消息。您可以作为特权用户使用`rabbitmqctl`工具执行此操作：
>
>     sudo rabbitmqctl list_queues
>       
>
> 在Windows上，省略sudo：
>
>     rabbitmqctl.bat list_queues
>
