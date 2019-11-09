+++
author = "Jerry Chan"
categories = ["开发"]
tags = ["RabbitMQ", "Middleware", "Node.js"]
date = "2018-02-13T08:52:19+08:00"
description = "node使用rabbitmq系列的第3篇文章，主要介绍rabbitmq的发布与订阅功能。"
featured = "rabbitmq_node.jpg"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "Node使用RabbitMQ：发布与订阅"
type = "post"

+++

# 前提条件

本教程假定RabbitMQ已安装并在标准端口（5672）上的本地主机上运行。如果您使用不同的主机，端口或凭据，连接设置将需要调整。

# （使用amqp.node客户端）

在前面的教程中，我们创建了一个工作队列，假设每个任务只被传递给一个Worker。在这一部分，我们将做一些完全不同的事情——我们会向多个消费者传递信息。这种模式被称为“发布与订阅”。 为了说明这个模式，我们将建立一个简单的日志系统。它将包含两个程序 - 第一个将发送日志消息，第二个将接收并打印它们。 在我们的日志系统中，接收程序的每个运行副本都会收到消息。这样我们就可以运行一个接收器并将日志定向到磁盘，同时将能够运行另一个接收器并输出到屏幕上以便查看日志。 本质上，发布的日志消息将被广播给所有的接收者。

## 交换器（exchange）

在本教程的前面部分，我们发送和接收来自队列的消息。现在是时候在Rabbit中引入完整的消息模型了。 让我们快速回顾一下前面的教程中介绍的内容：

*   生产者（_producer_）是发送消息的用户应用程序。
*   队列（_queue_）是存储消息的缓冲区。
*   消费者（_consumer_）是接收消息的用户应用程序。

RabbitMQ中消息传递模型的核心思想是生产者永远不会将任何消息直接发送到队列中。实际上，生产者通常甚至不知道邮件是否会被传送到任何队列中。 生产者只能将消息发送给交换器。交换器非常简单，它一面接受来自生产者的消息，一面将接收到的消息推送给队列。交换器必须知道如何处理接收到的消息：是否应该附加到特定的队列？是否应该附加到许多队列？还是应该丢弃。这些规则是由交换类型定义的。

![](/assets/blog/2018-02/exchanges.png) 

有几种可用的交换类型：`direct`，`topic`，`headers`和`fanout`。我们将关注最后一个 ——`fanout`。让我们创建一个这种类型的交换器，并将其称为`logs`：

```js
ch.assertExchange('logs', 'fanout', {durable: false})
```

`fanout`交换非常简单。正如你可能从名字中猜到的那样，它只是将所有收到的消息广播到它所知道的所有队列中。这正是我们日志系统所需要的。

> **列出交换器** 要列出服务器上的交换，您可以运行有用的`rabbitmqctl`：
>
>     sudo rabbitmqctl list_exchanges
>       
>
> 在这个列表中将会有一些`amq.*`交换和默认（未命名）交换。这些是默认创建的，但目前不太可能需要使用它们。 **默认交换器** 在本教程的以前部分，我们对交换器一无所知，但仍能够将消息发送到队列。这是可能的，因为我们正在使用一个默认的交换，这是由空字符串（""）标识。 回顾一下我们之前如何发布消息：
>
```js
ch.sendToQueue('hello', new Buffer('Hello World!'));
```
>
> 这里我们使用默认的或无名的交换：消息被路由到队列中，如果它存在的话，该消息被指定为第一个参数。

现在，我们可以发布到我们的命名交换：

```js
ch.publish('logs', '', new Buffer('Hello World!'));
```

作为第二个参数的空字符串意味着我们不想将消息发送到任何特定的队列。我们只想将其发布到我们的`logs`交换器。

## 临时队列

