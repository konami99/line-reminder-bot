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

// 604000 = 7days
const QSTASH_THRESHOLD_SECONDS = 604000;

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

const englishDayToChineseDay = (input: string) => {
  switch(input) {
    case 'Monday': {
      return '一'
      break;
    }
    case 'Tuesday': {
      return '二'
      break;
    }
    case 'Wednesday': {
      return '三'
      break;
    }
    case 'Thursday': {
      return '四'
      break;
    }
    case 'Friday': {
      return '五'
      break;
    }
    case 'Saturday': {
      return '六'
      break;
    }
    default: {
      return '日'
      break;
    }
  }
}

const stringToHash = (input: string) => {
  const pairs = input.split('&');
  var resultObject: Record<string, string> = {};

  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    resultObject[pair[0]] = pair[1];
  }
  return resultObject;
}

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
      const scheduledTimeInSeconds = jsonObject.scheduled_time_in_seconds;
      const nextTimeInSeconds = jsonObject.next_time_in_seconds;

      console.log('scheduledTimeInSeconds')
      console.log(scheduledTimeInSeconds);
      console.log('nextTimeInSeconds')
      console.log(nextTimeInSeconds);

      if (scheduledTimeInSeconds === nextTimeInSeconds) {
        const reminder = await DynamoDBCRUDs.getReminder(
          `UR#${userId}`,
          `REMINDER#${reminderId}`
        );

        if (reminder.Item?.gsi1sk.S === 'scheduled') {
          await lineClient.pushMessage({
            to: userId,
            messages: [
              {
                type: 'text',
                text: `提醒您: ${message}`
              }
            ]
          })
          await DynamoDBCRUDs.updateUserRemindersCount(userId, -1)
          await DynamoDBCRUDs.updateReminderStatus(userId, reminderId, 'sent')
        }
      } else {
        const timeDiff = scheduledTimeInSeconds - nextTimeInSeconds;
        if (timeDiff > QSTASH_THRESHOLD_SECONDS) {
          const next_time_in_seconds = nextTimeInSeconds + QSTASH_THRESHOLD_SECONDS;

          await qstashClient.publishJSON({
            topic: "reminders-tw",
            notBefore: next_time_in_seconds,
            body: {
              type: 'qstash',
              user_id: userId,
              reminder_id: reminderId,
              scheduled_time_in_seconds: scheduledTimeInSeconds,
              next_time_in_seconds,
              text: message,
            },
          });
        } else {
          await qstashClient.publishJSON({
            topic: "reminders-tw",
            notBefore: scheduledTimeInSeconds,
            body: {
              type: 'qstash',
              user_id: userId,
              reminder_id: reminderId,
              scheduled_time_in_seconds: scheduledTimeInSeconds,
              next_time_in_seconds: scheduledTimeInSeconds,
              text: message,
            },
          });
        }
      }
    } else {
      /*
      body: '{"destination":"U1f7351b944cb4b8c52529beeff107717","events":[{type:"postback","postback":{"data":"你好嗎","params":{"datetime":"2023-11-08T21:21"}},"webhookEventId":"01HEQ76MN3HQAGCWK1B7SZFVNS","deliveryContext":{"isRedelivery":false},"timestamp":1699438875261,"source":{type:"user","userId":"Uf653f8e04aae9441cc3d8e6a41cfe28a"},"replyToken":"9636527508bd4885999d1698450a2188","mode":"active"}]}'
      */
      
      /*
      production
      */
      //const firstEvent = jsonObject.events[0];
      
      switch (firstEvent.type) {
        case 'message':
          const userId = firstEvent.source.userId;
          
          

          console.log('-------------------------------');
          console.log(firstEvent);
          //console.log(getUser);
          //console.log(getUser.Item?.scheduled_reminders_count < 3);
          if (firstEvent.message.text === '查詢提醒') {
            const scheduledReminders = await DynamoDBCRUDs.scheduledReminders(userId);
            //console.log(scheduledReminders);
            scheduledReminders.Items?.map((item) => console.log(item.scheduled_at));
            
            console.log('>>>>>>>>>');
            console.log(scheduledReminders)
            if (scheduledReminders.Items != undefined && scheduledReminders.Items.length == 0) {
              await lineClient.replyMessage({
                replyToken: firstEvent.replyToken as string,
                messages: [
                  {
                    type: 'text',
                    text: '目前無任何預約停醒'
                  }
                ]
              })
            } else if (scheduledReminders.Items != undefined && scheduledReminders.Items.length > 0) {
              const sortedScheduledReminders = scheduledReminders.Items.sort((item1, item2) => item1.scheduled_at.N - item2.scheduled_at.N);
              
              await lineClient.replyMessage({
                replyToken: firstEvent.replyToken as string,
                messages: [
                  {
                    type: "flex",
                    altText: "test",
                    contents: {
                      type: "carousel",
                      contents: sortedScheduledReminders.map((item) => {
                        const seconds = item.scheduled_at.N as string;
                        const secondsToZone = DateTime.fromSeconds(parseInt(seconds)).setZone('Australia/Sydney')
                        const day = englishDayToChineseDay(secondsToZone.toFormat('EEEE'))
                        const formattedSecondsToZone = secondsToZone.toFormat(`M月d日(${day}) h:mm a`);

                        return {
                          type: "bubble",
                          body: {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                              {
                                type: 'text',
                                text: item.message.S,
                                weight: 'bold',
                                size: 'xl',
                              },
                              {
                                type: 'box',
                                layout: 'vertical',
                                margin: 'lg',
                                spacing: 'sm',
                                contents: [
                                  {
                                    type: 'text',
                                    text: formattedSecondsToZone,
                                    wrap: true,
                                    size: 'sm'
                                  }
                                ]
                              }
                            ]
                          },
                          footer: {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                              {
                                type: 'button',
                                action: {
                                  type: 'postback',
                                  label: '取消提醒',
                                  displayText: '取消提醒',
                                  data: `action=update_reminder_status&user_id=${item.pk.S.split('#')[1]}&reminder_id=${item.sk.S.split('#')[1]}&status=completed`
                                }
                              }
                            ]
                          }
                        }
                      })
                    }
                  }
                ]
              })
            }
          } else if (firstEvent.message.text === '新增提醒') {
            await lineClient.replyMessage({
              replyToken: firstEvent.replyToken as string,
              messages: [
                {
                  type: 'text',
                  text: '請輸入提醒事項',
                }
              ]
            });

          } else {
            const getUser: GetCommandOutput = await DynamoDBCRUDs.getUser(userId)
            if (!getUser.Item || getUser.Item?.scheduled_reminders_count < 100) {
              const message = firstEvent.message.text;
              
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
                          label: '輸入時間',
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
          console.log(firstEvent);

          const postbackData = firstEvent.postback.data;
          const resultObject = stringToHash(postbackData);
          console.log(postbackData);

          if (resultObject.action != undefined && resultObject.action == 'update_reminder_status') {
            console.log('update_reminder_status');

            await DynamoDBCRUDs.updateReminderStatus(resultObject.user_id, resultObject.reminder_id, resultObject.status)
            await DynamoDBCRUDs.updateUserRemindersCount(resultObject.user_id, -1)
            await lineClient.pushMessage({
              to: resultObject.user_id,
              messages: [
                {
                  type: 'text',
                  text: '好的, 取消提醒'
                }
              ]
            })

          } else if (resultObject.action != undefined && resultObject.action == 'edit_reminder') {
            console.log('edit');
            const reminder = await DynamoDBCRUDs.getReminder(resultObject.pk, resultObject.sk);
            console.log(reminder);
            const userId = reminder.Item?.pk.S?.split('#')[1] as string;
            const reminderId = reminder.Item?.sk.S?.split('#')[1] as string;
            const seconds = reminder.Item?.scheduled_at.N as string;
            const secondsToZone = DateTime.fromSeconds(parseInt(seconds)).setZone('Australia/Sydney')
            const formattedSecondsToZone = secondsToZone.toFormat('dd/MM H:mm');

            await lineClient.pushMessage({
              to: userId,
              messages: [
                {
                  type: 'template',
                  altText: 'Confirm alt text',
                  template: {
                    type: 'buttons',
                    text: `${reminder.Item?.message.S} 在${formattedSecondsToZone}`,
                    actions: [
                      {
                        type: 'postback',
                        label: '完成',
                        displayText: '完成',
                        data: `action=update_reminder_status&user_id=${userId}&reminder_id=${reminderId}&status=completed`
                      }
                    ]
                  }
                }
              ]
            })

          } else {
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
            
            const currentTimeInSeconds = Math.round(new Date().getTime() / 1000);
            const scheduledTimeInSeconds = timeWithZone.toSeconds();

            //604800 = 168 hours
            if (scheduledTimeInSeconds - currentTimeInSeconds > QSTASH_THRESHOLD_SECONDS) {
              const next_time_in_seconds = currentTimeInSeconds + QSTASH_THRESHOLD_SECONDS;

              await qstashClient.publishJSON({
                topic: "reminders-tw",
                notBefore: next_time_in_seconds,
                body: {
                  type: 'qstash',
                  user_id: newUserId,
                  reminder_id: reminderId,
                  scheduled_time_in_seconds: scheduledTimeInSeconds,
                  next_time_in_seconds,
                  text,
                },
              });
            } else {
              await qstashClient.publishJSON({
                topic: "reminders-tw",
                notBefore: scheduledTimeInSeconds,
                body: {
                  type: 'qstash',
                  user_id: newUserId,
                  reminder_id: reminderId,
                  scheduled_time_in_seconds: scheduledTimeInSeconds,
                  next_time_in_seconds: scheduledTimeInSeconds,
                  text,
                },
              });
            }
            
            
            
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
