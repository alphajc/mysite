+++
author = "西索oO"
date = "2019-07-07T08:19:54+08:00"
tags = ["LDAP", "OpenLDAP", "Linux", "CentOS", "CentOS6"]
categories = ["技术"]
description = "文章转载自互联网，供自己学习参考"
link = "https://blog.51cto.com/lansgg/1544951"
linktitle = "原文链接"
featured = ""
featuredalt = ""
featuredpath = ""
format = "51cto博客"
title = "在CentOS6.5上布署OpenLDAP"
type = "archive"

+++

本文系统：Centos6.5_x64

ip:192.168.28.139

客户端：192.168.28.141


推荐大家可以先了解下AD域的结构，一些概念性的东西，比如树、林、组织单位、资源等

openldap 可以看作是nis的升级，把他想象成资料库的一种就好了

# 一、ldap的部署、用户信息的存储

1. 安装openldap

        [root@master ~]# yum install openldap openldap-devel openldap-servers openldap-clients -y

2. 配置文件模版

        [root@master ~]# cp /usr/share/openldap-servers/slapd.conf.obsolete /etc/openldap/slapd.conf

    修改配置文件

        [root@master ~]# vim /etc/openldap/slapd.conf
        26 pidfile         /var/run/openldap/slapd.pid
        27 argsfile        /var/run/openldap/slapd.args
        28 loglevel        1
        115 suffix          "dc=lansgg,dc=com"
        117 rootdn          "cn=admin,dc=lansgg,dc=com"
        121 rootpw          adminpw

    这里管理员的密码使用了明文，也可以使用加密形式，方法如下：

        [root@master ~]# slappasswd 
        New password: 
        Re-enter new password: 
        {SSHA}7EJGErpaeX3Zd6rxfxVzNVwSm2UC1e/T

    将密文串替换成adminpw即可；

    你也可以指定加密方式：

        [root@master ~]# slappasswd -h {md5}
        New password: 
        Re-enter new password: 
        {MD5}cOdqFdoA5jAa3nGMyUFveQ==

    loglevel表示日志级别：这里为1，表示所有日志；一般正式环境配置256即可

        -1 记录所有的信息
        0 不记录debug
        1 跟踪功能调用的信息
        2 包处理的debug信息
        4 丰富的debug信息
        8 连接管理信息
        16 包的收发信息
        32 搜索过滤的处理过程
        64 配置文件的处理过程
        128 访问控制列表处理过程
        256 连接、操作及其结果的统计数据
        512 向客户端返回的结果的统计信息
        1024 与shell后端的通信信息
        2048 显示记录条目的分析信息
        4096 数据库缓存处理信息
        8192 数据库索引
        16384 从服务器数据同步资源消耗处理信息

    配置ldap日志输出

        [root@master ~]# vim /etc/rsyslog.conf
        ## ldap
        local4.*                                                /var/log/ldap.log
        [root@master ~]# /etc/init.d/rsyslog restart
        [root@master ~]# /etc/init.d/slapd start
        正在启动 slapd：                                           [确定]
        [root@master ~]# netstat -natpul |grep slapd
        tcp        0      0 0.0.0.0:389                 0.0.0.0:*                   LISTEN      53482/slapd         
        tcp        0      0 :::389                      :::*                        LISTEN      53482/slapd
    
    拷贝数据文件

        [root@master openldap]# cp /usr/share/openldap-servers/DB_CONFIG.example /var/lib/ldap/DB_CONFIG
        [root@master ~]# chown ldap:ldap /var/lib/ldap/DB_CONFIG
        [root@master openldap]# /etc/init.d/slapd restart

    推荐步骤：

        [root@master ~]# rm /etc/openldap/slapd.d/*
        /etc/init.d/slapd restart

    没有这步，当下面导入数据的时候会报错，（49）

    测试下配置

        [root@master openldap]# slaptest -f /etc/openldap/slapd.conf -F /etc/openldap/slapd.d
        config file testing succeeded

3. 数据录入

服务器正常运作后，就可以录入信息了。信息的录入有三种方法，一种是手工录入，一种是.ldif文件格式录入，一种是脚本自动录入。

1>、手动录入：

建立DN：( Distinguished Name，每个叶子结点到根的路径就是DN)

    [root@master openldap]# ldapadd -x -D 'cn=admin,dc=lansgg,dc=com' -W
    Enter LDAP Password: 
    dn: dc=lansgg,dc=com
    objectClass: dcObject
    objectClass: organization
    dc: lansgg
    o: Corporation
    description: d Corporation
    adding new entry "dc=lansgg,dc=com"      #结束以ctrl+d

建立RDN：(Relative Distinguished Name，叶子结点本身的名字是RDN)

    [root@master openldap]# ldapadd -x -D 'cn=admin,dc=lansgg,dc=com' -W
    Enter LDAP Password: 
    dn: uid=qq,dc=lansgg,dc=com
    objectClass: person
    objectClass: organizationalPerson
    objectClass: inetOrgPerson
    uid: qq
    cn: qq
    sn: qq
    telephoneNumber: 138888888
    description: openldap test
    telexNumber: tex-8888888
    street: my street
    postOfficeBox: postofficebox
    displayName: qqdisplay
    homePhone: home1111111
    mobile: mobile99999
    mail:qq@qq.com
    adding new entry "uid=qq,dc=lansgg,dc=com"

