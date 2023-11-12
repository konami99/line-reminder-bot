import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, QueryCommand, Select } from "@aws-sdk/client-dynamodb";
import { Client } from "@upstash/qstash";
import { DateTime } from "luxon";
import {
  ClientConfig,
  MessageAPIResponseBase,
  messagingApi,
  middleware,
  MiddlewareConfig,
  webhook,
} from '@line/bot-sdk';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

/*
const clientConfig: ClientConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN as string,
};
*/


const clientConfig: ClientConfig = {
  channelAccessToken: '',
};


const lineClient = new messagingApi.MessagingApiClient(clientConfig);

/*
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN as string,
});
*/

const qstashClient = new Client({
  token: '',
});

export const lambdaHandler = async (event: any): Promise<any> => {
  try {
    console.log(event);

    /*
    production
    */
    //const jsonObject = JSON.parse(event.body);
    

    /*
    local
    */
    const events = event["events"];
    const firstEvent = events[0];
    const jsonObject = firstEvent;
    
    if (jsonObject?.type === 'qstash') {
      lineClient.pushMessage({
        to: jsonObject.user_id,
        messages: [
          {
            type: 'text',
            text: `提醒您: ${jsonObject.text}`
          }
        ]
      })

      const params = {
        TableName: 'line-reminders',
        Key: {
          user_id: { 'S': jsonObject.user_id }, // The key of the item to update
          created_at: { 'N': `${jsonObject.created_at}` },
        },
        UpdateExpression: 'SET #status = :newStatus', // Define the update expression
        ExpressionAttributeNames: {
          '#status': 'status', // Replace 'status' with the attribute to update
        },
        ExpressionAttributeValues: {
          ':newStatus': { 'S': 'sent' }, // Define the new value for the attribute
        },
      };

      const client = new DynamoDBClient({
        region: 'us-west-2' as string,
      });
      //const dbDocClient = DynamoDBDocumentClient.from(client);
      //const data = await dbDocClient.send(new UpdateCommand(params));
      await client.send(new UpdateItemCommand(params))
    } else {
      /*
      body: '{"destination":"U1f7351b944cb4b8c52529beeff107717","events":[{"type":"postback","postback":{"data":"你好嗎","params":{"datetime":"2023-11-08T21:21"}},"webhookEventId":"01HEQ76MN3HQAGCWK1B7SZFVNS","deliveryContext":{"isRedelivery":false},"timestamp":1699438875261,"source":{"type":"user","userId":"Uf653f8e04aae9441cc3d8e6a41cfe28a"},"replyToken":"9636527508bd4885999d1698450a2188","mode":"active"}]}'
      */
      
      /*
      production
      */
      //const firstEvent = jsonObject.events[0];
      

      /*
      local
      */
      //const events = event["events"];
      //const firstEvent = events[0];
      
      switch (firstEvent.type) {
        case 'message':
          const userId = firstEvent.source.userId;
          const queryItemParams = {
            TableName: 'line-reminders',
            IndexName: 'UseridStatusIndex', // Replace with your GSI name
            KeyConditionExpression: 'user_id = :uid AND #status = :status', // Define your conditions
            ExpressionAttributeNames: {
              '#status': 'status', // Replace 'status' with the attribute in the GSI
            },
            ExpressionAttributeValues: {
              ':uid': { 'S': userId},
              ':status': { 'S': 'scheduled'}, // Replace with the status value you're querying
            },
            Select: Select.COUNT
          };

          const getClient = new DynamoDBClient({
            region: 'us-west-2' as string,
          });
          //const dbDocClient = DynamoDBDocumentClient.from(client);
          //const data = await dbDocClient.send(new UpdateCommand(params));
          const numberOfItems = await getClient.send(new QueryCommand(queryItemParams))

          if (numberOfItems.Count != undefined && (numberOfItems.Count < 3)) {
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
          } else {
            await lineClient.replyMessage({
              replyToken: firstEvent.replyToken as string,
              messages: [
                {
                  type: 'text',
                  text: '您已經超過額度(3)'
                }
              ]
            });
          }
          break;
        case 'postback':
          const text = firstEvent.postback.data;
          const time = firstEvent.postback.params.datetime //2023-11-05T19:48
          const newUserId = firstEvent.source.userId;

          /*
          time = '2023-11-05T19:48'
          */
          const timeWithZone = DateTime.fromFormat(time, "yyyy-MM-dd'T'HH:mm", { zone: 'Australia/Sydney'} )
          
          const client = new DynamoDBClient({
            region: 'us-west-2' as string,
          });
          const dbDocClient = DynamoDBDocumentClient.from(client);
          const created_at = parseInt(new Date().getTime().toString())
          const params = {
            TableName: 'line-reminders',
            Item: {
              user_id: newUserId,
              created_at,
              scheduled_at: timeWithZone.toSeconds(),
              status: 'scheduled',
              message: text,
            }
          }
          

          const data = await dbDocClient.send(new PutCommand(params))
          
          /*
          const res = await qstashClient.publishJSON({
            topic: "reminders-tw",
            notBefore: timeWithZone.toSeconds(),
            body: {
              type: 'qstash',
              user_id: userId,
              created_at,
              text,
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
          break;
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
