+++
author = "Jerry Chan"
categories = ["技术"]
tags = ["RabbitMQ", "Middleware", "Node.js"]
date = "2018-02-12T08:52:19+08:00"
description = "node使用rabbitmq系列的第2篇文章，主要介绍rabbitmq的工作队列。"
featured = ""
featuredalt = ""
featuredpath = ""
linktitle = ""
title = "Node使用RabbitMQ：工作队列"
type = "post"

+++

# 前提条件

本教程假定RabbitMQ已安装并在标准端口（5672）上的本地主机上运行。如果您使用不同的主机，端口或凭据，连接设置将需要调整。

# （使用[amqp.node](https://www.squaremobius.net/amqp.node/)客户端）

在第一个教程中，我们编写了用于从命名队列发送和接收消息的程序。在这一个中，我们将创建一个工作队列，用于在多个Worker之间分配耗时的任务。 工作队列（又名：任务队列）主要目的是避免立即执行资源密集型任务，避免必须等待任务完成。取而代之的是，安排稍后完成任务。我们把一个任务封装成一个消息并发送给一个队列。在后台运行的工作进程将弹出任务并最终执行作业。当你运行许多Worker时，任务将在他们之间共享。 这个概念在web应用程序中特别有用，在短的HTTP请求窗口中不可能处理复杂的任务。

## 准备

在本教程的前一部分，我们发送了一个包含“Hello World！”的消息。现在我们将发送代表复杂任务的字符串。我们没有真正的任务，比如图像被重新调整大小或者渲染PDF文件，所以让我们假装我们忙——通过使用`setTimeout`方法。 我们稍微修改前面例子中的`send.js`代码，以允许从命令行发送任意消息。这个程序将安排任务到我们的工作队列，所以让我们把它命名为`new_task.js`：

```js
var q = 'task_queue';
var msg = process.argv.slice(2).join(' ') || "Hello World!";

ch.assertQueue(q, {durable: true});
ch.sendToQueue(q, new Buffer(msg), {persistent: true});
console.log(" [x] Sent '%s'", msg);
```

我们旧的`receive.js`脚本也需要进行一些更改：它需要伪造邮件正文中每个点的第二个工作。它将从队列中弹出消息并执行任务，所以我们称之为`worker.js`：

```js
ch.consume(q, function(msg) {
  var secs = msg.content.toString().split('.').length - 1;

  console.log(" [x] Received %s", msg.content.toString());
  setTimeout(function() {
    console.log(" [x] Done");
  }, secs * 1000);
}, {noAck: true});
```

请注意，我们的假任务模拟执行时间。 按照教程1运行它们：

```sh
# shell 1
./worker.js
```

```sh
# shell 2
./new_task.js
```

## 循环调度

使用任务队列的优点之一是能够轻松地平行工作。如果我们积压工作，我们可以增加更多的工人，这样可以轻松扩展。 首先，我们试着同时运行两个`worker.js`脚本。他们都会从队列中得到消息，但究竟是如何？让我们来看看。 您需要打开三个控制台。两个将运行worker.js脚本。这些控制台将是我们的两个消费者——C1和C2。

```sh
# shell 1
./worker.js
# => [*] Waiting for messages. To exit press CTRL+C
```

```sh
# shell 2
./worker.js
# => [*] Waiting for messages. To exit press CTRL+C
```

在第三个，我们将发布新的任务。一旦你开始了消费者，你可以发布一些消息：

```sh
# shell 3
./new_task.js First message.
./new_task.js Second message..
./new_task.js Third message...
./new_task.js Fourth message....
./new_task.js Fifth message.....
```

让我们看看交给我们工人的东西：

```sh
# shell 1
./worker.js
# => [*] Waiting for messages. To exit press CTRL+C
# => [x] Received 'First message.'
# => [x] Received 'Third message...'
# => [x] Received 'Fifth message.....'
```

```sh
# shell 2
./worker.js
# => [*] Waiting for messages. To exit press CTRL+C
# => [x] Received 'Second message..'
# => [x] Received 'Fourth message....'
```

默认情况下，RabbitMQ将按顺序将每条消息发送给下一个使用者。平均而言，每个消费者将获得相同数量的消息。这种分发消息的方式称为循环法（round-robin）。试试三个或更多的Worker。

## 消息确认