手动已经录入，进行查看：

    [root@master ~]# ldapsearch -x -b 'dc=lansgg,dc=com' |more
    # extended LDIF
    #
    # LDAPv3
    # base <dc=lansgg,dc=com> with scope subtree
    # filter: (objectclass=*)
    # requesting: ALL
    #

    # lansgg.com
    dn: dc=lansgg,dc=com
    objectClass: dcObject
    objectClass: organization
    dc: lansgg
    o: Corporation
    description: d Corporation

    # qq, lansgg.com
    dn: uid=qq,dc=lansgg,dc=com
    objectClass: person
    objectClass: organizationalPerson
    objectClass: inetOrgPerson
    uid: qq
    cn: qq
    sn: qq
    telephoneNumber: 138888888
    description: openldap test
    telexNumber: tex-8888888
    street: my street
    postOfficeBox: postofficebox
    displayName: qqdisplay
    homePhone: home1111111
    mobile: mobile99999
    mail: qq@qq.com

    # search result
    search: 2
    result: 0 Success

    # numResponses: 3
    # numEntries:

2>、文件方式：

这里将系统帐号导出成ldif文件形式，使用MigrationTools工具

The MigrationTools are a set of Perl scripts for migrating users, groups, aliases, hosts, netgroups, networks, protocols, RPCs, and services from existing nameservices (flat files, NIS, and NetInfo) to LDAP.

    yum -y install migrationtools
    cd /usr/share/migrationtools/
    [root@master migrationtools]# vim migrate_common.ph
    70 # Default DNS domain
    71 $DEFAULT_MAIL_DOMAIN = "lansgg.com";
    72 
    73 # Default base 
    74 $DEFAULT_BASE = "dc=lansgg,dc=com";

导出：

    ./migrate_base.pl > /tmp/base.ldif
    ./migrate_passwd.pl /etc/passwd > /etc/passwd.ldif
    ./migrate_group.pl /etc/group > /etc/group.ldif

ldif文件导入ldap：

    ldapadd -x -w adminpw -D 'cn=admin,dc=lansgg,dc=com' -f /tmp/base.ldif 
    ldapadd -x -w adminpw -D 'cn=admin,dc=lansgg,dc=com' -f /tmp/passwd.ldif 
    ldapadd -x -w adminpw -D 'cn=admin,dc=lansgg,dc=com' -f /tmp/group.ldif

查看导入的数据：

    [root@master ~]# ldapsearch -x -b 'dc=lansgg,dc=com'

# 二、利用ldap数据库用户登录其他主机

意思就是客户端的登录帐号存储于ldap Server端；

客户端：  安装ldap客户端

    [root@master ~]# yum -y install openldap openldap-clients nss-pam-ldapd pam_ldap

增加BIND策略，避免LDAP无法连接时无法开机

```bash
echo "bind_policy soft" >> /etc/openldap/ldap.conf
```

自动建立主目录：

PAM提供了一个pam_mkhomedir.so的模块，当执行这个模块时，它会检查PAM客户端用户的主目录是否存在，如果不存在则自动建立。

修改/etc/pam.d/login,在pam_selinux.so下面添加一行。

    session    required     pam_mkhomedir.so skel=/etc/skel/ umask=0022

该方法特别适合使用网络账号的服务器，如使用NIS，LDAP等的域账号

也有人是这么写的：
    
    echo "session required pam_mkhomedir.so skel=/etc/skel umask=0077" >> /etc/pam.d/system-auth

## 客户端认证设置：

