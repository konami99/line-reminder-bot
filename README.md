# line-reminder-bot

![linebot](https://github.com/konami99/line-reminder-bot/assets/166879/7dce942a-2dab-46a7-84fe-9fe64d001939)

This repo creates a LINE Bot. Enter the date and text you want to be reminded of. When the time arrives this Bot will remind you. Similar to Slack reminder.

I've created a [front page](https://memorytoast.tamsui.xyz/) for this Bot.

# Test Locally

You need to have Docker engine running on your local.
```
cd hello-world
npm install
cd ..
sam build
sam local start-lambda 
```
After Lambda is started, start ngrok and point ngrok to the Lambda:
```
./ngrok http -subdomain=ezyraise -region ap 3001
```
Now your local LINE Bot is connected to the internet.

Point the LINE Webhook URL to the ngrok.

![linebot1](https://github.com/konami99/line-reminder-bot/assets/166879/0be6cb65-d648-4c87-a1e1-2f5340218ebb)

Now you can add the LINE Bot to your phone, start interacting with it. All the messages will be sent to your local LINE Bot.

