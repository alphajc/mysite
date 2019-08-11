+++

author = "Jerry Chan"
categories = ["工具"]
tags = ["Git"]
date = "2019-08-11T16:29:00+08:00"
description = "本文将介绍如何使用 git rebase 来修改 git 的历史提交"
featured = "git.jpg"
featuredalt = ""
featuredpath = "assets/blog/2019-08"
title = "修改 Git 的历史提交"
type = "post"

+++

现在工作生活中，基本都使用 Git 用作代码的版本控制。我们应该为自己的每次 commit 提供一个合理的 log，以让自己或其他开发者明白对应的 commit 都干了些什么，但有时我们不可避免地会出错，然后就需要修改某些该死的提交。我们大可以新建一个 commit 来干这个事情，但这对于有洁癖的我来讲实在太 low 了，也不利于代码维护。Git 作为一个强大的工具，当然有解决办法啦，下面就让我们来一起探讨该如何修改过去的提交。

## 环境说明
我这里有一个 git 项目，进行过 3 次代码提交，日志如下：
```
commit 5ae91d0efae757087386c0c4b80e660e97627d22 (HEAD -> master)
Author: Jerry Chan <jerry@mydream.ink>
Date:   Sun Aug 11 20:04:43 2019 +0800

    third commit

commit 6df839cab26ce48a561192933dc28c0d9fe302db
Author: Jerry Chan <jerry@mydream.ink>
Date:   Sun Aug 11 19:57:46 2019 +0800

    second commit

commit 61aa39cfbcbab89d8e0d44c03f01f65402bd20e6
Author: Jerry Chan <jerry@mydream.ink>
Date:   Sun Aug 11 19:56:23 2019 +0800

    fist commit
```

1. 第一次，提交的时候我建了个文件`test.txt`，并写了一行内容：
    ```
    这是我第一次不应该提交的内容，但是却提交了的内容。
    ```

2. 第二次，我新建了一个文件`test2.text`，也写下了一行内容：
    ```
    这是第二次提交的内容
    ```

3. 第三次，我对前面两次创建的文件分别进行了重命名：
    ```bash
    mv test.txt test1.txt
    mv test2.text test2.txt
    ```

现在的问题在于我第一次就提交错了，正确的内容应该是：
```
这是我第一次原本应该提交的内容
```

## 操作步骤
1. 我们要回到第一次提交去进行修改。因为第一次提交前没有提交，所以没有办法指定 commit 作为基来对第一次提交进行操作。此时，我们需要使用以下命令对第一次提交进行操作：
    ```bash
    git rebase -i --root
    ```
    此时，我们将看到如下信息：
    ```
    pick 61aa39c fist commit
    pick 6df839c second commit
    pick 5ae91d0 third commit

    # 变基 5ae91d0 到 64b66ae（3 个提交）
    #
    # 命令:
    # p, pick <提交> = 使用提交
    # r, reword <提交> = 使用提交，但修改提交说明
    # e, edit <提交> = 使用提交，进入 shell 以便进行提交修补
    # s, squash <提交> = 使用提交，但融合到前一个提交
    # f, fixup <提交> = 类似于 "squash"，但丢弃提交说明日志
    # x, exec <命令> = 使用 shell 运行命令（此行剩余部分）
    # b, break = 在此处停止（使用 'git rebase --continue' 继续变基）
    # d, drop <提交> = 删除提交
    # l, label <label> = 为当前 HEAD 打上标记
    # t, reset <label> = 重置 HEAD 到该标记
    # m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]
    # .       创建一个合并提交，并使用原始的合并提交说明（如果没有指定
    # .       原始提交，使用注释部分的 oneline 作为提交说明）。使用
    # .       -c <提交> 可以编辑提交说明。
    #
    # 可以对这些行重新排序，将从上至下执行。
    #
    # 如果您在这里删除一行，对应的提交将会丢失。
    #
    # 然而，如果您删除全部内容，变基操作将会终止。
    #
    # 注意空提交已被注释掉
    ```

2. 注释里面写得很清楚，我们需要修改第一次提交，所以我们得将`pick 61aa39c fist commit`改成`edit 61aa39c fist commit`，然后保存并退出。

    此时使用`git status`，我们可以看到如下内容：
    ```
    交互式变基操作正在进行中；至 64b66ae
    最后一条命令已完成（1 条命令被执行）：
    edit 61aa39c fist commit
    接下来要执行的命令（剩余 2 条命令）：
    pick 6df839c second commit
    pick 5ae91d0 third commit
    （使用 "git rebase --edit-todo" 来查看和编辑）
    您在执行将分支 'master' 变基到 '64b66ae' 的操作时编辑提交。
    （使用 "git commit --amend" 修补当前提交）
    （当您对您的修改满意后执行 "git rebase --continue"）

    无文件要提交，干净的工作区
    ```

3. 在这一步，我们需要把内容修改成我们想要的样子。将 test.txt 的内容改为：
    ```
    这是我第一次原本应该提交的内容
    ```

4. 暂存变更
    ```
    git add test.txt
    ```

5. 把暂存区中的内容变成自己想要的样子后，对本次提交进行修补

    执行命令`git commit --amend`，我们将得到以下内容
    ```
    fist commit

    # 请为您的变更输入提交说明。以 '#' 开始的行将被忽略，而一个空的提交
    # 说明将会终止提交。
    #
    # 日期：  Sun Aug 11 19:56:23 2019 +0800
    #
    # 交互式变基操作正在进行中；至 64b66ae
    # 最后一条命令已完成（1 条命令被执行）：
    #    edit 61aa39c fist commit
    # 接下来要执行的命令（剩余 2 条命令）：
    #    pick 6df839c second commit
    #    pick 5ae91d0 third commit
    # 您在执行将分支 'master' 变基到 '64b66ae' 的操作时拆分提交。
    #
    #
    # 初始提交
    #
    # 要提交的变更：
    #       新文件：   test.txt
    #
    ```
    你可能需要修改日志，但如果不需要的话，保存并退出即可。
    ```
    [分离头指针 3baa727] fist commit
    Date: Sun Aug 11 19:56:23 2019 +0800
    1 file changed, 1 insertion(+)
    create mode 100644 test.txt
    ```
    看到上面的信息后表示，我们对本次提交的更改就已经完成了。

6. 我们得到满意的提交后，执行`git rebase --continue`，回到当前 HEAD 下。

## 注意
当我们做这种操作时，修改了的提交之后的所有的提交都会发生改变，我们必须确保这些提交没有正在被别人使用。如果你还有什么问题欢迎留言。