正如你以前可能记得我们使用的是具有指定名称的队列（请记住`hello`和`task_queue`？）。给队列命名是很重要的——我们需要给Workers指定相同的队列。当你想在生产者和消费者之间共享队列时，一定要给队列命名。 但是我们的日志系统并不是这样。我们想要监听所有日志消息，而不仅仅是其中的一部分。我们也只对目前流动的消息感兴趣，而不是旧消息。要解决这个问题，我们需要两件事。 首先，每当我们连接到Rabbit，我们需要一个新的、空的队列。要做到这一点，我们可以创建一个随机名称的队列，或者最好是让服务器为我们选择一个随机队列名称。 其次，一旦我们断开消费者，队列应该被自动删除。 在[amqp.node](http://www.squaremobius.net/amqp.node/)客户端中，当我们将队列名称作为空字符串提供时，我们使用生成的名称创建一个非持久队列：

```js
ch.assertQueue('', {exclusive: true});
```

当方法返回时，队列实例包含由RabbitMQ生成的随机队列名称。例如，它可能看起来像`amq.gen-JzTY20BRgKO-HjmUJj0wLg`。 当声明它的连接关闭时，队列将被删除，因为它被声明为独占（exclusive）。

## 绑定

![](/assets/blog/2018-02/bindings.png) 

我们已经创建了一个扇出交换器和一个队列。现在我们需要告诉交换器把消息发送到我们的队列。交换器和队列之间的关系被称为绑定。

```js
ch.bindQueue(queue_name, 'logs', '');
```

此后，`logs`交换器将把消息附加到我们的队列中。

> **列出绑定** 你可以通过以下方式列出所有的绑定：
>
>     rabbitmqctl list_bindings
>       

## 全部代码

![](/assets/blog/2018-02/python-three-overall.png) 

发出日志消息的生产者程序与前面的教程没有什么不同。最重要的变化是，我们现在要发布消息到我们的`logs`交换器，而不是无名的。发送时我们需要提供一个路由键，但是对于扇出交换器，它的值将被忽略。这里是`emit_log.js`脚本的代码：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'logs';
    var msg = process.argv.slice(2).join(' ') || 'Hello World!';

    ch.assertExchange(ex, 'fanout', {durable: false});
    ch.publish(ex, '', new Buffer(msg));
    console.log(" [x] Sent %s", msg);
  });

  setTimeout(function() { conn.close(); process.exit(0) }, 500);
});
```

如你所见，建立连接后，我们声明交换器。这一步是必要的，因为不允许发布到一个不存在的交换器。 如果没有队列绑定到交换机上，消息将会丢失，但对我们来说没关系；如果没有消费者正准备接收，我们可以放心地丢弃消息。 `receive_logs.js`的代码：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'logs';

    ch.assertExchange(ex, 'fanout', {durable: false});

    ch.assertQueue('', {exclusive: true}, function(err, q) {
      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
      ch.bindQueue(q.queue, ex, '');

      ch.consume(q.queue, function(msg) {
        console.log(" [x] %s", msg.content.toString());
      }, {noAck: true});
    });
  });
});
```

如果您想将日志保存到文件中，只需打开一个控制台并输入：

```sh
./receive_logs.js > logs_from_rabbit.log
```

如果你想看到屏幕上的日志，开启一个新的终端，并运行：

    ./receive_logs.js


发送日志，需要输入：

    ./emit_log.js


使用`rabbitmqctl list_bindings`，你可以验证代码实际上是否创建了绑定和队列。若有两个`receive_logs.js`程序运行，你应该看到如下结果：

```sh
sudo rabbitmqctl list_bindings
# => Listing bindings ...
# => logs    exchange        amq.gen-JzTY20BRgKO-HjmUJj0wLg  queue           []
# => logs    exchange        amq.gen-vso0PVvyiRIL2WoV3i48Yg  queue           []
# => ...done.
```

结果的解释很简单：`logs`交换器中的数据发送到两个带有服务器分配名称的队列中。这正是我们想要的。 关于如何监听消息子集，我们可以继续阅读教程4。
