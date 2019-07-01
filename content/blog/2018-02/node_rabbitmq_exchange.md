+++
author = "Jerry Chan"
categories = ["信息技术"]
tags = ["RabbitMQ", "Middleware", "Node.js"]
date = "2018-02-15T08:52:19+08:00"
description = "node使用rabbitmq系列的第5篇文章，介绍了rabbitmq交换器的使用方式。"
featured = "rabbitmq_node.jpg"
featuredalt = ""
featuredpath = "assets/cover"
linktitle = ""
title = "Node使用RabbitMQ：主题交换器"
type = "post"

+++

# 前提条件

本教程假定RabbitMQ已安装并在标准端口（5672）上的本地主机上运行。如果您使用不同的主机，端口或凭据，连接设置将需要调整。

# （使用amqp.node客户端）

在之前的教程中，我们改良了我们的日志系统。我们没有使用只有虚拟广播的`fanout`交换器，而是使用`direct`交换器，提供了有选择性地接收日志的可能性。 虽然使用`direct`交换器改良了我们的系统，但是他还是存在一些限制——它不能根据多种标准路由。 在我们的日志系统中，我们可能不仅想要订阅基于严重性级别的日志，可能还有基于日志出处的。你可能从syslog unix工具知道这个概念，它根据严重性（info/warn/crit ...）和设备（auth/cron/kern ...）来路由日志。 这会给我们很大的灵活性——我们可能想要获取来自'cron'的严重错误，而且还要听取来自'kern'的所有日志。 为了在我们的日志系统中实现这一点，我们需要了解更复杂的主题（`topic`）交换器。

## 主题交换器

发送到主题交换的消息不能有任意的`routing_key`——它必须是由点分隔的单词列表。单词可以是任何东西，但通常它们指定连接到消息的一些功能。一些有效的路由键例子： `stock.usd.nyse`，`nyse.vmw`，`quick.orange.rabbit`。在路由选择键中可以有许多单词，最多255个字母。 绑定键也必须有相同的形式。主题交换器背后的逻辑类似于直接的——使用特定的路由键发送的消息将被传送到与匹配的绑定键绑定的所有队列。但是绑定键有两个重要的特殊情况：

*   *（星号）可以代替一个单词。
*   #（井号）可以代替另个或者多个单词。

举个简单的例子： 

![](/assets/blog/2018-02/python-five.png) 

在这个例子中，我们将发送所有描述动物的信息。消息将使用由三个单词（两个点）组成的路由键发送。路由键中的第一个单词将描述速度，第二个颜色和第三个种类：`<speed>.<color>.<species>`。 我们将创建三个绑定：Q1的绑定键是`*.orange.*`，Q2是`*.*.rabbit`和`lazy.#`。 什么含义呢？

*   Q1对所有橘色动物感兴趣。
*   Q2想要监听所有的兔子和和所有懒惰的动物。

一条路由键为`quick.orange.rabbit`将会被分发到两个队列，同样的，`lazy.orange.elephant`也将被分发到两个队列。而`quick.orange.fox`只会被发送到第一个队列中，`lazy.brown.fox`只会被发送到第二个。`lazy.pink.rabbit`虽然匹配第二个队列中的两个绑定键，但是它只会被发送一次。`auick.brown.fox`不匹配任何绑定键所以会被直接取消并且被丢掉。 如果违反我们的约定，发送一个或四个单词，如`orange`或`quick.orange.male.rabbit`的消息会发生什么？它们也将因为不匹配绑定键而被丢掉。 另一方面，`lazy.orange.male.rabbit`即使有四个单词，也会匹配最后一个绑定键，并被传递到第二个队列。

> **主题交换器** 主题交换器功能强大能够拥有其它交换器的功能。 当一个队列使用“＃”（井号）绑定键绑定时，它将接收所有的消息，而不管路由键如何——类似于`fanout`交换器。 当在绑定中不使用特殊字符“*”（星号）和“＃”（井号）时，主题交换器将像直接交换器一样。

## 全部代码

我们将在我们的日志系统中使用主题交换器。我们首先假定日志的路由键有两个单词：`<facility>.<severity>`。 这个代码和前一个教程基本一样。 `emit_log_topic.js`：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'topic_logs';
    var args = process.argv.slice(2);
    var key = (args.length > 0) ? args[0] : 'anonymous.info';
    var msg = args.slice(1).join(' ') || 'Hello World!';

    ch.assertExchange(ex, 'topic', {durable: false});
    ch.publish(ex, key, new Buffer(msg));
    console.log(" [x] Sent %s:'%s'", key, msg);
  });

  setTimeout(function() { conn.close(); process.exit(0) }, 500);
});
```

`receive_logs_topic.js`：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var args = process.argv.slice(2);

if (args.length == 0) {
  console.log("Usage: receive_logs_topic.js <facility>.<severity>");
  process.exit(1);
}

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'topic_logs';

    ch.assertExchange(ex, 'topic', {durable: false});

    ch.assertQueue('', {exclusive: true}, function(err, q) {
      console.log(' [*] Waiting for logs. To exit press CTRL+C');

      args.forEach(function(key) {
        ch.bindQueue(q.queue, ex, key);
      });

      ch.consume(q.queue, function(msg) {
        console.log(" [x] %s:'%s'", msg.fields.routingKey, msg.content.toString());
      }, {noAck: true});
    });
  });
});
```

接受所有日志：

```bash
./receive_logs_topic.js "#"
```

从`kern`中接受所有日志：

```sh
./receive_logs_topic.js "kern.*"
```

或者，你只想监听`critical`的日志：

```sh
./receive_logs_topic.js "*.critical"
```

你也可以创建多个绑定：

```sh
./receive_logs_topic.js "kern.*" "*.critical"
```

发送`kern.critical`类型的日志：

```sh
./emit_log_topic.js "kern.critical" "A critical kernel error"
```

请注意，代码不会对路由或绑定键作任何假设，您可能需要使用两个以上的路由键参数。 接下来，在教程6中找出如何做一个远程过程调用的往返消息。
