---
title: 使用LDAP的各种客户端进行统一身份认证
date: 2019-11-30T14:20:59+08:00
hero: /assets/images/posts/tools/LDAP-Injection.jpg
author:
  name: Jerry Chan
  image: /assets/images/portrait.jpg
categories:
- tools
tags:
- ldap
- openldap
---


本文主要讲客户端的配置及部署，不含服务器，这里的一切都是以服务器端正确配置为前提的，有关内容后续会一步步完善，将包括 Linux 登录、gitlab、sonarqube、habor、nginx、pypiserver、verdaccio 等等。

## Linux 篇

### 前提

- 一个或一组完备的 LDAP 服务端

### 步骤

在 linux 上配置 LDAP 认证其实有很多种方式，这里我仅挑一种我认为最简单的方式。以 CentOS 为例:

1. 安装依赖

    ```bash
    yum install libselinux-python nss-pam-ldapd -y
    ```

2. 客户端配置

    ```bash
    authconfig --enableshadow \
    --disablesssd \
    --disablesssdauth \
    --enableldap \
    --enableldapauth \
    --ldapserver=LDAP_SERVER \
    --ldapbasedn="BASE_DN" \
    --enableldaptls \
    --enablecache \
    --enablelocauthorize \
    --enablemkhomedir \
    --updateall
    ```

    > 注：将 LDAP_SERVER 替换为真实的地址，如果需要配置多个，则以半角逗号(,)隔开，确保 BASE_DN 为祖先结点，如我们的用户信息存在于`ou=People,dc=example,dc=com`下，用户分组信息位于`ou=Group,dc=example,dc=com`下，仔细观察会发现我们需要的认证信息都位于`dc=example,dc=com`下，所以`dc=example,dc=com`作为 BASE_DN 是个不错的选择。`--enableldaptls`视自己的服务端是否配了证书而定。

3. 单独配置 sudo

    ```bash
    cat << EOF >> /etc/sudo-ldap.conf
    uri <LDAP_SERVER>
    sudoers_base <SUDOER_BASE>
    EOF
    ```

    > 默认安装的 LDAP Server 中，没有 sudoer 的 schema，需要手动导入，真实配置了`ou=SUDOer,dc=example,dc=com`才会有效，并将<SUDOER_BASE>替换为`ou=SUDOer,dc=example,dc=com`。

4. 配置命名交换文件

    在文件中加入或者修改这么一行：
    ```
    sudoers: files ldap
    ```
    以确保在使用 sudo 权限的时候，ldap 会成为其验证来源

5. 启动 nslcd

    - CentOS6

        ```bash
        service nslcd start
        chkconfig nslcd --add
        chkconfig nslcd on --level 2,3,4,5
        ```

    - CentOS7

        ```bash
        systemctl enable nslcd
        systemctl start nslcd
        ```
