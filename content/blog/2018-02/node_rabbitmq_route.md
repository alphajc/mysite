+++
author = "Jerry Chan"
categories = ["技术"]
tags = ["RabbitMQ", "Middleware", "Node.js"]
date = "2018-02-14T08:52:19+08:00"
description = "node使用rabbitmq系列的第4篇文章，主要介绍rabbitmq的路由功能。"
featured = ""
featuredalt = ""
featuredpath = ""
linktitle = ""
title = "Node使用RabbitMQ：路由"
type = "post"

+++

# 前提条件

本教程假定RabbitMQ已安装并在标准端口（5672）上的本地主机上运行。如果您使用不同的主机，端口或凭据，连接设置将需要调整。

# （使用amqp.node客户端）

在之前的教程中，我们构建了一个简单的日志系统我们能够将日志消息广播给许多接收者。 在本教程中，我们将添加一个功能——只订阅一部分消息。比如说，我们只把最严重的错误输出到日志文件（写到盘），而在控制台上打印所有的日志信息。

## 绑定

在前面的教程中我们已经创建过绑定了，这里我们可以重新使用：

```js
ch.bindQueue(q.queue, ex, '');
```

一个绑定将一个交换器和一个队列关联起来。我们可以这样简单理解：队列将会对该交换器里的消息感兴趣。 绑定可以采用额外的绑定键参数（上面代码中的空字符串）。这是我们如何创建一个带key的绑定：

```js
ch.bindQueue(queue_name, exchange_name, 'black');
```

绑定键的含义取决于交换类型。我们之前使用的`fanout`交换机，简单地忽略了它的值。

## 直接交换器（Direct exchange）

我们在前面的教程中创建的日志系统将广播所有的信息给消费者。我们希望扩展这个功能，以便根据消息的严重性来过滤消息。例如我们可能希望将日志写入磁盘的脚本只接收到严重的错误，而不会浪费磁盘去存储`info`和`warning`的日志。 我们之前使用了一个`fanout`交换器，这并没有给我们太大的灵活性——它只能够无意识地广播。 现在我们使用`direct`交换器代替。`direct`交换器背后的路由算法很简单——消息将进入`binding key`与消息的`routing key`完全匹配的队列。 为了阐释清楚，我们可以参考一下示意图： 

![](/assets/blog/2018-02/direct-exchange.png) 

如图，我们可以看到`direct`交换器`X`绑定了两个队列。第一个队列的绑定键是`orange`，第二个队列有两个绑定，两个绑定键分别是`black`和`green`。 此图中，发布一个路由键为`orange`的消息到交换器中，将被路由到`Q1`队列中。路由键为`black`或者是`green`的消息将路由到`Q2`队列中。所有其他消息将被取消。

## 多绑定

![](/assets/blog/2018-02/direct-exchange-multiple.png) 

相同的绑定键绑定多个队列是完全合法的。在上述例子中，我们完全可以使用绑定键`black`绑定`X`和`Q1`。如此一来这个直接交换器就跟删除交换器一样将会把消息广播给匹配的队列。带有路由键`black`的消息将被同时推送到`Q1`和`Q2`。

## 发送日志

我们将使用我们的日志系统模型，以直接交换器代替删除交换器，以日志的严重性级别作为路由键。这样接收脚本可以选择自己想接收的级别的日志。我们先关注发送日志。 我们总需要首先去创建一个交换器：

```js
var ex = 'direct_logs';

ch.assertExchange(ex, 'direct', {durable: false});
```

然后准备发送一个消息：

```js
var ex = 'direct_logs';

ch.assertExchange(ex, 'direct', {durable: false});
ch.publish(ex, severity, new Buffer(msg));
```

为了简化事情，我们将假定“严重性”可以是`info`，`warning`，`error`之一。

## 订阅

接收消息的方式与上一个教程中的一样，除了一个例外——我们将为每个我们感兴趣的严重级别创建一个新的绑定。

```js
args.forEach(function(severity) {
  ch.bindQueue(q.queue, exchange, severity);
});
```

## 全部代码

![](/assets/blog/2018-02/python-four.png) 

`emit_log_direct.js`脚本的代码：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'direct_logs';
    var args = process.argv.slice(2);
    var msg = args.slice(1).join(' ') || 'Hello World!';
    var severity = (args.length > 0) ? args[0] : 'info';

    ch.assertExchange(ex, 'direct', {durable: false});
    ch.publish(ex, severity, new Buffer(msg));
    console.log(" [x] Sent %s: '%s'", severity, msg);
  });

  setTimeout(function() { conn.close(); process.exit(0) }, 500);
});
```

`receive_logs_direct.js`的代码：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var args = process.argv.slice(2);

if (args.length == 0) {
  console.log("Usage: receive_logs_direct.js [info] [warning] [error]");
  process.exit(1);
}

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'direct_logs';

    ch.assertExchange(ex, 'direct', {durable: false});

    ch.assertQueue('', {exclusive: true}, function(err, q) {
      console.log(' [*] Waiting for logs. To exit press CTRL+C');

      args.forEach(function(severity) {
        ch.bindQueue(q.queue, ex, severity);
      });

      ch.consume(q.queue, function(msg) {
        console.log(" [x] %s: '%s'", msg.fields.routingKey, msg.content.toString());
      }, {noAck: true});
    });
  });
});
```

如果只想保存“警告”和“错误”（而不是“信息”），则将消息记录到文件中，只需打开控制台并输入:

```sh
./receive_logs_direct.js warning error > logs_from_rabbit.log
```

如果您想要在屏幕上查看所有日志消息，请打开一个新终端并执行以下操作:

```sh
./receive_logs_direct.js info warning error
# => [*] Waiting for logs. To exit press CTRL+C
```

而且，例如，要输出错误日志消息，只需键入：

```sh
./emit_log_direct.js error "Run. Run. Or it will explode."
# => [x] Sent 'error':'Run. Run. Or it will explode.'
```

转到教程5，了解如何根据模式来侦听消息。
