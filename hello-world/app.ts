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
import { DynamoDBDocumentClient, GetCommandOutput, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBCRUDs } from './dynamodbQueries';
import { ulid } from "ulid"

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
      const userId = jsonObject.user_id;
      const reminderId = jsonObject.reminder_id;
      const message = jsonObject.text;

      await lineClient.pushMessage({
        to: userId,
        messages: [
          {
            type: 'text',
            text: `提醒您: ${message}`
          }
        ]
      })

      DynamoDBCRUDs.updateReminderStatus(userId, reminderId, 'sent')
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
          
          

          console.log('-------------------------------');
          console.log(firstEvent);
          //console.log(getUser);
          //console.log(getUser.Item?.scheduled_reminders_count < 3);
          if (firstEvent.message.text.startsWith('/list')) {
            const scheduledReminders = await DynamoDBCRUDs.scheduledReminders(userId);
            //console.log(scheduledReminders);
            scheduledReminders.Items?.map((item) => console.log(item.scheduled_at));
            
            
            if (scheduledReminders.Items != undefined) {
              const sortedScheduledReminders = scheduledReminders.Items.sort((item1, item2) => item1.scheduled_at.N - item2.scheduled_at.N);
              
              await lineClient.pushMessage({
                to: userId,
                messages: [
                  {
                    type: 'template',
                    altText: 'Confirm alt text',
                    template: {
                      type: 'buttons',
                      text: 'All scheduled reminders',
                      actions: sortedScheduledReminders.map((item) => {
                        return {
                          type: 'postback',
                          label: `${item.message.S}, ${item.scheduled_at.N}`,
                          data: `mmm`
                        }
                      })
                    }
                  }
                ]
              })
            }
          } else if (firstEvent.message.text.startsWith('/remind ')) {
            const getUser: GetCommandOutput = await DynamoDBCRUDs.getUser(userId)
            if (!getUser.Item || getUser.Item?.scheduled_reminders_count < 3) {
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
          }
          break;
        case 'postback':
          const text = firstEvent.postback.data;
          const time = firstEvent.postback.params.datetime //2023-11-05T19:48
          const newUserId = firstEvent.source.userId;
          const timeWithZone = DateTime.fromFormat(time, "yyyy-MM-dd'T'HH:mm", { zone: 'Australia/Sydney'} )
          
          const getUserResult: GetCommandOutput = await DynamoDBCRUDs.getUser(newUserId)
          
          if (!getUserResult.Item) {
            await DynamoDBCRUDs.insertUser(newUserId)
          }

          const reminderId = ulid();

          await DynamoDBCRUDs.insertReminder(
            newUserId,
            reminderId,
            text,
            timeWithZone.toSeconds(),
          )

          await DynamoDBCRUDs.updateUserRemindersCount(newUserId, 1)
          
          /*
          const res = await qstashClient.publishJSON({
            topic: "reminders-tw",
            notBefore: timeWithZone.toSeconds(),
            body: {
              type: 'qstash',
              user_id: userId,
              reminder_id: reminderId,
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
