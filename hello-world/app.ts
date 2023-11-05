import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  ClientConfig,
  MessageAPIResponseBase,
  messagingApi,
  middleware,
  MiddlewareConfig,
  webhook,
} from '@line/bot-sdk';

const clientConfig: ClientConfig = {
  channelAccessToken: 'hgLFz1jGdEYCoNuVK3zIV4nxaDp6K3/tgLnfNK3pvf2ig8tEuSyN8B9KRW9RCGIZH3QrxWzhrk3h/ig0GLyarkemnkJfWNalAVFI0hbGn7vnBeSo3IzkcE6e7CB7NNkWH4ih1Cqgtc2sPXYGpuwR/AdB04t89/1O/w1cDnyilFU=' || '',
};

const middlewareConfig: MiddlewareConfig = {
  channelAccessToken: 'hgLFz1jGdEYCoNuVK3zIV4nxaDp6K3/tgLnfNK3pvf2ig8tEuSyN8B9KRW9RCGIZH3QrxWzhrk3h/ig0GLyarkemnkJfWNalAVFI0hbGn7vnBeSo3IzkcE6e7CB7NNkWH4ih1Cqgtc2sPXYGpuwR/AdB04t89/1O/w1cDnyilFU=',
  channelSecret: '5071e5e75ecc7ea0e9db8eb67f1909b0' || '',
};

const client = new messagingApi.MessagingApiClient(clientConfig);

export const lambdaHandler = async (event: any): Promise<any> => {
  try {
    console.log(event);
    console.log(event["events"][0]);
    const events = event["events"];
    const firstEvent = events[0];
    /*
    {
      type: 'message',
      message: {
        type: 'text',
        id: '480375402586702258',
        quoteToken: 'syduXPNp_HkqIt3nRT-ELX4shBfg_eOFNJz2hbqtkxPVXSEBpflG-evKM1032u9gm29IJSXVSeehgF7zJnuh-rQ4_eAZ_5A5DknpwWmJrSZrRO5pzvPC01K3Bjb0Nq3FVrVynDLt4iQ0cvS10_jeXQ',
        text: 'The '
      },
      webhookEventId: '01HEETQC0ZXDV9EEA7RBDSYBC4',
      deliveryContext: { isRedelivery: true },
      timestamp: 1699157356324,
      source: { type: 'user', userId: 'Uf653f8e04aae9441cc3d8e6a41cfe28a' },
      replyToken: 'cad44f6a83f94635854065c79e07d14b',
      mode: 'active'
    }
    */
    

    if (firstEvent.type ==='message' && firstEvent.source.type === 'user' && firstEvent.message.text === '@toast') {
      const message = firstEvent.message.text;
      const replyToken = firstEvent.replyToken;

      await client.replyMessage({
        replyToken: replyToken as string,
        messages: [{
          type: 'text',
          text: '您需要提醒什麼事情?',
        }],
      });
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
