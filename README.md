Office Bot
==========

Authorizes with google's calendar api and finds your next event.

Features lots of nasty hacks and terrible ways to do things.

Required env vars:

* `SLACK_API_KEY`
* `GOOGLE_CLIENT_SECRET`
* `GOOGLE_CLIENT_ID`
* `GOOGLE_REDIRECT_URLS` (seperate urls with `|`)

Example:


    k [19:47]
    where is my next meeting?

    office-bot [19:47]
    It is @ ​*Some meeting room*​ in 12 minutes - Summary: Blast shields
