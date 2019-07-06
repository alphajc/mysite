+++
{{ $date := .Date }}
author = "Jerry Chan"
categories = [""]
tags = []
date = "{{ $date }}"
description = ""
featured = ""
featuredalt = ""
featuredpath = "assets/blog/{{ printf "%d-%02d" (time $date).Year (time $date).Month }}"
title = "{{ replace .Name "_" " " | title }}"
type = "post"

+++
