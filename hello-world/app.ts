import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Client } from "@upstash/qstash";
import {
  ClientConfig,
  MessageAPIResponseBase,
  messagingApi,
  middleware,
  MiddlewareConfig,
  webhook,
} from '@line/bot-sdk';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const clientConfig: ClientConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN as string,
};

/*
const middlewareConfig: MiddlewareConfig = {
  channelAccessToken: 'hgLFz1jGdEYCoNuVK3zIV4nxaDp6K3/tgLnfNK3pvf2ig8tEuSyN8B9KRW9RCGIZH3QrxWzhrk3h/ig0GLyarkemnkJfWNalAVFI0hbGn7vnBeSo3IzkcE6e7CB7NNkWH4ih1Cqgtc2sPXYGpuwR/AdB04t89/1O/w1cDnyilFU=',
  channelSecret: '5071e5e75ecc7ea0e9db8eb67f1909b0' || '',
};
*/

const lineClient = new messagingApi.MessagingApiClient(clientConfig);

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN as string,
});

export const lambdaHandler = async (event: any): Promise<any> => {
  try {
    console.log(event);

    if (event?.type === 'qstash') {
      lineClient.pushMessage({
        to: event.userId,
        messages: [
          {
            type: 'text',
            text: event.text
          }
        ]
      })
    } else {
      /*
      body: '{"destination":"U1f7351b944cb4b8c52529beeff107717","events":[{"type":"postback","postback":{"data":"你好嗎","params":{"datetime":"2023-11-08T21:21"}},"webhookEventId":"01HEQ76MN3HQAGCWK1B7SZFVNS","deliveryContext":{"isRedelivery":false},"timestamp":1699438875261,"source":{"type":"user","userId":"Uf653f8e04aae9441cc3d8e6a41cfe28a"},"replyToken":"9636527508bd4885999d1698450a2188","mode":"active"}]}'
      */
      const jsonObject = JSON.parse(event.body);
      const firstEvent = jsonObject.events[0];
      switch (firstEvent.type) {
        case 'message':
          const message = firstEvent.message.text.split(' ')[1];
          
          await lineClient.replyMessage({
            replyToken: firstEvent.replyToken as string,
            messages: [
              {
                type: 'template',
                altText: 'Confirm alt text',
                template: {
                  type: 'buttons',
                  text: `要什麼時候提醒您 "${message}"?`,
                  actions: [
                    { 
                      type: 'datetimepicker',
                      label: '點我選擇時間',
                      data: message,
                      mode: 'datetime'
                    },
                  ],
                },
              }
            ]
          });
        case 'postback':
          const text = firstEvent.postback.data;
          const userId = firstEvent.source.userId;
          
          /*
          const aws_remote_config = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
          }
          */
          /*
          const client = new DynamoDBClient({
            region: 'us-west-2' as string,
          });
          const dbDocClient = DynamoDBDocumentClient.from(client);
          const params = {
            TableName: 'line-reminders',
            Item: {
              user_id: userId,
              created_at: 399999
            }
          }
          */
          //const data = await dbDocClient.send(new PutCommand(params))
          /*
          const res = await qstashClient.publishJSON({
            url: "https://qstash.upstash.io/v2/publish/reminders-tw",
            body: {
              reminder: text,
            },
          });
          */
          await lineClient.replyMessage({
            replyToken: firstEvent.replyToken as string,
            messages: [
              {
                type: 'text',
                text: `好, 我會提醒您 "${text}"`
              }
            ]
          });
      }
    }

    return {
      statusCode: 200,
    };
  } catch (err) {
    console.log(err);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'some error happened',
      }),
    };
  }
};