1. 交互式配置：

        authconfig-tui

    ![authconfig-tui](https://images.weserv.nl/?url=https://s3.51cto.com/wyfs02/M02/47/80/wKioL1P7QcfA9TSVAAFgZUAPtao238.jpg)

2. 命令行配置：

    示例：
        
        authconfig --enablemkhomedir --disableldaptls --enableldap --enableldapauth --ldapserver=ldap://192.168.28.139,ldap://10.84.126.150,ldap://192.168.200.10 --ldapbasedn="ou=Common Linux servers,dc=lansgg,dc=org"  --update

    这里配置为：

        [root@master pam.d]# authconfig --enableldap --enableldapauth --enablemkhomedir --enableforcelegacy --disablesssd --disablesssdauth --ldapserver=192.168.28.139 --ldapbasedn="dc=lansgg,dc=com" --update 
        正在启动 nslcd：                                           [确定]
        正在启动 oddjobd：                                         [确定]
        [root@master pam.d]#

    在服务端新增个测试帐号：

        useradd tom
        echo "tom" |passwd --stdin tom

    然后导出，截取出刚新增的帐号信息，编辑为新的ldif文件，我的个人、组信息分别截取到c.ldif,g.ldif；然后导入（我个人是这样的，省的写ldif文件）

        /usr/share/migrationtools/migrate_passwd.pl /etc/passwd > /tmp/mod.ldif
        /usr/share/migrationtools/migrate_group.pl /etc/group -f gol.ldif

    这是我截取的tom帐号信息

        [root@master ~]# cat c.ldif 
        dn: uid=tom,ou=People,dc=lansgg,dc=com
        uid: tom
        cn: tom
        objectClass: account
        objectClass: posixAccount
        objectClass: top
        objectClass: shadowAccount
        userPassword: {crypt}$6$SeOQGWMf$/4Zw96.1qB20Mx1xY2693u7.ct9ThfA5NdEaghtohy4ibaomKBisivPeT02sNR0LRnn6BmBPF8N06I/V8mnPk.
        shadowLastChange: 16307
        shadowMin: 0
        shadowMax: 99999
        shadowWarning: 7
        loginShell: /bin/bash
        uidNumber: 502
        gidNumber: 502
        homeDirectory: /home/tom
        [root@master ~]# cat g.ldif 
        dn: cn=tom,ou=Group,dc=lansgg,dc=com
        objectClass: posixGroup
        objectClass: top
        cn: tom
        userPassword: {crypt}x
        gidNumber: 502

    进行导入：

        [root@master ~]# ldapadd -x -D "cn=admin,dc=lansgg,dc=com" -w adminpw -f c.ldif 
        [root@master ~]# ldapadd -x -w adminpw -D 'cn=admin,dc=lansgg,dc=com' -f g.ldif 
        adding new entry "cn=tom,ou=Group,dc=lansgg,dc=com

    在服务器使用tom登录客户端（客户端是没有这个帐号的）

        [root@master ~]# ssh tom@192.168.28.143
        reverse mapping checking getaddrinfo for bogon [192.168.28.143] failed - POSSIBLE BREAK-IN ATTEMPT!
        tom@192.168.28.143's password: 
        Last login: Sat Aug 23 22:58:17 2014 from 192.168.28.139

    可以看到正确登录（需要输入密码）

# 三、快速登录主机（无需输入密码）

    cp /usr/share/doc/sudo-1.8.6p3/schema.OpenLDAP /etc/openldap/schema/sudo.schema
    vim /etc/openldap/slapd.conf
    18 include         /etc/openldap/schema/sudo.schema
    rm -rf /etc/openldap/slapd.d/*
    slaptest -f /etc/openldap/slapd.conf -F /etc/openldap/slapd.d/
    chown -R ldap:ldap /etc/openldap/slapd.d/*
    /etc/init.d/slapd restart

编辑sudo权限的ldif文件

    [root@master ~]# vim sudo.ldif

    dn: ou=sudoers,dc=lansgg,dc=com
    objectClass: top
    objectClass: organizationalUnit
    ou: sudoers

    dn: cn=defaults,ou=sudoers,dc=lansgg,dc=com
    objectClass: top
    objectClass: sudoRole
    cn: defaults
    sudoOption: !visiblepw
    sudoOption: always_set_home
    sudoOption: env_reset
    sudoOption: requiretty

    dn: cn=tom,ou=sudoers,dc=lansgg,dc=com
    objectClass: top
    objectClass: sudoRole
    cn: tom
    sudoCommand: ALL
    sudoHost: ALL
    sudoOption: !authenticate
    sudoRunAsUser: ALL
    sudoUser: tom

导入：

    [root@master ~]# ldapadd -x -w adminpw -D "cn=admin,dc=lansgg,dc=com" -f sudo.ldif 
    adding new entry "ou=sudoers,dc=lansgg,dc=com"

    adding new entry "cn=defaults,ou=sudoers,dc=lansgg,dc=com"

    adding new entry "cn=tom,ou=sudoers,dc=lansgg,dc=com"

客户端编辑：

Nsswitch.conf文件通常控制着用户(在passwd中)、口令(在shadow中)、主机IP和组信息(在group中)的搜索。下面的列表描述了nsswitch.conf文件控制搜索的大多数信息(Info项)的类型。

    vim /etc/sudo-ldap.conf
    55 #uri ldap://ldapserver
    56 uri ldap://192.168.28.139
    63 #sudoers_base ou=SUDOers,dc=example,dc=com
    64 sudoers_base ou=sudoers,dc=lansgg,dc=com

    vim /etc/nsswitch.conf 
    64 sudoers: ldap files

服务器测试：登录客户端，然后成功sudo （无需密码）

    [root@master ~]# ssh tom@192.168.28.143
    reverse mapping checking getaddrinfo for bogon [192.168.28.143] failed - POSSIBLE BREAK-IN ATTEMPT!
    tom@192.168.28.143's password: 
    Last login: Sat Aug 23 23:15:27 2014 from 192.168.28.150
    [tom@c1 ~]$ sudo su
    [root@c1 tom]#

测试成功~

管理工具也有很多，比如ldapadmin

![wKioL1P7T9uTJJS2AAMng9du-lI675.jpg](https://images.weserv.nl/?url=https://s3.51cto.com/wyfs02/M01/47/80/wKioL1P7T9uTJJS2AAMng9du-lI675.jpg)