做任务可能需要几秒钟的时间。你可能会想知道如果其中一个消费者开始一个长期的任务，并且只是部分完成就死掉了会发生什么。使用我们当前的代码，一旦RabbitMQ向客户发送消息，立即将其标记为删除。在这种情况下，如果你杀死了一个Worker，我们将失去刚刚处理的信息，也将失去所有派发给这个特定工作人员但尚未处理的消息。 但我们不想失去任何任务。如果一个Worker死掉，我们希望将任务交付给另一个Worker。 为了确保消息永不丢失，RabbitMQ支持[消息确认](https://www.rabbitmq.com/confirms.html)。消费者发回确认（告知）告诉RabbitMQ已经收到，处理了一个特定的消息，并且RabbitMQ可以自由删除它。 如果消费者死掉（其通道关闭，连接关闭或TCP连接丢失），RabbitMQ将认为消息未被完全处理，并将重新排队。如果同时有其他消费者在线，则会迅速重新发送给另一个消费者。这样，即使Worker死掉，也可以确保没有任何信息丢失。 没有任何消息超时；当消费者死掉时，RabbitMQ将重新传递消息。即使处理消息需要非常长的时间也没关系。 在前面的例子中，消息确认是被关闭的。现在使用`{noAck：false}`来打开它们（您也可以完全删除选项），并在完成任务后从Worker发送正确的确认。

```js
ch.consume(q, function(msg) {
  var secs = msg.content.toString().split('.').length - 1;

  console.log(" [x] Received %s", msg.content.toString());
  setTimeout(function() {
    console.log(" [x] Done");
    ch.ack(msg);
  }, secs * 1000);
}, {noAck: false});
```

使用这段代码，我们可以确定，即使在处理消息的时候使用`CTRL+C`来杀死一个Worker，也不会丢失任何东西。Worker死后不久，所有未确认的消息将被重新发送。

> **忘记确认** 丢掉`ack`是一个常见的错误。这个错误很容易发生，但是后果很严重。当你的客户退出时（这可能看起来像随机的重新传递），消息将被重新传递，但是RabbitMQ将会消耗越来越多的内存，因为它将不能释放任何未被确认的消息。

为了调试这种错误，你可以使用非`rabbitmqctl`打印`messages_unacknowledged`字段：

    sudo rabbitmqctl list_queues name messages_ready messages_unacknowledged


在Windows上去掉`sudo`：

    rabbitmqctl.bat list_queues name messages_ready messages_unacknowledged


## 消息持久性

我们已经学会了如何确保即使消费者死掉，任务也不会丢失。但是如果RabbitMQ服务器停止，我们的任务仍然会丢失。 除非我们设置好，否则当RabbitMQ退出或崩溃时，它会忘记队列和消息。需要做两件事来确保消息不会丢失：我们需要将队列和消息标记为持久。 首先，我们需要确保RabbitMQ永远不会失去队列。为了做到这一点，我们需要宣布它是持久的：

```js
ch.assertQueue('hello', {durable: true});
```

虽然这个命令本身是正确的，但是在我们目前的设置中不起作用。这是因为我们已经定义了一个名为`hello`的队列，这个队列并不具有持久性。RabbitMQ不允许你使用不同的参数重新定义一个已经存在的队列，并且会向任何尝试这样做的程序返回一个错误。但有一个快速的解决方法——声明一个不同名称的队列，例如`task_queue`：

```js
ch.assertQueue('task_queue', {durable: true});
```

这个`durable`的选项更改需要应用于生产者和消费者代码。 此时我们确信，即使RabbitMQ重新启动，`task_queue`队列也不会丢失。现在我们需要将消息标记为持久的——通过使用`Channel.sendToQueue`持久选项。

```js
ch.sendToQueue(q, new Buffer(msg), {persistent: true});
```

> **注意消息持久性** 将消息标记为永久并不能完全保证消息不会丢失。尽管它告诉RabbitMQ将消息保存到磁盘，但是当RabbitMQ接收到消息并且还没有保存消息时，仍然有一个很短的时间窗口。此外，RabbitMQ不会为每个消息执行`fsync(2)`——它可能只是保存到缓存中，而不是写入磁盘。持久性保证不强，但对于我们简单的任务队列已经足够了。如果您需要更强大的保证，那么您可以使用发布者确认。

## 公平调度

您可能已经注意到调度仍然不能按照我们的要求工作。例如在有两个Worker的情况下，当所有第奇数个消息都很重且第偶数个消息都很轻的时候，一个Worker就会一直很忙，而另一个Worker几乎不会做任何工作。然而，RabbitMQ不知道任何有关的信息，并将仍然均匀地发送消息。 发生这种情况是因为RabbitMQ只在消息进入队列时调度消息。它没有考虑消费者未确认消息的数量。它只是盲目地把第n条消息分发给第n个消费者。 

![](/assets/blog/2018-02/prefetch-count.png) 

为了解决这个问题，我们可以使用值为1的`prefetch`方法。这告诉RabbitMQ一次不能给一个Worker多个消息。或者换句话说，在处理完前一个消息之前，不要向Worker发送新消息，它会将新消息分派给下一个还不忙的Worker。

```js
ch.prefetch(1);
```

> **关于队列大小的说明** 如果所有的Worker都很忙，你的队伍就可能填满了。你可能想要会增加更多的Worker，或者有其他的策略。

## 全部代码

`new_task.js`的最终代码：

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'task_queue';
    var msg = process.argv.slice(2).join(' ') || "Hello World!";

    ch.assertQueue(q, {durable: true});
    ch.sendToQueue(q, new Buffer(msg), {persistent: true});
    console.log(" [x] Sent '%s'", msg);
  });
  setTimeout(function() { conn.close(); process.exit(0) }, 500);
});
```

`work.js`

```js
#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'task_queue';

    ch.assertQueue(q, {durable: true});
    ch.prefetch(1);
    console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q);
    ch.consume(q, function(msg) {
      var secs = msg.content.toString().split('.').length - 1;

      console.log(" [x] Received %s", msg.content.toString());
      setTimeout(function() {
        console.log(" [x] Done");
        ch.ack(msg);
      }, secs * 1000);
    }, {noAck: false});
  });
});
```

使用消息确认和`prefetch`可以设置一个工作队列。即使RabbitMQ重新启动，持久性选项也能让任务继续存在。 有关Channel方法和消息属性的更多信息，可以浏览[amqplib文档](https://www.squaremobius.net/amqp.node/channel_api.html)。 现在我们可以继续阅读教程3，并学习如何向许多消费者传递相同的消息。
