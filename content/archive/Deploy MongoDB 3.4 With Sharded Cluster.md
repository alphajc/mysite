+++
author = "萧涵"
date = "2019-07-06T15:54:35+08:00"
tags = ["MongoDB","MongoDB3.4", "MongoDB Sharded Cluster"]
categories = ["信息技术"]
description = "文章转载自互联网，供自己学习参考"
link = "https://zhuanlan.zhihu.com/p/25594963"
linktitle = "原文链接"
featured = "v2-ce171d1e866d10af2ebadfb5f51249b2_1200x500.jpg"
featuredalt = ""
featuredpath = "https://pic1.zhimg.com"
format = "知乎"
title = "MongoDB3.4副本集分片集群搭建"
type = "archive"

+++

mongdb3.4 的副本集搭建与以前的版本有些区别，最主要的区别就是 configdb强制复制集(CSRS)。网上很多的教程都没有注意到这一点，所以在使用3.4版本的时候搭建不成功。

搭建时遇到不少坑，几乎放弃的情况下，借助谷歌翻译查看了官方文档，问题迎刃而解。

官方文档：[Sharding - MongoDB Manual 3.4](https://docs.mongodb.com/v3.4/sharding/)

# 一、测试环境

操作体统：VMware + ubuntu16.04 + 静态IP
mongodb版本：mongodb-3.4

# 二、布局预览

![](https://pic4.zhimg.com/80/v2-8062f692d687cad20536d3e44c1bf1fb_hd.png)

# 三、资源分配

IP分配：

1. 机器1：192.168.80.61
2. 机器2：192.168.80.62
3. 机器3：192.168.80.63
4. 机器4：192.168.80.64
5. 机器5：192.168.80.65
6. 机器6：192.168.80.66

端口分配：

- mongos：18000
- config：17000
- shard01：18001
- shard02：18002
- shard03：18003
- shard04：18004
- shard05：18005
- shard06：18006

表1:

![](https://pic2.zhimg.com/80/v2-7049f11c786ea34e9f2969c60c84ef6d_hd.png)

三台主机分别新建如下目录：

- /home/ubuntu/data/mongodb/config/data
- /home/ubuntu/data/mongodb/config/log/
- /home/ubuntu/data/mongodb/mongos/log

六台机器分别创建 表1 对应的分片，每台机器三个分片

- /home/ubuntu/data/mongodb/shard0X/data
- /home/ubuntu/data/mongodb/shard0X/log

# 四、启动配置服务器

这是最关键的一步，网上一些教程报错的主要原因就在于congfigsvr配置不是针对版本3.4分别

1. 在每一台路由机器上启动配置服务器（非第一次启动加`--logappend`）

    mongod –configsvr --replSet cfgsvr –port 17000 –dbpath /home/ubuntu/data/mongodb/config/data  --logpath /home/ubuntu/data/mongodb/config/log/config.log –fork

2. 登录任意一台配置服务器，初始化配置副本集

    mongo 127.0.0.1:17000

    > config = {_id:"cfgsvr", configsvr:true, members:[

    {_id:0, host:"192.168.80.61:17000"},

    {_id:0, host:"192.168.80.62:17000"},

    {_id:0, host:"192.168.80.63:17000"}

    ]}

    > rs.initiate(config)

# 五、启动分片

分别在每台机器上启动的设计的分片（例见上图）shardxx、shardxx、shardxx。（非第一次启动加`--logappend`）

__#Shard01__：

    mongod --shardsvr --replSet shard01 --port 18001 --dbpath /home/ubuntu/data/mongodb/shard01/data --logpath /home/ubuntu/data/mongodb/shard01/log/shard01.log --fork

__#Shard02__：

    mongod --shardsvr --replSet shard02 --port 18002 --dbpath /home/ubuntu/data/mongodb/shard02/data --logpath /home/ubuntu/data/mongodb/shard02/log/shard02.log --fork

__#Shard03__：

    mongod --shardsvr --replSet shard03 --port 18003 --dbpath /home/ubuntu/data/mongodb/shard03/data --logpath /home/ubuntu/data/mongodb/shard03/log/shard03.log --fork

__#Shard04__：

    mongod --shardsvr --replSet shard04 --port 18004 --dbpath /home/ubuntu/data/mongodb/shard04/data --logpath /home/ubuntu/data/mongodb/shard04/log/shard04.log --fork

__#Shard05__：

    mongod --shardsvr --replSet shard05 --port 18005 --dbpath /home/ubuntu/data/mongodb/shard05/data --logpath /home/ubuntu/data/mongodb/shard05/log/shard05.log --fork

__#Shard06__：

    mongod --shardsvr --replSet shard06 --port 18006 --dbpath /home/ubuntu/data/mongodb/shard06/data --logpath /home/ubuntu/data/mongodb/shard06/log/shard06.log --fork

# 六、启动mongos服务器

分别在每一台路由机器上启动mongos服务器，（非第一次启动加`--logappend`）注意命令：`mongos`不是`mongod`

    mongos --configdb cfgsvr/192.168.80.61:17000, 192.168.80.62:17000, 192.168.80.63:17000 --port 18000 --logpath /home/ubuntu/data/mongodb/mongos/log/mongos.log --fork

# 七、初始化分片

在任一机器（机器上有对应shardxx即可，可在1、4号机器），通过分片端口登陆分片，并初始化分片

__#Shard01__：

    mongo 127.0.0.1:18001

    > use admin

    > config = { _id:"shard01", members:[

    {_id:0,host:"192.168.80.61:18001"},

    {_id:1,host:"192.168.80.66:18001"},

    {_id:2,host:"192.168.80.65:18001"}]

    }

    > rs.initiate(config)

__#Shard02__：

    mongo 127.0.0.1:18002

    > use admin

    > config = { _id:"shard02", members:[

    {_id:0,host:"192.168.80.62:18002"},

    {_id:1,host:"192.168.80.61:18002"},

    {_id:2,host:"192.168.80.66:18002"}]

    }

    > rs.initiate(config)

__#Shard03__：

    mongo 127.0.0.1:18003

    > use admin

    > config = { _id:"shard03", members:[

    {_id:0,host:"192.168.80.63:18003"},

    {_id:1,host:"192.168.80.62:18003"},

    {_id:2,host:"192.168.80.61:18003"}]

    }

    > rs.initiate(config)

__#Shard04__：

    mongo 127.0.0.1:18004

    > use admin

    > config = { _id:"shard04", members:[

    {_id:0,host:"192.168.80.64:18004"},

    {_id:1,host:"192.168.80.63:18004"},

    {_id:2,host:"192.168.80.62:18004"}]

    }

    > rs.initiate(config)

__#Shard05__：

    mongo 127.0.0.1:18005

    > use admin

    > config = { _id:"shard05", members:[

    {_id:0,host:"192.168.80.65:18005"},

    {_id:1,host:"192.168.80.64:18005"},

    {_id:2,host:"192.168.80.63:18005"}]

    }

    > rs.initiate(config)

__#Shard06__：

    mongo 127.0.0.1:18006

    > use admin

    > config = { _id:"shard06", members:[

    {_id:0,host:"192.168.80.66:18006"},

    {_id:1,host:"192.168.80.65:18006"},

    {_id:2,host:"192.168.80.64:18006"}]

    }

    > rs.initiate(config)

# 八、启用分片

登陆mongos，添加所有分片

    mongo 127.0.0.1:18000

    > use  admin
    > sh.addShard("shard01/192.168.80.61:18001,192.168.80.66:18001,192.168.80.65:18001"})
    > sh.addShard("shard02/192.168.80.62:18002,192.168.80.61:18002,192.168.80.66:18002"})
    > sh.addShard("shard03/192.168.80.63:18003,192.168.80.62:18003,192.168.80.61:18003"})
    > sh.addShard("shard04/192.168.80.64:18004,192.168.80.63:18004,192.168.80.62:18004"})
    > sh.addShard("shard05/192.168.80.65:18005,192.168.80.64:18005,192.168.80.63:18005"})
    > sh.addShard("shard06/192.168.80.66:18006,192.168.80.65:18006,192.168.80.64:18006"})

# 九、指定数据库、集合、片键

登陆mongos，这里可以选择hash分片还是range分片

    mongo 127.0.0.1:18000

    > sh.enableSharding("testdb")

    >Sh.shardCollection("testdb.table1",{id:1}})
