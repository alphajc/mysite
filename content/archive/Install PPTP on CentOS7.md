+++
author = "很懒的虫"
date = "2019-07-07T10:52:34+08:00"
tags = ["PPTP", "VPN", "CentOS", "CentOS7"]
categories = ["运维"]
description = "文章转载自互联网，供自己学习参考"
link = "https://www.cnblogs.com/CoveredWithDust/p/7967036.html"
linktitle = "原文链接"
featured = ""
featuredalt = ""
featuredpath = ""
format = "博客园"
title = "CentOS7安装PPTP"
type = "archive"

+++

CentOS7安装PPTP VPN（开启firewall防火墙）

1. 准备一个CentOS7服务器

2. 检查是否支持PPTP

    ```bash
    modprobe ppp-compress-18 && echo ok #返回OK
    zgrep MPPE /proc/config.gz #返回CONFIG_PPP_MPPE=y 或 =m
    cat /dev/net/tun #返回cat: /dev/net/tun: File descriptor in bad state
    ```
    以上三条命令满足一条即为支持PPTP

3. 安装PPP

        yum install -y ppp

4. 安装PPTPD

   1. 添加EPEL源：

            wget http://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm

   2. 安装EPEL源：

            rpm -ivh epel-release-latest-7.noarch.rpm

   3. 检查是否已添加到源列表中：

            yum repolist

    1. 更新源列表：

            yum -y update
    
    2. 安装PPTPD：

            yum install -y pptpd

5. 编辑/etc/pptpd.conf设置VPN内网IP段
    
    最后IP设置改为：

    ```dns
    localip 192.168.0.1
    remoteip 192.168.0.214,192.168.0.245
    ```
 

6. 编辑/etc/ppp/options.pptpd

   1. 更改DNS项：

        ```dns
        ms-dns 8.8.8.8
        ms-dns 8.8.4.4
        ```

   2. 修改日志记录：

            nologfd
            logfile /var/log/pptpd.log

7. 编辑/etc/ppp/chap-secrets设置VPN账号密码

        用户名 pptpd 密码 *
    
    > 每个字段之间用tab键隔开  *表示用任意IP连接VPN都可以

    样例：登录账号为root 密码为123  这样写：

        root        pptpd     123         *

8. 编辑/etc/sysctl.conf修改内核参数支持内核转发

    ```ini
    net.ipv4.ip_forward = 1
    ```

    输入命令生效：`sysctl -p`

9.  修改防火墙设置：

    1.  创建规则文件：

            touch /usr/lib/firewalld/services/pptpd.xml

    2.  修改规则文件

        ```xml
        <?xml version="1.0" encoding="utf-8"?>
        <service>
            <short>pptpd</short>
            <description>PPTP</description>
            <port protocol="tcp" port="1723"/>
        </service>
        ```

    3.  启动或重启防火墙：

            systemctl start firewalld.service
            firewall-cmd --reload # 或者

    4.  添加服务：

            firewall-cmd --permanent --zone=public --add-service=pptpd

    5.  允许防火墙伪装IP：

            firewall-cmd --add-masquerade

    6.  开启47及1723端口：

            firewall-cmd --permanent --zone=public --add-port=47/tcp
            firewall-cmd --permanent --zone=public --add-port=1723/tcp

    7.  允许gre协议：

            firewall-cmd --permanent --direct --add-rule ipv4 filter INPUT 0 -p gre -j ACCEPT
            firewall-cmd --permanent --direct --add-rule ipv4 filter OUTPUT 0 -p gre -j ACCEPT

    8.  设置规则允许数据包由eth0和ppp+接口中进出

            firewall-cmd --permanent --direct --add-rule ipv4 filter FORWARD 0 -i ppp+ -o eth0 -j ACCEPT
            firewall-cmd --permanent --direct --add-rule ipv4 filter FORWARD 0 -i eth0 -o ppp+ -j ACCEPT

    9.  设置转发规则，从源地址发出的所有包都进行伪装，改变地址，由eth0发出：

            firewall-cmd --permanent --direct --passthrough ipv4 -t nat -I POSTROUTING -o eth0 -j MASQUERADE -s 192.168.0.0/24

10. 重启服务器：

    ```bash
    firewall-cmd --reload
    systemctl restart pptpd
    ```