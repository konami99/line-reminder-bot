import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
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
  channelAccessToken: 'hgLFz1jGdEYCoNuVK3zIV4nxaDp6K3/tgLnfNK3pvf2ig8tEuSyN8B9KRW9RCGIZH3QrxWzhrk3h/ig0GLyarkemnkJfWNalAVFI0hbGn7vnBeSo3IzkcE6e7CB7NNkWH4ih1Cqgtc2sPXYGpuwR/AdB04t89/1O/w1cDnyilFU=' || '',
};

const middlewareConfig: MiddlewareConfig = {
  channelAccessToken: 'hgLFz1jGdEYCoNuVK3zIV4nxaDp6K3/tgLnfNK3pvf2ig8tEuSyN8B9KRW9RCGIZH3QrxWzhrk3h/ig0GLyarkemnkJfWNalAVFI0hbGn7vnBeSo3IzkcE6e7CB7NNkWH4ih1Cqgtc2sPXYGpuwR/AdB04t89/1O/w1cDnyilFU=',
  channelSecret: '5071e5e75ecc7ea0e9db8eb67f1909b0' || '',
};

const lineClient = new messagingApi.MessagingApiClient(clientConfig);

export const lambdaHandler = async (event: any): Promise<any> => {
  try {
    console.log(event);
    console.log(event["events"][0]);
    const events = event["events"];
    const firstEvent = events[0];

    switch (firstEvent.type) {
      case 'message':
        const message = firstEvent.message.text.split(' ')[1];
        const replyToken = firstEvent.replyToken;
        
        await lineClient.replyMessage({
          replyToken: replyToken as string,
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
        console.log('postback');
        const text = firstEvent.postback.data;
        console.log(text);
        const userId = firstEvent.source.userId;
        
        const aws_table_name = 'line-reminders';
        const aws_local_config = {
          //Provide details for local configuration
        }
        const aws_remote_config = {
          accessKeyId: 'AKIAQFFDKRTMFDQMB624',
          secretAccessKey: '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',
          region: 'us-west-2',
        }
        
        //AWS.config.update(aws_remote_config);
        const client = new DynamoDBClient({
          region: 'us-west-2' as string,
        });
        const dbDocClient = DynamoDBDocumentClient.from(client);
        const params = {
          TableName: 'line-reminders',
          Item: {
            user_id: userId,
            created_at: 199999
          }
        }
        const data = await dbDocClient.send(new PutCommand(params))
        console.log(data)
        /*
        const docClient = new AWS.DynamoDB.DocumentClient();
        const item = {
          user_id: userId,
          created_at: new Date().getTime().toString(),
        }
        var params = {
          TableName: aws_table_name,
          Item: item
        };
        */
        //docClient.put(params)
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
